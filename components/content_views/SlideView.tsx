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

// ─────────────────────────────────────────────
// PageRenderer – renders a single PDF page onto a canvas
// Used by ConsecutivePdfViewer (thumbnail / scroll view)
// ─────────────────────────────────────────────
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
                const viewport = page.getViewport({ scale: 1.5 });
                const canvas = canvasRef.current!;
                const context = canvas.getContext('2d')!;
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                canvas.style.width = '100%';
                canvas.style.height = 'auto';
                const renderTask = page.render({ canvasContext: context, viewport });
                renderTaskRef.current = renderTask;
                await renderTask.promise;
            } catch (_) {}
        };
        renderPage();
    }, [isVisible, pdfDoc, pageNumber]);

    return (
        <div ref={containerRef} className="w-full bg-white shadow-sm mb-4 relative" style={{ minHeight: 80 }}>
            <canvas ref={canvasRef} className="block w-full h-auto" />
            {!isVisible && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-50 text-gray-400">
                    <span className="text-sm">Loading…</span>
                </div>
            )}
        </div>
    );
});

// ─────────────────────────────────────────────
// ConsecutivePdfViewer – scrollable list of all pages
// ─────────────────────────────────────────────
const ConsecutivePdfViewer: React.FC<{
    url: string;
    onPageClick: () => void;
    isMobile: boolean;
}> = ({ url, onPageClick, isMobile }) => {
    const [pdfDoc, setPdfDoc] = useState<any>(null);
    const [numPages, setNumPages] = useState(0);

    useEffect(() => {
        let cancelled = false;
        const loadPdf = async () => {
            try {
                const pdf = await pdfjsLib.getDocument(url).promise;
                if (!cancelled) { setPdfDoc(pdf); setNumPages(pdf.numPages); }
            } catch (_) {}
        };
        loadPdf();
        return () => { cancelled = true; };
    }, [url]);

    return (
        <div
            className="w-full h-full overflow-y-auto bg-gray-100 dark:bg-gray-900 scroll-smooth custom-scrollbar"
            onClick={() => { if (!isMobile) onPageClick(); }}
            onDoubleClick={() => { if (isMobile) onPageClick(); }}
        >
            {pdfDoc && Array.from({ length: numPages }, (_, i) => i + 1).map(page => (
                <div key={page} className="cursor-pointer">
                    <PageRenderer pdfDoc={pdfDoc} pageNumber={page} />
                </div>
            ))}
        </div>
    );
};

// ─────────────────────────────────────────────
// FullscreenPdfRenderer – renders ONE page at a time.
// The pdfDoc is kept stable externally; only currentSlide changes.
// This avoids any re-load/blink.
// ─────────────────────────────────────────────
const FullscreenPdfRenderer: React.FC<{
    pdfDoc: any;
    currentSlide: number;
    containerEl: HTMLDivElement | null;
}> = React.memo(({ pdfDoc, currentSlide, containerEl }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const renderTaskRef = useRef<any>(null);
    const isRenderingRef = useRef(false);

    useEffect(() => {
        if (!pdfDoc || !canvasRef.current || !containerEl) return;

        const renderPage = async () => {
            if (isRenderingRef.current) {
                if (renderTaskRef.current) { try { renderTaskRef.current.cancel(); } catch (_) {} }
            }
            isRenderingRef.current = true;
            try {
                const page = await pdfDoc.getPage(currentSlide);
                const cw = containerEl.clientWidth  || window.innerWidth;
                const ch = containerEl.clientHeight || window.innerHeight;
                const dpr = window.devicePixelRatio || 1;
                const unscaled = page.getViewport({ scale: 1 });
                const scale = Math.min(cw / unscaled.width, ch / unscaled.height) * dpr;
                const viewport = page.getViewport({ scale });

                const canvas = canvasRef.current!;
                const ctx = canvas.getContext('2d')!;

                canvas.width  = viewport.width;
                canvas.height = viewport.height;
                canvas.style.width  = `${viewport.width  / dpr}px`;
                canvas.style.height = `${viewport.height / dpr}px`;

                const task = page.render({ canvasContext: ctx, viewport });
                renderTaskRef.current = task;
                await task.promise;
            } catch (_) {
            } finally {
                isRenderingRef.current = false;
            }
        };

        renderPage();
    }, [pdfDoc, currentSlide, containerEl]);

    return (
        <canvas
            ref={canvasRef}
            style={{ display: 'block', maxWidth: '100%', maxHeight: '100%' }}
        />
    );
});

// ─────────────────────────────────────────────
// FullscreenSlideViewer – the fullscreen overlay
// ─────────────────────────────────────────────
const FullscreenSlideViewer: React.FC<{
    content: Content;
    onClose: () => void;
}> = ({ content, onClose }) => {
    const [pdfDoc,       setPdfDoc]       = useState<any>(null);
    const [totalSlides,  setTotalSlides]  = useState(0);
    const [currentSlide, setCurrentSlide] = useState(1);
    const [showControls, setShowControls] = useState(true);
    const [pdfUrl,       setPdfUrl]       = useState<string | null>(null);

    const overlayRef    = useRef<HTMLDivElement>(null);
    const containerRef  = useRef<HTMLDivElement>(null);
    const timerRef      = useRef<ReturnType<typeof setTimeout> | null>(null);
    const blobUrlRef    = useRef<string | null>(null);

    // ── Build PDF URL once ──────────────────────────────────
    useEffect(() => {
        let url = '';
        if (content.file?.url) {
            url = content.file.url;
        } else if (content.filePath) {
            url = `/api/content/${content._id}/file`;
        } else if (content.body?.startsWith('data:application/pdf')) {
            const parts = content.body.split(',');
            const bytes = Uint8Array.from(atob(parts[1]), c => c.charCodeAt(0));
            const blob  = new Blob([bytes], { type: 'application/pdf' });
            url = URL.createObjectURL(blob);
            blobUrlRef.current = url;
        }
        setPdfUrl(url || null);
        return () => {
            if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = null; }
        };
    }, [content]);

    // ── Load PDF doc once ──────────────────────────────────
    useEffect(() => {
        if (!pdfUrl) return;
        let cancelled = false;
        pdfjsLib.getDocument(pdfUrl).promise.then(doc => {
            if (!cancelled) { setPdfDoc(doc); setTotalSlides(doc.numPages); setCurrentSlide(1); }
        }).catch(() => {});
        return () => { cancelled = true; };
    }, [pdfUrl]);

    // ── Controls auto-hide ──────────────────────────────────
    const showControlsBriefly = useCallback(() => {
        setShowControls(true);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setShowControls(false), 3000);
    }, []);

    useEffect(() => {
        showControlsBriefly();
        return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    }, [showControlsBriefly]);

    // ── Keyboard navigation ──────────────────────────────────
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')    { setCurrentSlide(p => Math.max(1, p - 1)); showControlsBriefly(); }
            if (e.key === 'ArrowRight' || e.key === 'ArrowDown')   { setCurrentSlide(p => Math.min(totalSlides, p + 1)); showControlsBriefly(); }
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [totalSlides, onClose, showControlsBriefly]);

    // ── Lock body scroll ──────────────────────────────────
    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prev; };
    }, []);

    const canGoPrev = currentSlide > 1;
    const canGoNext = currentSlide < totalSlides;

    const goToPrev = useCallback(() => {
        setCurrentSlide(p => Math.max(1, p - 1));
        showControlsBriefly();
    }, [showControlsBriefly]);

    const goToNext = useCallback(() => {
        setCurrentSlide(p => Math.min(totalSlides, p + 1));
        showControlsBriefly();
    }, [totalSlides, showControlsBriefly]);

    return (
        <div
            ref={overlayRef}
            className="fixed inset-0 bg-black"
            style={{ zIndex: 9999 }}
            onMouseMove={showControlsBriefly}
            onTouchStart={showControlsBriefly}
        >
            {/* PDF canvas area */}
            <div
                ref={containerRef}
                className="absolute inset-0 flex items-center justify-center overflow-hidden"
            >
                {pdfDoc ? (
                    <FullscreenPdfRenderer
                        pdfDoc={pdfDoc}
                        currentSlide={currentSlide}
                        containerEl={containerRef.current}
                    />
                ) : (
                    <div className="flex flex-col items-center gap-3 text-white/60">
                        <SlideIcon className="w-16 h-16" />
                        <p className="text-sm">Loading PDF…</p>
                    </div>
                )}
            </div>

            {/* ── Top bar ── */}
            <div
                className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 pt-3 pb-6 bg-gradient-to-b from-black/70 to-transparent pointer-events-none"
                style={{ opacity: showControls ? 1 : 0, transition: 'opacity 0.3s', zIndex: 10 }}
            >
                <span className="text-white text-sm font-semibold truncate max-w-[70%] drop-shadow">{content.title}</span>
                <button
                    className="pointer-events-auto bg-black/50 hover:bg-black/80 text-white p-2.5 rounded-full backdrop-blur-sm transition-all active:scale-95"
                    style={{ opacity: showControls ? 1 : 0, pointerEvents: showControls ? 'auto' : 'none' }}
                    onClick={onClose}
                >
                    <CloseIcon className="w-5 h-5" />
                </button>
            </div>

            {/* ── Prev button ── */}
            <button
                onClick={goToPrev}
                disabled={!canGoPrev}
                className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/80 text-white p-3.5 rounded-full backdrop-blur-sm transition-all active:scale-90 disabled:opacity-20 disabled:cursor-not-allowed"
                style={{
                    opacity: showControls ? (canGoPrev ? 1 : 0.25) : 0,
                    pointerEvents: showControls ? 'auto' : 'none',
                    transition: 'opacity 0.3s',
                    zIndex: 20,
                }}
            >
                <ChevronLeftIcon className="w-7 h-7" />
            </button>

            {/* ── Next button ── */}
            <button
                onClick={goToNext}
                disabled={!canGoNext}
                className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/80 text-white p-3.5 rounded-full backdrop-blur-sm transition-all active:scale-90 disabled:opacity-20 disabled:cursor-not-allowed"
                style={{
                    opacity: showControls ? (canGoNext ? 1 : 0.25) : 0,
                    pointerEvents: showControls ? 'auto' : 'none',
                    transition: 'opacity 0.3s',
                    zIndex: 20,
                }}
            >
                <ChevronRightIcon className="w-7 h-7" />
            </button>

            {/* ── Bottom bar ── */}
            <div
                className="absolute bottom-0 left-0 right-0 flex flex-col items-center gap-2 pb-5 pt-8 bg-gradient-to-t from-black/70 to-transparent"
                style={{ opacity: showControls ? 1 : 0, transition: 'opacity 0.3s', zIndex: 10, pointerEvents: showControls ? 'auto' : 'none' }}
            >
                {/* Dot indicators */}
                {totalSlides > 1 && totalSlides <= 30 && (
                    <div className="flex gap-1.5 items-center flex-wrap justify-center max-w-xs">
                        {Array.from({ length: totalSlides }, (_, i) => (
                            <button
                                key={i}
                                onClick={() => { setCurrentSlide(i + 1); showControlsBriefly(); }}
                                className="rounded-full transition-all duration-200"
                                style={{
                                    width:  i + 1 === currentSlide ? 18 : 7,
                                    height: 7,
                                    background: i + 1 === currentSlide ? '#fff' : 'rgba(255,255,255,0.35)',
                                }}
                            />
                        ))}
                    </div>
                )}
                <div className="bg-black/60 backdrop-blur-sm px-4 py-1.5 rounded-full text-white text-xs font-semibold tracking-wide">
                    {currentSlide} / {totalSlides || '…'}
                </div>
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────
// SavedSlideViewer – thumbnail card shown in the list
// ─────────────────────────────────────────────
const SavedSlideViewer: React.FC<{ content: Content; onExpand: () => void }> = ({ content, onExpand }) => {
    const [pdfUrl,   setPdfUrl]   = useState<string | null>(null);
    const [isMobile, setIsMobile] = useState(false);
    const blobRef = useRef<string | null>(null);

    useEffect(() => {
        if (content._id) api.trackContentView(content._id).catch(() => {});
    }, [content._id]);

    useEffect(() => {
        let url = content.file?.url || (content.filePath ? `/api/content/${content._id}/file` : '');
        if (!url && content.body?.startsWith('data:application/pdf')) {
            const parts = content.body.split(',');
            const blob  = new Blob([Uint8Array.from(atob(parts[1]), c => c.charCodeAt(0))], { type: 'application/pdf' });
            url = URL.createObjectURL(blob);
            blobRef.current = url;
        }
        if (url && url.startsWith('http') && !url.includes('cloudinary.com') && !url.includes(window.location.hostname)) {
            const API_BASE = (import.meta as any).env.VITE_API_URL || 'http://localhost:5001';
            url = `${API_BASE}/api/proxy/pdf?url=${encodeURIComponent(url)}`;
        }
        setPdfUrl(url || null);
        return () => { if (blobRef.current) { URL.revokeObjectURL(blobRef.current); blobRef.current = null; } };
    }, [content]);

    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < 768);
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md relative h-full flex flex-col">
            <div className="absolute top-4 right-4 flex gap-2 z-20">
                {!isMobile && (
                    <button
                        onClick={onExpand}
                        className="p-2 rounded-full bg-white/50 dark:bg-black/50 hover:bg-white/80 dark:hover:bg-black/80 backdrop-blur-sm shadow-md"
                    >
                        <ExpandIcon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                    </button>
                )}
            </div>
            {!isMobile && (
                <h2 className="text-lg p-3 font-semibold pr-24 shrink-0 text-gray-800 dark:text-white truncate">
                    {content.title}
                </h2>
            )}
            {pdfUrl ? (
                <div className="flex-1 overflow-hidden rounded border dark:border-gray-700 bg-gray-100 dark:bg-gray-900 relative">
                    <ConsecutivePdfViewer url={pdfUrl} onPageClick={onExpand} isMobile={isMobile} />
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

// ─────────────────────────────────────────────
// SlideView – main exported component
// ─────────────────────────────────────────────
export const SlideView: React.FC<SlideViewProps> = ({ lessonId, user }) => {
    const { data: groupedContent, isLoading } = useApi(
        () => api.getContentsByLessonId(lessonId, ['slide'], true),
        [lessonId, user]
    );
    const [fullscreenContent, setFullscreenContent] = useState<Content | null>(null);
    const slides = groupedContent?.[0]?.docs || [];

    return (
        <div className="p-4 sm:p-6 lg:p-8 h-full flex flex-col overflow-hidden">
            <div className="flex justify-between items-center mb-6 shrink-0">
                <div className="flex items-center gap-3">
                    <SlideIcon className="w-8 h-8 text-blue-600" />
                    <h1 className="text-lg sm:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-blue-600 dark:from-white dark:to-blue-400">
                        Slides
                    </h1>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0">
                {isLoading && <div className="text-center py-10 text-gray-500">Loading slides…</div>}
                {!isLoading && slides.length > 0 && (
                    <div className="grid grid-cols-1 gap-6 pb-6 h-full">
                        {slides.map(slide => (
                            <SavedSlideViewer
                                key={slide._id}
                                content={slide}
                                onExpand={() => setFullscreenContent(slide)}
                            />
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
                <FullscreenSlideViewer
                    content={fullscreenContent}
                    onClose={() => setFullscreenContent(null)}
                />
            )}
        </div>
    );
};
