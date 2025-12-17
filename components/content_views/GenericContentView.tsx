import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Content, User, ResourceType } from '../../types';
import { useApi } from '../../hooks/useApi';
import * as api from '../../services/api';
import { PlusIcon, EditIcon, TrashIcon, ChevronRightIcon, UploadCloudIcon, ExpandIcon, XIcon, EyeIcon, DownloadIcon } from '../icons/AdminIcons';
import { UnpublishedContentMessage } from '../common/UnpublishedContentMessage';
import { ConfirmModal } from '../ConfirmModal';
import { RESOURCE_TYPES } from '../../constants';
import { PdfViewer } from './PdfViewer';
import { useToast } from '../../context/ToastContext';
import { useSession } from '../../context/SessionContext';
import { FontSizeControl } from '../FontSizeControl';
import { FileUploadHelper } from '../../services/fileStorage';
import path from 'path';
import { processContentForHTML } from '../../utils/htmlUtils';
import { formatCount } from '../../utils/formatUtils';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

declare const Quill: any;

// Function to check if an element is a heading
const isHeading = (el: HTMLElement): boolean => {
    return /^H[1-6]$/i.test(el.tagName);
};

// Function to split content into pages (Adapted for QAView to keep pairs together)
const splitContentIntoPages = (htmlContent: string): string[] => {
    const pages: string[] = [];

    // Create a container for all content
    const contentContainer = document.createElement('div');
    contentContainer.innerHTML = htmlContent;

    // Use top-level children (QA Pairs) directly as blocks, DO NOT flatten them.
    // This ensures Q and A stay together unless the whole block is > page height.
    const blockElements: HTMLElement[] = Array.from(contentContainer.children) as HTMLElement[];

    // Create a temporary div to measure heights accurately
    const tempDiv = document.createElement('div');
    tempDiv.style.cssText = `
        position: absolute;
        visibility: hidden;
        left: -9999px;
        top: -9999px;
        width: 700px;
        font-family: 'TAU-Paalai', 'Nirmala UI', Arial, sans-serif;
        font-size: 14pt;
        line-height: 1.6;
        padding: 0;
        margin: 0;
        word-wrap: break-word;
    `;
    document.body.appendChild(tempDiv);

    const maxHeightPerPage = 900;
    const headingThreshold = 150;

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

        // Check if element fits on current page
        if (currentHeight + elementHeight > maxHeightPerPage && currentPageHTML !== '') {
            // If it doesn't fit, push current page and start new one
            pages.push(currentPageHTML);
            currentPageHTML = '';
            currentHeight = 0;
        }

        currentPageHTML += clone.outerHTML;
        currentHeight += elementHeight;

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
        pages.push('<div style="text-align: center; padding: 100px; color: #666; font-style: italic;">No content available for this chapter.</div>');
    }

    return pages;
};

interface GenericContentViewProps {
    lessonId: string;
    user: User;
    resourceType: ResourceType;
}

// ... (GenericEditorModal and ContentCard remain same)
// --- Generic Editor Modal (Rich Text for both Title and Content) ---
interface GenericEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: { title: string; body: string }) => Promise<void>;
    contentToEdit: Content | null;
    resourceLabel: string;
    resourceType: ResourceType;
}

const GenericEditorModal: React.FC<GenericEditorModalProps> = ({ isOpen, onClose, onSave, contentToEdit, resourceLabel, resourceType }) => {
    const [activeTab, setActiveTab] = useState<'title' | 'content'>('title');
    const [titleHtml, setTitleHtml] = useState('');
    const [bodyHtml, setBodyHtml] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isInitialized, setIsInitialized] = useState(false);

    const editorContainerRef = useRef<HTMLDivElement>(null);
    const quillRef = useRef<any>(null);

    const isActivity = resourceType === 'activity';
    const titleLabel = isActivity ? 'Question' : 'Title';
    const contentLabel = isActivity ? 'Answer' : 'Content';

    // Initialize editor and load content when modal opens
    useEffect(() => {
        if (!isOpen) {
            return;
        }

        console.log('[GenericEditor] Initializing for edit:', contentToEdit ? 'existing content' : 'new content');
        console.log('[GenericEditor] Full contentToEdit object:', contentToEdit);
        console.log('[GenericEditor] Title content:', contentToEdit?.title ? contentToEdit.title.substring(0, 100) + '...' : '(empty/null)');
        console.log('[GenericEditor] Body content:', contentToEdit?.body ? contentToEdit.body.substring(0, 100) + '...' : '(empty/null)');
        console.log('[GenericEditor] Body content length:', contentToEdit?.body?.length || 0);
        console.log('[GenericEditor] Body content type:', typeof contentToEdit?.body);
        console.log('[GenericEditor] Body content exists:', !!contentToEdit?.body);

        // Reset state for new session
        setIsInitialized(false);
        setActiveTab('title');

        // Load content from contentToEdit with proper mapping for activities
        const rawTitle = contentToEdit ? contentToEdit.title : '';
        const rawBody = contentToEdit ? contentToEdit.body : '';

        // For activities, ensure Question and Answer are properly mapped
        let questionContent = '';
        let answerContent = '';

        if (isActivity) {
            // For activities: Question should be in title, Answer should be in body
            questionContent = rawTitle;
            answerContent = rawBody;

            // Add verification to ensure content is not swapped
            if (rawTitle && rawBody && rawTitle.length > 0 && rawBody.length > 0) {
                // If both exist, verify they are different content
                if (rawTitle.trim() === rawBody.trim()) {
                    console.warn('[GenericEditor] WARNING: Question and Answer content are identical!');
                }
            }
        } else {
            // For non-activities: title is title, body is content
            questionContent = rawTitle;
            answerContent = rawBody;
        }

        console.log('[GenericEditor] Content mapping for activity:', isActivity);
        console.log('[GenericEditor] Raw titleContent:', rawTitle ? rawTitle.substring(0, 100) + '...' : '(empty)');
        console.log('[GenericEditor] Raw bodyContent:', rawBody ? rawBody.substring(0, 100) + '...' : '(empty)');
        console.log('[GenericEditor] Mapped Question content:', questionContent ? questionContent.substring(0, 100) + '...' : '(empty)');
        console.log('[GenericEditor] Mapped Answer content:', answerContent ? answerContent.substring(0, 100) + '...' : '(empty)');
        console.log('[GenericEditor] Setting titleHtml (Question) state, length:', questionContent.length);
        console.log('[GenericEditor] Setting bodyHtml (Answer) state, length:', answerContent.length);

        // Set states with proper mapping
        setTitleHtml(questionContent); // Question content
        setBodyHtml(answerContent);    // Answer content

        console.log('[GenericEditor] States set. Question:', questionContent.length, 'Answer:', answerContent.length);

        // Initialize Quill editor if not already done
        if (editorContainerRef.current && !quillRef.current) {
            console.log('[GenericEditor] Initializing Quill editor');

            const quill = new Quill(editorContainerRef.current, {
                theme: 'snow',
                modules: {
                    toolbar: [
                        ['bold', 'italic', 'underline', 'strike'],
                        ['blockquote', 'code-block'],
                        [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                        [{ 'script': 'sub' }, { 'script': 'super' }],
                        [{ 'color': [] }, { 'background': [] }],
                        ['image', 'video', 'formula'],
                        ['clean']
                    ],
                    keyboard: {
                        bindings: {
                            // Handler for Shift+Enter to insert <br>
                            linebreak: {
                                key: 13,
                                shiftKey: true,
                                handler: function (range) {
                                    this.quill.clipboard.dangerouslyPasteHTML(range.index, '<br>');
                                }
                            },
                            // Handler for Enter to insert <p> (Block Break)
                            enter: {
                                key: 13,
                                handler: function (range) {
                                    this.quill.format('block', 'P'); // Ensure paragraph block
                                    return true; // Propagate to default handler to insert new line
                                }
                            }
                        }
                    }
                },
                placeholder: 'Enter content...',
            });

            // Load initial content based on active tab (using mapped content)
            const initialContent = activeTab === 'title' ? questionContent : answerContent;
            console.log('[GenericEditor] Setting initial content for', activeTab, ':', initialContent ? initialContent.substring(0, 100) + '...' : '(empty)');
            console.log('[GenericEditor] Question content available:', !!questionContent, 'Answer content available:', !!answerContent);
            quill.root.innerHTML = initialContent || '';

            quillRef.current = quill;
            setIsInitialized(true);

            console.log('[GenericEditor] Editor initialized successfully');

            // Ensure content is properly loaded after a brief delay
            setTimeout(() => {
                if (quillRef.current && isOpen) {
                    const contentToLoad = activeTab === 'title' ? questionContent : answerContent;
                    if (quillRef.current.root.innerHTML !== contentToLoad) {
                        console.log('[GenericEditor] Correcting initial content load');
                        quillRef.current.root.innerHTML = contentToLoad || '';
                    }
                }
            }, 100);
        }
    }, [isOpen, contentToEdit]);

    // Cleanup when modal closes
    useEffect(() => {
        return () => {
            if (!isOpen) {
                console.log('[GenericEditor] Cleaning up editor');
                quillRef.current = null;
                setIsInitialized(false);
            }
        };
    }, [isOpen]);

    // Load content when tab changes - Ensure both title and body are properly loaded
    useEffect(() => {
        if (quillRef.current && isInitialized && isOpen) {
            const contentToLoad = activeTab === 'title' ? titleHtml : bodyHtml;
            const currentContent = quillRef.current.root.innerHTML;

            console.log('[GenericEditor] Tab changed to', activeTab);
            console.log('[GenericEditor] Content to load:', contentToLoad ? contentToLoad.substring(0, 100) + '...' : '(empty)');
            console.log('[GenericEditor] Current content:', currentContent ? currentContent.substring(0, 100) + '...' : '(empty)');
            console.log('[GenericEditor] BodyHtml state:', bodyHtml ? bodyHtml.substring(0, 100) + '...' : '(empty)');

            if (currentContent !== contentToLoad) {
                console.log('[GenericEditor] Loading content into Quill editor');
                quillRef.current.root.innerHTML = contentToLoad || '';
            }
        }
    }, [activeTab, isInitialized, titleHtml, bodyHtml, isOpen]);

    // Additional effect to ensure content is loaded when editor becomes available
    useEffect(() => {
        if (quillRef.current && isInitialized && isOpen && (activeTab === 'title' || activeTab === 'content')) {
            const contentToLoad = activeTab === 'title' ? titleHtml : bodyHtml;
            if (contentToLoad && quillRef.current.root.innerHTML !== contentToLoad) {
                console.log('[GenericEditor] Ensuring content is loaded for tab:', activeTab);
                quillRef.current.root.innerHTML = contentToLoad;
            }
        }
    }, [isInitialized, activeTab, titleHtml, bodyHtml, isOpen]);

    const handleTabSwitch = (newTab: 'title' | 'content') => {
        if (newTab === activeTab || !quillRef.current || !isInitialized) return;

        console.log('[GenericEditor] Switching from', activeTab, 'to', newTab);

        // Save current tab content before switching
        const currentContent = quillRef.current.root.innerHTML;
        console.log('[GenericEditor] Saving current content before switch:', currentContent.substring(0, 100) + '...');

        if (activeTab === 'title') {
            setTitleHtml(currentContent);
            console.log('[GenericEditor] Saved title content');
        } else {
            setBodyHtml(currentContent);
            console.log('[GenericEditor] Saved body content');
        }

        // Switch to new tab
        setActiveTab(newTab);
        console.log('[GenericEditor] Tab switched to:', newTab);

        // Force load the new content immediately for better UX
        setTimeout(() => {
            if (quillRef.current) {
                // Use the content from state variables for more reliable loading
                let contentToLoad = '';
                let tabName = '';
                if (newTab === 'title') {
                    contentToLoad = titleHtml;  // Question content
                    tabName = 'Question';
                    console.log('[GenericEditor] Force loading', tabName, 'content, length:', contentToLoad.length);
                } else {
                    contentToLoad = bodyHtml;   // Answer content
                    tabName = 'Answer';
                    console.log('[GenericEditor] Force loading', tabName, 'content, length:', contentToLoad.length);
                    console.log('[GenericEditor] Answer content preview:', contentToLoad.substring(0, 100) + '...');
                }

                // Force set the content even if it's empty to ensure proper state
                quillRef.current.root.innerHTML = contentToLoad;
                console.log('[GenericEditor]', tabName, 'content set in editor, current length:', quillRef.current.root.innerHTML.length);
            }
        }, 50);
    };

    const handleSaveClick = async () => {
        if (isSaving) return;

        let finalTitle = titleHtml;
        let finalBody = bodyHtml;

        if (quillRef.current) {
            const currentContent = quillRef.current.root.innerHTML;
            if (activeTab === 'title') finalTitle = currentContent;
            else finalBody = currentContent;
        }

        if (!finalTitle.trim() || !finalBody.trim()) {
            alert(`Both ${titleLabel} and ${contentLabel} are required.`);
            return;
        }

        setIsSaving(true);
        await onSave({ title: finalTitle, body: finalBody });
        setTitleHtml('');
        setBodyHtml('');
        if (quillRef.current) quillRef.current.root.innerHTML = '';
        setIsSaving(false);
    };

    const handleClose = () => {
        setTitleHtml('');
        setBodyHtml('');
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl flex flex-col max-h-[90vh] overflow-hidden">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white">{contentToEdit ? `Edit ${resourceLabel}` : `Add New ${resourceLabel}`}</h2>
                    <button onClick={handleClose} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                        <span className="text-2xl">&times;</span>
                    </button>
                </div>
                <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                    <button
                        className={`flex-1 py-3 text-sm font-medium text-center transition-colors ${activeTab === 'title' ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 border-t-2 border-blue-500' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                        onClick={() => handleTabSwitch('title')}
                    >
                        {titleLabel}
                    </button>
                    <button
                        className={`flex-1 py-3 text-sm font-medium text-center transition-colors ${activeTab === 'content' ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 border-t-2 border-blue-500' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                        onClick={() => handleTabSwitch('content')}
                    >
                        {contentLabel}
                    </button>
                </div>
                <div className="flex-1 flex flex-col p-4 overflow-hidden bg-white dark:bg-gray-800">
                    <div className="bg-white dark:bg-gray-700 rounded-lg border border-gray-300 dark:border-gray-600 flex-1 flex flex-col overflow-hidden text-gray-900 dark:text-gray-100">
                        <div ref={editorContainerRef} className="flex-1 overflow-y-auto" style={{ minHeight: '200px' }}></div>
                    </div>
                </div>
                <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex justify-end gap-3">
                    <button onClick={handleClose} className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600" disabled={isSaving}>Cancel</button>
                    <button onClick={handleSaveClick} className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-blue-400" disabled={isSaving}>
                        {isSaving ? 'Saving...' : `Save ${resourceLabel}`}
                    </button>
                </div>
            </div>
        </div>
    );
};


const ContentCard: React.FC<{ item: Content; onEdit: (c: Content) => void; onDelete: (id: string) => void; isAdmin: boolean; onExpandPdf?: (url: string) => void; onDownload?: (id: string) => void; onTogglePublish?: (item: Content) => void }> = ({ item, onEdit, onDelete, isAdmin, onExpandPdf, onDownload, onTogglePublish }) => {
    const [isOpen, setIsOpen] = useState(false);
    // Check if this is a PDF-based content (either has fileId or is worksheet with file metadata)
    const isPdf = item.type === 'worksheet' && (item.metadata as any)?.fileId;
    const { session } = useSession();

    const fontStyle = { fontSize: `${session.fontSize}px` };

    // Helper to get PDF URL for worksheet PDFs
    const getPdfUrl = () => {
        try {
            // For file-based worksheets
            if ((item.metadata as any)?.fileId) {
                const fileUrl = FileUploadHelper.getFileUrl((item.metadata as any).fileId);
                if (fileUrl) {
                    return fileUrl;
                }
            }

            // Fallback to legacy base64 system if present
            if (item.body && item.body.startsWith('data:application/pdf')) {
                return item.body;
            }

            // If content has a filePath, try to construct URL from it
            if (item.filePath) {
                const path = require('path');
                const filename = path.basename(item.filePath);
                return `/api/files/${filename}`;
            }
            return null;
        } catch (e) {
            console.error('Error generating PDF URL:', e);
            return null;
        }
    };

    const pdfUrl = isPdf ? getPdfUrl() : null;

    if (isPdf) {
        return (
            <div
                className="group bg-white dark:bg-gray-800 rounded-2xl shadow-sm hover:shadow-2xl transition-all duration-300 border border-gray-100 dark:border-gray-700 flex flex-col h-72 sm:h-80 transform hover:-translate-y-1 overflow-hidden"
                onClick={() => {
                    if (onExpandPdf) onExpandPdf(pdfUrl || '');
                    // View increment removed
                }}
            >
                <div className="flex-1 bg-gray-50 dark:bg-gray-900 flex items-center justify-center overflow-hidden relative group-hover:bg-gray-100 dark:group-hover:bg-gray-900/80 transition-theme">
                    {/* Decorative Background Pattern */}
                    <div className="absolute inset-0 opacity-5 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:16px_16px]"></div>

                    {pdfUrl ? (
                        <div className="w-full h-full pointer-events-none opacity-90 group-hover:opacity-100 transition-opacity scale-95 group-hover:scale-100 duration-500 shadow-inner">
                            <PdfViewer url={pdfUrl} initialScale={0.45} />
                        </div>
                    ) : (
                        <div className="text-center p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-dashed border-gray-200 dark:border-gray-700">
                            <div className="text-red-400 font-medium mb-1">Preview Unavailable</div>
                            <div className="text-xs text-gray-400">PDF could not be loaded</div>
                        </div>
                    )}

                    {/* Overlay Action Button */}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/10 dark:group-hover:bg-black/30 transition-all duration-300 backdrop-blur-[1px] opacity-0 group-hover:opacity-100">
                        <div className="transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                            <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-4 py-2 rounded-full shadow-lg font-medium text-sm flex items-center gap-2">
                                <ExpandIcon className="w-4 h-4" />
                                <span>View Fullscreen</span>
                            </div>
                        </div>
                    </div>

                    {/* Badge */}
                    <div className="absolute top-3 left-3 px-2 py-1 bg-blue-600 text-white text-[10px] font-bold uppercase tracking-wider rounded shadow-md z-10">
                        PDF
                    </div>
                </div>

                <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 relative z-20">
                    <div className="flex justify-between items-start gap-3">
                        <h3 className="font-semibold text-gray-800 dark:text-gray-100 text-sm leading-snug line-clamp-2" title={item.title}>{item.title}</h3>
                        <div className="flex items-center gap-1 shrink-0 -mt-1 -mr-1" onClick={e => e.stopPropagation()}>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (onDownload) onDownload(item._id);
                                }}
                                className="p-2 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/30 text-gray-400 hover:text-blue-600 transition-colors"
                                title={isAdmin ? "Download" : "Email PDF"}
                            >
                                <DownloadIcon className="w-5 h-5" />
                            </button>

                            {isAdmin && (
                                <button onClick={() => onDelete(item._id)} className="p-2 rounded-full hover:bg-red-50 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500 transition-colors" title="Delete">
                                    <TrashIcon className="w-5 h-5" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="group bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 dark:border-gray-700 overflow-hidden mb-4 transform hover:-translate-y-0.5">
            <div className={`
                w-full text-left p-5 flex flex-col relative cursor-pointer
                bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-800/50
             `} onClick={() => {
                    setIsOpen(!isOpen);
                }}>
                {/* Left Accent Bar */}
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 rounded-l-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>

                <div className="flex justify-between items-start w-full gap-4">
                    <div className="flex-1">
                        <div className="prose dark:prose-invert max-w-none font-semibold text-lg text-gray-800 dark:text-white font-tau-paalai leading-snug" style={fontStyle} dangerouslySetInnerHTML={{ __html: processContentForHTML(item.title) }} />
                    </div>
                    <div className="flex items-center shrink-0 gap-2">
                        {isAdmin && onTogglePublish && (
                            <div className="mr-2" onClick={e => e.stopPropagation()}>
                                <div className="mr-2" onClick={e => e.stopPropagation()}>
                                    <PublishToggle
                                        isPublished={!!item.isPublished}
                                        onToggle={() => onTogglePublish(item)}
                                    />
                                </div>
                            </div>
                        )}
                        {isAdmin && (
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200 transform translate-x-2 group-hover:translate-x-0" onClick={e => e.stopPropagation()}>
                                <button onClick={() => onEdit(item)} className="p-2 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/30 text-gray-400 hover:text-blue-600 transition-colors" title="Edit">
                                    <EditIcon className="w-4 h-4" />
                                </button>
                                <button onClick={() => onDelete(item._id)} className="p-2 rounded-full hover:bg-red-50 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500 transition-colors" title="Delete">
                                    <TrashIcon className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                        <div className={`p-1.5 rounded-full bg-gray-100 dark:bg-gray-700 transition-all duration-300 ${isOpen ? 'rotate-90 bg-blue-100 text-blue-600' : 'text-gray-400'}`}>
                            <ChevronRightIcon className="w-5 h-5" />
                        </div>
                    </div>
                </div>
            </div>

            <div className={`grid transition-all duration-300 ease-in-out ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                <div className="overflow-hidden">
                    <div className="p-5 border-t border-dashed border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30">
                        <div className="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 font-tau-paalai" style={fontStyle} dangerouslySetInnerHTML={{ __html: processContentForHTML(item.body) }} />
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- PDF Upload Form Component ---
// Added lessonId to props for auto-title and path generation
const PdfUploadForm: React.FC<{ onSave: (data: { title: string; body: string; metadata?: any }) => Promise<void>; onCancel: () => void; lessonId: string; }> = ({ onSave, onCancel, lessonId }) => {
    const [title, setTitle] = useState('Loading title...');
    const [file, setFile] = useState<File | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [folderPath, setFolderPath] = useState('');
    const { showToast } = useToast();

    // Optimized Path and Title Logic - Fast loading with minimal API calls
    useEffect(() => {
        const fetchTitleAndPath = async () => {
            try {
                console.log('=== FAST PATH GENERATION START ===');

                // Strategy 1: Try breadcrumbs first (fastest for lessons)
                const breadcrumbs = await api.getBreadcrumbs(lessonId);
                if (breadcrumbs && breadcrumbs.trim()) {
                    const parts = breadcrumbs.split(' > ').filter(part => part.trim());
                    if (parts.length >= 2) {
                        const fileName = parts[parts.length - 1];
                        const hierarchyPath = parts.join('/');
                        const fullVirtualPath = `${hierarchyPath}/Worksheet/${fileName}.pdf`;

                        console.log('Fast path from breadcrumbs:', fullVirtualPath);
                        setTitle(fileName);
                        setFolderPath(fullVirtualPath);
                        return;
                    }
                }

                console.log('Breadcrumbs failed, trying fast search...');

                // Strategy 2: Fast identification with minimal calls
                let foundLevel = false;
                let breadcrumbParts: string[] = [];
                let fileName = 'New Worksheet';

                // Get all classes first (usually just 2-3)
                const classes = await api.getClasses();

                // Try each class - parallel approach would be better but this is still fast
                for (const classItem of classes) {
                    const subjects = await api.getSubjectsByClassId(classItem._id);

                    for (const subject of subjects) {
                        const units = await api.getUnitsBySubjectId(subject._id);

                        // Check if lessonId matches any unit directly
                        const unit = units.find(u => u._id === lessonId);
                        if (unit) {
                            breadcrumbParts = [classItem.name, subject.name, unit.name];
                            fileName = unit.name;
                            foundLevel = true;
                            break;
                        }

                        // Check subUnits
                        for (const unitItem of units) {
                            const subUnits = await api.getSubUnitsByUnitId(unitItem._id);

                            const subUnit = subUnits.find(su => su._id === lessonId);
                            if (subUnit) {
                                breadcrumbParts = [classItem.name, subject.name, unitItem.name, subUnit.name];
                                fileName = subUnit.name;
                                foundLevel = true;
                                break;
                            }

                            // Only check lessons if we haven't found it yet
                            if (!foundLevel) {
                                for (const subUnitItem of subUnits) {
                                    const lessons = await api.getLessonsBySubUnitId(subUnitItem._id);
                                    const lesson = lessons.find(l => l._id === lessonId);
                                    if (lesson) {
                                        // Should have been caught by breadcrumbs, but just in case
                                        breadcrumbParts = [classItem.name, subject.name, unitItem.name, subUnitItem.name, lesson.name];
                                        fileName = lesson.name;
                                        foundLevel = true;
                                        break;
                                    }
                                }
                            }
                        }

                        if (foundLevel) break;
                    }
                    if (foundLevel) break;
                }

                // Generate final path
                if (foundLevel && breadcrumbParts.length > 0) {
                    const hierarchyPath = breadcrumbParts.join('/');
                    const fullVirtualPath = `${hierarchyPath}/Worksheet/${fileName}.pdf`;

                    console.log('Fast path from search:', fullVirtualPath);
                    setTitle(fileName);
                    setFolderPath(fullVirtualPath);
                } else {
                    // Quick fallback
                    console.log('Quick fallback for:', lessonId);
                    const fallbackTitle = `Worksheet_${lessonId.slice(-4)}`;
                    const fallbackPath = `Class/Worksheet/${fallbackTitle}.pdf`;

                    setTitle(fallbackTitle);
                    setFolderPath(fallbackPath);
                }

            } catch (e) {
                console.error('Fast path generation error:', e);
                setTitle('New Worksheet');
                setFolderPath('Default/Worksheet/New Worksheet.pdf');
            }
        };

        if (lessonId) {
            // No timeout delay for faster response
            fetchTitleAndPath();
        } else {
            setTitle('Select a lesson/unit first');
            setFolderPath('Worksheets/Pending Selection');
        }
    }, [lessonId]);

    useEffect(() => {
        return () => {
            if (previewUrl) URL.revokeObjectURL(previewUrl);
        }
    }, [previewUrl]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile && selectedFile.type === 'application/pdf') {
            setFile(selectedFile);
            const url = URL.createObjectURL(selectedFile);
            setPreviewUrl(url);
        } else if (selectedFile) {
            showToast("Please select a valid PDF file.", 'error');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file || !title || isSaving) return;

        setIsSaving(true);
        try {
            // Upload and store the file using the new file storage system
            const uploadResult = await FileUploadHelper.uploadFile(
                file,
                lessonId,
                'worksheet',
                title,
                { folderPath, fileName: file.name }
            );

            // Save content with proper metadata
            const contentData = {
                title,
                body: FileUploadHelper.getFileUrl(uploadResult.fileId) || '',
                metadata: {
                    fileId: uploadResult.fileId,
                    filePath: uploadResult.path,
                    fileName: file.name,
                    fileSize: file.size,
                    uploadDate: new Date().toISOString()
                }
            };

            await onSave(contentData);
            showToast("Worksheet saved successfully!", 'success');
        } catch (error) {
            console.error("Save failed", error);
            showToast("Failed to save worksheet.", 'error');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
            <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-white">Upload Worksheet (PDF)</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Title</label>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="mt-1 w-full p-2 border rounded-md bg-white dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                        required
                    />
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 font-mono truncate" title={folderPath}>
                        Virtual Path: {folderPath}
                    </p>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">PDF File</label>
                    <div className="mt-1 flex items-center justify-center px-6 pt-5 pb-6 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-md">
                        <div className="space-y-1 text-center">
                            <UploadCloudIcon className="mx-auto h-12 w-12 text-gray-400" />
                            <div className="flex text-sm text-gray-600 dark:text-gray-400 justify-center">
                                <label htmlFor="worksheet-upload" className="relative cursor-pointer bg-white dark:bg-gray-800 rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none">
                                    <span>Upload a file</span>
                                    <input id="worksheet-upload" name="worksheet-upload" type="file" className="sr-only" onChange={handleFileChange} accept=".pdf" />
                                </label>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-500">{file ? file.name : 'PDF up to 10MB'}</p>
                        </div>
                    </div>
                </div>

                {previewUrl && (
                    <div className="h-64 border rounded overflow-hidden">
                        <PdfViewer url={previewUrl} initialScale={0.6} />
                    </div>
                )}

                <div className="flex justify-end gap-3 pt-2">
                    <button type="button" onClick={onCancel} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-md text-gray-700 dark:text-gray-200" disabled={isSaving}>Cancel</button>
                    <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md disabled:bg-blue-400" disabled={isSaving || !file}>
                        {isSaving ? 'Uploading...' : 'Save Worksheet'}
                    </button>
                </div>
            </form>
        </div>
    );
};


const ExportEmailModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onExport: (email: string) => void;
    isLoading: boolean;
}> = ({ isOpen, onClose, onExport, isLoading }) => {
    const [email, setEmail] = useState('');

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onExport(email);
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md p-6 transform transition-all scale-100">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">Export to PDF</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                        <XIcon className="w-6 h-6" />
                    </button>
                </div>

                <p className="text-sm text-gray-600 dark:text-gray-300 mb-6 font-medium">
                    Enter your email address to receive the PDF copy.
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email Address</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="your@email.com"
                            required
                            className="w-full px-4 py-2 border rounded-lg bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 dark:text-white"
                        />
                    </div>

                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full px-4 py-3 bg-gradient-to-r from-green-600 to-teal-600 text-white rounded-lg hover:from-green-700 hover:to-teal-700 transition-all font-bold shadow-md flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {isLoading ? (
                                <span>Generating PDF...</span>
                            ) : (
                                <>
                                    <span>Export & Send Mail</span>
                                    <DownloadIcon className="w-5 h-5" />
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export const GenericContentView: React.FC<GenericContentViewProps> = ({ lessonId, user, resourceType }) => {
    const [version, setVersion] = useState(0);
    const { data: groupedContent, isLoading } = useApi(() => api.getContentsByLessonId(lessonId, [resourceType], (user.role !== 'admin' && !user.canEdit)), [lessonId, version, resourceType, user]);

    const [modalState, setModalState] = useState<{ isOpen: boolean; content: Content | null }>({ isOpen: false, content: null });
    const [confirmModalState, setConfirmModalState] = useState<{ isOpen: boolean; onConfirm: (() => void) | null }>({ isOpen: false, onConfirm: null });
    const [isAddingPdf, setIsAddingPdf] = useState(false);
    const [fullscreenPdfUrl, setFullscreenPdfUrl] = useState<string | null>(null);
    const [stats, setStats] = useState<{ count: number; downloads: number } | null>(null);
    const { showToast } = useToast();

    // Export state
    const [exportModalOpen, setExportModalOpen] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const exportContainerRef = useRef<HTMLDivElement>(null);

    // SweetAlert state
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

    const contentItems = groupedContent?.[0]?.docs || [];
    const resourceInfo = RESOURCE_TYPES.find(r => r.key === resourceType) || { key: resourceType, label: resourceType, Icon: () => null, description: 'Resource', color: 'text-gray-500', gradient: 'from-gray-500 to-gray-600' };
    const canEdit = user.role === 'admin' || !!user.canEdit;
    const isWorksheet = resourceType === 'worksheet';

    const handleSave = async (contentData: { title: string; body: string; metadata?: any }) => {
        try {
            if (modalState.content) {
                // For worksheet content, preserve the metadata
                const updatedContent: any = { ...contentData };
                if (modalState.content.metadata && (modalState.content.metadata as any).fileId) {
                    updatedContent.metadata = modalState.content.metadata;
                }
                await api.updateContent(modalState.content._id, updatedContent);
            } else {
                // For new worksheet content with metadata (file upload), save with metadata
                if (isWorksheet && contentData.metadata) {
                    await api.addContent({
                        title: contentData.title,
                        body: contentData.body || '', // Use provided body or empty string
                        metadata: contentData.metadata,
                        lessonId,
                        type: resourceType
                    });
                } else {
                    await api.addContent({ ...contentData, lessonId, type: resourceType });
                }
            }
            setVersion(v => v + 1);
            showToast(`${resourceInfo.label} saved successfully!`, 'success');
        } catch (e) {
            showToast('Failed to save content.', 'error');
        }
        setModalState({ isOpen: false, content: null });
        setIsAddingPdf(false);
    };

    const handleDelete = (contentId: string) => {
        const confirmAction = async () => {
            try {
                await api.deleteContent(contentId);
                setVersion(v => v + 1);
                showToast(`${resourceInfo.label} deleted.`, 'error');
            } catch (e) {
                showToast('Failed to delete content.', 'error');
            }
            setConfirmModalState({ isOpen: false, onConfirm: null });
        };
        setConfirmModalState({ isOpen: true, onConfirm: confirmAction });
    };

    const handleTogglePublish = async (item: Content) => {
        try {
            const newStatus = !item.isPublished;
            await api.updateContent(item._id, { isPublished: newStatus });
            setVersion(v => v + 1);
            showToast(`Content ${newStatus ? 'published' : 'unpublished'} successfully`, 'success');
        } catch (error) {
            console.error('Failed to toggle publish status:', error);
            showToast('Failed to update publish status', 'error');
        }
    };

    const handleAddClick = () => {
        if (isWorksheet) {
            setIsAddingPdf(true);
        } else {
            setModalState({ isOpen: true, content: null });
        }
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

    // Export PDF Logic
    const handleExportConfirm = async (email: string) => {
        setIsExporting(true);
        const isAdmin = user.role === 'admin' || user.canEdit;

        setSweetAlert({
            show: true,
            type: 'loading',
            title: 'PDF உருவாக்கப்படுகிறது | Generating PDF',
            message: 'PDF தயாரிக்கப்படுகிறது... தயவுசெய்து காத்திருக்கவும்\n\nGenerating PDF... Please wait'
        });

        try {
            // 1. Fetch Hierarchy details
            const hierarchy = await api.getHierarchy(lessonId);
            const lessonName = hierarchy?.lessonName || resourceInfo.label;

            // 2. Load logo
            const logoImage = await loadImage('/top_logo.png');

            // 3. Prepare all content
            let allQAHTML = '';

            // Helper to strip manual numbering from user content since we add our own
            const cleanTitleText = (text: string) => {
                // Regex matches:
                // 1. Prefix (tags/whitespace) - Captured in Group 1
                // 2. Optional whitespace
                // 3. The Number (\d+)
                // 4. Separator (., ), -, or space) - one or more
                // 5. Trailing whitespace
                // callback prunes the prefix of trailing spaces so "<p> 1. " becomes "<p>"
                return text.replace(/^(\s*(?:<[^>]+>\s*)*)\s*\d+[\.\)\-\s]+\s*/, (match, prefix) => {
                    return prefix.replace(/\s+$/, '');
                });
            };

            contentItems.forEach((item, index) => {
                const qText = item.title ? processContentForHTML(cleanTitleText(item.title)) : '';
                const aText = item.body ? processContentForHTML(item.body) : '';

                allQAHTML += `
                    <div class="qa-pair-container" style="border: 1px solid #eee; border-radius: 8px; padding: 8px 12px; margin-bottom: 12px; background-color: #fcfcfc;">
                        <div class="question-part" style="font-weight: bold; font-size: 15pt; margin-bottom: 4px; color: #000; line-height: 1.4;">
                            <span style="color: #2563eb; margin-right: 5px;">${index + 1}.</span>
                            ${qText}
                        </div>
                        <div class="answer-part" style="font-size: 14pt; margin-left: 0px; color: #333; line-height: 1.5;">
                            ${aText}
                        </div>
                    </div>
                `;
            });

            if (contentItems.length === 0) {
                throw new Error(`இந்த அத்தியாயத்தில் ${resourceInfo.label} இல்லை | No ${resourceInfo.label} available for this chapter`);
            }

            // 4. Split content into pages
            const pages = splitContentIntoPages(allQAHTML);
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
                    font-family: 'TAU-Paalai', 'Nirmala UI', Arial, sans-serif;
                    page-break-after: always;
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
                    right: 54px;
                    bottom: 100px;
                    font-size: 14pt;
                    line-height: 1.6;
                    color: #000;
                    text-align: justify;
                    overflow: visible;
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
               
                .qa-pair-container {
                    border: 1px solid #eee;
                    border-radius: 8px;
                    padding: 15px;
                    margin-bottom: 20px;
                    background-color: #fcfcfc;
                }

                .qa-pair-container:last-child {
                    margin-bottom: 0;
                }

                p {
                    margin-bottom: 12px;
                    line-height: 1.6;
                }
               
                h1, h2, h3, h4, h5, h6 {
                    margin-top: 20px;
                    margin-bottom: 8px;
                    line-height: 1.3;
                    font-weight: bold;
                }

                ul, ol {
                    margin: 10px 0 10px 20px;
                    padding-left: 20px;
                }

                ul { list-style-type: disc; }
                ol { list-style-type: decimal; }
               
                li {
                    margin-bottom: 5px;
                }

                strong { font-weight: bold; }
                em, i { font-style: italic; }

                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 10px 0;
                }

                th, td {
                    border: 1px solid #ddd;
                    padding: 8px;
                    text-align: left;
                }

                th {
                    background-color: #f2f2f2;
                    font-weight: bold;
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

            // 6. Generate PDF with html2canvas
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
                    height: 1123,
                    windowWidth: 794,
                    onclone: (clonedDoc, element) => {
                        element.style.opacity = '1';
                        element.style.visibility = 'visible';
                        element.style.display = 'block';

                        const allElements = element.querySelectorAll('*');
                        allElements.forEach(el => {
                            if (el instanceof HTMLElement) {
                                el.style.fontFamily = "'TAU-Paalai', 'Nirmala UI', Arial, sans-serif";
                            }
                        });
                    }
                });

                const imgData = canvas.toDataURL('image/png');
                doc.addImage(imgData, 'PNG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');

                if (i < pageElements.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }

            const pdfBlob = doc.output('blob');

            // 7. Handle PDF distribution based on user role
            if (isAdmin) {
                // ADMIN: Direct download
                const url = URL.createObjectURL(pdfBlob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `${lessonName.replace(/[^a-zA-Z0-9\u0B80-\u0BFF]/g, '_')}_${resourceInfo.label}_${new Date().toISOString().slice(0, 10)}.pdf`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);

                // Increment download count
                api.incrementLessonDownload(lessonId, resourceType).catch(console.error);
                setStats(prev => prev ? { ...prev, downloads: prev.downloads + 1 } : { count: 0, downloads: 1 });

                setSweetAlert({
                    show: true,
                    type: 'success',
                    title: 'வெற்றி! | Success!',
                    message: 'கோப்பு பதிவிறக்கம் தொடங்கியது!\n\nDownload started successfully!'
                });
            } else {
                // USER: Send via email
                setSweetAlert({
                    show: true,
                    type: 'loading',
                    title: 'மின்னஞ்சல் அனுப்பப்படுகிறது | Sending Email',
                    message: 'PDF மின்னஞ்சலுக்கு அனுப்பப்படுகிறது...\n\nSending PDF to email...'
                });

                const formData = new FormData();
                formData.append('file', pdfBlob, `${lessonName}_${resourceInfo.label}.pdf`);
                formData.append('email', email);
                formData.append('title', `${resourceInfo.label}: ${lessonName}`);
                formData.append('lessonId', lessonId);
                formData.append('type', resourceType);
                formData.append('userName', user.name || 'User');

                const res = await fetch('/api/export/send-pdf', {
                    method: 'POST',
                    body: formData,
                });

                const responseData = await res.json();

                if (res.ok && responseData.success) {
                    // Increment download count
                    api.incrementLessonDownload(lessonId, resourceType).catch(console.error);
                    setStats(prev => prev ? { ...prev, downloads: prev.downloads + 1 } : { count: 0, downloads: 1 });

                    setSweetAlert({
                        show: true,
                        type: 'success',
                        title: 'வெற்றி! | Success!',
                        message: `PDF உங்கள் மின்னஞ்சலுக்கு அனுப்பப்பட்டது!\n📧 ${email}\n\nஇன்பாக்ஸ் மற்றும் ஸ்பேம் போல்டரை சரிபார்க்கவும்.\n\nPDF sent to your email successfully!`
                    });
                } else {
                    throw new Error(responseData.message || 'மின்னஞ்சல் அனுப்புவதில் பிழை');
                }
            }

            setExportModalOpen(false);

        } catch (error: any) {
            console.error('Export Error:', error);
            const adminPhone = '7904838296';
            setSweetAlert({
                show: true,
                type: 'error',
                title: user.role === 'admin' || user.canEdit ? 'பிழை | Error' : 'மின்னஞ்சல் தோல்வி | Email Failed',
                message: (user.role === 'admin' || user.canEdit)
                    ? `Export தோல்வியடைந்தது: ${error.message}\n\nதொடர்புக்கு: ${adminPhone}`
                    : `PDF மின்னஞ்சலுக்கு அனுப்ப முடியவில்லை.\n(${error.message})\n\nதயவு செய்து நிர்வாகியை தொடர்பு கொள்ளவும்:\n📞 ${adminPhone}`,
                phone: adminPhone
            });
        } finally {
            setIsExporting(false);
            if (exportContainerRef.current) {
                exportContainerRef.current.innerHTML = '';
            }
        }
    };

    const handleExportInitiate = () => {
        if (canEdit) {
            handleExportConfirm(user.email || 'admin@example.com');
        } else {
            if (user.email) {
                handleExportConfirm(user.email);
            } else {
                setExportModalOpen(true);
            }
        }
    };

    const handleDownload = async (contentId: string) => {
        setSweetAlert({
            show: true,
            type: 'loading',
            title: 'பதிவிறக்குகிறது | Downloading',
            message: 'தயவுசெய்து காத்திருக்கவும்...\n\nPlease wait...'
        });

        const isAdminUser = user.role === 'admin' || !!user.canEdit;

        try {
            const res = await api.downloadContent(contentId, user._id, user.email);

            if (res.success) {
                if (isAdminUser && res.fileUrl) {
                    // Admin: Direct Download
                    const link = document.createElement('a');
                    link.href = res.fileUrl;
                    link.setAttribute('download', '');
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);

                    setSweetAlert({
                        show: true,
                        type: 'success',
                        title: 'வெற்றி! | Success!',
                        message: 'கோப்பு பதிவிறக்கம் தொடங்கியது!\n\nDownload started successfully!'
                    });
                } else {
                    // User: Email Sent
                    setSweetAlert({
                        show: true,
                        type: 'success',
                        title: 'வெற்றி! | Success!',
                        message: `PDF உங்கள் மின்னஞ்சலுக்கு அனுப்பப்பட்டது!\n📧 ${user.email}\n\nPDF sent to your email successfully!`
                    });
                }
            } else {
                throw new Error(res.message || 'Download failed');
            }
        } catch (error: any) {
            setSweetAlert({
                show: true,
                type: 'error',
                title: 'தோல்வி | Failed',
                message: error.message || 'Download failed',
                phone: '7904838296'
            });
        }
    };



    useEffect(() => {
        const updateStats = async () => {
            // Map resourceType to API type key
            const validTypes = ['book', 'slide', 'video', 'audio', 'flashcard', 'worksheet', 'questionPaper', 'quiz', 'activity'];
            const typeKey = resourceType as any;
            if (!validTypes.includes(typeKey)) return;

            try {
                const h: any = await api.getHierarchy(lessonId);
                const downloadCountKey = `${typeKey}DownloadCount`;
                setStats({ count: 0, downloads: h[downloadCountKey] || 0 });
            } catch (e) {
                console.error('Failed to fetch stats', e);
            }
        };
        updateStats();
    }, [lessonId, resourceType]);

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full flex flex-col h-full overflow-hidden">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <resourceInfo.Icon className={`w-8 h-8 ${resourceInfo.color}`} />
                        <h2 className={`text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r ${resourceInfo.gradient}`}>
                            {resourceInfo.label}
                        </h2>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 pl-1">{resourceInfo.description}</p>
                </div>

                <div className="flex items-center gap-2 sm:gap-4">
                    {/* Added Font Size Control here too - Hidden for Worksheets */}
                    {!isWorksheet && <FontSizeControl />}

                    {/* Export Button for non-worksheets */}
                    {!isLoading && !isWorksheet && contentItems.length > 0 && (
                        <button
                            onClick={handleExportInitiate}
                            className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm"
                            title="Export to PDF"
                        >
                            <DownloadIcon className="w-5 h-5" />
                            <span className="hidden sm:inline">PDF</span>
                            <span className="bg-white/20 px-1.5 py-0.5 rounded text-xs font-semibold ml-1">
                                {formatCount(stats?.downloads || 0)}
                            </span>
                        </button>
                    )}

                    {canEdit && !isAddingPdf && (
                        <button onClick={handleAddClick} className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors" title={`Add New ${resourceInfo.label}`}>
                            <PlusIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                            <span className="hidden sm:inline">Add New</span>
                        </button>
                    )}
                </div>
            </div>


            <div className="flex-1 overflow-y-auto min-h-0 no-scrollbar">
                {isLoading && <div className="text-center py-10">Loading content...</div>}

                {isAddingPdf && (
                    // Passing lessonId to PdfUploadForm for path generation
                    <PdfUploadForm onSave={handleSave} onCancel={() => setIsAddingPdf(false)} lessonId={lessonId} />
                )}

                {!isLoading && !isAddingPdf && contentItems.length > 0 && (
                    // Responsive Grid for Worksheets (PDFs), List for others - Larger grid
                    <div className={isWorksheet ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6 lg:gap-8 pb-6" : "space-y-3 sm:space-y-4 pb-6"}>
                        {contentItems.map(item => {
                            console.log('[GenericContentView] Content item:', {
                                id: item._id,
                                title: item.title?.substring(0, 50) + '...',
                                body: item.body?.substring(0, 50) + '...',
                                bodyLength: item.body?.length || 0,
                                type: item.type
                            });
                            return (
                                <ContentCard
                                    key={item._id}
                                    item={item}
                                    onEdit={(c) => {
                                        console.log('[GenericContentView] Edit clicked for item:', {
                                            id: c._id,
                                            title: c.title?.substring(0, 50) + '...',
                                            body: c.body?.substring(0, 50) + '...',
                                            bodyLength: c.body?.length || 0
                                        });
                                        setModalState({ isOpen: true, content: c })
                                    }}
                                    onDelete={handleDelete}
                                    isAdmin={canEdit}
                                    onExpandPdf={setFullscreenPdfUrl}
                                    onDownload={handleDownload}
                                    onTogglePublish={handleTogglePublish}
                                />
                            );
                        })}
                    </div>
                )}

                {!isLoading && !isAddingPdf && contentItems.length === 0 && (
                    <div className="text-center py-20 bg-white dark:bg-gray-800/50 rounded-lg">
                        <resourceInfo.Icon className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600" />
                        <p className="mt-4 text-gray-500">No {resourceInfo.label.toLowerCase()} available for this chapter.</p>
                    </div>
                )}
            </div>

            <GenericEditorModal isOpen={modalState.isOpen} onClose={() => setModalState({ isOpen: false, content: null })} onSave={handleSave} contentToEdit={modalState.content} resourceLabel={resourceInfo.label} resourceType={resourceType} />
            <ConfirmModal isOpen={confirmModalState.isOpen} onClose={() => setConfirmModalState({ isOpen: false, onConfirm: null })} onConfirm={confirmModalState.onConfirm} title={`Delete ${resourceInfo.label}`} message={`Are you sure you want to delete this ${resourceInfo.label.toLowerCase()}?`} />

            {fullscreenPdfUrl && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex flex-col animate-fade-in h-screen w-screen">
                    <div className="flex justify-end p-2 bg-black/50 absolute top-0 right-0 z-50 rounded-bl-lg">
                        <button
                            onClick={() => setFullscreenPdfUrl(null)}
                            className="p-2 rounded-full bg-white/20 hover:bg-white/40 text-white transition-colors"
                            aria-label="Close fullscreen PDF viewer"
                        >
                            <XIcon className="w-6 h-6" />
                        </button>
                    </div>
                    <div className="w-full h-full">
                        <PdfViewer
                            url={fullscreenPdfUrl}
                            initialScale={2.5}
                        />
                    </div>
                </div>
            )}

            <ExportEmailModal
                isOpen={exportModalOpen}
                onClose={() => setExportModalOpen(false)}
                onExport={handleExportConfirm}
                isLoading={isExporting}
            />

            {/* Hidden Container for PDF Content Staging */}
            <div
                ref={exportContainerRef}
                style={{
                    position: 'fixed',
                    top: '-10000px',
                    left: '-10000px',
                    width: '794px',
                    visibility: 'visible',
                    pointerEvents: 'none',
                    zIndex: -9999,
                }}
            />

            {/* SweetAlert UI */}
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
        </div>
    );
};