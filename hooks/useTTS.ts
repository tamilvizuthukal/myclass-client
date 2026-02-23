import { useState, useCallback, useEffect, useRef } from 'react';
import { stripHtml, detectLanguage, getBestVoice } from '../utils/ttsUtils';

export const useTTS = () => {
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [speakingWord, setSpeakingWord] = useState<{ start: number; length: number } | null>(null);
    const [lastCharIndex, setLastCharIndex] = useState(0);
    const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
    const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
    const currentHtmlContentRef = useRef<string>("");

    const stop = useCallback(() => {
        if (synth) {
            synth.cancel();
            setIsSpeaking(false);
            setIsPaused(false);
            setSpeakingWord(null);
            setLastCharIndex(0);
        }
    }, [synth]);

    const pause = useCallback(() => {
        if (synth && isSpeaking && !isPaused) {
            synth.pause();
            setIsPaused(true);
        }
    }, [synth, isSpeaking, isPaused]);

    const resume = useCallback(() => {
        if (synth && isPaused) {
            synth.resume();
            setIsPaused(false);
        }
    }, [synth, isPaused]);

    const speak = useCallback((htmlContent: string, fromStart: boolean = true) => {
        if (!synth) return;

        // Small delay helper to wait for synth to settle after cancel
        const startSpeaking = (text: string, lang: string, startIdx: number) => {
            const utterance = new SpeechSynthesisUtterance(text);
            utteranceRef.current = utterance;

            const voices = synth.getVoices();
            const voice = getBestVoice(lang, voices);
            if (voice) utterance.voice = voice;
            utterance.lang = lang;
            utterance.rate = 0.9;
            utterance.pitch = 1;

            utterance.onstart = () => {
                if (utteranceRef.current !== utterance) return;
                setIsSpeaking(true);
                setIsPaused(false);
            };

            utterance.onend = () => {
                if (utteranceRef.current !== utterance) return;
                if (!synth.paused) {
                    setIsSpeaking(false);
                    setIsPaused(false);
                    setSpeakingWord(null);
                    setLastCharIndex(0);
                    utteranceRef.current = null;
                }
            };

            utterance.onboundary = (event) => {
                if (utteranceRef.current !== utterance) return;
                if (event.name === 'word') {
                    const currentRelIndex = event.charIndex;
                    const globalStart = startIdx + currentRelIndex;
                    setSpeakingWord({ start: globalStart, length: event.charLength });
                    setLastCharIndex(globalStart);
                }
            };

            utterance.onerror = (event: any) => {
                if (utteranceRef.current !== utterance) return;

                // 'interrupted' and 'canceled' are expected when we stop/pause/restart
                const silentErrors = ['interrupted', 'canceled'];
                if (!silentErrors.includes(event.error)) {
                    console.error('SpeechSynthesisUtterance error', event);
                }

                // Only reset state if it's a real error
                if (!silentErrors.includes(event.error)) {
                    setIsSpeaking(false);
                    setIsPaused(false);
                    setSpeakingWord(null);
                    utteranceRef.current = null;
                }
            };

            synth.speak(utterance);
        };

        if (fromStart) {
            stop();
            currentHtmlContentRef.current = htmlContent;
        } else {
            synth.cancel();
            setIsPaused(false);
        }

        const fullText = stripHtml(currentHtmlContentRef.current);
        const startIndex = fromStart ? 0 : lastCharIndex;
        const textToSpeak = fullText.substring(startIndex);

        if (!textToSpeak.trim()) {
            stop();
            return;
        }

        const lang = detectLanguage(fullText);

        // Some browsers need a tiny gap after cancel to work reliably
        if (!fromStart) {
            setTimeout(() => startSpeaking(textToSpeak, lang, startIndex), 50);
        } else {
            startSpeaking(textToSpeak, lang, startIndex);
        }
    }, [synth, stop, lastCharIndex]);

    useEffect(() => {
        return () => {
            if (synth) synth.cancel();
        };
    }, [synth]);

    return { speak, pause, resume, stop, isSpeaking, isPaused, speakingWord };
};
