import React, { useState, useEffect } from 'react';
import { Content, User } from '../../types';
import { useApi } from '../../hooks/useApi';
import * as api from '../../services/api';
import { WorksheetIcon } from '../icons/ResourceTypeIcons';
import { DownloadIcon, XIcon } from '../icons/AdminIcons';
import { PdfViewer } from './PdfViewer';
import { useToast } from '../../context/ToastContext';
import { formatCount } from '../../utils/formatUtils';
import "./worksheet.css";

interface WorksheetViewProps {
    lessonId: string;
    user: User;
}

const BeautifulWorksheetCard: React.FC<{
    content: Content;
    onExpand: (url: string) => void;
    onDownloadClick: () => void;
    index: number;
    downloading: boolean;
}> = ({ content, onExpand, onDownloadClick, index, downloading }) => {
    const displayUrl = content.file?.url || content.filePath || content.body;
    const downloadCount = content.downloadCount || 0;

    const colorSchemes = [
        { bg: 'from-blue-400 to-purple-600', icon: 'bg-white/20' },
        { bg: 'from-green-400 to-blue-600', icon: 'bg-white/20' },
        { bg: 'from-purple-400 to-pink-600', icon: 'bg-white/20' },
        { bg: 'from-red-400 to-orange-600', icon: 'bg-white/20' },
        { bg: 'from-indigo-400 to-purple-600', icon: 'bg-white/20' },
        { bg: 'from-yellow-400 to-red-600', icon: 'bg-white/20' },
        { bg: 'from-pink-400 to-rose-600', icon: 'bg-white/20' },
        { bg: 'from-teal-400 to-cyan-600', icon: 'bg-white/20' }
    ];

    const colorScheme = colorSchemes[index % colorSchemes.length];

    return (
        <div className="group relative bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 overflow-hidden border border-gray-100 dark:border-gray-700 flex flex-col h-full">
            <div
                className={`h-32 bg-gradient-to-br ${colorScheme.bg} relative overflow-hidden cursor-pointer`}
                onClick={() => onExpand(displayUrl)}
            >
                <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition-colors"></div>
                <div className="absolute -top-6 -right-6 w-20 h-20 bg-white/10 rounded-full blur-xl"></div>
                <div className="absolute -bottom-4 -left-4 w-16 h-16 bg-white/10 rounded-full blur-lg"></div>
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                    <div className={`p-4 ${colorScheme.icon} rounded-full backdrop-blur-sm shadow-inner group-hover:scale-110 transition-transform duration-300`}>
                        <WorksheetIcon className="w-8 h-8 text-white" />
                    </div>
                </div>
            </div>

            <div className="p-5 flex flex-col flex-1">
                <h3
                    className="font-bold text-lg text-gray-800 dark:text-white mb-2 text-center line-clamp-2 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    onClick={() => onExpand(displayUrl)}
                    title={content.title}
                >
                    {content.title}
                </h3>

                <div className="mt-auto pt-4 flex items-center justify-center border-t border-gray-100 dark:border-gray-700">
                    <button
                        onClick={(e) => { e.stopPropagation(); onDownloadClick(); }}
                        disabled={downloading}
                        className="flex items-center gap-1 px-4 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full text-xs font-semibold hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {downloading ? (
                            <>
                                <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Sending...
                            </>
                        ) : (
                            <>
                                <DownloadIcon className="w-3 h-3" />
                                <span>Download ({formatCount(downloadCount)})</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export const WorksheetView: React.FC<WorksheetViewProps> = ({ lessonId, user }) => {
    const [version, setVersion] = useState(0);
    const { data: grouped, isLoading } = useApi(() => api.getContentsByLessonId(lessonId, ['worksheet'], true), [lessonId, version, user]);
    const worksheets = grouped?.[0]?.docs || [];
    const [fullscreenUrl, setFullscreenUrl] = useState<string | null>(null);
    const [downloading, setDownloading] = useState(false);
    const [sweetAlert, setSweetAlert] = useState<{ show: boolean; type: 'loading' | 'success' | 'error'; title: string; message: string; phone?: string }>({
        show: false,
        type: 'loading',
        title: '',
        message: ''
    });

    const executeDownloadRequest = async (id: string, title: string) => {
        setDownloading(true);
        setSweetAlert({
            show: true,
            type: 'loading',
            title: 'பதிவிறக்கம் | Downloading',
            message: 'PDF அனுப்பப்படுகிறது... தயவுசெய்து காத்திருக்கவும்\n\nSending PDF... Please wait'
        });

        try {
            const response = await api.downloadContent(id, user._id, user.email);
            if (response.success) {
                if (response.isAdmin && response.fileUrl) {
                    const link = document.createElement('a');
                    link.href = response.fileUrl;
                    link.download = title || 'worksheet.pdf';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    setSweetAlert({
                        show: true,
                        type: 'success',
                        title: 'வெற்றி! | Success!',
                        message: 'கோப்பு பதிவிறக்கம் தொடங்கியது!\n\nDownload started!'
                    });
                } else if (response.emailSent) {
                    setSweetAlert({
                        show: true,
                        type: 'success',
                        title: 'வெற்றி! | Success!',
                        message: `உங்கள் மின்னஞ்சலுக்கு PDF அனுப்பப்பட்டது!\n📧 ${user.email}\n\nPDF sent to your email successfully!`
                    });
                } else {
                    setSweetAlert({
                        show: true,
                        type: 'success',
                        title: 'முடிந்தது | Done',
                        message: response.message || 'பதிவிறக்கம் செயல்படுத்தப்பட்டது\n\nDownload processed'
                    });
                }
                setVersion(v => v + 1);
                setTimeout(() => setSweetAlert(prev => ({ ...prev, show: false })), 3000);
            } else {
                const adminPhone = response.adminPhone || '7904838296';
                setSweetAlert({
                    show: true,
                    type: 'error',
                    title: 'தோல்வி | Failed',
                    message: `${response.message}\n\nதொடர்புக்கு | Contact Admin:\n📞 ${adminPhone}`,
                    phone: adminPhone
                });
            }
        } catch (error: any) {
            const adminPhone = '7904838296';
            setSweetAlert({
                show: true,
                type: 'error',
                title: 'பிழை | Error',
                message: `${error.message}\n\nதொடர்புக்கு | Contact Admin:\n📞 ${adminPhone}`,
                phone: adminPhone
            });
        } finally {
            setDownloading(false);
        }
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 h-full flex flex-col overflow-hidden">
            <div className="flex justify-between items-center mb-6 shrink-0">
                <div className="flex items-center gap-3">
                    <WorksheetIcon className="w-8 h-8 text-green-600" />
                    <h1 className="text-lg sm:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-green-600 dark:from-white dark:to-green-400">
                        Worksheets
                    </h1>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar">
                {isLoading && <div className="text-center py-12 text-gray-500">Loading worksheets...</div>}
                {!isLoading && worksheets.length === 0 && (
                    <div className="text-center py-20 bg-gray-50 dark:bg-gray-800/50 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                        <WorksheetIcon className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                        <p className="text-gray-500">No worksheets found.</p>
                    </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-8">
                    {worksheets.map((item, idx) => (
                        <BeautifulWorksheetCard
                            key={item._id}
                            content={item}
                            index={idx}
                            onExpand={(url) => {
                                api.trackContentView(item._id).catch(() => { });
                                setFullscreenUrl(url);
                            }}
                            onDownloadClick={() => executeDownloadRequest(item._id, item.title)}
                            downloading={downloading}
                        />
                    ))}
                </div>
            </div>

            {sweetAlert.show && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-8 transform transition-all scale-100 flex flex-col items-center text-center">
                        {sweetAlert.type === 'loading' && (
                            <div className="w-16 h-16 mb-4">
                                <svg className="animate-spin h-16 w-16 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            </div>
                        )}
                        {sweetAlert.type === 'success' && (
                            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/50 rounded-full flex items-center justify-center mb-4">
                                <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                                </svg>
                            </div>
                        )}
                        {sweetAlert.type === 'error' && (
                            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/50 rounded-full flex items-center justify-center mb-4">
                                <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                                </svg>
                            </div>
                        )}

                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">{sweetAlert.title}</h3>
                        <p className="text-gray-600 dark:text-gray-300 mb-6 whitespace-pre-line">{sweetAlert.message}</p>

                        {sweetAlert.type !== 'loading' && (
                            <button
                                onClick={() => setSweetAlert(prev => ({ ...prev, show: false }))}
                                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
                            >
                                சரி (OK)
                            </button>
                        )}

                        {sweetAlert.phone && sweetAlert.type === 'error' && (
                            <a
                                href={`tel:${sweetAlert.phone}`}
                                className="mt-3 w-full py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path>
                                </svg>
                                அழை | Call Admin
                            </a>
                        )}
                    </div>
                </div>
            )}

            {fullscreenUrl && (
                <div className="fixed inset-0 z-[70] bg-black/95 flex flex-col animate-fade-in">
                    <button onClick={() => setFullscreenUrl(null)} className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white z-50">
                        <XIcon className="w-6 h-6" />
                    </button>
                    <div className="flex-1 w-full h-full p-4 md:p-8">
                        <PdfViewer url={fullscreenUrl} initialScale={1.5} />
                    </div>
                </div>
            )}
        </div>
    );
};
