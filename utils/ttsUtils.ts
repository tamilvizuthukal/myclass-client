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
