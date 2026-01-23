import React, { useState, useEffect, useRef } from 'react';
// Force rebuild
import { formatCount } from '../../utils/formatUtils';
import { Content, User, ResourceType } from '../../types';
import { useApi } from '../../hooks/useApi';
import * as api from '../../services/api';
import { NotesIcon } from '../icons/ResourceTypeIcons';
import { PlusIcon, EditIcon, TrashIcon, DownloadIcon, XIcon, EyeIcon } from '../icons/AdminIcons';
import { UnpublishedContentMessage } from '../common/UnpublishedContentMessage';
import { ConfirmModal } from '../ConfirmModal';
import { NoteEditor } from './NoteEditor';
import { useToast } from '../../context/ToastContext';
import { useSession } from '../../context/SessionContext';
import { FontSizeControl } from '../FontSizeControl';
import { processContentForHTML } from '../../utils/htmlUtils';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

declare global {
    interface Window {
        MathJax: any;
    }
}

interface NotesViewProps {
    lessonId: string;
    user: User;
}




const PublishToggle: React.FC<{ isPublished: boolean; onToggle: () => void }> = ({ isPublished, onToggle }) => (
    <button
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${isPublished ? 'bg-green-500' : 'bg-gray-200'}`}
        title={isPublished ? "Published" : "Draft"}
    >
        <span
            className={`${isPublished ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
        />
    </button>
);

const NoteCard: React.FC<{
    item: Content;
    onEdit: (c: Content) => void;
    onDelete: (id: string) => void;
    isAdmin: boolean;
    onTogglePublish?: (item: Content) => void;
}> = ({ item, onEdit, onDelete, isAdmin, onTogglePublish }) => {
    const { session } = useSession();
    const fontStyle = { fontSize: `${session.fontSize}px` };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 sm:px-8 relative group">
            <div
                className="tau-body prose prose-sm dark:prose-invert max-w-none text-black dark:text-white break-words font-tau-paalai"
                style={{
                    fontSize: `${fontStyle.fontSize}`,
                }}
                dangerouslySetInnerHTML={{ __html: processContentForHTML(item.body) }}
            />

        </div>
    );
};

// Function to check if an element is a heading
const isHeading = (el: HTMLElement): boolean => {
    return /^H[1-6]$/i.test(el.tagName);
};

// Function to split content into pages based on content height with intelligent breaking
const splitContentIntoPages = (htmlContent: string): string[] => {
    const pages: string[] = [];

    // Create a container for all content
    const contentContainer = document.createElement('div');
    contentContainer.innerHTML = htmlContent;

    // Flatten content logic to avoid duplication (Parent+Child)
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

    // Fallback if structure is unexpected
    if (flatBlocks.length === 0 && contentContainer.children.length > 0) {
        flatBlocks = Array.from(contentContainer.children) as HTMLElement[];
    }

    // Use flat blocks for pagination
    const blockElements = flatBlocks;

    // Create a temporary div to measure heights accurately
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

        // Intelligent breaking for headings
        if (isHeading(clone)) {
            const spaceLeft = maxHeightPerPage - currentHeight;
            if (spaceLeft < headingThreshold && currentPageHTML !== '') {
                pages.push(currentPageHTML);
                currentPageHTML = '';
                currentHeight = 0;
            }
        }

        // If the element is too tall for a full page, split it
        if (elementHeight > maxHeightPerPage && (element.tagName === 'P' || element.tagName === 'DIV')) {
            const textNodes = element.textContent?.split(/\s+/) || [];
            let splitParts: string[] = [];
            let currentPart = '';
            tempDiv.innerHTML = `<${element.tagName.toLowerCase()} style="${clone.style.cssText}"></${element.tagName.toLowerCase()}>`;
            const innerElem = tempDiv.firstChild as HTMLElement;

            for (let word of textNodes) {
                const testPart = currentPart + ' ' + word;
                innerElem.textContent = testPart;
                const testHeight = tempDiv.offsetHeight;
                if (testHeight > maxHeightPerPage) {
                    splitParts.push(currentPart.trim());
                    currentPart = word;
                } else {
                    currentPart = testPart;
                }
            }
            if (currentPart) splitParts.push(currentPart.trim());

            for (let part of splitParts) {
                const partClone = document.createElement(element.tagName.toLowerCase());
                partClone.style.cssText = clone.style.cssText;
                partClone.textContent = part;
                tempDiv.innerHTML = '';
                tempDiv.appendChild(partClone);
                elementHeight = tempDiv.offsetHeight;

                if (currentHeight + elementHeight > maxHeightPerPage && currentPageHTML !== '') {
                    pages.push(currentPageHTML);
                    currentPageHTML = '';
                    currentHeight = 0;
                }

                currentPageHTML += partClone.outerHTML;
                currentHeight += elementHeight;
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

            // Use element.rows to get all rows even if in tbody/thead
            // Note: This flattens structure to just rows inside the table tag
            // preserving original table attributes but losing tbody/thead grouping for splitting
            const rows = Array.from((element as HTMLTableElement).querySelectorAll('tr'));

            let tableHTML = openingTag;
            let tableHeight = 0;

            for (let row of rows) {
                tempDiv.innerHTML = '';
                // Wrap row in table for correct measurement
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
    const [version, setVersion] = useState(0);
    const { data: groupedContent, isLoading } = useApi(() => api.getContentsByLessonId(lessonId, ['notes'], (user.role !== 'admin' && !user.canEdit)), [lessonId, version, user]);
    const [editingNote, setEditingNote] = useState<Content | boolean | null>(null);
    const [confirmModalState, setConfirmModalState] = useState<{ isOpen: boolean; onConfirm: (() => void) | null }>({ isOpen: false, onConfirm: null });

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
    const resourceType: ResourceType = 'notes';
    const canEdit = user.role === 'admin' || !!user.canEdit;

    useEffect(() => {
        if (window.MathJax && !isLoading && notes.length > 0 && editingNote === null) {
            window.MathJax.typesetPromise();
        }
    }, [notes, isLoading, editingNote]);



    const handleSave = async (body: string) => {
        try {
            if (typeof editingNote === 'object' && editingNote !== null) {
                await api.updateContent(editingNote._id, { body });
            } else {
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = body;
                const textContent = tempDiv.textContent || tempDiv.innerText || '';
                const title = textContent.trim().substring(0, 50) || `Note - ${new Date().toLocaleDateString()}`;
                await api.addContent({ title, body, lessonId, type: resourceType });
            }
            setVersion(v => v + 1);
            showToast('Note saved successfully.', 'success');
        } catch (e) {
            showToast('Failed to save note.', 'error');
        }
        setEditingNote(null);
    };

    const handleDelete = (contentId: string) => {
        const confirmAction = async () => {
            try {
                await api.deleteContent(contentId);
                setVersion(v => v + 1);
                showToast('Note deleted.', 'error');
            } catch (e) {
                showToast('Failed to delete note.', 'error');
            }
            setConfirmModalState({ isOpen: false, onConfirm: null });
        };
        setConfirmModalState({ isOpen: true, onConfirm: confirmAction });
        setConfirmModalState({ isOpen: true, onConfirm: confirmAction });
    };

    const handleTogglePublish = async (item: Content) => {
        try {
            const newStatus = !item.isPublished;
            await api.updateContent(item._id, { isPublished: newStatus });
            setVersion(v => v + 1);
            showToast(`Note ${newStatus ? 'published' : 'unpublished'} successfully`, 'success');
        } catch (error) {
            console.error('Failed to toggle publish status:', error);
            showToast('Failed to update publish status', 'error');
        }
    };

    const handleCancelEdit = () => {
        setEditingNote(null);
    };

    // Load images for PDF
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
            console.error('Error loading image:', url, error);
            return '';
        }
    };

    // Function to remove unformatted duplicate content
    const removeUnformattedDuplicates = (html: string): string => {
        // Look for the first proper HTML heading tag
        const headingMatch = html.match(/<h[1-6][^>]*>/i);

        if (headingMatch && headingMatch.index) {
            return html.substring(headingMatch.index);
        }

        // Alternative: Look for the first div with note-section class
        const noteSectionMatch = html.match(/<div class="note-section" /i);
        if (noteSectionMatch && noteSectionMatch.index) {
            return html.substring(noteSectionMatch.index);
        }

        return html;
    };

    // PDF Export Logic
    const handleExportConfirm = async () => {


        setSweetAlert({
            show: true,
            type: 'loading',
            title: 'PDF உருவாக்கப்படுகிறது | Generating PDF',
            message: 'PDF தயாரிக்கப்படுகிறது... தயவுசெய்து காத்திருக்கவும்\n\nGenerating PDF... Please wait'
        });

        try {
            // 1. Fetch Hierarchy details
            const hierarchy = await api.getHierarchy(lessonId);
            const lessonName = hierarchy?.lessonName || 'Notes';

            // 2. Load logo
            const logoImage = await loadImage('/top_logo.png');

            // 3. Prepare all notes content
            let allNotesHTML = '';
            notes.forEach(note => {
                allNotesHTML += `<div class="note-section" style="margin-bottom: 15px;">${processContentForHTML(note.body)}</div>`;
            });

            if (notes.length === 0) {
                throw new Error('இந்த அத்தியாயத்தில் குறிப்புகள் இல்லை | No notes available for this chapter');
            }

            // Remove unformatted duplicates - DISABLED to prevent data loss
            // allNotesHTML = removeUnformattedDuplicates(allNotesHTML);

            // Additional cleanup: Remove any leading plain text before the first HTML tag
            const firstHtmlTag = allNotesHTML.match(/<[^>]+>/);
            if (firstHtmlTag && firstHtmlTag.index && firstHtmlTag.index > 0) {
                allNotesHTML = allNotesHTML.substring(firstHtmlTag.index);
            }

            // 4. Split content into pages
            const pages = splitContentIntoPages(allNotesHTML);
            console.log(`Split content into ${pages.length} pages`);

            // 5. Create PDF container
            if (!exportContainerRef.current) {
                throw new Error('Export container not found');
            }

            const container = exportContainerRef.current;
            container.innerHTML = '';

            // Add CSS styles for PDF
            const styleElement = document.createElement('style');
            styleElement.textContent = `
                .pdf-page {
                    width: 794px;
                    min-height: 1123px;
                    background: white;
                    position: relative;
                    font-family: 'Noto Sans Tamil', 'TAU-Paalai', 'Nirmala UI', 'Latha', 'Vijaya', 'Tunga', Arial, sans-serif;
                    page-break-after: always;
                    overflow: hidden;
                }

                .pdf-header {
                    position: absolute;
                    top: 20px;
                    left: 40px;
                    right: 40px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 1px solid #ddd;
                    padding-bottom: 10px;
                }

                .logo-container img {
                    width: 170px;
                    height: 22px;
                    object-fit: contain;
                }

                .header-info {
                    text-align: right;
                    font-size: 11px;
                    color: #555;
                    line-height: 1.3;
                }

                .header-info .class-info {
                    font-weight: bold;
                    color: #333;
                }

                .header-info .lesson-name {
                    font-size: 12px;
                    font-weight: bold;
                    margin-top: 3px;
                    color: #222;
                }

                .pdf-content {
                    position: absolute;
                    top: 100px;
                    left: 40px;
                    right: 40px; /* Increased right margin for safety */
                    bottom: 70px; /* Reduced bottom margin to fit more content safely */
                    font-size: 14pt;
                    line-height: 1.6;
                    color: #000;
                    text-align: justify;
                    overflow: hidden;
                    z-index: 10;
                }

                .pdf-footer {
                    position: absolute;
                    bottom: 30px;
                    left: 40px;
                    right: 40px;
                    border-top: 1px solid #ddd;
                    padding-top: 10px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    font-size: 10px;
                    color: #666;
                }

                .footer-quote {
                    font-style: normal;
                }

                .page-number {
                    font-weight: bold;
                }

                .note-section {
                    margin-bottom: 15px;
                }

                .note-section:last-child {
                    margin-bottom: 0;
                }

                .math-tex {
                    display: inline-block;
                    vertical-align: middle;
                }

                p {
                    margin-bottom: 12px;
                    line-height: 1.6;
                    color: #000;
                }

                h1, h2, h3, h4, h5, h6 {
                    margin-top: 20px;
                    margin-bottom: 8px;
                    line-height: 1.3;
                    font-weight: bold;
                    color: #000;
                }

                h1 { font-size: 24pt; }
                h2 { font-size: 18pt; }
                h3 { font-size: 16pt; }

                ul, ol {
                    margin: 10px 0 10px 20px;
                    padding-left: 20px;
                }

                ul { list-style-type: disc; }
                ol { list-style-type: decimal; }

                li {
                    margin-bottom: 5px;
                }

                strong { font-weight: bold; color: #000; }
                em, i { font-style: italic; }

                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 15px 0;
                    table-layout: fixed; /* Ensures table stays within width */
                    word-wrap: break-word; /* Prevents text overflow */
                }

                th, td {
                    border: 1px solid #000 !important; /* Darker border for PDF */
                    padding: 8px;
                    text-align: left;
                    vertical-align: top;
                    word-break: break-word; /* Break long words */
                    color: #000;
                    font-size: 12pt;
                }

                th {
                    background-color: #f0f0f0;
                    font-weight: bold;
                }

                img {
                    max-width: 100%;
                    height: auto;
                }
            `;
            container.appendChild(styleElement);

            // Create page elements
            pages.forEach((pageContent, index) => {
                const pageDiv = document.createElement('div');
                pageDiv.className = 'pdf-page';

                // Header
                const headerDiv = document.createElement('div');
                headerDiv.className = 'pdf-header';

                const logoDiv = document.createElement('div');
                logoDiv.className = 'logo-container';
                if (logoImage) {
                    const logoImg = document.createElement('img');
                    logoImg.src = logoImage;
                    logoImg.alt = 'TAU Logo';
                    logoDiv.appendChild(logoImg);
                }
                headerDiv.appendChild(logoDiv);

                const infoDiv = document.createElement('div');
                infoDiv.className = 'header-info';
                infoDiv.innerHTML = `
                    <div class="class-info">${hierarchy?.className || ''} - ${hierarchy?.subjectName || ''}</div>
                    <div>${hierarchy?.unitName || ''}${hierarchy?.subUnitName ? ' - ' + hierarchy.subUnitName : ''}</div>
                    <div class="lesson-name">${lessonName}</div>
                `;
                headerDiv.appendChild(infoDiv);
                pageDiv.appendChild(headerDiv);

                // Content
                const contentDiv = document.createElement('div');
                contentDiv.className = 'pdf-content';
                contentDiv.innerHTML = pageContent;
                pageDiv.appendChild(contentDiv);

                // Footer
                const footerDiv = document.createElement('div');
                footerDiv.className = 'pdf-footer';

                const quoteDiv = document.createElement('div');
                quoteDiv.className = 'footer-quote';
                quoteDiv.textContent = 'நினை சக்தி பிறக்கும்; செய் வெற்றி கிடைக்கும்';
                footerDiv.appendChild(quoteDiv);

                const pageNumDiv = document.createElement('div');
                pageNumDiv.className = 'page-number';
                pageNumDiv.textContent = `பக்கம் ${index + 1} / ${pages.length}`;
                footerDiv.appendChild(pageNumDiv);

                pageDiv.appendChild(footerDiv);
                container.appendChild(pageDiv);
            });

            // 6. Generate PDF with html2canvas (Updated Options)
            const doc = new jsPDF('p', 'mm', 'a4');
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            const pageElements = container.querySelectorAll('.pdf-page');

            for (let i = 0; i < pageElements.length; i++) {
                if (i > 0) {
                    doc.addPage();
                }
                const page = pageElements[i] as HTMLElement;

                const canvas = await html2canvas(page, {
                    scale: 2,
                    backgroundColor: '#ffffff',
                    logging: false,
                    useCORS: true,
                    allowTaint: true,
                    width: 794,
                    // height: 1123, // Removed fixed height to prevent clipping
                    windowWidth: 794,
                    onclone: (clonedDoc, element) => {
                        element.style.opacity = '1';
                        element.style.visibility = 'visible';
                        element.style.display = 'block';

                        const allElements = element.querySelectorAll('*');
                        allElements.forEach(el => {
                            if (el instanceof HTMLElement) {
                                // Ensure font is applied but fallback to serif for better print read
                                el.style.fontFamily = "'Noto Sans Tamil', 'TAU-Paalai', 'Nirmala UI', 'Latha', 'Vijaya', 'Tunga', Arial, sans-serif";
                            }
                        });
                    }
                });

                const imgData = canvas.toDataURL('image/jpeg', 1.0); // Changed to JPEG for smaller size and sometimes better text handling
                doc.addImage(imgData, 'JPEG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');

                if (i < pageElements.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }

            const pdfBlob = doc.output('blob');

            // 7. Handle PDF distribution - ALWAYS DIRECT DOWNLOAD
            const url = URL.createObjectURL(pdfBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${lessonName.replace(/[^a-zA-Z0-9\u0B80-\u0BFF]/g, '_')}_Notes_${new Date().toISOString().slice(0, 10)}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            setSweetAlert({
                show: true,
                type: 'success',
                title: 'வெற்றி! | Success!',
                message: 'கோப்பு பதிவிறக்கம் தொடங்கியது!\n\nDownload started successfully!'
            });


        } catch (error: any) {
            console.error('Export Error:', error);
            const adminPhone = '7904838296';
            setSweetAlert({
                show: true,
                type: 'error',
                title: 'பிழை | Error',
                message: `PDF பதிவிறக்கம் செய்ய முடியவில்லை.\n(${error.message})\n\nதயவு செய்து நிர்வாகியை தொடர்பு கொள்ளவும்:\n📞 ${adminPhone}`,
                phone: adminPhone
            });
        } finally {

            if (exportContainerRef.current) {
                exportContainerRef.current.innerHTML = '';
            }
            // Clean up style if needed (optional)
        }
    };



    return (
        <div className="p-4 sm:p-6 lg:p-8 h-full overflow-hidden flex flex-col">
            <div className="flex justify-between items-center mb-6 shrink-0">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-3">
                        <NotesIcon className="w-8 h-8 text-amber-500" />
                        <h1 className="text-lg sm:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-amber-500 dark:from-white dark:to-amber-400 whitespace-normal break-words leading-tight">Notes</h1>
                    </div>
                    {/* View Count next to Title */}
                    {/* View Count Removed */}
                </div>

                <div className="flex items-center gap-2">
                    {!editingNote && notes.length > 0 && (user.role === 'admin' || user.canDownload) && (
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

            {editingNote ? (
                <div className="tau-body flex-1 overflow-y-auto min-h-0 pb-3 no-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                    <NoteEditor
                        initialValue={typeof editingNote === 'object' && editingNote !== null ? editingNote.body : ''}
                        onSave={handleSave}
                        onCancel={handleCancelEdit}
                    />
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto min-h-0 pb-6 no-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                    {isLoading && <div className="text-center py-10">Loading notes...</div>}

                    {!isLoading && notes.length > 0 && (
                        <div className="space-y-[30px] px-2">
                            {notes.map(note => <NoteCard key={note._id} item={note} onEdit={setEditingNote} onDelete={handleDelete} isAdmin={canEdit} onTogglePublish={handleTogglePublish} />)}
                        </div>
                    )}

                    {!isLoading && notes.length === 0 && (
                        <div className="text-center py-20 bg-white dark:bg-gray-800/50 rounded-lg">
                            <NotesIcon className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600" />
                            <p className="mt-4 text-gray-500">No notes available for this chapter.</p>
                        </div>
                    )}
                </div>
            )}

            <ConfirmModal isOpen={confirmModalState.isOpen} onClose={() => setConfirmModalState({ isOpen: false, onConfirm: null })} onConfirm={confirmModalState.onConfirm} title="Delete Note" message="Are you sure you want to delete this note?" />



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

            <div
                ref={exportContainerRef}
                style={{
                    position: 'fixed',
                    top: '-10000px',
                    left: '-10000px',
                    width: '790px',
                    visibility: 'visible',
                    pointerEvents: 'none',
                    zIndex: -9999,
                }}
            />
        </div>
    );
};