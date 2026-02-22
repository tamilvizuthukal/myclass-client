import React, { useState, useEffect } from 'react';
import { Content, User } from '../../types';
import { useApi } from '../../hooks/useApi';
import * as api from '../../services/api';
import { VideoIcon } from '../icons/ResourceTypeIcons';

interface VideoViewProps {
    lessonId: string;
    user: User;
}

const getYouTubeEmbedUrl = (raw: string | undefined | null): string | null => {
    if (!raw) return null;
    const url = raw.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) return null;
    if (url.includes('youtube.com/embed/')) return url;
    try {
        const u = new URL(url);
        const host = u.hostname.replace(/^www\./, '');
        let videoId: string | null = null;
        if (host === 'youtu.be') {
            videoId = u.pathname.split('/')[1] || null;
            if (videoId) videoId = videoId.split('?')[0].split('/')[0];
        } else if (host.includes('youtube.com')) {
            if (u.pathname === '/watch') videoId = u.searchParams.get('v');
            else if (u.pathname.startsWith('/shorts/')) videoId = u.pathname.split('/')[2] || null;
            else if (u.pathname.startsWith('/embed/')) videoId = u.pathname.split('/')[2] || null;
            else if (u.pathname.startsWith('/v/')) videoId = u.pathname.split('/')[2] || null;
        }
        if (videoId) {
            videoId = videoId.replace(/[^a-zA-Z0-9_-]/g, '');
            return `https://www.youtube.com/embed/${videoId}?rel=0`;
        }
        return null;
    } catch (error) {
        return null;
    }
};

const SavedVideoViewer: React.FC<{ content: Content; }> = ({ content }) => {
    const [videoError, setVideoError] = useState<string | null>(null);
    const [videoLoading, setVideoLoading] = useState(true);
    const [videoSrc, setVideoSrc] = useState<string>('');

    const getVideoSrc = () => {
        const body = (content.body || '').trim();
        const youtubeEmbed = getYouTubeEmbedUrl(body);
        if (youtubeEmbed) return youtubeEmbed;
        if (content.file?.url) return content.file.url;
        if (content.filePath && content.filePath.trim() !== '') {
            if (content.filePath.startsWith('http')) return content.filePath;
            return `/api/content/${content._id}/file`;
        }
        if (body.startsWith('http')) return body;
        if (body.startsWith('data:video/')) return body;
        return '';
    };

    useEffect(() => {
        const src = getVideoSrc();
        setVideoSrc(src);
        const isYouTubeVideo = src && src.includes('youtube.com/embed/');
        setVideoLoading(isYouTubeVideo ? false : (src ? true : false));
        setVideoError(null);

        // Track view
        api.trackContentView(content._id).catch(() => { });
    }, [content]);

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 relative w-full">
            <h2 className="text-xl font-semibold mb-4 pr-12 truncate">{content.title}</h2>
            <div className="w-full">
                {videoLoading && (
                    <div className="flex items-center justify-center py-4">
                        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mr-2"></div>
                        <span className="text-sm text-gray-600 dark:text-gray-400">Loading video...</span>
                    </div>
                )}
                {videoSrc && videoSrc.includes('youtube.com/embed/') && (
                    <div className="aspect-video w-full bg-black rounded-lg overflow-hidden">
                        <iframe
                            src={videoSrc}
                            className="w-full h-full"
                            title={content.title}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            referrerPolicy="strict-origin-when-cross-origin"
                            allowFullScreen
                        />
                    </div>
                )}
                {videoSrc && !videoSrc.includes('youtube.com/embed/') && (
                    <div className="aspect-video w-full bg-black rounded-lg overflow-hidden">
                        <video
                            controls
                            className="w-full h-full"
                            src={videoSrc}
                            onCanPlay={() => setVideoLoading(false)}
                            onError={() => { setVideoLoading(false); setVideoError('Video format not supported or file not found.'); }}
                            style={{ display: videoLoading ? 'none' : 'block' }}
                        >
                            Your browser does not support the video element.
                        </video>
                    </div>
                )}
                {videoError && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-sm text-red-800 dark:text-red-200">
                        {videoError}
                    </div>
                )}
                {!videoSrc && !videoError && !videoLoading && (
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 text-sm text-yellow-800 dark:text-yellow-200">
                        No valid video source found.
                    </div>
                )}
            </div>
        </div>
    );
};

export const VideoView: React.FC<VideoViewProps> = ({ lessonId, user }) => {
    const { data: groupedContent, isLoading } = useApi(() => api.getContentsByLessonId(lessonId, ['video'], true), [lessonId, user]);
    const videoContents: Content[] = groupedContent?.[0]?.docs || [];

    return (
        <div className="p-4 sm:p-6 lg:p-8 h-full flex flex-col overflow-hidden">
            <div className="flex justify-between items-center mb-6 shrink-0">
                <div className="flex items-center gap-3">
                    <VideoIcon className="w-8 h-8 text-red-600" />
                    <h1 className="text-lg sm:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-red-600 dark:from-white dark:to-red-400">Video</h1>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0">
                {isLoading && <div className="text-center py-10 text-gray-500">Loading videos...</div>}

                {!isLoading && videoContents.length > 0 && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-6">
                        {videoContents.map(video => (
                            <SavedVideoViewer key={video._id} content={video} />
                        ))}
                    </div>
                )}

                {!isLoading && videoContents.length === 0 && (
                    <div className="text-center py-20 bg-white dark:bg-gray-800/50 rounded-lg">
                        <VideoIcon className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600" />
                        <p className="mt-4 text-gray-500">No videos available.</p>
                    </div>
                )}
            </div>
        </div>
    );
};