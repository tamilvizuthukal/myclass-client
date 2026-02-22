import React, { useState } from 'react';
import { Content, User } from '../../types';
import { useApi } from '../../hooks/useApi';
import * as api from '../../services/api';
import { QuestionPaperIcon } from '../icons/ResourceTypeIcons';
import { DownloadIcon, XIcon } from '../icons/AdminIcons';
import { PdfViewer } from './PdfViewer';
import { formatCount } from '../../utils/formatUtils';
import "./worksheet.css";

const BeautifulQuestionCard: React.FC<{
    content: Content;
    onExpand: (url: string) => void;
    onDownloadClick: () => void;
    index: number;
    downloading: boolean;
}> = ({ content, onExpand, onDownloadClick, index, downloading }) => {
    const displayUrl = content.file?.url || content.filePath || content.body;
    const downloadCount = content.downloadCount || 0;

    const colorSchemes = [
        { bg: 'from-emerald-400 to-teal-600', icon: 'bg-white/20' },
        { bg: 'from-orange-400 to-red-600', icon: 'bg-white/20' },
        { bg: 'from-cyan-400 to-blue-600', icon: 'bg-white/20' },
        { bg: 'from-violet-400 to-fuchsia-600', icon: 'bg-white/20' },
        { bg: 'from-amber-400 to-orange-600', icon: 'bg-white/20' },
        { bg: 'from-lime-400 to-green-600', icon: 'bg-white/20' },
    ];

    const colorScheme = colorSchemes[index % colorSchemes.length];

    return (
        <div className="group bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-2xl transition-all border border-gray-100 dark:border-gray-700 flex flex-col h-full overflow-hidden">
            <div className={`h-32 bg-gradient-to-br ${colorScheme.bg} relative cursor-pointer`} onClick={() => onExpand(displayUrl)}>
                <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20" />
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                    <div className={`p-4 ${colorScheme.icon} rounded-full backdrop-blur-sm shadow-inner group-hover:scale-110 transition-transform`}>
                        <QuestionPaperIcon className="w-8 h-8 text-white" />
                    </div>
                </div>
            </div>
            <div className="p-5 flex flex-col flex-1">
                <h3 className="font-bold text-lg mb-2 text-center line-clamp-2 cursor-pointer hover:text-blue-600 transition-colors" onClick={() => onExpand(displayUrl)}>{content.title}</h3>
                <div className="mt-auto pt-4 flex items-center justify-center border-t border-gray-100 dark:border-gray-700">
                    <button onClick={e => { e.stopPropagation(); onDownloadClick(); }} disabled={downloading} className="flex items-center gap-2 px-6 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 rounded-full text-sm font-semibold hover:bg-blue-100 transition-colors disabled:opacity-50">
                        {downloading ? <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /> : <DownloadIcon className="w-4 h-4" />}
                        <span>{downloading ? 'Sending...' : `Download (${formatCount(downloadCount)})`}</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export const QuestionPaperView: React.FC<{ lessonId: string; user: User }> = ({ lessonId, user }) => {
    const [version, setVersion] = useState(0);
    const { data: grouped, isLoading } = useApi(() => api.getContentsByLessonId(lessonId, ['questionPaper'], true), [lessonId, version, user]);
    const papers = grouped?.[0]?.docs || [];
    const [fullscreenUrl, setFullscreenUrl] = useState<string | null>(null);
    const [downloading, setDownloading] = useState(false);
    const [sweetAlert, setSweetAlert] = useState<{ show: boolean; type: 'loading' | 'success' | 'error'; title: string; message: string; phone?: string }>({ show: false, type: 'loading', title: '', message: '' });

    const handleDownloadRequest = async (id: string, title: string) => {
        setDownloading(true);
        setSweetAlert({ show: true, type: 'loading', title: 'பதிவிறக்கம் | Downloading', message: 'PDF அனுப்பப்படுகிறது... தயவுசெய்து காத்திருக்கவும்\n\nSending PDF... Please wait' });
        try {
            const res = await api.downloadContent(id, user._id, user.email);
            if (res.success) {
                if ((user.role === 'admin' || user.canEdit) && res.fileUrl) {
                    const l = document.createElement('a'); l.href = res.fileUrl; l.download = title || 'question-paper.pdf'; l.click();
                    setSweetAlert({ show: true, type: 'success', title: 'வெற்றி! | Success!', message: 'Download started!' });
                } else {
                    setSweetAlert({ show: true, type: 'success', title: 'வெற்றி! | Success!', message: `உங்கள் மின்னஞ்சலுக்கு PDF அனுப்பப்பட்டது!\n📧 ${user.email}` });
                }
                setVersion(v => v + 1);
                setTimeout(() => setSweetAlert(prev => ({ ...prev, show: false })), 3000);
            } else throw new Error(res.message);
        } catch (e: any) {
            setSweetAlert({ show: true, type: 'error', title: 'தோல்வி | Failed', message: e.message, phone: '7904838296' });
        } finally { setDownloading(false); }
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 h-full flex flex-col overflow-hidden">
            <div className="flex justify-between items-center mb-6 shrink-0">
                <div className="flex items-center gap-3">
                    <QuestionPaperIcon className="w-8 h-8 text-indigo-600" />
                    <h1 className="text-xl sm:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-indigo-600 dark:from-white dark:to-indigo-400">Question Papers</h1>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto min-h-0 no-scrollbar">
                {isLoading && <div className="text-center py-12 text-gray-500">Loading question papers...</div>}
                {!isLoading && papers.length === 0 && <div className="text-center py-20 bg-gray-50 dark:bg-gray-800/50 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                    <QuestionPaperIcon className="w-16 h-16 mx-auto text-gray-300 mb-4" /><p className="text-gray-500">No question papers found.</p>
                </div>}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 pb-8">
                    {papers.map((item, idx) => (
                        <BeautifulQuestionCard
                            key={item._id}
                            content={item}
                            index={idx}
                            onExpand={(url) => {
                                api.trackContentView(item._id).catch(() => { });
                                setFullscreenUrl(url);
                            }}
                            onDownloadClick={() => handleDownloadRequest(item._id, item.title)}
                            downloading={downloading}
                        />
                    ))}
                </div>
            </div>
            {fullscreenUrl && <div className="fixed inset-0 z-[70] bg-black/95 flex flex-col"><button onClick={() => setFullscreenUrl(null)} className="absolute top-4 right-4 p-2 bg-white/10 rounded-full text-white z-50"><XIcon className="w-6 h-6" /></button><div className="flex-1 p-4 md:p-8"><PdfViewer url={fullscreenUrl} initialScale={1.5} /></div></div>}
            {sweetAlert.show && <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"><div className="bg-white dark:bg-gray-800 rounded-2xl p-8 w-full max-w-md text-center flex flex-col items-center">
                {sweetAlert.type === 'loading' && <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />}
                <h3 className="text-xl font-bold mb-3">{sweetAlert.title}</h3><p className="text-gray-600 dark:text-gray-300 mb-6 whitespace-pre-line">{sweetAlert.message}</p>
                {sweetAlert.type !== 'loading' && <button onClick={() => setSweetAlert(prev => ({ ...prev, show: false }))} className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg">OK</button>}
                {sweetAlert.phone && sweetAlert.type === 'error' && <a href={`tel:${sweetAlert.phone}`} className="mt-3 w-full py-3 bg-green-600 text-white font-semibold rounded-lg flex items-center justify-center gap-2">Call Admin</a>}
            </div></div>}
        </div>
    );
};