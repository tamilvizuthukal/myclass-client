import React, { useState, useEffect, useRef } from 'react';
import { Content, User, QAMetadata, QuestionType, CognitiveProcess } from '../../types';
import { useApi } from '../../hooks/useApi';
import * as api from '../../services/api';
import { ChevronRightIcon } from '../icons/AdminIcons';
import { useSession } from '../../context/SessionContext';
import { FontSizeControl } from '../FontSizeControl';

import {
    processContentForHTML
} from '../../utils/htmlUtils';

declare global {
    interface Window {
        MathJax: any;
    }
}

interface QAViewProps {
    lessonId: string;
    user: User;
}

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

const QACard: React.FC<{
    item: Content;
    isOpen: boolean;
    onToggle: () => void;
}> = ({ item, isOpen, onToggle }) => {
    const { session } = useSession();
    const meta = item.metadata as QAMetadata | undefined;
    const cp = meta?.cognitiveProcess ? COGNITIVE_PROCESSES[meta.cognitiveProcess] : null;

    const fontStyle = { fontSize: `${session.fontSize}px` };

    return (
        <div className={`
            group bg-white dark:bg-gray-800 rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 
            border border-gray-200 dark:border-gray-700 overflow-hidden mb-5 transform hover:-translate-y-1
            ${isOpen ? 'ring-2 ring-blue-100 dark:ring-blue-900 shadow-md' : ''}
        `}>
            <div onClick={onToggle} className="relative w-full text-left p-5 sm:p-6 cursor-pointer bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-800/50">

                <div className={`absolute left-0 top-0 bottom-0 w-1.5 transition-colors duration-300 ${meta?.questionType === 'Profound' ? 'bg-violet-500' :
                    meta?.questionType === 'Average' ? 'bg-amber-500' :
                        meta?.questionType === 'Basic' ? 'bg-emerald-500' : 'bg-blue-500'
                    }`}></div>

                <div className="flex flex-nowrap items-center gap-2 mb-3 pl-2 overflow-x-auto no-scrollbar scroll-smooth">
                    {meta?.marks && (
                        <span className={`px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-widest shadow-sm shrink-0 whitespace-nowrap ${getMarksColor(meta.marks)}`}>
                            {meta.marks} Marks
                        </span>
                    )}
                    {meta?.questionType && (
                        <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-widest shadow-sm border shrink-0 whitespace-nowrap ${getQuestionTypeColor(meta.questionType)}`}>
                            {meta.questionType}
                        </span>
                    )}
                    {cp && (
                        <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-widest shadow-sm border shrink-0 whitespace-nowrap ${cp.color}`}>
                            {cp.label}
                        </span>
                    )}
                </div>

                <div className="flex justify-between items-start w-full pl-2">
                    <div className="flex-1 pr-6">
                        <div className="prose dark:prose-invert max-w-none text-lg font-semibold text-gray-800 dark:text-gray-100 qa-content tamil-text font-tau-paalai leading-relaxed" style={fontStyle} dangerouslySetInnerHTML={{ __html: processContentForHTML(item.title) }} />
                    </div>

                    <div className="flex items-center shrink-0 gap-3">
                        <div className={`hidden sm:block p-2 rounded-full bg-white dark:bg-gray-700 shadow-sm border border-gray-100 dark:border-gray-600 transition-all duration-300 ${isOpen ? 'rotate-90 bg-blue-50 dark:bg-blue-900/30 text-blue-600' : 'text-gray-400'}`}>
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

export const QAView: React.FC<QAViewProps> = ({ lessonId }) => {
    const { data: groupedContent, isLoading } = useApi(() => api.getContentsByLessonId(lessonId, ['qa']), [lessonId]);
    const [openCardId, setOpenCardId] = useState<string | null>(null);

    const qaItems = groupedContent?.[0]?.docs || [];

    useEffect(() => {
        if (window.MathJax) {
            window.MathJax.typesetPromise?.().catch(() => { });
        }
    }, [qaItems, openCardId]);

    if (isLoading) {
        return <div className="p-8 text-center text-gray-500">Loading Q&A...</div>;
    }

    if (qaItems.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center text-gray-500">
                <p className="text-xl font-medium">No Q&A available for this chapter.</p>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto p-4 sm:p-6">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Questions & Answers</h2>
                <FontSizeControl />
            </div>

            <div className="space-y-4">
                {qaItems.map((item: Content) => (
                    <QACard
                        key={item._id}
                        item={item}
                        isOpen={openCardId === item._id}
                        onToggle={() => {
                            if (openCardId !== item._id) {
                                api.trackContentView(item._id).catch(() => { });
                            }
                            setOpenCardId(openCardId === item._id ? null : item._id);
                        }}
                    />
                ))}
            </div>
        </div>
    );
};