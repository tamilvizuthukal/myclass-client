import React, { useState, useRef, useEffect } from 'react';
import { Content, User, ResourceType } from '../../types';
import { useApi } from '../../hooks/useApi';
import * as api from '../../services/api';
import { ExpandIcon, XIcon, DownloadIcon, ChevronRightIcon } from '../icons/AdminIcons';
import { RESOURCE_TYPES } from '../../constants';
import { PdfViewer } from './PdfViewer';
import { useSession } from '../../context/SessionContext';
import { FontSizeControl } from '../FontSizeControl';
import { FileUploadHelper } from '../../services/fileStorage';
import { processContentForHTML } from '../../utils/htmlUtils';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

const splitContentIntoPages = (htmlContent: string): string[] => {
    const pages: string[] = [];
    const contentContainer = document.createElement('div');
    contentContainer.innerHTML = htmlContent;

    let flatBlocks: HTMLElement[] = [];
    Array.from(contentContainer.children).forEach((section) => {
        const childNodes = Array.from(section.childNodes);
        if (childNodes.length === 0 && section.textContent?.trim()) {
            const p = document.createElement('p');
            p.innerHTML = section.innerHTML;
            flatBlocks.push(p);
        } else {
            childNodes.forEach(node => {
                if (node.nodeType === Node.ELEMENT_NODE) flatBlocks.push(node as HTMLElement);
                else if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
                    const p = document.createElement('p');
                    p.textContent = node.textContent;
                    flatBlocks.push(p);
                }
            });
        }
    });

    if (flatBlocks.length === 0 && contentContainer.children.length > 0) flatBlocks = Array.from(contentContainer.children) as HTMLElement[];

    const tempDiv = document.createElement('div');
    tempDiv.style.cssText = `position: absolute; visibility: hidden; left: -9999px; top: -9999px; width: 700px; font-family: 'Noto Sans Tamil', 'TAU-Paalai', 'Nirmala UI', 'Latha', 'Vijaya', 'Tunga', Arial, sans-serif; font-size: 14pt; line-height: 1.6; padding: 0; margin: 0; word-wrap: break-word;`;
    document.body.appendChild(tempDiv);

    const maxHeightPerPage = 880;
    let currentPageHTML = '';
    let currentHeight = 0;

    for (let i = 0; i < flatBlocks.length; i++) {
        const element = flatBlocks[i];
        const clone = element.cloneNode(true) as HTMLElement;
        tempDiv.innerHTML = '';
        tempDiv.appendChild(clone);
        const elementHeight = tempDiv.offsetHeight;

        if (currentHeight + elementHeight > maxHeightPerPage && currentPageHTML !== '') {
            pages.push(currentPageHTML);
            currentPageHTML = '';
            currentHeight = 0;
        }

        currentPageHTML += clone.outerHTML;
        currentHeight += elementHeight + 8;
        currentPageHTML += '<div style="height: 8px;"></div>';
    }

    if (currentPageHTML !== '') pages.push(currentPageHTML);
    document.body.removeChild(tempDiv);
    return pages.length ? pages : ['<div style="text-align: center; padding: 100px; color: #666;">No content available.</div>'];
};

const ContentCard: React.FC<{ item: Content; onExpandPdf?: (url: string) => void; onDownload?: (id: string) => void; resourceType?: ResourceType }> = ({ item, onExpandPdf, onDownload, resourceType }) => {
    const [isOpen, setIsOpen] = useState(false);
    const isActivity = resourceType === 'activity';
    const isPdf = item.type === 'worksheet' && (item.metadata as any)?.fileId;
    const { session } = useSession();
    const fontStyle = { fontSize: `${session.fontSize}px` };

    const getPdfUrl = () => {
        if ((item.metadata as any)?.fileId) return FileUploadHelper.getFileUrl((item.metadata as any).fileId);
        if (item.body?.startsWith('data:application/pdf')) return item.body;
        return null;
    };

    const pdfUrl = isPdf ? getPdfUrl() : null;

    if (isActivity) {
        return (
            <div className="group bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden mb-4 cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
                <div className="w-full text-left p-5 relative bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-800/50">
                    <div className={`absolute left-0 top-0 bottom-0 w-1.5 transition-colors duration-300 ${isOpen ? 'bg-green-500' : 'bg-purple-500'}`}></div>
                    <div className="prose dark:prose-invert max-w-none font-semibold text-lg font-tau-paalai" style={fontStyle} dangerouslySetInnerHTML={{ __html: processContentForHTML(item.title) }} />
                    {isOpen && (
                        <div className="mt-4 pt-4 border-t border-dashed border-gray-200 dark:border-gray-700 animate-fade-in">
                            <div className="text-sm font-bold text-green-600 mb-1">Answer:</div>
                            <div className="prose dark:prose-invert max-w-none text-gray-700 font-tau-paalai" style={fontStyle} dangerouslySetInnerHTML={{ __html: processContentForHTML(item.body) }} />
                        </div>
                    )}
                </div>
            </div>
        );
    }

    if (isPdf) {
        return (
            <div className="group bg-white dark:bg-gray-800 rounded-2xl shadow-sm hover:shadow-2xl transition-all duration-300 border border-gray-100 dark:border-gray-700 flex flex-col h-72 sm:h-80 overflow-hidden cursor-pointer" onClick={() => onExpandPdf?.(pdfUrl || '')}>
                <div className="flex-1 bg-gray-50 dark:bg-gray-900 flex items-center justify-center relative overflow-hidden">
                    {pdfUrl ? <div className="w-full h-full opacity-90 group-hover:opacity-100 scale-95 group-hover:scale-100 duration-500"><PdfViewer url={pdfUrl} initialScale={0.45} /></div> : <div className="text-red-400 text-xs">Preview Unavailable</div>}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/10 transition-all opacity-0 group-hover:opacity-100">
                        <div className="bg-white dark:bg-gray-800 px-4 py-2 rounded-full shadow-lg text-sm flex items-center gap-2"><ExpandIcon className="w-4 h-4" /><span>View Fullscreen</span></div>
                    </div>
                </div>
                <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center gap-3">
                    <h3 className="font-semibold text-sm line-clamp-2">{item.title}</h3>
                    <button onClick={e => { e.stopPropagation(); onDownload?.(item._id); }} className="p-2 rounded-full hover:bg-blue-50 text-gray-400 hover:text-blue-600"><DownloadIcon className="w-5 h-5" /></button>
                </div>
            </div>
        );
    }

    return (
        <div className="group bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-xl transition-all border border-gray-100 dark:border-gray-700 overflow-hidden mb-4 cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
            <div className="w-full text-left p-5 relative bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-800/50 flex justify-between items-center gap-4">
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-blue-500"></div>
                <div className="prose dark:prose-invert max-w-none font-semibold text-lg font-tau-paalai flex-1" style={fontStyle} dangerouslySetInnerHTML={{ __html: processContentForHTML(item.title) }} />
                <div className={`p-1.5 rounded-full bg-gray-100 dark:bg-gray-700 transition-transform ${isOpen ? 'rotate-90' : ''}`}><ChevronRightIcon className="w-5 h-5" /></div>
            </div>
            {isOpen && (
                <div className="p-5 border-t border-dashed border-gray-200 dark:border-gray-700 bg-gray-50/50">
                    <div className="prose dark:prose-invert max-w-none font-tau-paalai" style={fontStyle} dangerouslySetInnerHTML={{ __html: processContentForHTML(item.body) }} />
                </div>
            )}
        </div>
    );
};

export const GenericContentView: React.FC<{ lessonId: string; user: User; resourceType: ResourceType }> = ({ lessonId, user, resourceType }) => {
    const { data: groupedContent, isLoading } = useApi(() => api.getContentsByLessonId(lessonId, [resourceType], true), [lessonId, resourceType, user]);
    const [fullscreenPdfUrl, setFullscreenPdfUrl] = useState<string | null>(null);
    const [sweetAlert, setSweetAlert] = useState<{ show: boolean; type: 'loading' | 'success' | 'error'; title: string; message: string; phone?: string }>({ show: false, type: 'loading', title: '', message: '' });
    const exportContainerRef = useRef<HTMLDivElement>(null);

    const contentItems = groupedContent?.[0]?.docs || [];
    const resourceInfo = RESOURCE_TYPES.find(r => r.key === resourceType) || { key: resourceType, label: resourceType, Icon: () => null, description: 'Resource', color: 'text-gray-500', gradient: 'from-gray-500 to-gray-600' };
    const isWorksheet = resourceType === 'worksheet';

    useEffect(() => {
        if (!isLoading && contentItems.length > 0) {
            contentItems.forEach(item => {
                api.trackContentView(item._id).catch(() => { });
            });
        }
    }, [contentItems, isLoading]);

    const handleExport = async () => {
        setSweetAlert({ show: true, type: 'loading', title: 'பதிவிறக்கம் | Downloading', message: 'PDF தயாரிக்கப்படுகிறது... தயவுசெய்து காத்திருக்கவும்\n\nGenerating PDF... Please wait' });
        try {
            const h = await api.getHierarchy(lessonId);
            const lessonName = h?.lessonName || resourceInfo.label;
            let html = '';
            contentItems.forEach((item, i) => {
                html += `<div style="border:1px solid #eee; border-radius:8px; padding:15px; margin-bottom:20px; background:#fcfcfc;">
                    <div style="font-weight:bold; font-size:15pt; color:#000; margin-bottom:4px;"><span style="color:#2563eb;">${i + 1}.</span> ${processContentForHTML(item.title)}</div>
                    <div style="font-size:14pt; color:#333;">${processContentForHTML(item.body)}</div>
                </div>`;
            });
            if (!html) throw new Error('No content available');
            const pages = splitContentIntoPages(html);
            const doc = new jsPDF('p', 'mm', 'a4');
            const container = exportContainerRef.current!;
            container.innerHTML = '';
            for (let i = 0; i < pages.length; i++) {
                if (i > 0) doc.addPage();
                const page = document.createElement('div');
                page.style.cssText = 'width:794px; min-height:1123px; background:white; position:relative; padding:100px 40px 70px; font-size:14pt;';
                page.innerHTML = pages[i];
                container.appendChild(page);
                const canvas = await html2canvas(page, { scale: 2 });
                doc.addImage(canvas.toDataURL('image/jpeg', 1.0), 'JPEG', 0, 0, 210, 297);
            }
            doc.save(`${lessonName}_${resourceInfo.label}.pdf`);
            setSweetAlert({ show: true, type: 'success', title: 'வெற்றி! | Success!', message: 'Download started successfully!' });
        } catch (e: any) {
            setSweetAlert({ show: true, type: 'error', title: 'பிழை | Error', message: `Export failed: ${e.message}`, phone: '7904838296' });
        } finally { if (exportContainerRef.current) exportContainerRef.current.innerHTML = ''; }
    };

    const handleDownload = async (id: string) => {
        setSweetAlert({ show: true, type: 'loading', title: 'பதிவிறக்கம் | Downloading', message: 'தயவுசெய்து காத்திருக்கவும்...\n\nPlease wait...' });
        try {
            const res = await api.downloadContent(id, user._id, user.email);
            if (res.success) {
                if ((user.role === 'admin' || user.canEdit) && res.fileUrl) {
                    const l = document.createElement('a'); l.href = res.fileUrl; l.download = ''; l.click();
                    setSweetAlert({ show: true, type: 'success', title: 'வெற்றி! | Success!', message: 'Download started!' });
                } else setSweetAlert({ show: true, type: 'success', title: 'வெற்றி! | Success!', message: `PDF sent to ${user.email}!` });
            } else throw new Error(res.message);
        } catch (e: any) { setSweetAlert({ show: true, type: 'error', title: 'தோல்வி | Failed', message: e.message, phone: '7904838296' }); }
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full flex flex-col h-full overflow-hidden">
            <div className="flex justify-between items-center gap-4 mb-8">
                <div>
                    <div className="flex items-center gap-3 mb-1"><resourceInfo.Icon className={`w-8 h-8 ${resourceInfo.color}`} /><h2 className={`text-xl sm:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r ${resourceInfo.gradient}`}>{resourceInfo.label}</h2></div>
                    <p className="text-sm text-gray-500">{resourceInfo.description}</p>
                </div>
                <div className="flex items-center gap-2">
                    {!isWorksheet && <FontSizeControl />}
                    {!isLoading && !isWorksheet && contentItems.length > 0 && <button onClick={handleExport} className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg shadow-sm"><DownloadIcon className="w-5 h-5" /><span>PDF</span></button>}
                </div>
            </div>
            <div className="flex-1 overflow-y-auto min-h-0 no-scrollbar">
                {isLoading && <div className="text-center py-10 text-gray-500">Loading content...</div>}
                {!isLoading && contentItems.length > 0 && <div className={isWorksheet ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-6" : "space-y-4 pb-6"}>
                    {contentItems.map(item => <ContentCard key={item._id} item={item} onExpandPdf={setFullscreenPdfUrl} onDownload={handleDownload} resourceType={resourceType} />)}
                </div>}
                {!isLoading && contentItems.length === 0 && <div className="text-center py-20 bg-white dark:bg-gray-800/50 rounded-lg"><resourceInfo.Icon className="w-16 h-16 mx-auto text-gray-300 mb-4" /><p className="text-gray-500">No {resourceInfo.label.toLowerCase()} available.</p></div>}
            </div>
            {sweetAlert.show && <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"><div className="bg-white dark:bg-gray-800 rounded-2xl p-8 w-full max-w-md text-center">
                {sweetAlert.type === 'loading' && <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />}
                <h3 className="text-xl font-bold mb-3">{sweetAlert.title}</h3><p className="text-gray-600 mb-6 whitespace-pre-line">{sweetAlert.message}</p>
                {sweetAlert.type !== 'loading' && <button onClick={() => setSweetAlert(prev => ({ ...prev, show: false }))} className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg">OK</button>}
                {sweetAlert.phone && sweetAlert.type === 'error' && <a href={`tel:${sweetAlert.phone}`} className="mt-3 w-full py-3 bg-green-600 text-white font-semibold rounded-lg flex items-center justify-center gap-2">Call Admin</a>}
            </div></div>}
            {fullscreenPdfUrl && <div className="fixed inset-0 bg-black/90 z-50 flex flex-col h-screen w-screen"><button onClick={() => setFullscreenPdfUrl(null)} className="absolute top-4 right-4 p-2 bg-white/20 rounded-full text-white z-50"><XIcon className="w-6 h-6" /></button><div className="w-full h-full"><PdfViewer url={fullscreenPdfUrl} initialScale={2.5} /></div></div>}
            <div ref={exportContainerRef} className="fixed -left-[10000px] -top-[10000px] w-[794px] invisible" />
        </div>
    );
};