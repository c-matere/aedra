let francFn: ((text: string, opts?: any) => string) | null = null;

function getFranc() {
  if (francFn !== null) return francFn;
  try {
    // franc-min is ESM-only; attempting require will throw ERR_REQUIRE_ESM in CJS.
    // We catch and fall back to keyword heuristics if loading fails under Jest.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('franc-min');
    francFn = (mod && (mod.franc || mod.default)) || null;
  } catch {
    francFn = null;
  }
  return francFn;
}

export enum DetectedLanguage {
  EN = 'en',
  SW = 'sw',
  MIXED = 'mixed',
}

/**
 * Detects the language of a given text.
 * Routes between English, Swahili, and Mixed (Sheng).
 */
export function detectLanguage(text: string): DetectedLanguage {
  if (!text || text.trim().length < 5) {
    return DetectedLanguage.EN; // Default for very short messages
  }

  const franc = getFranc();
  const langCode = franc ? franc(text, { minLength: 3 }) : 'eng';

  // Map franc codes to our enum
  // swa is Swahili, eng is English
  if (langCode === 'swa') {
    return DetectedLanguage.SW;
  }
  
  if (langCode === 'eng') {
    return DetectedLanguage.EN;
  }

  // If franc is uncertain or detects something else, we check for common Swahili/Sheng keywords
  const swahiliKeywords = [
    'hujambo', 'habari', 'sawa', 'ndio', 'hapana', 'asante', 'tafadhali',
    'pango', 'mpangaji', 'mwenye nyumba', 'kitengo', 'matengenezo',
    'risiti', 'malipo', 'ankara', 'notisi', 'kukodisha', 'mkataba',
    'nionyeshe', 'ongeza', 'rekodi', 'tuma', 'makala', 'ripoti'
  ];

  const lowerText = text.toLowerCase();
  const hasSwahiliCue = swahiliKeywords.some(word => lowerText.includes(word));

  if (hasSwahiliCue) {
    // If it has swahili cues but franc didn't detect it clearly as 'eng', call it mixed or Swahili
    return langCode === 'eng' ? DetectedLanguage.MIXED : DetectedLanguage.SW;
  }

  return DetectedLanguage.EN; // Fallback to English
}
