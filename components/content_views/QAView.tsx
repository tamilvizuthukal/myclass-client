import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Content, User, ResourceType, QAMetadata, QuestionType, CognitiveProcess } from '../../types';
import { useApi } from '../../hooks/useApi';
import * as api from '../../services/api';
import { QAIcon } from '../icons/ResourceTypeIcons';
import { PlusIcon, EditIcon, TrashIcon, ChevronRightIcon, DownloadIcon, XIcon, EyeIcon } from '../icons/AdminIcons';
import { UnpublishedContentMessage } from '../common/UnpublishedContentMessage';
import { ConfirmModal } from '../ConfirmModal';
import { useSession } from '../../context/SessionContext';
import { useToast } from '../../context/ToastContext';
import { FontSizeControl } from '../FontSizeControl';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

import {
    processContentForHTML
} from '../../utils/htmlUtils';
import { formatCount } from '../../utils/formatUtils';

declare const Quill: any;

declare global {
    interface Window {
        MathJax: any;
    }
}

interface QAViewProps {
    lessonId: string;
    user: User;
}

// --- Constants & Helpers ---
const COGNITIVE_PROCESSES: { [key in CognitiveProcess]: { label: string, color: string } } = {
    'CP1': { label: 'Conceptual Clarity', color: 'bg-blue-100 text-blue-800 border-blue-200' },
    'CP2': { label: 'Application Skill', color: 'bg-green-100 text-green-800 border-green-200' },
    'CP3': { label: 'Computational Thinking', color: 'bg-purple-100 text-purple-800 border-purple-200' },
    'CP4': { label: 'Analytical Thinking', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
    'CP5': { label: 'Critical Thinking', color: 'bg-red-100 text-red-800 border-red-200' },
    'CP6': { label: 'Creative Thinking', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
    'CP7': { label: 'Values/Attitudes', color: 'bg-pink-100 text-pink-800 border-pink-200' },
};

const getMarksColor = (marks: number): string => {
    switch (marks) {
        case 2: return 'bg-teal-100 text-teal-800 border-teal-200';
        case 3: return 'bg-sky-100 text-sky-800 border-sky-200';
        case 5: return 'bg-orange-100 text-orange-800 border-orange-200';
        case 6: return 'bg-rose-100 text-rose-800 border-rose-200';
        default: return 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
    }
};

const getQuestionTypeColor = (type: QuestionType): string => {
    switch (type) {
        case 'Basic': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
        case 'Average': return 'bg-amber-100 text-amber-800 border-amber-200';
        case 'Profound': return 'bg-violet-100 text-violet-800 border-violet-200';
        default: return 'bg-gray-100 text-gray-600 border-gray-200';
    }
};

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

        // If the element is larger than a single page even when empty, we technically should split it.
        // But for Q&A pairs which are complex structures, simple text splitting is destructive.
        // We will assume Q&A pairs are reasonable size (10 list items).
        // If one is massive, it will just overflow effectively or we'd need complex logic.
        // For now, allow it to be added to the new page.

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
        pages.push('<div style="text-align: center; padding: 100px; color: #666; font-style: italic;">No Q&A available for this chapter.</div>');
    }

    return pages;
};

// --- Components ---

interface QAEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: { title: string; body: string; metadata: QAMetadata }) => Promise<void>;
    contentToEdit: Content | null;
}

const QAEditorModal: React.FC<QAEditorModalProps> = ({ isOpen, onClose, onSave, contentToEdit }) => {
    const [activeTab, setActiveTab] = useState<'question' | 'answer'>('question');
    const [questionHtml, setQuestionHtml] = useState('');
    const [answerHtml, setAnswerHtml] = useState('');
    const [marks, setMarks] = useState<number>(2);
    const [qType, setQType] = useState<QuestionType>('Basic');
    const [cogProcess, setCogProcess] = useState<CognitiveProcess>('CP1');
    const [isSaving, setIsSaving] = useState(false);
    const [isInitialized, setIsInitialized] = useState(false);
    const editorContainerRef = useRef<HTMLDivElement>(null);
    const quillRef = useRef<any>(null);

    // Initialize Quill editor and load content
    useEffect(() => {
        if (!isOpen) return;

        const initializeEditor = () => {
            setIsInitialized(false);
            setActiveTab('question');

            const questionContent = contentToEdit ? contentToEdit.title : '';
            const answerContent = contentToEdit ? contentToEdit.body : '';

            setQuestionHtml(questionContent);
            setAnswerHtml(answerContent);

            const meta = contentToEdit?.metadata as QAMetadata | undefined;
            setMarks(meta?.marks || 2);
            setQType(meta?.questionType || 'Basic');
            setCogProcess(meta?.cognitiveProcess || 'CP1');

            if (editorContainerRef.current && !quillRef.current) {
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
                                linebreak: {
                                    key: 13,
                                    shiftKey: true,
                                    handler: function (range) {
                                        this.quill.clipboard.dangerouslyPasteHTML(range.index, '<br>');
                                    }
                                }
                            }
                        }
                    },
                    placeholder: 'Enter content...'
                });

                const initialContent = activeTab === 'question' ? questionContent : answerContent;
                quill.root.innerHTML = initialContent;
                quillRef.current = quill;
                setIsInitialized(true);
            }
        };

        const timer = setTimeout(initializeEditor, 100);
        return () => clearTimeout(timer);
    }, [isOpen, contentToEdit]);

    useEffect(() => {
        return () => {
            if (!isOpen) {
                quillRef.current = null;
                setIsInitialized(false);
            }
        };
    }, [isOpen]);

    useEffect(() => {
        if (quillRef.current && isInitialized && isOpen) {
            const contentToLoad = activeTab === 'question' ? questionHtml : answerHtml;
            const currentContent = quillRef.current.root.innerHTML;
            if (currentContent !== contentToLoad) {
                quillRef.current.root.innerHTML = contentToLoad;
            }
        }
    }, [activeTab, isInitialized, questionHtml, answerHtml, isOpen]);

    const handleTabSwitch = (newTab: 'question' | 'answer') => {
        if (newTab === activeTab || !quillRef.current || !isInitialized) return;
        const currentContent = quillRef.current.root.innerHTML;
        if (activeTab === 'question') {
            setQuestionHtml(currentContent);
        } else {
            setAnswerHtml(currentContent);
        }
        setActiveTab(newTab);
    };

    const handleSaveClick = async () => {
        if (isSaving) return;
        let finalQuestion = questionHtml;
        let finalAnswer = answerHtml;

        if (quillRef.current && isInitialized) {
            const currentContent = quillRef.current.root.innerHTML;
            if (activeTab === 'question') {
                finalQuestion = currentContent;
            } else {
                finalAnswer = currentContent;
            }
        }

        if (!finalQuestion.trim() || !finalAnswer.trim()) {
            alert("Both Question and Answer must have content.");
            return;
        }

        setIsSaving(true);
        try {
            const metadata: QAMetadata = { marks, questionType: qType, cognitiveProcess: cogProcess };
            await onSave({ title: finalQuestion, body: finalAnswer, metadata });
            handleClose();
        } catch (error) {
            console.error('Error saving Q&A:', error);
            alert('Error saving Q&A. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleClose = () => {
        setQuestionHtml('');
        setAnswerHtml('');
        setMarks(2);
        setQType('Basic');
        setCogProcess('CP1');
        setActiveTab('question');
        setIsInitialized(false);
        if (quillRef.current) {
            quillRef.current.root.innerHTML = '';
        }
        quillRef.current = null;
        onClose();
    };
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl flex flex-col max-h-[90vh] overflow-hidden">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white">{contentToEdit ? 'Edit Q&A' : 'Add New Q&A'}</h2>
                    <button onClick={handleClose} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"><span className="text-2xl">&times;</span></button>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-900/50 grid grid-cols-1 sm:grid-cols-3 gap-4 border-b border-gray-200 dark:border-gray-700">
                    <div><label className="block text-xs font-medium text-gray-500 uppercase mb-1">Marks</label><select value={marks} onChange={(e) => setMarks(Number(e.target.value))} className="w-full p-2 text-sm border rounded bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white"><option value={2}>2 Marks</option><option value={3}>3 Marks</option><option value={5}>5 Marks</option><option value={6}>6 Marks</option></select></div>
                    <div><label className="block text-xs font-medium text-gray-500 uppercase mb-1">Question Type</label><select value={qType} onChange={(e) => setQType(e.target.value as QuestionType)} className="w-full p-2 text-sm border rounded bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white"><option value="Basic">Basic</option><option value="Average">Average</option><option value="Profound">Profound</option></select></div>
                    <div><label className="block text-xs font-medium text-gray-500 uppercase mb-1">Cognitive Process</label><select value={cogProcess} onChange={(e) => setCogProcess(e.target.value as CognitiveProcess)} className="w-full p-2 text-sm border rounded bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white">{Object.entries(COGNITIVE_PROCESSES).map(([key, value]) => (<option key={key} value={key}>{key} - {value.label}</option>))}</select></div>
                </div>
                <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                    <button className={`flex-1 py-3 text-sm font-medium text-center transition-colors ${activeTab === 'question' ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 border-t-2 border-blue-500' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`} onClick={() => handleTabSwitch('question')}>Question</button>
                    <button className={`flex-1 py-3 text-sm font-medium text-center transition-colors ${activeTab === 'answer' ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 border-t-2 border-blue-500' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`} onClick={() => handleTabSwitch('answer')}>Answer</button>
                </div>
                <div className="flex-1 flex flex-col p-4 overflow-hidden bg-white dark:bg-gray-800">
                    <div className="bg-white dark:bg-gray-700 rounded-lg border border-gray-300 dark:border-gray-600 flex-1 flex flex-col overflow-hidden text-gray-900 dark:text-gray-100">
                        <div ref={editorContainerRef} className="flex-1 overflow-y-auto tamil-text" style={{ minHeight: '200px', fontFamily: "'Noto Sans Tamil', 'Kailasa', 'Latha', sans-serif" }}></div>
                    </div>
                </div>
                <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex justify-end gap-3">
                    <button onClick={handleClose} className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600" disabled={isSaving}>Cancel</button>
                    <button onClick={handleSaveClick} className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-blue-400" disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Q&A'}</button>
                </div>
            </div>
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
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">Export Q&A to PDF</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                        <XIcon className="w-6 h-6" />
                    </button>
                </div>

                <p className="text-sm text-gray-600 dark:text-gray-300 mb-6 font-medium">
                    Enter your email address to receive the PDF copy of these Q&A.
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

const QACard: React.FC<{
    item: Content;
    isOpen: boolean;
    onToggle: () => void;
    onEdit: (c: Content) => void;
    onDelete: (id: string) => void;
    isAdmin: boolean;
    onTogglePublish?: (item: Content) => void;
}> = ({ item, isOpen, onToggle, onEdit, onDelete, isAdmin, onTogglePublish }) => {

    const { session } = useSession();
    const meta = item.metadata as QAMetadata | undefined;
    const cp = meta?.cognitiveProcess ? COGNITIVE_PROCESSES[meta.cognitiveProcess] : null;

    const fontStyle = { fontSize: `${session.fontSize}px` };

    return (
        <div className={`
            group bg-white dark:bg-gray-800 rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 
            border-l-4 ${item.isPublished ? 'border-l-green-500' : 'border-l-gray-300'}
            border-y border-r border-gray-100 dark:border-gray-700 overflow-hidden mb-5 transform hover:-translate-y-1
            ${isOpen ? 'ring-2 ring-blue-100 dark:ring-blue-900 shadow-md' : ''}
        `}>
            <div onClick={onToggle} className="relative w-full text-left p-5 sm:p-6 cursor-pointer bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-800/50">

                {/* Decorative left border accent based on question type or default */}
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 transition-colors duration-300 ${meta?.questionType === 'Profound' ? 'bg-violet-500' :
                    meta?.questionType === 'Average' ? 'bg-amber-500' :
                        meta?.questionType === 'Basic' ? 'bg-emerald-500' : 'bg-blue-500'
                    }`}></div>

                <div className="flex flex-wrap items-center gap-2 mb-3 pl-2">
                    {meta?.marks && (
                        <span className={`px-2.5 py-1 rounded-md text-[10px] font-extrabold uppercase tracking-widest shadow-sm ${getMarksColor(meta.marks)}`}>
                            {meta.marks} Marks
                        </span>
                    )}
                    {meta?.questionType && (
                        <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest shadow-sm border ${getQuestionTypeColor(meta.questionType)}`}>
                            {meta.questionType}
                        </span>
                    )}
                    {cp && (
                        <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest shadow-sm border ${cp.color}`}>
                            {cp.label}
                        </span>
                    )}
                </div>

                <div className="flex justify-between items-start w-full pl-2">
                    <div className="flex-1 pr-6">
                        <div className="prose dark:prose-invert max-w-none text-lg font-semibold text-gray-800 dark:text-gray-100 qa-content tamil-text font-tau-paalai leading-relaxed" style={fontStyle} dangerouslySetInnerHTML={{ __html: processContentForHTML(item.title) }} />
                    </div>

                    <div className="flex items-center shrink-0 gap-3">
                        {isAdmin && (
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200 transform translate-x-2 group-hover:translate-x-0" onClick={e => e.stopPropagation()}>
                                {onTogglePublish && (
                                    <PublishToggle
                                        isPublished={!!item.isPublished}
                                        onToggle={() => onTogglePublish(item)}
                                    />
                                )}
                                <button onClick={(e) => { e.stopPropagation(); onEdit(item); }} className="p-2 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/30 text-gray-400 hover:text-blue-600 transition-colors shadow-sm border border-transparent hover:border-blue-100 dark:hover:border-blue-800" title="Edit Q&A">
                                    <EditIcon className="w-4 h-4" />
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); onDelete(item._id); }} className="p-2 rounded-full hover:bg-red-50 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-600 transition-colors shadow-sm border border-transparent hover:border-red-100 dark:hover:border-red-800" title="Delete Q&A">
                                    <TrashIcon className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                        <div className={`p-2 rounded-full bg-white dark:bg-gray-700 shadow-sm border border-gray-100 dark:border-gray-600 transition-all duration-300 ${isOpen ? 'rotate-90 bg-blue-50 dark:bg-blue-900/30 text-blue-600' : 'text-gray-400'}`}>
                            <ChevronRightIcon className="w-5 h-5" />
                        </div>
                    </div>
                </div>
            </div>

            <div className={`grid transition-all duration-300 ease-in-out ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                <div className="overflow-hidden">
                    <div className="p-6 pt-2 bg-gradient-to-b from-white to-gray-50/50 dark:from-gray-800 dark:to-gray-900/50 border-t border-dashed border-gray-200 dark:border-gray-700">
                        <div className="flex gap-4">
                            <div className="shrink-0 pt-1">
                                <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400 font-bold text-sm shadow-sm">
                                    A
                                </div>
                            </div>
                            <div className="flex-1">
                                <div className="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 qa-content tamil-text font-tau-paalai leading-relaxed text-base" style={fontStyle} dangerouslySetInnerHTML={{ __html: processContentForHTML(item.body) }} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const QAView: React.FC<QAViewProps> = ({ lessonId, user }) => {
    const [version, setVersion] = useState(0);
    const { data: groupedContent, isLoading } = useApi(() => api.getContentsByLessonId(lessonId, ['qa'], (user.role !== 'admin' && !user.canEdit)), [lessonId, version, user]);
    const [modalState, setModalState] = useState<{ isOpen: boolean; content: Content | null }>({ isOpen: false, content: null });
    const [confirmModalState, setConfirmModalState] = useState<{ isOpen: boolean; onConfirm: (() => void) | null }>({ isOpen: false, onConfirm: null });
    const [openCardId, setOpenCardId] = useState<string | null>(null);
    const [stats, setStats] = useState<{ downloads: number } | null>(null);

    // Export state
    const [exportModalOpen, setExportModalOpen] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const { showToast } = useToast();
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

    useEffect(() => {
        const updateStats = async () => {
            try {
                const h = await api.getHierarchy(lessonId);
                setStats({ downloads: h.qaDownloadCount || 0 });
            } catch (e) {
                console.error('Failed to fetch stats', e);
            }
        };
        updateStats();
    }, [lessonId]);

    const qaItems = groupedContent?.[0]?.docs || [];
    const resourceType: ResourceType = 'qa';
    const canEdit = user.role === 'admin' || !!user.canEdit;

    const handleSave = async (contentData: { title: string; body: string; metadata: QAMetadata }) => {
        if (modalState.content) {
            await api.updateContent(modalState.content._id, contentData);
        } else {
            await api.addContent({ ...contentData, lessonId, type: resourceType });
        }
        setVersion(v => v + 1);
        setModalState({ isOpen: false, content: null });
    };

    const handleDelete = (contentId: string) => {
        const confirmAction = async () => {
            await api.deleteContent(contentId);
            setVersion(v => v + 1);
            setConfirmModalState({ isOpen: false, onConfirm: null });
        };
        setConfirmModalState({ isOpen: true, onConfirm: confirmAction });
    };

    const handleTogglePublish = async (item: Content) => {
        try {
            const newStatus = !item.isPublished;
            await api.updateContent(item._id, { isPublished: newStatus });
            setVersion(v => v + 1);
            showToast(`Q&A ${newStatus ? 'published' : 'unpublished'} successfully`, 'success');
        } catch (error) {
            console.error('Failed to toggle publish status:', error);
            showToast('Failed to update publish status', 'error');
        }
    };

    const handleToggleCard = (id: string) => {
        const isExpanding = openCardId !== id;
        setOpenCardId(prev => prev === id ? null : id);
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
            const lessonName = hierarchy?.lessonName || 'QA';

            // 2. Load logo
            const logoImage = await loadImage('/top_logo.png');

            // 3. Prepare all QA content
            let allQAHTML = '';

            // Helper to strip manual numbering from user content since we add our own
            const cleanTitleText = (text: string) => {
                return text.replace(/^(\s*(?:<[^>]+>\s*)*)\d+[\.\)\-\s]\s*/, '$1');
            };

            qaItems.forEach((item, index) => {
                allQAHTML += `
                    <div class="qa-pair-container" style="border: 1px solid #eee; border-radius: 8px; padding: 8px 12px; margin-bottom: 12px; background-color: #fcfcfc;">
                        <div class="question-part" style="font-weight: bold; font-size: 15pt; margin-bottom: 4px; color: #000; line-height: 1.4;">
                            <span style="color: #2563eb; margin-right: 5px;">Q${index + 1}.</span>
                            ${processContentForHTML(cleanTitleText(item.title))}
                        </div>
                        <div class="answer-part" style="font-size: 14pt; margin-left: 0px; color: #333; line-height: 1.5;">
                            <span style="font-weight: bold; color: #16a34a; margin-right: 5px;">Ans:</span>
                            ${processContentForHTML(item.body)}
                        </div>
                    </div>
                `;
            });

            if (qaItems.length === 0) {
                throw new Error('இந்த அத்தியாயத்தில் வினா-விடைகள் இல்லை | No Q&A available for this chapter');
            }

            // 4. Split content into pages
            // splitContentIntoPages is modified to keep .qa-pair-container intact unless too huge
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

            // 6. Generate PDF with html2canvas (Same robust logic as NotesView)
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
                link.download = `${lessonName.replace(/[^a-zA-Z0-9\u0B80-\u0BFF]/g, '_')}_QA_${new Date().toISOString().slice(0, 10)}.pdf`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);

                // Update download count
                await api.incrementLessonDownload(lessonId, 'qa');

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
                formData.append('file', pdfBlob, `${lessonName}_QA.pdf`);
                formData.append('email', email);
                formData.append('title', `Q&A: ${lessonName}`);
                formData.append('lessonId', lessonId);
                formData.append('type', 'qa');
                formData.append('userName', user.name || 'User');

                const res = await fetch('/api/export/send-pdf', {
                    method: 'POST',
                    body: formData,
                });

                const responseData = await res.json();

                if (res.ok && responseData.success) {
                    await api.incrementLessonDownload(lessonId, 'qa').catch(() => { });
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

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full flex flex-col h-full overflow-hidden">
            <div className="flex justify-between items-center mb-6 shrink-0">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <QAIcon className="w-8 h-8 text-emerald-600" />
                        <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-emerald-600 dark:from-white dark:to-emerald-400">
                            Q-A & More
                        </h2>
                        {/* View Count next to Title */}
                        {/* View Count Removed */}
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 pl-1">Questions, answers, and additional exercises.</p>
                </div>

                <div className="flex items-center gap-2">
                    {/* Export Button */}
                    {!isLoading && qaItems.length > 0 && (
                        <button
                            onClick={handleExportInitiate}
                            className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm"
                            title="Export to PDF"
                        >
                            <DownloadIcon className="w-5 h-5" />
                            <span className="hidden sm:inline">PDF</span>
                            <span className="bg-white/20 px-1.5 py-0.5 rounded text-xs font-semibold ml-1">
                                {formatCount(stats?.downloads || 0)}
                            </span>
                        </button>
                    )}

                    <FontSizeControl />

                    {canEdit && (
                        <button onClick={() => setModalState({ isOpen: true, content: null })} className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors" title="Add New Q&A">
                            <PlusIcon className="w-5 h-5" />
                            <span className="hidden sm:inline">Add New</span>
                        </button>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 pb-8 no-scrollbar">
                {isLoading && <div className="text-center py-12">Loading Q&A...</div>}

                {!isLoading && qaItems.length > 0 && (
                    <div className="space-y-6">
                        {qaItems.map(item => (
                            <QACard
                                key={item._id}
                                item={item}
                                isOpen={openCardId === item._id}
                                onToggle={() => handleToggleCard(item._id)}
                                onEdit={(c) => setModalState({ isOpen: true, content: c })}
                                onDelete={handleDelete}
                                isAdmin={canEdit}
                                onTogglePublish={handleTogglePublish}
                            />
                        ))}
                    </div>
                )}

                {!isLoading && qaItems.length === 0 && (
                    <div className="text-center py-20 bg-white dark:bg-gray-800/50 rounded-lg">
                        <QAIcon className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600" />
                        <p className="mt-4 text-gray-500">No Q&A available for this chapter.</p>
                    </div>
                )}
            </div>

            <QAEditorModal isOpen={modalState.isOpen} onClose={() => setModalState({ isOpen: false, content: null })} onSave={handleSave} contentToEdit={modalState.content} />
            <ConfirmModal isOpen={confirmModalState.isOpen} onClose={() => setConfirmModalState({ isOpen: false, onConfirm: null })} onConfirm={confirmModalState.onConfirm} title="Delete Q&A" message="Are you sure you want to delete this Q&A?" />

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