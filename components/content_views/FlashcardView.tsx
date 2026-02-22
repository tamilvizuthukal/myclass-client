import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Content, User } from '../../types';
import { useApi } from '../../hooks/useApi';
import * as api from '../../services/api';
import { FlashcardIcon } from '../icons/ResourceTypeIcons';
import { ChevronRightIcon, ChevronLeftIcon } from '../icons/AdminIcons';
import { Fireworks } from './Fireworks';
import { processContentForHTML } from '../../utils/htmlUtils';

const getFrontTheme = () => ({
    bg: 'linear-gradient(135deg, #000000, #333333)',
    textClass: 'text-white',
    borderClass: 'border-gray-400'
});

const getBackTheme = () => ({
    bg: 'linear-gradient(135deg, #ffffff, #f5f5f5)',
    textClass: '!text-black',
    borderClass: 'border-gray-800 dark:border-gray-700'
});

const Flashcard: React.FC<{
    card: Content;
    frontTheme: { bg: string; textClass: string; borderClass: string };
    backTheme: { bg: string; textClass: string; borderClass: string };
    isLandscapeMobile?: boolean;
}> = ({ card, frontTheme, backTheme, isLandscapeMobile }) => {
    const [isFlipped, setIsFlipped] = useState(false);

    useEffect(() => {
        setIsFlipped(false);
    }, [card]);

    const contentClass = `w-full max-h-full overflow-y-auto ${isLandscapeMobile ? 'prose prose-base leading-snug pb-16' : 'prose prose-2xl'} max-w-none text-center px-4 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent font-tau-marutham`;

    return (
        <div className="w-full h-full [perspective:1500px]" onClick={() => setIsFlipped(!isFlipped)}>
            <div className={`relative w-full h-full transition-transform duration-700 [transform-style:preserve-3d] ${isFlipped ? '[transform:rotateY(180deg)]' : ''} ease-in-out`}>
                <div
                    className={`absolute w-full h-full rounded-2xl shadow-2xl flex flex-col items-center justify-center ${isLandscapeMobile ? 'p-4' : 'p-8'} [backface-visibility:hidden] ${frontTheme.textClass} ${frontTheme.borderClass} border-2 cursor-pointer`}
                    style={{ background: frontTheme.bg }}
                >
                    <div className="text-5xl mb-6 opacity-80 shrink-0">❓</div>
                    <div className={contentClass} style={{ color: 'inherit' }} dangerouslySetInnerHTML={{ __html: processContentForHTML(card.title) }} />
                    <p className="absolute bottom-6 text-xs uppercase tracking-widest opacity-60 animate-pulse shrink-0">Tap to Flip</p>
                </div>

                <div
                    className={`absolute w-full h-full rounded-2xl shadow-2xl flex flex-col items-center justify-center ${isLandscapeMobile ? 'p-4' : 'p-8'} [transform:rotateY(180deg)] [backface-visibility:hidden] ${backTheme.textClass} ${backTheme.borderClass} border-2 cursor-pointer`}
                    style={{ background: backTheme.bg }}
                >
                    <div className="text-5xl mb-6 opacity-80 shrink-0">💡</div>
                    <div className={contentClass} style={{ color: 'inherit' }} dangerouslySetInnerHTML={{ __html: processContentForHTML(card.body) }} />
                </div>
            </div>
        </div>
    );
};

const ThankYouScreen: React.FC<{ onRetry: () => void }> = ({ onRetry }) => (
    <div className="absolute inset-0 bg-gray-900/80 backdrop-blur-sm z-20 flex flex-col items-center justify-center p-4 text-center">
        <Fireworks />
        <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">Great Job!</h2>
        <p className="text-lg text-gray-300 mb-8">You've reviewed all the flashcards.</p>
        <button onClick={onRetry} className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-full hover:bg-blue-700 transition-transform transform hover:scale-105 shadow-lg">
            Start Over
        </button>
    </div>
);

export const FlashcardView: React.FC<{ lessonId: string; user: User }> = ({ lessonId, user }) => {
    const { data: groupedContent, isLoading } = useApi(() => api.getContentsByLessonId(lessonId, ['flashcard'], true), [lessonId, user]);
    const [currentCardIndex, setCurrentCardIndex] = useState(0);
    const [showThankYou, setShowThankYou] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [isLandscape, setIsLandscape] = useState(false);

    const flashcards = useMemo(() => groupedContent?.[0]?.docs || [], [groupedContent]);

    useEffect(() => {
        const checkResponsive = () => {
            setIsMobile(window.innerWidth < 768);
            setIsLandscape(window.innerWidth > window.innerHeight);
        };
        checkResponsive();
        window.addEventListener('resize', checkResponsive);
        return () => window.removeEventListener('resize', checkResponsive);
    }, []);

    useEffect(() => {
        const header = document.querySelector('header');
        if (header) header.style.display = (isMobile && isLandscape) ? 'none' : 'flex';
        return () => { if (header) header.style.display = 'flex'; };
    }, [isMobile, isLandscape]);

    useEffect(() => {
        setCurrentCardIndex(0);
        setShowThankYou(false);
    }, [lessonId]);

    const handleNext = useCallback(() => {
        if (currentCardIndex < flashcards.length - 1) setCurrentCardIndex(prev => prev + 1);
        else setShowThankYou(true);
    }, [currentCardIndex, flashcards.length]);

    const handlePrev = useCallback(() => {
        setShowThankYou(false);
        if (currentCardIndex > 0) setCurrentCardIndex(prev => prev - 1);
    }, [currentCardIndex]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight') handleNext();
            if (e.key === 'ArrowLeft') handlePrev();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleNext, handlePrev]);

    if (isLoading) return <div className="text-center py-10 text-gray-500">Loading flashcards...</div>;

    if (flashcards.length === 0) {
        return (
            <div className="p-4 sm:p-6 lg:p-8 flex flex-col h-full">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                        <FlashcardIcon className="w-8 h-8 text-violet-600" />
                        <h1 className="text-lg sm:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-violet-600 dark:from-white dark:to-violet-400">Flashcards</h1>
                    </div>
                </div>
                <div className="flex-1 text-center py-20 bg-white dark:bg-gray-800/50 rounded-lg flex flex-col justify-center shadow-inner text-gray-500">
                    <FlashcardIcon className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <p>No flashcards available.</p>
                </div>
            </div>
        );
    }

    const currentCard = flashcards[currentCardIndex];
    const progressPercentage = ((currentCardIndex + 1) / flashcards.length) * 100;

    useEffect(() => {
        if (currentCard?._id) {
            api.trackContentView(currentCard._id).catch(() => { });
        }
    }, [currentCard?._id]);

    return (
        <div className={`${isMobile && isLandscape ? 'p-0 fixed inset-0 z-50 bg-gray-100 dark:bg-gray-900' : 'p-4 sm:p-6 lg:p-8'} flex flex-col h-full overflow-hidden`}>
            {!isLandscape && (
                <div className="flex justify-between items-center mb-8 shrink-0">
                    <div className="flex items-center gap-3">
                        <FlashcardIcon className="w-8 h-8 text-violet-600" />
                        <h1 className="text-lg sm:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-violet-600 dark:from-white dark:to-violet-400">Flashcards</h1>
                    </div>
                </div>
            )}

            <div className="flex-1 flex flex-col items-center justify-center relative min-h-0 w-full">
                <div className={`${isMobile && isLandscape ? 'w-full h-full p-4 pb-20' : 'w-full max-w-3xl flex-1 mb-6'}`}>
                    <Flashcard
                        card={currentCard}
                        frontTheme={getFrontTheme()}
                        backTheme={getBackTheme()}
                        isLandscapeMobile={isMobile && isLandscape}
                    />
                </div>

                <div className={`${isMobile && isLandscape ? 'absolute bottom-0 left-0 right-0 z-20 pb-2 px-12 bg-gradient-to-t from-black/80 pt-10' : 'w-full max-w-3xl flex flex-col items-center mb-4 shrink-0'}`}>
                    <div className="flex items-center justify-between w-full mb-3">
                        <button onClick={handlePrev} disabled={currentCardIndex === 0} className={`p-3 rounded-full shadow-md transition-colors ${isMobile && isLandscape ? 'bg-white/20 text-white hover:bg-white/30 disabled:opacity-30 scale-75' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 disabled:opacity-50'}`}>
                            <ChevronLeftIcon className="w-6 h-6" />
                        </button>
                        <span className={`text-sm font-bold ${isMobile && isLandscape ? 'text-white' : 'text-gray-500'}`}>{currentCardIndex + 1} / {flashcards.length}</span>
                        <button onClick={handleNext} className={`p-3 rounded-full shadow-md transition-colors ${isMobile && isLandscape ? 'bg-blue-600/80 text-white hover:bg-blue-600 scale-75' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
                            <ChevronRightIcon className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="w-full h-2 bg-gray-200/30 dark:bg-gray-700/50 rounded-full overflow-hidden" onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setCurrentCardIndex(Math.floor(((e.clientX - rect.left) / rect.width) * flashcards.length));
                        setShowThankYou(false);
                    }}>
                        <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${progressPercentage}%` }}></div>
                    </div>
                </div>

                {showThankYou && <ThankYouScreen onRetry={() => { setCurrentCardIndex(0); setShowThankYou(false); }} />}
            </div>
        </div>
    );
};