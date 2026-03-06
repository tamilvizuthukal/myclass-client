/**
 * Strips HTML tags from a string to prepare it for speech synthesis.
 */
export const stripHtml = (html: string): string => {
    const tmp = document.createElement('DIV');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
};

/**
 * Detects the language of a text based on Unicode character ranges.
 * Supports: Tamil, Hindi (Devanagari), Malayalam, and English fallback.
 */
export const detectLanguage = (text: string): string => {
    // Tamil: \u0B80–\u0BFF
    if (/[\u0B80-\u0BFF]/.test(text)) return 'ta-IN';

    // Hindi (Devanagari): \u0900–\u097F
    if (/[\u0900-\u097F]/.test(text)) return 'hi-IN';

    // Malayalam: \u0D00–\u0D7F
    if (/[\u0D00-\u0D7F]/.test(text)) return 'ml-IN';

    // Default to English
    return 'en-US';
};

/**
 * Finds the best available voice for a given language code.
 */
export const getBestVoice = (lang: string, voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null => {
    // Try exact match first (e.g., ta-IN)
    let voice = voices.find(v => v.lang === lang || v.lang === lang.replace('-', '_'));
    if (voice) return voice;

    // Try prefix match (e.g., 'ta' for 'ta-IN')
    const langPrefix = lang.split('-')[0];
    voice = voices.find(v => v.lang.startsWith(langPrefix));

    return voice || null;
};

/**
 * Applies visual highlight to a text range, using CSS Custom Highlight API with a fallback to mark wrapping or native selection.
 */
export const applyTTSHighlight = (range: Range | null) => {
    // 1. Cleanup old marks
    const marks = document.querySelectorAll('mark.tts-word-highlight');
    marks.forEach(m => {
        const parent = m.parentNode;
        if (parent) {
            while (m.firstChild) {
                parent.insertBefore(m.firstChild, m);
            }
            parent.removeChild(m);
        }
    });

    if (!range) {
        if (typeof CSS !== 'undefined' && 'highlights' in CSS) {
            (CSS as any).highlights.delete('tts-highlight');
        }
        window.getSelection()?.removeAllRanges();
        return;
    }

    // Try CSS Custom Highlight API (Safari 17.4+, Chrome 105+)
    if (typeof CSS !== 'undefined' && 'highlights' in CSS) {
        try {
            const DefaultHighlight = (window as any).Highlight;
            if (DefaultHighlight) {
                const highlight = new DefaultHighlight(range);
                (CSS as any).highlights.set('tts-highlight', highlight);
                return; // Return early if successful
            }
        } catch (e) {
            console.warn('CSS Highlights API failed:', e);
        }
    }

    // Fallback 1: DOM mark wrapping (More reliable for mobile Safari unsupported Highlight API)
    try {
        const mark = document.createElement('mark');
        mark.className = 'tts-word-highlight bg-blue-200 dark:bg-blue-400 text-black dark:text-white rounded px-[2px]';
        range.surroundContents(mark);
        return; // Return early if successful
    } catch (e) {
        // Fallback 2: Native programmatic selection. Invisible on unfocused iOS, but no throw.
        const selection = window.getSelection();
        if (selection) {
            selection.removeAllRanges();
            selection.addRange(range);
        }
    }
};

/**
 * Clears all TTS highlights 
 */
export const clearTTSHighlight = () => {
    applyTTSHighlight(null);
};
