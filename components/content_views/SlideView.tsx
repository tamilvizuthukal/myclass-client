import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Content, User } from '../../types';
import { useApi } from '../../hooks/useApi';
import * as api from '../../services/api';
import { SlideIcon } from '../icons/ResourceTypeIcons';
import { TrashIcon, UploadCloudIcon, ExpandIcon, SaveIcon, ChevronLeftIcon, ChevronRightIcon, EyeIcon, CheckCircleIcon } from '../icons/AdminIcons';
import { CloseIcon } from '../icons/ToastIcons';
import { ConfirmModal } from '../ConfirmModal';
import { PdfViewer } from './PdfViewer';
import { useToast } from '../../context/ToastContext';
import { formatCount } from '../../utils/formatUtils';
import * as pdfjsLib from 'pdfjs-dist';

// Configure worker - using local worker file with CDN fallback
const CDN_WORKER_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
const LOCAL_WORKER_URL = '/pdf.worker.min.js';

// Set up worker configuration with fallbacks
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

// --- New Components for Normal View (Consecutive Pages) ---

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
                // Use a higher scale for better quality in normal view
                const viewport = page.getViewport({ scale: 1.5 });
                const canvas = canvasRef.current;
                const context = canvas?.getContext('2d');

                if (context && canvas) {
                    canvas.height = viewport.height;
                    canvas.width = viewport.width;

                    // Style for responsiveness
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
                // Ignore cancel errors
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
                console.error("Error loading consecutive PDF:", e);
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
                    onClick={(e) => {
                        // On Mobile, Single click does nothing or default.
                        // On Desktop, Single click opens Fullscreen.
                        if (!isMobile) onPageClick();
                    }}
                    onDoubleClick={(e) => {
                        // On Mobile, Double click opens Fullscreen.
                        if (isMobile) onPageDoubleClick();
                    }}
                >
                    <PageRenderer pdfDoc={pdfDoc} pageNumber={page} />
                </div>
            ))}
        </div>
    );
};

// Full-screen slide viewer with navigation controls
const FullscreenSlideViewer: React.FC<{
    content: Content;
    onClose: () => void;
    isMobile: boolean;
    isLandscape: boolean;
}> = ({ content, onClose, isMobile: initialIsMobile, isLandscape: initialIsLandscape }) => {
    // Handle both base64 content and file-based content
    const [isMobile, setIsMobile] = useState(initialIsMobile);
    const [isLandscape, setIsLandscape] = useState(initialIsLandscape);

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 768);
            setIsLandscape(window.innerWidth > window.innerHeight);
        };

        // Initial check
        handleResize();

        window.addEventListener('resize', handleResize);
        window.addEventListener('orientationchange', handleResize);
        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('orientationchange', handleResize);
        };
    }, []);

    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [currentSlide, setCurrentSlide] = useState(1);
    const [totalSlides, setTotalSlides] = useState(1);

    const [touchStart, setTouchStart] = useState<{ x: number, y: number } | null>(null);
    const [touchEnd, setTouchEnd] = useState<{ x: number, y: number } | null>(null);
    const viewerRef = useRef<any>(null);
    const [lastClickTime, setLastClickTime] = useState(0);
    const [showControls, setShowControls] = useState(false);

    // Auto-rotate logic: If mobile and NOT landscape, we force rotation
    const isRotated = isMobile && !isLandscape;

    useEffect(() => {
        const loadPdfFromFile = async () => {
            try {
                console.log('[FullscreenSlideViewer] Loading PDF for content:', content._id);

                // If content has a filePath, construct the URL to load the file
                if (content.file?.url) {
                    console.log('[FullscreenSlideViewer] Using Cloudinary URL:', content.file.url);
                    setPdfUrl(content.file.url);
                } else if (content.filePath) {
                    // For uploaded files, construct URL from file path
                    const url = `/api/content/${content._id}/file`;
                    console.log('[FullscreenSlideViewer] Using file URL:', url);
                    setPdfUrl(url);
                } else if (content.body && content.body.startsWith('data:application/pdf')) {
                    // Fallback for base64 content
                    const blobUrl = useBase64ToBlobUrl(content.body);
                    setPdfUrl(blobUrl);
                } else {
                    console.log('[FullscreenSlideViewer] No filePath or base64 data found');
                }
            } catch (error) {
                console.error('[FullscreenSlideViewer] Error loading PDF:', error);
            }
        };

        loadPdfFromFile();
    }, [content]);

    // Touch gesture handling for mobile
    const minSwipeDistance = 50;
    const onTouchStart = (e: React.TouchEvent) => {
        setTouchEnd(null);
        setTouchStart({
            x: e.targetTouches[0].clientX,
            y: e.targetTouches[0].clientY
        });
    };

    const onTouchMove = (e: React.TouchEvent) => {
        setTouchEnd({
            x: e.targetTouches[0].clientX,
            y: e.targetTouches[0].clientY
        });
    };

    const onTouchEnd = () => {
        if (!touchStart || !touchEnd) return;

        let delta = 0;

        if (isRotated) {
            // In rotated mode (90deg CW):
            // Visual Left (Next) is Physical Top (y decreases)
            // Visual Right (Prev) is Physical Bottom (y increases)

            // To go Next (Swipe Left visually): Finger moves towards Visual Left (Physical Top)
            // startY > endY => delta positive
            delta = touchStart.y - touchEnd.y;
        } else {
            // Normal mode
            // Swipe Left (Next): startX > endX => delta positive
            delta = touchStart.x - touchEnd.x;
        }

        const isNextSwipe = delta > minSwipeDistance;
        const isPrevSwipe = delta < -minSwipeDistance;

        if (isNextSwipe && currentSlide < totalSlides) {
            setCurrentSlide(prev => prev + 1);
        }
        if (isPrevSwipe && currentSlide > 1) {
            setCurrentSlide(prev => prev - 1);
        }
    };

    // Handle keyboard navigation and ESC key
    useEffect(() => {
        const handleKeyPress = (e: KeyboardEvent) => {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                e.preventDefault();
                setCurrentSlide(prev => Math.max(1, prev - 1));
            } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                e.preventDefault();
                setCurrentSlide(prev => Math.min(totalSlides, prev + 1));
            } else if (e.key === 'Escape') {
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [totalSlides, onClose]);

    // Handle double-click to exit fullscreen - DISABLED for Desktop as per request
    const handleDoubleClick = useCallback((e: React.MouseEvent) => {
        // User requested to disable double click in Full Screen (Desktop)
        // If mobile, they generally want double click to OPEN it, but once inside, 
        // usually double click might zoom or exit.
        // For now, we disable the "Exit on Double Click" feature entirely 
        // or restrict it since the user explicitly said "Disable double click in this" (Desktop Full View).
        if (!isMobile) return;

        // Optional: Keep it for mobile if desired, or disable there too.
        // Assuming "Disable double click" applies to the Full View general behavior requested.
        // Let's disable it completely to be safe or just for Desktop.
        // Code below is effectively disabled for desktop.
    }, [isMobile]);

    // Handle click navigation (left/right sides - only 25% zones)
    // Note: click coordinates might need adjustment in rotated mode, but touch is primary for mobile.
    // We disable click nav on mobile to avoid confusion or conflicts with swipe
    const handleClickNavigation = useCallback((e: React.MouseEvent) => {
        if (isMobile) return; // Disable click zones on mobile
        if (!viewerRef.current) return;

        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickPercentage = (clickX / rect.width) * 100;

        // Left 25% for previous slide
        if (clickPercentage <= 25) {
            setCurrentSlide(prev => Math.max(1, prev - 1));
        }
        // Right 25% for next slide  
        else if (clickPercentage >= 75) {
            setCurrentSlide(prev => Math.min(totalSlides, prev + 1));
        }
    }, [totalSlides, isMobile]);

    // Update total slides when PDF loads
    const handlePdfLoad = useCallback((pdf: any) => {
        setTotalSlides(pdf.numPages);
        setCurrentSlide(1);
    }, []);

    // Fullscreen API and Orientation Lock
    useEffect(() => {
        const requestFullScreenAndLock = async () => {
            try {
                const elem = document.documentElement;
                if (!document.fullscreenElement) {
                    if (elem.requestFullscreen) {
                        await elem.requestFullscreen();
                    } else if ((elem as any).webkitRequestFullscreen) {
                        await (elem as any).webkitRequestFullscreen();
                    }
                }

                if (isMobile && 'orientation' in screen && (screen.orientation as any).lock) {
                    // Try to lock to landscape
                    try {
                        await (screen.orientation as any).lock('landscape');
                    } catch (e) {
                        // Fallback to CSS rotation if lock fails (already handled by isRotated logic below)
                        console.warn("Orientation lock failed:", e);
                    }
                }
            } catch (e) {
                console.error("Fullscreen/Orientation error:", e);
            }
        };

        requestFullScreenAndLock();

        // Cleanup on exit
        /*
        return () => {
             // We generally want to exit fullscreen when component unmounts
             if (document.fullscreenElement) {
                 document.exitFullscreen().catch(err => console.error("Exit fullscreen error", err));
             }
             if ('orientation' in screen && (screen.orientation as any).unlock) {
                 (screen.orientation as any).unlock();
             }
        }; 
        */
        // NOTE: Cleanup is handled by the close button which unmounts this. 
        // We should ensure exit logic is triggered. 

    }, [isMobile]);

    // Handle component unmount for cleanup
    useEffect(() => {
        return () => {
            if (document.fullscreenElement) {
                document.exitFullscreen().catch(() => { });
            }
            if ('orientation' in screen && (screen.orientation as any).unlock) {
                (screen.orientation as any).unlock();
            }
        }
    }, []);


    return (
        <div
            className="fixed inset-0 bg-black z-50 flex items-center justify-center overflow-hidden touch-none"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
        >
            {/* 
               Content Wrapper
               Handles rotation if necessary.
               If rotated (isRotated=true), we rotate 90deg CW.
               Dimensions must be swapped: w=100vh, h=100vw.
             */}
            <div
                className={`relative transition-all duration-300 ease-in-out flex items-center justify-center ${isRotated
                    ? 'w-[100vh] h-[100vw] rotate-90'
                    : 'w-full h-full'
                    }`}
            >
                {/* Slide content area - True fullscreen without headers/footers */}
                <div
                    className="w-full h-full relative cursor-pointer select-none"
                    onClick={handleClickNavigation}
                    onDoubleClick={handleDoubleClick}
                    ref={viewerRef}
                >
                    {pdfUrl ? (
                        <SlidePdfViewer
                            url={pdfUrl}
                            currentSlide={currentSlide}
                            onSlideChange={setCurrentSlide}
                            onPdfLoad={handlePdfLoad}
                            isMobile={isMobile}
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-white">
                            <div className="text-center">
                                <SlideIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
                                <p>Loading slides...</p>
                                {content.body && !content.body.startsWith('data:application/pdf') && (
                                    <p className="text-sm text-gray-400 mt-2">No PDF data found</p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Top area with close button - content relative */}
                    <div
                        className={`absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-black/50 to-transparent transition-opacity duration-300 ${showControls || isRotated ? 'opacity-100' : 'opacity-0'}`}
                        onMouseEnter={() => setShowControls(true)}
                        onMouseLeave={() => setShowControls(false)}
                    >
                        {/* Close button - top right */}
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 bg-black/70 backdrop-blur-sm hover:bg-black/90 text-white p-2 rounded-full transition-all duration-200 hover:scale-110 hover:rotate-90 z-50 pointer-events-auto"
                            title="Close (ESC)"
                        >
                            <CloseIcon className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Page counter - bottom left */}
                    <div
                        className={`absolute bottom-4 left-4 bg-black/70 backdrop-blur-sm px-4 py-2 rounded-lg text-white text-sm font-medium transition-opacity duration-300 ${showControls || isRotated ? 'opacity-100' : 'opacity-0'}`}
                    >
                        {currentSlide} / {totalSlides}
                    </div>

                    {/* Navigation hints - visual helpers */}
                    {isMobile && (
                        <>
                            {/* Left side tap/swipe zone hint */}
                            <div className="absolute left-0 top-[75px] w-1/4 h-[calc(100%-75px)] bg-transparent" />
                            {/* Right side tap/swipe zone hint */}
                            <div className="absolute right-0 top-[75px] w-1/4 h-[calc(100%-75px)] bg-transparent" />
                            {/* Middle area */}
                            <div className="absolute left-1/4 top-[75px] w-1/2 h-[calc(100%-75px)] bg-transparent border-l border-r border-white/5" />
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

// PDF viewer component specifically for slides
const SlidePdfViewer: React.FC<{
    url: string;
    currentSlide: number;
    onSlideChange: (slide: number) => void;
    onPdfLoad: (pdf: any) => void;
    isMobile: boolean;
}> = ({ url, currentSlide, onSlideChange, onPdfLoad, isMobile }) => {
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
                console.error('Error loading PDF:', error);
            }
        };

        loadPdf();
    }, [url, onPdfLoad]);

    // Calculate optimal scale for full screen display
    useEffect(() => {
        let retryCount = 0;
        const maxRetries = 10;

        const calculateOptimalScale = () => {
            if (!pdfDoc || !containerRef.current) return;

            const container = containerRef.current;
            const containerWidth = container.clientWidth;
            const containerHeight = container.clientHeight;

            // If container has no visible size (e.g. during rotation or modal animation), retry
            if ((containerWidth === 0 || containerHeight === 0) && retryCount < maxRetries) {
                retryCount++;
                setTimeout(calculateOptimalScale, 100);
                return;
            }

            if (containerWidth === 0 || containerHeight === 0) return;

            // Get the first page to calculate aspect ratio
            pdfDoc.getPage(currentSlide).then((page: any) => {
                const unscaledViewport = page.getViewport({ scale: 1.0 });
                const pageWidth = unscaledViewport.width;
                const pageHeight = unscaledViewport.height;

                // Calculate scale to fit width and height
                const scaleX = containerWidth / pageWidth;
                const scaleY = containerHeight / pageHeight;

                // Use the smaller scale to ensure the entire page fits - no padding for full page view
                const optimalScale = Math.min(scaleX, scaleY);
                setScale(optimalScale);
            });
        };

        // Recalculate scale when window is resized OR orientation changes
        window.addEventListener('resize', calculateOptimalScale);
        window.addEventListener('orientationchange', calculateOptimalScale);

        // Initial calculation
        calculateOptimalScale();

        // Additional delayed check for mobile rotation settling
        const timer = setTimeout(calculateOptimalScale, 500);

        return () => {
            window.removeEventListener('resize', calculateOptimalScale);
            window.removeEventListener('orientationchange', calculateOptimalScale);
            clearTimeout(timer);
        };
    }, [pdfDoc, currentSlide]);

    useEffect(() => {
        if (!pdfDoc || !canvasRef.current || !containerRef.current) return;

        const renderPage = async () => {
            try {
                // Cancel previous render task
                if (renderTaskRef.current) {
                    renderTaskRef.current.cancel();
                }

                const page = await pdfDoc.getPage(currentSlide);
                const viewport = page.getViewport({ scale });
                const canvas = canvasRef.current;
                const context = canvas.getContext('2d');

                if (context) {
                    canvas.height = viewport.height;
                    canvas.width = viewport.width;

                    const renderContext = {
                        canvasContext: context,
                        viewport: viewport
                    };

                    const renderTask = page.render(renderContext);
                    renderTaskRef.current = renderTask;

                    await renderTask.promise;
                    renderTaskRef.current = null;
                }
            } catch (error) {
                console.error('Error rendering page:', error);
            }
        };

        renderPage();
    }, [pdfDoc, currentSlide, scale]);

    return (
        <div
            ref={containerRef}
            className="w-full h-full flex items-center justify-center bg-white overflow-hidden select-none"
            style={{ userSelect: 'none' }}
        >
            <canvas
                ref={canvasRef}
                className="shadow-2xl max-w-full max-h-full object-contain"
                style={{
                    maxWidth: '100vw',
                    maxHeight: '100vh',
                    width: 'auto',
                    height: 'auto',
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    MozUserSelect: 'none',
                    msUserSelect: 'none'
                }}
            />
        </div>
    );
};

const SavedSlideViewer: React.FC<{ content: Content; onRemove: () => void; isAdmin: boolean; onExpand: () => void; onTogglePublish?: () => void }> = ({
    content,
    onRemove,
    isAdmin,
    onExpand,
    onTogglePublish
}) => {
    // Handle both base64 content and file-based content
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [isMobile, setIsMobile] = useState(false);
    const [isLandscape, setIsLandscape] = useState(true);
    const [lastClickTime, setLastClickTime] = useState(0);

    useEffect(() => {
        const loadPdfFromFile = async () => {
            try {
                console.log('[SavedSlideViewer] Loading content:', content._id);
                console.log('[SavedSlideViewer] Content has filePath:', !!content.filePath);
                console.log('[SavedSlideViewer] Content body:', content.body);

                // If content has a file object (new model) or filePath (legacy), construct the URL
                // If content has a file object (new model) or filePath (legacy), construct the URL
                let url = '';
                if (content.file?.url) {
                    console.log('[SavedSlideViewer] Using Cloudinary URL:', content.file.url);
                    url = content.file.url;
                } else if (content.filePath) {
                    // For uploaded files, construct URL from content ID
                    url = `/api/content/${content._id}/file`;
                    console.log('[SavedSlideViewer] Using file URL:', url);
                } else if (content.body && content.body.startsWith('data:application/pdf')) {
                    // Fallback for base64 content
                    const blobUrl = useBase64ToBlobUrl(content.body);
                    if (blobUrl) url = blobUrl;
                }

                // Apply Proxy for external links
                if (url && url.startsWith('http') &&
                    !url.includes('cloudinary.com') &&
                    !url.includes(window.location.hostname)) {

                    const API_BASE = (import.meta as any).env.VITE_API_URL || 'http://localhost:5001';
                    url = `${API_BASE}/api/proxy/pdf?url=${encodeURIComponent(url)}`;
                }

                setPdfUrl(url);
            } catch (error) {
                console.error('Error loading PDF:', error);
            }
        };

        loadPdfFromFile();
    }, [content]);

    // View count increment removed as per request
    useEffect(() => {
        // logic removed
    }, [content._id]);

    // Handle double-click (handled in ConsecutivePdfViewer now, or effectively disabled here if unused)
    // The interaction is now managed by passing onPageClick/onPageDoubleClick to ConsecutivePdfViewer
    // stored in onExpand
    const handleDoubleClick = () => { };

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768);
            setIsLandscape(window.innerWidth > window.innerHeight);
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);
        window.addEventListener('orientationchange', checkMobile);
        return () => {
            window.removeEventListener('resize', checkMobile);
            window.removeEventListener('orientationchange', checkMobile);
        };
    }, []);

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md relative h-full flex flex-col">
            <div className="absolute top-4 right-4 flex gap-2 z-20">

                {!isMobile && (
                    <button
                        onClick={onExpand}
                        className={`${isMobile ? 'p-3' : 'p-2'} rounded-full bg-white/50 dark:bg-black/50 hover:bg-white/80 dark:hover:bg-black/80 backdrop-blur-sm shadow-md`}
                        title="View Fullscreen"
                    >
                        <ExpandIcon className={`${isMobile ? 'w-6 h-6' : 'w-5 h-5'} text-gray-600 dark:text-gray-300`} />
                    </button>
                )}

            </div>

            {!isMobile && (
                <h2 className="text-lg p-3 font-semibold pr-24 shrink-0 text-gray-800 dark:text-white truncate" title={content.title}>
                    {content.title}
                </h2>
            )}

            {pdfUrl ? (
                <div className="flex-1 overflow-hidden rounded border dark:border-gray-700 bg-gray-100 dark:bg-gray-900 relative">
                    <ConsecutivePdfViewer
                        url={pdfUrl}
                        onPageClick={onExpand}
                        onPageDoubleClick={onExpand}
                        isMobile={isMobile}
                    />
                </div>
            ) : (
                <div className="flex-1 aspect-[16/9] w-full bg-gray-200 dark:bg-gray-700 rounded border dark:border-gray-600 flex flex-col items-center justify-center text-center p-4">
                    <SlideIcon className="w-16 h-16 text-gray-400 dark:text-gray-500 mb-4" />
                    <p className="text-gray-600 dark:text-gray-300 font-semibold">Cannot display PDF</p>
                    <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">This slide deck cannot be opened.</p>
                </div>
            )}
        </div>
    );
};

const UploadForm: React.FC<{ lessonId: string; onUpload: () => void; onExpand: (url: string) => void; }> = ({ lessonId, onUpload, onExpand }) => {
    const [activeTab, setActiveTab] = useState<'upload' | 'link'>('upload');
    const [file, setFile] = useState<File | null>(null);
    const [title, setTitle] = useState('');
    const [folderPath, setFolderPath] = useState('');
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [linkUrl, setLinkUrl] = useState('');

    const { showToast } = useToast();

    // Optimized Title & Path Logic (Matching BookView)
    useEffect(() => {
        const fetchDefaults = async () => {
            setTitle('New Slides');
            setFolderPath('Default/Slides');

            try {
                const hierarchy = await api.getHierarchy(lessonId);

                if (hierarchy) {
                    const { className, subjectName, unitName, subUnitName, lessonName } = hierarchy;

                    const extractNum = (str: string) => {
                        if (!str) return '0';
                        const match = str.match(/\d+/);
                        return match ? match[0] : '0';
                    };

                    const unitNum = extractNum(unitName);
                    const subUnitNum = extractNum(subUnitName);
                    const lessonNum = extractNum(lessonName);

                    // Format: Unit.SubUnit.Lesson.pdf (Same as Book)
                    const formattedTitle = `${unitNum}.${subUnitNum}.${lessonNum}.pdf`;

                    const cleanPart = (str: string) => str.replace(/[^a-zA-Z0-9]/g, '');
                    const hierarchyParts = [
                        cleanPart(className),
                        cleanPart(subjectName),
                        cleanPart(unitName),
                        subUnitName ? cleanPart(subUnitName) : '',
                        cleanPart(lessonName)
                    ].filter(p => p);

                    const hierarchyPath = hierarchyParts.join('/');

                    setTitle(formattedTitle);
                    setFolderPath(`${hierarchyPath}/Slides`);
                }
            } catch (e) {
                console.log('Error fetching defaults', e);
            }
        };
        if (lessonId) fetchDefaults();
    }, [lessonId]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            if (selectedFile.type === "application/pdf") {
                setFile(selectedFile);
                setUploadedUrl(null);
                setUploadProgress(0);
            } else {
                showToast("Please select a valid PDF file.", 'error');
                setFile(null);
            }
        }
    };

    const handleUploadToCloud = async () => {
        if (!file || !lessonId) return;

        setIsUploading(true);
        setUploadProgress(0);

        const formData = new FormData();
        formData.append('file', file);
        formData.append('lessonId', lessonId);
        formData.append('type', 'slide'); // Type set to slide
        formData.append('title', title);

        let cleanFolder = folderPath.replace(/^(\.\.\/)?uploads\//, '');
        formData.append('folder', cleanFolder);

        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                const percentComplete = Math.round((e.loaded / e.total) * 100);
                setUploadProgress(percentComplete);
            }
        });

        xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    const result = JSON.parse(xhr.responseText);
                    const url = result.file?.url || result.secure_url || result.url;
                    setUploadedUrl(url);

                    showToast('Slides uploaded and saved successfully!', 'success');
                    setIsUploading(false);
                    onUpload(); // Auto refresh
                } catch (e) {
                    showToast('Upload succeeded but response was invalid.', 'warning');
                    setIsUploading(false);
                }
            } else {
                try {
                    const errorResponse = JSON.parse(xhr.responseText);
                    showToast(`Upload failed: ${errorResponse.message || xhr.statusText}`, 'error');
                } catch (e) {
                    showToast(`Upload failed: ${xhr.statusText}`, 'error');
                }
                setIsUploading(false);
            }
        });

        xhr.addEventListener('error', () => {
            showToast('Network error during upload.', 'error');
            setIsUploading(false);
        });

        xhr.open('POST', '/api/upload');
        xhr.send(formData);
    };

    const handleSaveLink = async () => {
        if (!linkUrl || !title) return;
        setIsSaving(true);
        try {
            await api.addContent({
                title,
                body: linkUrl,
                lessonId,
                type: 'slide',
                metadata: { category: 'External', subCategory: 'Link' } as any
            });
            showToast('Slide link saved successfully!', 'success');
            onUpload();
        } catch (e) {
            showToast('Failed to save link.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="w-full max-w-4xl mx-auto bg-white dark:bg-gray-800/50 p-6 sm:p-8 rounded-lg shadow-md h-full flex flex-col overflow-hidden">
            <h3 className="text-lg font-bold text-center mb-6 text-gray-800 dark:text-white shrink-0">Add New Slides</h3>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6 shrink-0">
                <button
                    onClick={() => setActiveTab('upload')}
                    className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'upload'
                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                        }`}
                >
                    PDF Upload
                </button>
                <button
                    onClick={() => setActiveTab('link')}
                    className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'link'
                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                        }`}
                >
                    Direct Link
                </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2">
                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Slide Title</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    {activeTab === 'upload' && (
                        <div className="space-y-6 animate-fade-in">
                            {!uploadedUrl ? (
                                <>
                                    <div className="mt-1 flex items-center justify-center px-6 pt-10 pb-10 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                        <div className="space-y-2 text-center">
                                            <UploadCloudIcon className="mx-auto h-12 w-12 text-gray-400" />
                                            <div className="flex text-sm text-gray-600 dark:text-gray-400 justify-center">
                                                <label htmlFor="slideFile" className="relative cursor-pointer rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none">
                                                    <span>Select Slide PDF</span>
                                                    <input id="slideFile" name="slideFile" type="file" className="sr-only" onChange={handleFileChange} accept=".pdf" />
                                                </label>
                                            </div>
                                            <p className="text-xs text-gray-500 dark:text-gray-500">{file ? file.name : 'PDF up to 10MB'}</p>
                                        </div>
                                    </div>

                                    {file && (
                                        <div className="space-y-4">
                                            {isUploading ? (
                                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden relative">
                                                    <div
                                                        className={`h-4 rounded-full transition-all duration-300 relative overflow-hidden ${uploadProgress === 100 ? 'bg-green-500' : 'bg-blue-600'}`}
                                                        style={{ width: `${uploadProgress === 100 ? 100 : uploadProgress}%` }}
                                                    >
                                                        <div className="absolute inset-0 bg-white/30 animate-[shimmer_2s_infinite]"></div>
                                                    </div>
                                                    <div className="text-center mt-2 flex items-center justify-center gap-2">
                                                        {uploadProgress === 100 ? (
                                                            <>
                                                                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                                                <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">Processing on Server (Please wait)...</p>
                                                            </>
                                                        ) : (
                                                            <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">{uploadProgress}% Uploading...</p>
                                                        )}
                                                    </div>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={handleUploadToCloud}
                                                    className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all"
                                                >
                                                    Upload & Save
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="text-center space-y-4 py-6 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                                    <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 dark:bg-green-900">
                                        {/* Success Icon */}
                                        <svg className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">Upload Complete!</h3>
                                    <button
                                        onClick={onUpload}
                                        className="mt-4 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors"
                                    >
                                        Done & View Slides
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'link' && (
                        <div className="space-y-6 animate-fade-in">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Slide PDF URL</label>
                                <input
                                    type="url"
                                    value={linkUrl}
                                    onChange={(e) => setLinkUrl(e.target.value)}
                                    placeholder="https://example.com/slides.pdf"
                                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <button
                                onClick={handleSaveLink}
                                disabled={isSaving || !linkUrl}
                                className="w-full py-3 px-4 bg-gray-800 dark:bg-gray-700 text-white rounded-lg font-semibold shadow hover:bg-gray-700 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                                {isSaving ? 'Saving...' : 'Save Link'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export const SlideView: React.FC<SlideViewProps> = ({ lessonId, user }) => {
    const [version, setVersion] = useState(0);

    useEffect(() => {
        console.log('[SlideView] LessonId changed:', lessonId);
    }, [lessonId]);

    const { data: groupedContent, isLoading } = useApi(
        () => api.getContentsByLessonId(lessonId, ['slide'], (user.role !== 'admin' && !user.canEdit)),
        [lessonId, version, user]
    );

    const [stats, setStats] = useState<{ count: number } | null>(null);



    useEffect(() => {
        console.log('[SlideView] Content loaded:', groupedContent);
    }, [groupedContent]);

    const [confirmModalState, setConfirmModalState] = useState<{ isOpen: boolean; onConfirm: (() => void) | null }>({ isOpen: false, onConfirm: null });
    const [fullscreenMode, setFullscreenMode] = useState(false);
    const { showToast } = useToast();

    const slideContent = groupedContent?.[0]?.docs[0];
    const canEdit = user.role === 'admin' || !!user.canEdit;

    const handleDelete = (contentId: string) => {
        const confirmAction = async () => {
            await api.deleteContent(contentId);
            setVersion(v => v + 1);
            showToast('Slides deleted successfully.', 'success');
            setConfirmModalState({ isOpen: false, onConfirm: null });
        };
        setConfirmModalState({ isOpen: true, onConfirm: confirmAction });
    };

    const handleTogglePublish = async () => {
        if (!slideContent) return;
        try {
            const newStatus = !slideContent.isPublished;
            await api.updateContent(slideContent._id, { isPublished: newStatus });
            setVersion(v => v + 1);
            showToast(`Slides ${newStatus ? 'published' : 'unpublished'} successfully`, 'success');
        } catch (error) {
            console.error('Failed to toggle publish status:', error);
            showToast('Failed to update publish status', 'error');
        }
    };

    return (
        <div className="p-1 sm:p-3 sm:pt-0 lg:p-8 lg:pt-4 h-full overflow-hidden flex flex-col">
            <div className="flex-1 pt-3 overflow-hidden min-h-0 flex flex-col">
                {isLoading && <div className="text-center py-10">Loading slides...</div>}

                {!isLoading && slideContent && (
                    <SavedSlideViewer
                        content={slideContent}
                        onRemove={() => handleDelete(slideContent._id)}
                        isAdmin={canEdit}
                        onExpand={() => setFullscreenMode(true)}
                        onTogglePublish={handleTogglePublish}
                    />
                )}

                {!isLoading && !slideContent && (
                    <div className="text-center py-20 bg-white dark:bg-gray-800/50 rounded-lg">
                        <SlideIcon className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600" />
                        <p className="mt-4 text-gray-500">No slides available.</p>
                    </div>
                )}
            </div>

            <ConfirmModal
                isOpen={confirmModalState.isOpen}
                onClose={() => setConfirmModalState({ isOpen: false, onConfirm: null })}
                onConfirm={confirmModalState.onConfirm}
                title="Remove Slides"
                message="Are you sure you want to remove these slides? This action cannot be undone."
            />

            {fullscreenMode && slideContent && (
                <FullscreenSlideViewer
                    content={slideContent}
                    onClose={() => setFullscreenMode(false)}
                    isMobile={window.innerWidth < 768}
                    isLandscape={window.innerWidth > window.innerHeight}
                />
            )}
        </div>
    );
};
