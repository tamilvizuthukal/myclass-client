import React from 'react';
import { RESOURCE_TYPES } from '../constants';
import { ResourceType, ResourceCounts } from '../types';
import { CascadeSelectors } from './CascadeSelectors';
import { useApi } from '../hooks/useApi';
import { getCountsByLessonId } from '../services/api';

interface MobileHomeProps {
    onSelectResourceType: (type: ResourceType) => void;
    currentResourceType: ResourceType | null;

    // Selection state & handlers
    classId: string | null;
    subjectId: string | null;
    unitId: string | null;
    subUnitId: string | null;
    lessonId: string | null;
    onClassChange: (id: string | null) => void;
    onSubjectChange: (id: string | null) => void;
    onUnitChange: (id: string | null) => void;
    onSubUnitChange: (id: string | null) => void;
    onLessonChange: (id: string | null) => void;
    userRole?: string;
    userClass?: string;
    userName?: string;
}

export const MobileHome: React.FC<MobileHomeProps> = ({
    onSelectResourceType,
    currentResourceType,
    classId,
    subjectId,
    unitId,
    subUnitId,
    lessonId,
    onClassChange,
    onSubjectChange,
    onUnitChange,
    onSubUnitChange,
    onLessonChange,
    userRole,
    userClass,
    userName
}) => {
    const { data: counts } = useApi<ResourceCounts>(
        () => getCountsByLessonId(lessonId!),
        [lessonId],
        !!lessonId
    );

    const hasLesson = !!lessonId;

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 overflow-y-auto animate-fade-in-up pb-10">
            <div className="p-5 pt-8">
                <div className="mb-6 flex justify-between items-start gap-4">
                    <div className="flex-1">
                        <h1 className="text-3xl font-extrabold text-blue-600 dark:text-blue-400 tracking-tight font-tau-marutham">
                            முகப்பு
                        </h1>
                        <p className="text-gray-500 dark:text-gray-400 mt-1 font-tau-paalai text-[14px]">
                            தொடர ஒரு பாடத்தைத் தேர்ந்தெடுக்கவும்
                        </p>
                    </div>
                    {userName && (
                        <div className="text-right flex flex-col items-end shrink-0 pt-1">
                            <span className="text-[12px] text-gray-400 dark:text-gray-500 font-tau-paalai">நல்வரவு!</span>
                            <span className="text-[14px] font-bold text-gray-700 dark:text-gray-200 font-tau-paalai truncate max-w-[120px] leading-tight">
                                {userName}
                            </span>
                        </div>
                    )}
                </div>

                {/* Selection Section moved to Home Page */}
                <div className="mb-8 bg-white dark:bg-gray-900 p-4 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800">
                    <CascadeSelectors
                        classId={classId}
                        subjectId={subjectId}
                        unitId={unitId}
                        subUnitId={subUnitId}
                        lessonId={lessonId}
                        onClassChange={onClassChange}
                        onSubjectChange={onSubjectChange}
                        onUnitChange={onUnitChange}
                        onSubUnitChange={onSubUnitChange}
                        onLessonChange={onLessonChange}
                        onlyPublished={true}
                        lockedClassName={userRole === 'student' ? userClass : undefined}
                    />
                </div>

                {/* Grid menu appears only after full selection */}
                {hasLesson ? (
                    <div className="animate-grid-entrance">
                        <div className="mb-4">
                            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200 font-tau-paalai">
                                பாடத் தொகுப்புகள்
                            </h2>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            {RESOURCE_TYPES.map((resource, index) => {
                                const Icon = resource.Icon;
                                return (
                                    <button
                                        key={resource.key}
                                        onClick={() => onSelectResourceType(resource.key)}
                                        className={`
                                            relative group overflow-hidden rounded-3xl p-5 flex flex-col items-center justify-center gap-3
                                            transition-all duration-300 active:scale-95 shadow-sm border border-gray-100 dark:border-gray-800/50
                                            ${currentResourceType === resource.key
                                                ? 'bg-white dark:bg-gray-800 ring-4 ring-blue-500 shadow-xl scale-105 z-10'
                                                : 'bg-white dark:bg-gray-900 hover:shadow-md'
                                            }
                                        `}
                                        style={{
                                            animationDelay: `${index * 50}ms`
                                        }}
                                    >
                                        <div className={`absolute -right-4 -top-4 w-20 h-20 rounded-full blur-2xl opacity-20 bg-gradient-to-br ${resource.gradient}`} />

                                        {/* Count Badge */}
                                        {counts && (counts[resource.key as keyof ResourceCounts] || 0) > 0 && (
                                            <div className="absolute top-4 right-4 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm animate-fade-in">
                                                {counts[resource.key as keyof ResourceCounts]}
                                            </div>
                                        )}

                                        <div className={`
                                            p-4 rounded-2xl transition-all duration-700 shadow-inner
                                            ${currentResourceType === resource.key ? 'bg-blue-500 text-white' : 'bg-slate-50 dark:bg-slate-800'}
                                        `}>
                                            <Icon className={`w-9 h-9 transition-all duration-1000 ${currentResourceType === resource.key ? 'text-white' : resource.color} animate-subtle-float`} />
                                        </div>

                                        <span className={`
                                            font-bold text-center leading-tight font-tau-paalai text-[14px]
                                            ${currentResourceType === resource.key ? 'text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-200'}
                                        `}>
                                            {resource.label}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-10 px-6 text-center animate-pulse">
                        <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-4">
                            <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <p className="text-gray-500 dark:text-gray-400 font-tau-paalai text-[14px]">
                            வகுப்பு மற்றும் பாடத்தைத் தேர்வு செய்தவுடன் மெனுக்கள் இங்கு தோன்றும்
                        </p>
                    </div>
                )}

                {/* Footer Section */}
                <div className="mt-12 pt-8 border-t border-gray-100 dark:border-gray-800/50 text-center">
                    <p className="text-[13px] text-gray-500 dark:text-gray-400 font-tau-paalai leading-relaxed max-w-xs mx-auto italic">
                        தமிழ்விருதுகள் என்பது தமிழ் வழி மாணவர்களுக்கான ஒரு நவீன மின்-கற்றல் தளம்.
                    </p>
                    <div className="mt-4 flex flex-col items-center gap-1">
                        <p className="text-[12px] font-bold text-blue-600/40 dark:text-blue-400/40 font-tau-paalai uppercase tracking-[0.2em]">
                            © காப்புரிமை தமிழ்விழுதுகள்
                        </p>
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes subtleFloat {
                    0%, 100% { transform: translateY(0) rotate(0); }
                    50% { transform: translateY(-6px) rotate(2deg); }
                }
                .animate-subtle-float {
                    animation: subtleFloat 4s ease-in-out infinite;
                }
                .animate-fade-in-up {
                    animation: fadeInUpMobile 0.6s cubic-bezier(0.23, 1, 0.32, 1);
                }
                .animate-grid-entrance {
                    animation: gridEntrance 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
                @keyframes fadeInUpMobile {
                    from {
                        opacity: 0;
                        transform: translateY(40px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                @keyframes gridEntrance {
                    from {
                        opacity: 0;
                        transform: translateY(20px) scale(0.95);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0) scale(1);
                    }
                }
            `}</style>
        </div>
    );
};
