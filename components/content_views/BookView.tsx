import React, { useState, useEffect } from 'react';
import { Content, User } from '../../types';
import { useApi } from '../../hooks/useApi';
import * as api from '../../services/api';
import { BookIcon } from '../icons/ResourceTypeIcons';
import { ExpandIcon, XIcon } from '../icons/AdminIcons';
import { PdfViewer } from './PdfViewer';

interface BookViewProps {
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

const SavedBookViewer: React.FC<{ content: Content; onExpand: (url: string) => void; }> = ({ content, onExpand }) => {
    const fileUrl = content.file?.url;
    const bodyUrl = content.body || '';
    const isBase64 = bodyUrl.startsWith('data:application/pdf');
    const blobUrl = useBase64ToBlobUrl(isBase64 ? bodyUrl : undefined);

    let displayUrl = fileUrl || (isBase64 ? blobUrl : bodyUrl);

    if (displayUrl && displayUrl.startsWith('http') &&
        !displayUrl.includes('cloudinary.com') &&
        !displayUrl.includes(window.location.hostname)) {
        const API_BASE = (import.meta as any).env.VITE_API_URL || 'http://localhost:5001';
        displayUrl = `${API_BASE}/api/proxy/pdf?url=${encodeURIComponent(displayUrl)}`;
    }

    const [isMobile, setIsMobile] = React.useState(false);
    React.useEffect(() => {
        const checkMobile = () => { setIsMobile(window.innerWidth < 768); };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);
    const initialScale = isMobile ? 0.65 : 1.5;

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-2 relative h-full flex flex-col">
            <div className="absolute top-4 right-4 flex gap-2 z-20">
                <button onClick={() => displayUrl && onExpand(displayUrl)} className={`${isMobile ? 'p-3' : 'p-2'} rounded-full bg-white/50 dark:bg-black/50 hover:bg-white/80 dark:hover:bg-black/80 backdrop-blur-sm shadow-md`} title="View Fullscreen">
                    <ExpandIcon className={`${isMobile ? 'w-6 h-6' : 'w-5 h-5'} text-gray-600 dark:text-gray-300`} />
                </button>
            </div>

            <div className="flex-1 overflow-hidden rounded border dark:border-gray-700 bg-gray-100 dark:bg-gray-900 relative">
                {displayUrl ? (
                    <PdfViewer
                        url={displayUrl}
                        initialScale={initialScale}
                    />
                ) : (
                    <div className="flex items-center justify-center h-full text-gray-500">
                        Preparing PDF...
                    </div>
                )}
            </div>
        </div>
    );
};

export const BookView: React.FC<BookViewProps> = ({ lessonId, user }) => {
    const { data: groupedContent, isLoading } = useApi(
        () => api.getContentsByLessonId(lessonId, ['book'], true),
        [lessonId, user]
    );

    const [fullscreenPdfUrl, setFullscreenPdfUrl] = useState<string | null>(null);

    const bookContent = groupedContent?.[0]?.docs[0];

    useEffect(() => {
        if (bookContent?._id) {
            api.trackContentView(bookContent._id).catch(() => { });
        }
    }, [bookContent?._id]);

    return (
        <div className="p-4 sm:p-6 lg:p-8 h-full overflow-hidden flex flex-col">
            <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
                {isLoading && <div className="text-center py-10 text-gray-500">Loading book...</div>}

                {!isLoading && bookContent && (
                    <SavedBookViewer
                        content={bookContent}
                        onExpand={setFullscreenPdfUrl}
                    />
                )}

                {!isLoading && !bookContent && (
                    <div className="text-center py-20 bg-white dark:bg-gray-800/50 rounded-lg">
                        <BookIcon className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600" />
                        <p className="mt-4 text-gray-500">No book available.</p>
                    </div>
                )}
            </div>

            {fullscreenPdfUrl && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex flex-col animate-fade-in h-screen w-screen">
                    <div className="hidden md:flex justify-end p-2 bg-black/50 absolute top-0 right-0 z-50 rounded-bl-lg">
                        <button
                            onClick={() => setFullscreenPdfUrl(null)}
                            className="p-2 rounded-full bg-red-600/80 hover:bg-red-500 text-white transition-colors"
                        >
                            <XIcon className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="md:hidden fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50">
                        <button
                            onClick={() => setFullscreenPdfUrl(null)}
                            className="p-3 rounded-full bg-red-600/80 hover:bg-red-500 text-white transition-colors backdrop-blur-sm shadow-lg"
                        >
                            <XIcon className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="w-full h-full pt-12 md:pt-0">
                        <PdfViewer
                            url={fullscreenPdfUrl}
                            initialScale={2.5}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};