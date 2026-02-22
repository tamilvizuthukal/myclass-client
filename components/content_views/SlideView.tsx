import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Content, User } from '../../types';
import { useApi } from '../../hooks/useApi';
import * as api from '../../services/api';
import { SlideIcon } from '../icons/ResourceTypeIcons';
import { ExpandIcon, ChevronLeftIcon, ChevronRightIcon } from '../icons/AdminIcons';
import { CloseIcon } from '../icons/ToastIcons';
import * as pdfjsLib from 'pdfjs-dist';

const LOCAL_WORKER_URL = '/pdf.worker.min.js';
pdfjsLib.GlobalWorkerOptions.workerSrc = LOCAL_WORKER_URL;

interface SlideViewProps {
    lessonId: string;
    user: User;
}

const useBase64ToBlobUrl = (base64String: string | undefined) => {
    const [blobUrl, setBlobUrl] = useState<string | null>(null);

    useEffect(() => {
        if (!base64String || !base64String.startsWith('data:application/pdf')) {
            setBlobUrl(null);
            return;
        }

        let url: string | null = null;
        const timer = setTimeout(() => {
            try {
                const parts = base64String.split(',');
                const base64 = parts[1];
                const binaryStr = atob(base64);
                const len = binaryStr.length;
                const bytes = new Uint8Array(len);
                for (let i = 0; i < len; i++) {
                    bytes[i] = binaryStr.charCodeAt(i);
                }
                const blob = new Blob([bytes], { type: 'application/pdf' });
                url = URL.createObjectURL(blob);
                setBlobUrl(url);
            } catch (e) {
                setBlobUrl(base64String);
            }
        }, 0);

        return () => {
            clearTimeout(timer);
            if (url) URL.revokeObjectURL(url);
        };
    }, [base64String]);

    return blobUrl;
};

const PageRenderer: React.FC<{
    pdfDoc: any;
    pageNumber: number;
}> = ({ pdfDoc, pageNumber }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isVisible, setIsVisible] = useState(false);
    const renderTaskRef = useRef<any>(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                }
            },
            { rootMargin: '50% 0px' }
        );

        if (containerRef.current) {
            observer.observe(containerRef.current);
        }

        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (!isVisible || !pdfDoc || !canvasRef.current) return;

        const renderPage = async () => {
            try {
                if (renderTaskRef.current) {
                    renderTaskRef.current.cancel();
                }

                const page = await pdfDoc.getPage(pageNumber);
                const viewport = page.getViewport({ scale: 1.5 });
                const canvas = canvasRef.current;
                const context = canvas?.getContext('2d');

                if (context && canvas) {
                    canvas.height = viewport.height;
                    canvas.width = viewport.width;
                    canvas.style.width = '100%';
                    canvas.style.height = 'auto';

                    const renderContext = {
                        canvasContext: context,
                        viewport: viewport
                    };

                    const renderTask = page.render(renderContext);
                    renderTaskRef.current = renderTask;

                    await renderTask.promise;
                }
            } catch (error) {
            }
        };

        renderPage();
    }, [isVisible, pdfDoc, pageNumber]);

    return (
        <div ref={containerRef} className="w-full bg-white shadow-sm mb-4 relative">
            <canvas ref={canvasRef} className="block w-full h-auto" />
            {!isVisible && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-50 text-gray-400">
                    <span className="text-sm">Loading Page {pageNumber}...</span>
                </div>
            )}
        </div>
    );
};

const ConsecutivePdfViewer: React.FC<{
    url: string;
    onPageClick: () => void;
    onPageDoubleClick: () => void;
    isMobile: boolean;
}> = ({ url, onPageClick, onPageDoubleClick, isMobile }) => {
    const [pdfDoc, setPdfDoc] = useState<any>(null);
    const [numPages, setNumPages] = useState(0);

    useEffect(() => {
        const loadPdf = async () => {
            try {
                const loadingTask = pdfjsLib.getDocument(url);
                const pdf = await loadingTask.promise;
                setPdfDoc(pdf);
                setNumPages(pdf.numPages);
            } catch (e) {
            }
        };
        loadPdf();
    }, [url]);

    return (
        <div className="w-full h-full overflow-y-auto bg-gray-100 dark:bg-gray-900 scroll-smooth custom-scrollbar">
            {pdfDoc && Array.from({ length: numPages }, (_, i) => i + 1).map(page => (
                <div
                    key={page}
                    className="cursor-pointer transition-transform sm:hover:scale-[1.01] touch-pan-y"
                    onClick={() => {
                        if (!isMobile) onPageClick();
                    }}
                    onDoubleClick={() => {
                        if (isMobile) onPageDoubleClick();
                    }}
                >
                    <PageRenderer pdfDoc={pdfDoc} pageNumber={page} />
                </div>
            ))}
        </div>
    );
};

const SlidePdfViewer: React.FC<{
    url: string;
    currentSlide: number;
    onPdfLoad: (pdf: any) => void;
}> = ({ url, currentSlide, onPdfLoad }) => {
    const [pdfDoc, setPdfDoc] = useState<any>(null);
    const [scale, setScale] = useState(1.0);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const renderTaskRef = useRef<any>(null);

    useEffect(() => {
        if (!url) return;
        const loadPdf = async () => {
            try {
                const loadingTask = await pdfjsLib.getDocument(url);
                const pdf = await loadingTask.promise;
                setPdfDoc(pdf);
                onPdfLoad(pdf);
            } catch (error) {
            }
        };
        loadPdf();
    }, [url, onPdfLoad]);

    useEffect(() => {
        const calculateOptimalScale = () => {
            if (!pdfDoc || !containerRef.current) return;
            const container = containerRef.current;
            const containerWidth = container.clientWidth;
            const containerHeight = container.clientHeight;

            if (containerWidth === 0 || containerHeight === 0) return;

            pdfDoc.getPage(currentSlide).then((page: any) => {
                const unscaledViewport = page.getViewport({ scale: 1.0 });
                const optimalScale = Math.min(containerWidth / unscaledViewport.width, containerHeight / unscaledViewport.height);
                setScale(optimalScale);
            });
        };
        window.addEventListener('resize', calculateOptimalScale);
        calculateOptimalScale();
        return () => window.removeEventListener('resize', calculateOptimalScale);
    }, [pdfDoc, currentSlide]);

    useEffect(() => {
        if (!pdfDoc || !canvasRef.current || !containerRef.current) return;
        const renderPage = async () => {
            try {
                if (renderTaskRef.current) renderTaskRef.current.cancel();
                const page = await pdfDoc.getPage(currentSlide);
                const viewport = page.getViewport({ scale });
                const canvas = canvasRef.current;
                const context = canvas.getContext('2d');
                if (context) {
                    canvas.height = viewport.height;
                    canvas.width = viewport.width;
                    const renderContext = { canvasContext: context, viewport: viewport };
                    const renderTask = page.render(renderContext);
                    renderTaskRef.current = renderTask;
                    await renderTask.promise;
                }
            } catch (error) {
            }
        };
        renderPage();
    }, [pdfDoc, currentSlide, scale]);

    return (
        <div ref={containerRef} className="w-full h-full flex items-center justify-center bg-white overflow-hidden select-none">
            <canvas ref={canvasRef} className="shadow-2xl max-w-full max-h-full object-contain" />
        </div>
    );
};

const FullscreenSlideViewer: React.FC<{
    content: Content;
    onClose: () => void;
}> = ({ content, onClose }) => {
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [currentSlide, setCurrentSlide] = useState(1);
    const [totalSlides, setTotalSlides] = useState(1);
    const [showControls, setShowControls] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [isLandscape, setIsLandscape] = useState(false);

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 768);
            setIsLandscape(window.innerWidth > window.innerHeight);
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const isRotated = isMobile && !isLandscape;

    useEffect(() => {
        let url = '';
        if (content.file?.url) url = content.file.url;
        else if (content.filePath) url = `/api/content/${content._id}/file`;
        else if (content.body && content.body.startsWith('data:application/pdf')) {
            const parts = content.body.split(',');
            const blob = new Blob([Uint8Array.from(atob(parts[1]), c => c.charCodeAt(0))], { type: 'application/pdf' });
            url = URL.createObjectURL(blob);
        }
        setPdfUrl(url);
        return () => { if (url.startsWith('blob:')) URL.revokeObjectURL(url); };
    }, [content]);

    useEffect(() => {
        const handleKeyPress = (e: KeyboardEvent) => {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') setCurrentSlide(prev => Math.max(1, prev - 1));
            else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') setCurrentSlide(prev => Math.min(totalSlides, prev + 1));
            else if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [totalSlides, onClose]);

    useEffect(() => {
        const enterFullscreen = async () => {
            try {
                if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
                if (isMobile && 'orientation' in screen && (screen.orientation as any).lock) {
                    await (screen.orientation as any).lock('landscape').catch(() => { });
                }
            } catch (e) { }
        };
        enterFullscreen();
        return () => {
            if (document.fullscreenElement) document.exitFullscreen().catch(() => { });
            if ('orientation' in screen && (screen.orientation as any).unlock) (screen.orientation as any).unlock();
        };
    }, [isMobile]);

    return (
        <div className="fixed inset-0 bg-black z-50 flex items-center justify-center overflow-hidden touch-none">
            <div className={`relative transition-all duration-300 flex items-center justify-center ${isRotated ? 'w-[100vh] h-[100vw] rotate-90' : 'w-full h-full'}`}>
                <div className="w-full h-full relative cursor-pointer select-none" onMouseEnter={() => setShowControls(true)} onMouseLeave={() => setShowControls(false)}>
                    {pdfUrl ? (
                        <SlidePdfViewer url={pdfUrl} currentSlide={currentSlide} onPdfLoad={pdf => { setTotalSlides(pdf.numPages); setCurrentSlide(1); }} />
                    ) : (
                        <div className="text-white text-center"><SlideIcon className="w-16 h-16 mx-auto mb-4 opacity-50" /><p>Loading slides...</p></div>
                    )}
                    <div className={`absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-black/50 to-transparent transition-opacity ${showControls || isRotated ? 'opacity-100' : 'opacity-0'}`}>
                        <button onClick={onClose} className="absolute top-4 right-4 bg-black/70 text-white p-2 rounded-full z-50"><CloseIcon className="w-5 h-5" /></button>
                    </div>
                    <div className={`absolute bottom-4 left-4 bg-black/70 px-4 py-2 rounded-lg text-white text-sm transition-opacity ${showControls || isRotated ? 'opacity-100' : 'opacity-0'}`}>
                        {currentSlide} / {totalSlides}
                    </div>
                </div>
            </div>
        </div>
    );
};

const SavedSlideViewer: React.FC<{ content: Content; onExpand: () => void; }> = ({ content, onExpand }) => {
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        if (content._id) {
            api.trackContentView(content._id).catch(() => { });
        }
    }, [content._id]);

    useEffect(() => {
        let url = content.file?.url || (content.filePath ? `/api/content/${content._id}/file` : '');
        if (!url && content.body?.startsWith('data:application/pdf')) {
            const parts = content.body.split(',');
            const blob = new Blob([Uint8Array.from(atob(parts[1]), c => c.charCodeAt(0))], { type: 'application/pdf' });
            url = URL.createObjectURL(blob);
        }
        if (url && url.startsWith('http') && !url.includes('cloudinary.com') && !url.includes(window.location.hostname)) {
            const API_BASE = (import.meta as any).env.VITE_API_URL || 'http://localhost:5001';
            url = `${API_BASE}/api/proxy/pdf?url=${encodeURIComponent(url)}`;
        }
        setPdfUrl(url);
        return () => { if (url.startsWith('blob:')) URL.revokeObjectURL(url); };
    }, [content]);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md relative h-full flex flex-col">
            <div className="absolute top-4 right-4 flex gap-2 z-20">
                {!isMobile && (
                    <button onClick={onExpand} className="p-2 rounded-full bg-white/50 dark:bg-black/50 hover:bg-white/80 dark:hover:bg-black/80 backdrop-blur-sm shadow-md">
                        <ExpandIcon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                    </button>
                )}
            </div>
            {!isMobile && <h2 className="text-lg p-3 font-semibold pr-24 shrink-0 text-gray-800 dark:text-white truncate">{content.title}</h2>}
            {pdfUrl ? (
                <div className="flex-1 overflow-hidden rounded border dark:border-gray-700 bg-gray-100 dark:bg-gray-900 relative">
                    <ConsecutivePdfViewer url={pdfUrl} onPageClick={onExpand} onPageDoubleClick={onExpand} isMobile={isMobile} />
                </div>
            ) : (
                <div className="flex-1 aspect-[16/9] w-full bg-gray-200 dark:bg-gray-700 rounded border flex flex-col items-center justify-center p-4">
                    <SlideIcon className="w-16 h-16 text-gray-400 mb-4" />
                    <p className="text-gray-600 dark:text-gray-300 font-semibold">Cannot display PDF</p>
                </div>
            )}
        </div>
    );
};

export const SlideView: React.FC<SlideViewProps> = ({ lessonId, user }) => {
    const { data: groupedContent, isLoading } = useApi(() => api.getContentsByLessonId(lessonId, ['slide'], true), [lessonId, user]);
    const [fullscreenContent, setFullscreenContent] = useState<Content | null>(null);
    const slides = groupedContent?.[0]?.docs || [];

    return (
        <div className="p-4 sm:p-6 lg:p-8 h-full flex flex-col overflow-hidden">
            <div className="flex justify-between items-center mb-6 shrink-0">
                <div className="flex items-center gap-3">
                    <SlideIcon className="w-8 h-8 text-blue-600" />
                    <h1 className="text-lg sm:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-blue-600 dark:from-white dark:to-blue-400">Slides</h1>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0">
                {isLoading && <div className="text-center py-10 text-gray-500">Loading slides...</div>}
                {!isLoading && slides.length > 0 && (
                    <div className="grid grid-cols-1 gap-6 pb-6 h-full">
                        {slides.map(slide => (
                            <SavedSlideViewer key={slide._id} content={slide} onExpand={() => setFullscreenContent(slide)} />
                        ))}
                    </div>
                )}
                {!isLoading && slides.length === 0 && (
                    <div className="text-center py-20 bg-white dark:bg-gray-800/50 rounded-lg">
                        <SlideIcon className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600" />
                        <p className="mt-4 text-gray-500">No slides available.</p>
                    </div>
                )}
            </div>

            {fullscreenContent && (
                <FullscreenSlideViewer content={fullscreenContent} onClose={() => setFullscreenContent(null)} />
            )}
        </div>
    );
};
