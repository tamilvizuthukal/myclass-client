import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Content, User } from '../../types';
import { useApi } from '../../hooks/useApi';
import * as api from '../../services/api';
import { SlideIcon } from '../icons/ResourceTypeIcons';
import { ExpandIcon, ChevronLeftIcon, ChevronRightIcon } from '../icons/AdminIcons';
import { CloseIcon } from '../icons/ToastIcons';
import * as pdfjsLib from 'pdfjs-dist';

// Configure worker - using local worker file
const LOCAL_WORKER_URL = '/pdf.worker.min.js';
pdfjsLib.GlobalWorkerOptions.workerSrc = LOCAL_WORKER_URL;

interface SlideViewProps {
    lessonId: string;
    user: User;
}

// Utility to convert Base64 to Blob URL for faster PDF rendering
const useBase64ToBlobUrl = (base64String: string | undefined) => {
    const [blobUrl, setBlobUrl] = useState<string | null>(null);

    useEffect(() => {
        if (!base64String || !base64String.startsWith('data:application/pdf')) {
            setBlobUrl(null);
            return;
        }

        let url: string | null = null;
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

        return () => {
            if (url) URL.revokeObjectURL(url);
        };
    }, [base64String]);

    return blobUrl;
};

// --- Single Slide Viewer (Renders exactly one page) ---
const SlidePdfViewer: React.FC<{
    url: string;
    currentSlide: number;
    onPdfLoad: (pdf: any) => void;
    containerRef: React.RefObject<HTMLDivElement | null>;
}> = ({ url, currentSlide, onPdfLoad, containerRef }) => {
    const [pdfDoc, setPdfDoc] = useState<any>(null);
    const [scale, setScale] = useState(1.0);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const renderTaskRef = useRef<any>(null);

    useEffect(() => {
        if (!url) return;
        let isMounted = true;
        pdfjsLib.getDocument(url).promise.then(pdf => {
            if (isMounted) {
                setPdfDoc(pdf);
                onPdfLoad(pdf);
            }
        }).catch(console.error);
        return () => { isMounted = false; };
    }, [url, onPdfLoad]);

    const calculateOptimalScale = useCallback(() => {
        if (!pdfDoc || !containerRef.current) return;
        const container = containerRef.current;
        pdfDoc.getPage(currentSlide).then((page: any) => {
            const unscaledViewport = page.getViewport({ scale: 1.0, rotation: page.rotate });
            const scaleX = container.clientWidth / unscaledViewport.width;
            const scaleY = container.clientHeight / unscaledViewport.height;
            setScale(Math.min(scaleX, scaleY));
        });
    }, [pdfDoc, currentSlide, containerRef]);

    useEffect(() => {
        calculateOptimalScale();
        window.addEventListener('resize', calculateOptimalScale);
        return () => window.removeEventListener('resize', calculateOptimalScale);
    }, [calculateOptimalScale]);

    useEffect(() => {
        if (!pdfDoc || !canvasRef.current) return;
        const renderPage = async () => {
            try {
                if (renderTaskRef.current) renderTaskRef.current.cancel();
                const page = await pdfDoc.getPage(currentSlide);
                const viewport = page.getViewport({ scale, rotation: page.rotate });
                const canvas = canvasRef.current!;
                const context = canvas.getContext('2d');
                if (context) {
                    // Clear canvas and set background to ensure no transparency/double layers
                    canvas.height = viewport.height;
                    canvas.width = viewport.width;
                    context.fillStyle = 'white';
                    context.fillRect(0, 0, canvas.width, canvas.height);

                    const renderContext = { canvasContext: context, viewport: viewport };
                    const renderTask = page.render(renderContext);
                    renderTaskRef.current = renderTask;
                    await renderTask.promise;
                }
            } catch (error: any) {
                if (error.name !== 'RenderingCancelledException') console.error('Error rendering page:', error);
            }
        };
        renderPage();
    }, [pdfDoc, currentSlide, scale]);

    return (
        <div className="w-full h-full flex items-center justify-center bg-black overflow-hidden select-none">
            <canvas ref={canvasRef} className="shadow-2xl max-w-full max-h-full object-contain bg-white" />
        </div>
    );
};

// --- Fullscreen Slide Viewer (The "Better" Admin version) ---
const FullscreenSlideViewer: React.FC<{
    content: Content;
    onClose: () => void;
    startPage?: number;
}> = ({ content, onClose, startPage = 1 }) => {
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [currentSlide, setCurrentSlide] = useState(startPage);
    const [totalSlides, setTotalSlides] = useState(1);
    const [showControls, setShowControls] = useState(true);
    const [touchStart, setTouchStart] = useState<number | null>(null);
    const [touchEnd, setTouchEnd] = useState<number | null>(null);
    
    const containerRef = useRef<HTMLDivElement>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Build PDF URL
    const blobUrl = useBase64ToBlobUrl(content.body && content.body.startsWith('data:application/pdf') ? content.body : undefined);
    
    useEffect(() => {
        if (content.file?.url) {
            setPdfUrl(content.file.url);
        } else if (content.filePath) {
            setPdfUrl(`/api/content/${content._id}/file`);
        } else if (blobUrl) {
            setPdfUrl(blobUrl);
        }
    }, [content, blobUrl]);

    // Update currentSlide if startPage changes
    useEffect(() => {
        setCurrentSlide(startPage);
    }, [startPage]);

    // Stabilized PDF load callback
    const handlePdfLoad = useCallback((pdf: any) => {
        setTotalSlides(pdf.numPages);
    }, []);

    // Native Fullscreen logic
    const toggleNativeFullscreen = useCallback(async () => {
        if (!containerRef.current) return;

        if (!document.fullscreenElement) {
            try {
                if (containerRef.current.requestFullscreen) {
                    await containerRef.current.requestFullscreen();
                }
                const screenObj = window.screen as any;
                if (screenObj?.orientation?.lock) {
                    await screenObj.orientation.lock('landscape').catch(() => {});
                }
            } catch (err) {
                console.error('Fullscreen failed', err);
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen().catch(() => {});
            }
        }
    }, []);

    useEffect(() => {
        const timer = setTimeout(toggleNativeFullscreen, 100);
        return () => clearTimeout(timer);
    }, [toggleNativeFullscreen]);

    useEffect(() => {
        const handleFullscreenChange = async () => {
            if (!document.fullscreenElement) {
                const screenObj = window.screen as any;
                if (screenObj?.orientation?.lock) {
                    try {
                        await screenObj.orientation.lock('portrait');
                    } catch (e) {
                        console.log('Portrait lock failed on exit:', e);
                    }
                }
                if (screenObj?.orientation?.unlock) {
                    screenObj.orientation.unlock();
                }
                onClose();
            }
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            const screenObj = window.screen as any;
            if (screenObj?.orientation?.unlock) screenObj.orientation.unlock();
        };
    }, [onClose]);

    // Controls auto-hide
    const showControlsBriefly = useCallback(() => {
        setShowControls(true);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setShowControls(false), 3000);
    }, []);

    useEffect(() => {
        showControlsBriefly();
        return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    }, [showControlsBriefly]);

    // Navigation
    const goToNext = useCallback(() => {
        setCurrentSlide(prev => Math.min(totalSlides, prev + 1));
        showControlsBriefly();
    }, [totalSlides, showControlsBriefly]);

    const goToPrev = useCallback(() => {
        setCurrentSlide(prev => Math.max(1, prev - 1));
        showControlsBriefly();
    }, [showControlsBriefly]);

    useEffect(() => {
        const handleKeyPress = (e: KeyboardEvent) => {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') goToPrev();
            else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') goToNext();
            else if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [goToPrev, goToNext, onClose]);

    const onTouchStartZone = (e: React.TouchEvent) => {
        setTouchEnd(null);
        setTouchStart(e.targetTouches[0].clientX);
        showControlsBriefly();
    };

    const onTouchMoveZone = (e: React.TouchEvent) => {
        setTouchEnd(e.targetTouches[0].clientX);
    };

    const onTouchEndZone = () => {
        if (!touchStart || !touchEnd) return;
        const distance = touchStart - touchEnd;
        if (distance > 50) goToNext();
        if (distance < -50) goToPrev();
    };

    const handleClickNavigation = (e: React.MouseEvent) => {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickPercentage = (clickX / rect.width) * 100;

        if (clickPercentage <= 25) goToPrev();
        else if (clickPercentage >= 75) goToNext();
        else showControlsBriefly();
    };

    return (
        <div
            ref={containerRef}
            className="fixed inset-0 bg-black z-[9999] flex flex-col"
            onTouchStart={onTouchStartZone}
            onTouchMove={onTouchMoveZone}
            onTouchEnd={onTouchEndZone}
            onMouseMove={showControlsBriefly}
        >
            <div
                className="w-full h-full relative cursor-pointer select-none"
                onClick={handleClickNavigation}
                onDoubleClick={toggleNativeFullscreen}
            >
                {pdfUrl ? (
                    <SlidePdfViewer
                        url={pdfUrl}
                        currentSlide={currentSlide}
                        onPdfLoad={handlePdfLoad}
                        containerRef={containerRef}
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/50">
                        <div className="text-center">
                            <SlideIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
                            <p>Loading slides...</p>
                        </div>
                    </div>
                )}

                {/* Controls Overlay */}
                <div className={`absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-black/70 to-transparent transition-opacity duration-300 z-30 flex items-center justify-end px-6 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
                    <div className="flex gap-4">
                        <button onClick={(e) => { e.stopPropagation(); toggleNativeFullscreen(); }} className="p-2 bg-black/50 rounded-full text-white hover:bg-black/70 transition-all">
                            <ExpandIcon className="w-5 h-5" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="p-2 bg-black/50 rounded-full text-white hover:bg-black/70 transition-all">
                            <CloseIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Visible Navigation Buttons */}
                <button
                    onClick={(e) => { e.stopPropagation(); goToPrev(); }}
                    disabled={currentSlide === 1}
                    className={`absolute left-4 top-1/2 -translate-y-1/2 p-4 bg-black/50 rounded-full text-white transition-opacity duration-300 z-30 disabled:opacity-0 ${showControls ? 'opacity-100' : 'opacity-0'}`}
                >
                    <ChevronLeftIcon className="w-8 h-8" />
                </button>
                <button
                    onClick={(e) => { e.stopPropagation(); goToNext(); }}
                    disabled={currentSlide === totalSlides}
                    className={`absolute right-4 top-1/2 -translate-y-1/2 p-4 bg-black/50 rounded-full text-white transition-opacity duration-300 z-30 disabled:opacity-0 ${showControls ? 'opacity-100' : 'opacity-0'}`}
                >
                    <ChevronRightIcon className="w-8 h-8" />
                </button>

                {/* Progress Bar & Counter */}
                <div className={`absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/70 to-transparent transition-opacity duration-300 z-30 flex flex-col items-center gap-2 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
                    {totalSlides > 1 && totalSlides <= 40 && (
                        <div className="flex gap-1.5 flex-wrap justify-center mb-2">
                            {Array.from({ length: totalSlides }, (_, i) => (
                                <div
                                    key={i}
                                    className={`h-1.5 rounded-full transition-all duration-300 ${i + 1 === currentSlide ? 'w-8 bg-blue-500' : 'w-1.5 bg-white/30'}`}
                                />
                            ))}
                        </div>
                    )}
                    <div className="bg-black/60 px-4 py-1.5 rounded-full text-white text-sm font-semibold">
                        {currentSlide} / {totalSlides}
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- List View Components (Kept from Client for performance/style) ---
const PageRenderer: React.FC<{ pdfDoc: any; pageNumber: number }> = React.memo(({ pdfDoc, pageNumber }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isVisible, setIsVisible] = useState(false);
    const renderTaskRef = useRef<any>(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => { if (entry.isIntersecting) setIsVisible(true); },
            { rootMargin: '50% 0px' }
        );
        if (containerRef.current) observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (!isVisible || !pdfDoc || !canvasRef.current) return;
        const renderPage = async () => {
            try {
                if (renderTaskRef.current) renderTaskRef.current.cancel();
                const page = await pdfDoc.getPage(pageNumber);
                const viewport = page.getViewport({ scale: 1.5, rotation: page.rotate });
                const canvas = canvasRef.current!;
                const context = canvas.getContext('2d')!;
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                const renderTask = page.render({ canvasContext: context, viewport });
                renderTaskRef.current = renderTask;
                await renderTask.promise;
            } catch (_) {}
        };
        renderPage();
    }, [isVisible, pdfDoc, pageNumber]);

    return (
        <div ref={containerRef} className="w-full bg-white dark:bg-gray-800 shadow-sm mb-4" style={{ minHeight: 100 }}>
            <canvas ref={canvasRef} className="block w-full h-auto" />
            {!isVisible && <div className="p-10 text-center text-gray-400">Loading page...</div>}
        </div>
    );
});

const ConsecutivePdfViewer: React.FC<{ url: string; onPageClick: (page: number) => void; isMobile: boolean }> = ({ url, onPageClick, isMobile }) => {
    const [pdfDoc, setPdfDoc] = useState<any>(null);
    const [numPages, setNumPages] = useState(0);

    useEffect(() => {
        pdfjsLib.getDocument(url).promise.then(pdf => {
            setPdfDoc(pdf);
            setNumPages(pdf.numPages);
        }).catch(console.error);
    }, [url]);

    return (
        <div 
            className="w-full h-full overflow-y-auto bg-gray-100 dark:bg-gray-900 custom-scrollbar"
        >
            {pdfDoc && Array.from({ length: numPages }, (_, i) => i + 1).map(page => (
                <div 
                    key={page} 
                    className="cursor-pointer transition-transform hover:scale-[1.01] active:scale-100"
                    onClick={() => { if (!isMobile) onPageClick(page); }}
                    onDoubleClick={() => { if (isMobile) onPageClick(page); }}
                >
                    <PageRenderer pdfDoc={pdfDoc} pageNumber={page} />
                </div>
            ))}
        </div>
    );
};

const SavedSlideViewer: React.FC<{ content: Content; onExpand: (page?: number) => void }> = ({ content, onExpand }) => {
// ... existing states and effects ...
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [isMobile, setIsMobile] = useState(false);
    
    const blobUrl = useBase64ToBlobUrl(content.body && content.body.startsWith('data:application/pdf') ? content.body : undefined);

    useEffect(() => {
        let url = content.file?.url || (content.filePath ? `/api/content/${content._id}/file` : '');
        if (!url && blobUrl) url = blobUrl;
        
        if (url && url.startsWith('http') && !url.includes('cloudinary.com') && !url.includes(window.location.hostname)) {
            const API_BASE = (import.meta as any).env.VITE_API_URL || 'http://localhost:5001';
            url = `${API_BASE}/api/proxy/pdf?url=${encodeURIComponent(url)}`;
        }
        setPdfUrl(url || null);
    }, [content, blobUrl]);

    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < 768);
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);

    useEffect(() => {
        if (content._id) api.trackContentView(content._id).catch(() => {});
    }, [content._id]);

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg relative h-full flex flex-col overflow-hidden border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between p-4 bg-gray-50/50 dark:bg-gray-900/50 border-b dark:border-gray-700">
                <h2 className="text-lg font-bold text-gray-800 dark:text-white truncate pr-4">{content.title}</h2>
                <button onClick={() => onExpand(1)} className="p-2 bg-white dark:bg-gray-700 rounded-lg shadow-sm hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
                    <ExpandIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </button>
            </div>
            <div className="flex-1 min-h-0 bg-gray-100 dark:bg-gray-900 relative">
                {pdfUrl ? (
                    <ConsecutivePdfViewer url={pdfUrl} onPageClick={onExpand} isMobile={isMobile} />
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-10 text-gray-400">
                        <SlideIcon className="w-16 h-16 mb-4 opacity-20" />
                        <p>No PDF available</p>
                    </div>
                )}
                {isMobile && (
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/60 backdrop-blur-sm rounded-full text-white text-xs font-medium pointer-events-none">
                        Double-tap a page for Fullscreen
                    </div>
                )}
            </div>
        </div>
    );
};

export const SlideView: React.FC<SlideViewProps> = ({ lessonId, user }) => {
    const { data: groupedContent, isLoading } = useApi(
        () => api.getContentsByLessonId(lessonId, ['slide'], true),
        [lessonId]
    );
    const [fullscreenState, setFullscreenState] = useState<{ content: Content; page: number } | null>(null);
    const slides = groupedContent?.[0]?.docs || [];

    useEffect(() => {
        if (lessonId && !isLoading) {
            api.trackView(lessonId, 'slide').catch(() => {});
        }
    }, [lessonId, isLoading]);

    return (
        <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900/50">
            <div className="p-4 sm:p-6 lg:p-8 flex-1 overflow-y-auto">
                <div className="max-w-7xl mx-auto h-full flex flex-col">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-2xl">
                            <SlideIcon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tight">
                                Lesson Slides
                            </h1>
                            <p className="text-gray-500 dark:text-gray-400">Interactive presentations and overviews</p>
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="flex-1 flex items-center justify-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                        </div>
                    ) : slides.length > 0 ? (
                        <div className="grid grid-cols-1 gap-8 pb-10">
                            {slides.map(slide => (
                                <SavedSlideViewer key={slide._id} content={slide} onExpand={(page = 1) => setFullscreenState({ content: slide, page })} />
                            ))}
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center py-20 bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
                            <SlideIcon className="w-20 h-20 text-gray-200 dark:text-gray-700 mb-6" />
                            <h3 className="text-xl font-bold text-gray-800 dark:text-white">No slides found</h3>
                            <p className="text-gray-500 dark:text-gray-400 mt-2">Check back later for updates</p>
                        </div>
                    )}
                </div>
            </div>

            {fullscreenState && (
                <FullscreenSlideViewer
                    content={fullscreenState.content}
                    startPage={fullscreenState.page}
                    onClose={() => setFullscreenState(null)}
                />
            )}
        </div>
    );
};
