import React, { useState, useEffect, useRef } from 'react';
import { Content, User } from '../../types';
import { useApi } from '../../hooks/useApi';
import * as api from '../../services/api';
import { NotesIcon } from '../icons/ResourceTypeIcons';
import { DownloadIcon } from '../icons/AdminIcons';
import { useSession } from '../../context/SessionContext';
import { FontSizeControl } from '../FontSizeControl';
import { processContentForHTML } from '../../utils/htmlUtils';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { useToast } from '../../context/ToastContext';

declare global {
    interface Window {
        MathJax: any;
    }
}

interface NotesViewProps {
    lessonId: string;
    user: User;
}

const NoteCard: React.FC<{ item: Content; }> = ({ item }) => {
    const { session } = useSession();
    const fontStyle = { fontSize: `${session.fontSize}px` };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 sm:px-8 relative group">
            <div
                className="tau-body prose prose-sm dark:prose-invert max-w-none text-black dark:text-white break-words font-tau-paalai"
                style={fontStyle}
                dangerouslySetInnerHTML={{ __html: processContentForHTML(item.body) }}
            />
        </div>
    );
};

const isHeading = (el: HTMLElement): boolean => {
    return /^H[1-6]$/i.test(el.tagName);
};

const splitContentIntoPages = (htmlContent: string): string[] => {
    const pages: string[] = [];
    const contentContainer = document.createElement('div');
    contentContainer.innerHTML = htmlContent;

    let flatBlocks: HTMLElement[] = [];
    const noteSections = Array.from(contentContainer.children);
    noteSections.forEach((section) => {
        const childNodes = Array.from(section.childNodes);
        if (childNodes.length === 0 && section.textContent?.trim()) {
            const p = document.createElement('p');
            p.innerHTML = section.innerHTML;
            flatBlocks.push(p);
        } else {
            childNodes.forEach(node => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    flatBlocks.push(node as HTMLElement);
                } else if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
                    const p = document.createElement('p');
                    p.textContent = node.textContent;
                    flatBlocks.push(p);
                }
            });
        }
    });

    if (flatBlocks.length === 0 && contentContainer.children.length > 0) {
        flatBlocks = Array.from(contentContainer.children) as HTMLElement[];
    }

    const blockElements = flatBlocks;
    const tempDiv = document.createElement('div');
    tempDiv.style.cssText = `
        position: absolute;
        visibility: hidden;
        left: -9999px;
        top: -9999px;
        width: 700px;
        font-family: 'Noto Sans Tamil', 'TAU-Paalai', 'Nirmala UI', 'Latha', 'Vijaya', 'Tunga', Arial, sans-serif;
        font-size: 14pt;
        line-height: 1.6;
        padding: 0;
        margin: 0;
        word-wrap: break-word;
        `;
    document.body.appendChild(tempDiv);

    const maxHeightPerPage = 880;
    const headingThreshold = 250;
    let currentPageHTML = '';
    let currentHeight = 0;

    for (let i = 0; i < blockElements.length; i++) {
        const element = blockElements[i];
        const clone = element.cloneNode(true) as HTMLElement;
        tempDiv.innerHTML = '';
        tempDiv.appendChild(clone);
        let elementHeight = tempDiv.offsetHeight;

        if (isHeading(clone)) {
            const spaceLeft = maxHeightPerPage - currentHeight;
            if (spaceLeft < headingThreshold && currentPageHTML !== '') {
                pages.push(currentPageHTML);
                currentPageHTML = '';
                currentHeight = 0;
            }
        }

        if (elementHeight > maxHeightPerPage && (element.tagName === 'P' || element.tagName === 'DIV')) {
            const textNodes = element.textContent?.split(/\s+/) || [];
            let currentPart = '';
            tempDiv.innerHTML = `<${element.tagName.toLowerCase()} style="${clone.style.cssText}"></${element.tagName.toLowerCase()}>`;
            const innerElem = tempDiv.firstChild as HTMLElement;

            for (let word of textNodes) {
                const testPart = currentPart + ' ' + word;
                innerElem.textContent = testPart;
                const testHeight = tempDiv.offsetHeight;
                if (testHeight > maxHeightPerPage) {
                    pages.push(currentPageHTML + `<p style="${clone.style.cssText}">${currentPart.trim()}</p>`);
                    currentPageHTML = '';
                    currentHeight = 0;
                    currentPart = word;
                } else {
                    currentPart = testPart;
                }
            }
            if (currentPart) {
                const partClone = document.createElement(element.tagName.toLowerCase());
                partClone.style.cssText = clone.style.cssText;
                partClone.textContent = currentPart.trim();
                currentPageHTML += partClone.outerHTML;
                currentHeight += tempDiv.offsetHeight;
            }
        } else if (element.tagName === 'UL' || element.tagName === 'OL') {
            const listItems = Array.from(clone.children);
            let listType = element.tagName.toLowerCase();
            let currentListHTML = `<${listType}>`;
            let listHeight = 0;

            for (let li of listItems) {
                tempDiv.innerHTML = '';
                tempDiv.appendChild(li.cloneNode(true));
                const liHeight = tempDiv.offsetHeight;

                if (currentHeight + listHeight + liHeight > maxHeightPerPage && currentPageHTML !== '') {
                    if (currentListHTML !== `<${listType}>`) {
                        currentPageHTML += currentListHTML + `</${listType}>`;
                    }
                    pages.push(currentPageHTML);
                    currentPageHTML = '';
                    currentHeight = 0;
                    currentListHTML = `<${listType}>`;
                    listHeight = 0;
                }
                currentListHTML += li.outerHTML;
                listHeight += liHeight;
            }
            if (currentListHTML !== `<${listType}>`) {
                currentPageHTML += currentListHTML + `</${listType}>`;
                currentHeight += listHeight;
            }
        } else if (element.tagName === 'TABLE') {
            const tableBase = element.cloneNode(false) as HTMLElement;
            const tempTable = document.createElement('div');
            tempTable.appendChild(tableBase);
            const openingTag = tempTable.innerHTML.replace(/<\/table>$/i, '');
            const rows = Array.from((element as HTMLTableElement).querySelectorAll('tr'));
            let tableHTML = openingTag;
            let tableHeight = 0;

            for (let row of rows) {
                tempDiv.innerHTML = '';
                const measureTable = element.cloneNode(false) as HTMLElement;
                measureTable.appendChild(row.cloneNode(true));
                tempDiv.appendChild(measureTable);
                const rowHeight = tempDiv.offsetHeight;

                if (currentHeight + tableHeight + rowHeight > maxHeightPerPage && currentPageHTML !== '') {
                    if (tableHTML !== openingTag) {
                        currentPageHTML += tableHTML + '</table>';
                    }
                    pages.push(currentPageHTML);
                    currentPageHTML = '';
                    currentHeight = 0;
                    tableHTML = openingTag;
                    tableHeight = 0;
                }
                tableHTML += row.outerHTML;
                tableHeight += rowHeight;
            }
            if (tableHTML !== openingTag) {
                currentPageHTML += tableHTML + '</table>';
                currentHeight += tableHeight;
            }
        } else {
            if (currentHeight + elementHeight > maxHeightPerPage && currentPageHTML !== '') {
                pages.push(currentPageHTML);
                currentPageHTML = '';
                currentHeight = 0;
            }
            currentPageHTML += clone.outerHTML;
            currentHeight += elementHeight;
        }

        if (i < blockElements.length - 1) {
            const spacing = 8;
            if (currentHeight + spacing > maxHeightPerPage && currentPageHTML !== '') {
                pages.push(currentPageHTML);
                currentPageHTML = '';
                currentHeight = 0;
            }
            currentPageHTML += '<div style="height: 8px;"></div>';
            currentHeight += spacing;
        }
    }

    if (currentPageHTML !== '') {
        pages.push(currentPageHTML);
    }

    document.body.removeChild(tempDiv);
    if (pages.length === 0) {
        pages.push('<div style="text-align: center; padding: 100px; color: #666; font-style: italic;">No notes available for this chapter.</div>');
    }
    return pages;
};

export const NotesView: React.FC<NotesViewProps> = ({ lessonId, user }) => {
    const { data: groupedContent, isLoading } = useApi(() => api.getContentsByLessonId(lessonId, ['notes'], true), [lessonId, user]);
    const { showToast } = useToast();
    const [sweetAlert, setSweetAlert] = useState<{
        show: boolean;
        type: 'loading' | 'success' | 'error';
        title: string;
        message: string;
        phone?: string
    }>({
        show: false,
        type: 'loading',
        title: '',
        message: ''
    });

    const exportContainerRef = useRef<HTMLDivElement>(null);
    const notes = groupedContent?.[0]?.docs || [];

    useEffect(() => {
        if (window.MathJax && !isLoading && notes.length > 0) {
            window.MathJax.typesetPromise();
        }

        // Track views for each note item
        if (!isLoading && notes.length > 0) {
            notes.forEach(note => {
                api.trackContentView(note._id).catch(() => { });
            });
        }
    }, [notes, isLoading]);

    const loadImage = async (url: string): Promise<string> => {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Failed to load ${url}`);
            const blob = await response.blob();
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.readAsDataURL(blob);
            });
        } catch (error) {
            return '';
        }
    };

    const handleExportConfirm = async () => {
        setSweetAlert({
            show: true,
            type: 'loading',
            title: 'PDF உருவாக்கப்படுகிறது | Generating PDF',
            message: 'PDF தயாரிக்கப்படுகிறது... தயவுசெய்து காத்திருக்கவும்\n\nGenerating PDF... Please wait'
        });

        try {
            const hierarchy = await api.getHierarchy(lessonId);
            const lessonName = hierarchy?.lessonName || 'Notes';
            const logoImage = await loadImage('/top_logo.png');

            let allNotesHTML = '';
            notes.forEach(note => {
                allNotesHTML += `<div class="note-section" style="margin-bottom: 15px;">${processContentForHTML(note.body)}</div>`;
            });

            if (notes.length === 0) {
                throw new Error('இந்த அத்தியாயத்தில் குறிப்புகள் இல்லை | No notes available for this chapter');
            }

            const firstHtmlTag = allNotesHTML.match(/<[^>]+>/);
            if (firstHtmlTag && firstHtmlTag.index && firstHtmlTag.index > 0) {
                allNotesHTML = allNotesHTML.substring(firstHtmlTag.index);
            }

            const pages = splitContentIntoPages(allNotesHTML);

            if (!exportContainerRef.current) {
                throw new Error('Export container not found');
            }

            const container = exportContainerRef.current;
            container.innerHTML = '';
            const styleElement = document.createElement('style');
            styleElement.textContent = `
                .pdf-page { width: 794px; min-height: 1123px; background: white; position: relative; font-family: 'Noto Sans Tamil', 'TAU-Paalai', 'Nirmala UI', 'Latha', 'Vijaya', 'Tunga', Arial, sans-serif; page-break-after: always; overflow: hidden; }
                .pdf-header { position: absolute; top: 20px; left: 40px; right: 40px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #ddd; padding-bottom: 10px; }
                .logo-container img { width: 170px; height: 22px; object-fit: contain; }
                .header-info { text-align: right; font-size: 11px; color: #555; line-height: 1.3; }
                .header-info .class-info { font-weight: bold; color: #333; }
                .header-info .lesson-name { font-size: 12px; font-weight: bold; margin-top: 3px; color: #222; }
                .pdf-content { position: absolute; top: 100px; left: 40px; right: 40px; bottom: 70px; font-size: 14pt; line-height: 1.6; color: #000; text-align: justify; overflow: hidden; z-index: 10; }
                .pdf-footer { position: absolute; bottom: 30px; left: 40px; right: 40px; border-top: 1px solid #ddd; padding-top: 10px; display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: #666; }
                .footer-quote { font-style: normal; }
                .page-number { font-weight: bold; }
                .note-section { margin-bottom: 15px; }
                p { margin-bottom: 12px; line-height: 1.6; color: #000; }
                h1, h2, h3 { margin-top: 20px; margin-bottom: 8px; line-height: 1.3; font-weight: bold; color: #000; }
                h1 { font-size: 24pt; } h2 { font-size: 18pt; } h3 { font-size: 16pt; }
                ul, ol { margin: 10px 0 10px 20px; padding-left: 20px; }
                li { margin-bottom: 5px; }
                table { width: 100%; border-collapse: collapse; margin: 15px 0; table-layout: fixed; word-wrap: break-word; }
                th, td { border: 1px solid #000 !important; padding: 8px; text-align: left; vertical-align: top; word-break: break-word; color: #000; font-size: 12pt; }
                th { background-color: #f0f0f0; font-weight: bold; }
                img { max-width: 100%; height: auto; }
            `;
            container.appendChild(styleElement);

            pages.forEach((pageContent, index) => {
                const pageDiv = document.createElement('div');
                pageDiv.className = 'pdf-page';
                pageDiv.innerHTML = `
                    <div class="pdf-header">
                        <div class="logo-container">${logoImage ? `<img src="${logoImage}" alt="TAU Logo">` : ''}</div>
                        <div class="header-info">
                            <div class="class-info">${hierarchy?.className || ''} - ${hierarchy?.subjectName || ''}</div>
                            <div>${hierarchy?.unitName || ''}${hierarchy?.subUnitName ? ' - ' + hierarchy.subUnitName : ''}</div>
                            <div class="lesson-name">${lessonName}</div>
                        </div>
                    </div>
                    <div class="pdf-content">${pageContent}</div>
                    <div class="pdf-footer">
                        <div class="footer-quote">நினை சக்தி பிறக்கும்; செய் வெற்றி கிடைக்கும்</div>
                        <div class="page-number">பக்கம் ${index + 1} / ${pages.length}</div>
                    </div>
                `;
                container.appendChild(pageDiv);
            });

            const doc = new jsPDF('p', 'mm', 'a4');
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            const pageElements = container.querySelectorAll('.pdf-page');

            for (let i = 0; i < pageElements.length; i++) {
                if (i > 0) doc.addPage();
                const page = pageElements[i] as HTMLElement;
                const canvas = await html2canvas(page, { scale: 2, backgroundColor: '#ffffff', logging: false, useCORS: true, width: 794, windowWidth: 794 });
                const imgData = canvas.toDataURL('image/jpeg', 1.0);
                doc.addImage(imgData, 'JPEG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
                if (i < pageElements.length - 1) await new Promise(resolve => setTimeout(resolve, 100));
            }

            doc.save(`${lessonName.replace(/[^a-zA-Z0-9\u0B80-\u0BFF]/g, '_')}_Notes_${new Date().toISOString().slice(0, 10)}.pdf`);
            setSweetAlert({
                show: true,
                type: 'success',
                title: 'வெற்றி! | Success!',
                message: 'கோப்பு பதிவிறக்கம் தொடங்கியது!\n\nDownload started successfully!'
            });
        } catch (error: any) {
            const adminPhone = '7904838296';
            setSweetAlert({
                show: true,
                type: 'error',
                title: 'பிழை | Error',
                message: `PDF பதிவிறக்கம் செய்ய முடியவில்லை.\n\nதயவு செய்து நிர்வாகியை தொடர்பு கொள்ளவும்:\n📞 ${adminPhone}`,
                phone: adminPhone
            });
        } finally {
            if (exportContainerRef.current) exportContainerRef.current.innerHTML = '';
        }
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 h-full overflow-hidden flex flex-col">
            <div className="flex justify-between items-center mb-6 shrink-0">
                <div className="flex items-center gap-3">
                    <NotesIcon className="w-8 h-8 text-amber-500" />
                    <h1 className="text-lg sm:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-amber-500 dark:from-white dark:to-amber-400 whitespace-normal break-words leading-tight">Notes</h1>
                </div>

                <div className="flex items-center gap-2">
                    {notes.length > 0 && (user.role === 'admin' || (user as any).canDownload) && (
                        <button
                            onClick={handleExportConfirm}
                            className="flex items-center justify-center p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm"
                            title="Download PDF"
                        >
                            <DownloadIcon className="w-5 h-5" />
                        </button>
                    )}
                    <FontSizeControl />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 pb-3 no-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                <div className="space-y-6">
                    {isLoading ? (
                        <div className="text-center py-10 text-gray-500">Loading notes...</div>
                    ) : notes.length > 0 ? (
                        notes.map(note => <NoteCard key={note._id} item={note} />)
                    ) : (
                        <div className="text-center py-20 bg-white dark:bg-gray-800/50 rounded-lg">
                            <NotesIcon className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600" />
                            <p className="mt-4 text-gray-500">No notes available.</p>
                        </div>
                    )}
                </div>
            </div>

            <div ref={exportContainerRef} className="absolute opacity-0 pointer-events-none" style={{ top: -9999, left: -9999 }}></div>

            {sweetAlert.show && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 sm:p-8 w-full max-w-sm text-center transform transition-all scale-100">
                        <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 ${sweetAlert.type === 'loading' ? 'bg-blue-100 dark:bg-blue-900/30' : sweetAlert.type === 'success' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                            {sweetAlert.type === 'loading' && <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>}
                            {sweetAlert.type === 'success' && <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"></path></svg>}
                            {sweetAlert.type === 'error' && <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>}
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{sweetAlert.title}</h3>
                        <p className="text-gray-600 dark:text-gray-400 mb-6 whitespace-pre-line leading-relaxed">{sweetAlert.message}</p>
                        {sweetAlert.type !== 'loading' && (
                            <div className="space-y-3">
                                <button onClick={() => setSweetAlert({ ...sweetAlert, show: false })} className="w-full py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl font-bold text-gray-700 dark:text-white transition-colors">Close</button>
                                {sweetAlert.phone && <a href={`tel:${sweetAlert.phone}`} className="block w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold shadow-lg transition-transform active:scale-95">Call Admin</a>}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};