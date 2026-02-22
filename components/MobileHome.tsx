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

// Bubble configuration
// type: 'fade' = mid-way disappear | 'top' = reaches the top
const BUBBLE_CONFIG: { left: string; size: number; delay: number; duration: number; type: 'fade' | 'top' }[] = [
    { left: '8%', size: 5, delay: 0, duration: 9, type: 'fade' },
    { left: '22%', size: 4, delay: 3.5, duration: 12, type: 'top' },
    { left: '38%', size: 6, delay: 1.5, duration: 10, type: 'fade' },
    { left: '52%', size: 4, delay: 5.0, duration: 11, type: 'fade' },
    { left: '63%', size: 7, delay: 2.2, duration: 13, type: 'top' },
    { left: '76%', size: 5, delay: 0.8, duration: 10, type: 'fade' },
    { left: '88%', size: 4, delay: 4.1, duration: 12, type: 'fade' },
    { left: '45%', size: 6, delay: 7.0, duration: 14, type: 'top' },
];

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
        <div className="relative flex flex-col h-full bg-slate-50/20 dark:bg-slate-950/20 backdrop-blur-md overflow-y-auto animate-fade-in-up pb-10">

            {/* ===== BUBBLE ANIMATION LAYER ===== */}
            <div
                aria-hidden="true"
                className="bubble-container"
            >
                {BUBBLE_CONFIG.map((b, i) => (
                    <span
                        key={i}
                        className={b.type === 'top' ? 'bubble bubble-top' : 'bubble bubble-fade'}
                        style={{
                            left: b.left,
                            width: `${b.size}px`,
                            height: `${b.size}px`,
                            animationDelay: `${b.delay}s`,
                            animationDuration: `${b.duration}s`,
                        }}
                    />
                ))}
            </div>
            {/* ================================= */}

            <div className="p-5 pt-8 relative z-10">
                {userName && (
                    <div className="flex justify-end mb-2 animate-fade-in">
                        <div className="text-right flex flex-col items-end shrink-0 px-4 py-2 rounded-2xl border-r-4 border-blue-500 bg-white dark:bg-gray-900 shadow-sm border border-gray-100 dark:border-gray-800">
                            <span className="text-[11px] text-gray-500 dark:text-gray-400 font-tau-paalai uppercase tracking-widest font-bold">நல்வரவு!</span>
                            <span className="text-[16px] font-extrabold text-blue-600 dark:text-blue-400 font-tau-paalai leading-tight">
                                {userName}
                            </span>
                        </div>
                    </div>
                )}

                <div className="space-y-4">
                    <div>
                        <h1 className="text-4xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight font-tau-marutham">
                            முகப்பு
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 mt-1 font-tau-paalai text-[15px]">
                            தொடர ஒரு பாடத்தைத் தேர்ந்தெடுக்கவும்
                        </p>
                    </div>

                    <div className="bg-white/40 dark:bg-gray-900/40 backdrop-blur-md p-4 rounded-3xl shadow-sm border border-gray-100/50 dark:border-gray-800/50">
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
                            lockedClassName={userRole === 'student' ? userClass : undefined}
                        />
                    </div>

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
                                            transition-all duration-300 active:scale-95 shadow-sm border border-gray-100/50 dark:border-gray-800/50 backdrop-blur-sm
                                            ${currentResourceType === resource.key
                                                    ? 'bg-blue-500/10 dark:bg-blue-500/10 ring-4 ring-blue-500 shadow-xl scale-105 z-10'
                                                    : 'bg-white/40 dark:bg-gray-900/40 hover:shadow-md'
                                                }
                                        `}
                                            style={{
                                                animationDelay: `${index * 50}ms`
                                            }}
                                        >
                                            <div className={`absolute -right-4 -top-4 w-20 h-20 rounded-full blur-2xl opacity-20 bg-gradient-to-br ${resource.gradient}`} />

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
            </div>

            <style>{`
                /* ======== BUBBLE RISE ANIMATION ======== */
                .bubble-container {
                    position: fixed;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    top: 0;
                    pointer-events: none;
                    overflow: hidden;
                    z-index: 1;
                }

                /* Base bubble styles */
                .bubble {
                    position: fixed;
                    bottom: 0px;
                    border-radius: 50%;
                    background: radial-gradient(circle at 35% 35%, rgba(255,120,120,0.6), rgba(200,20,20,0.3));
                    box-shadow: inset 0 0 3px rgba(255,255,255,0.25);
                    opacity: 0;
                    will-change: transform, opacity;
                }

                /* Fades out around mid-screen */
                .bubble-fade {
                    animation: bubbleMidFade linear infinite;
                }

                /* Travels all the way to the top */
                .bubble-top {
                    animation: bubbleFullRise linear infinite;
                }

                @keyframes bubbleMidFade {
                    0%   { transform: translateY(0)      translateX(0px);  opacity: 0;    }
                    8%   { opacity: 0.45; }
                    50%  { transform: translateY(-45vh)  translateX(6px);  opacity: 0.3;  }
                    70%  { transform: translateY(-62vh)  translateX(-4px); opacity: 0;    }
                    100% { transform: translateY(-100vh) translateX(2px);  opacity: 0;    }
                }

                @keyframes bubbleFullRise {
                    0%   { transform: translateY(0)      translateX(0px);  opacity: 0;    }
                    8%   { opacity: 0.5; }
                    45%  { transform: translateY(-40vh)  translateX(5px);  opacity: 0.35; }
                    75%  { transform: translateY(-72vh)  translateX(-3px); opacity: 0.2;  }
                    92%  { opacity: 0.05; }
                    100% { transform: translateY(-103vh) translateX(1px);  opacity: 0;    }
                }

                /* ======== OTHER ANIMATIONS ======== */
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
