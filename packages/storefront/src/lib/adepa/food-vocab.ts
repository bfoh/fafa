/**
 * Ghanaian food vocabulary corrections for speech recognition.
 *
 * Chrome's speech engine doesn't know Ghanaian food names, so "Jollof"
 * becomes "jello", "Waakye" becomes "walkie", etc. This module fixes
 * common mishearings BEFORE the text is sent to the LLM.
 *
 * The map is intentionally broad — false positives are harmless because
 * the LLM + menu search will handle them gracefully.
 */

// Map of (lowercased mishearing) → correct spelling.
// Each entry can have multiple mishearings that map to the same food.
const CORRECTIONS: Array<[RegExp, string]> = [
  // ── Rice dishes ──
  [/\bjell?o(?:\s+rice)?\b/gi, 'Jollof rice'],
  [/\bjello[f]?\b/gi, 'Jollof'],
  [/\bjolly(?:\s+of)?\b/gi, 'Jollof'],
  [/\bjello off\b/gi, 'Jollof'],
  [/\bwar\s?key\b/gi, 'Waakye'],
  [/\bwalkie\b/gi, 'Waakye'],
  [/\bwalk\s?yay\b/gi, 'Waakye'],
  [/\bwok\s?e\b/gi, 'Waakye'],
  [/\bwah\s?chay\b/gi, 'Waakye'],
  [/\bwatchy\b/gi, 'Waakye'],

  // ── Staples ──
  [/\bbank\s?oo?\b/gi, 'Banku'],
  [/\bbon\s?coup?\b/gi, 'Banku'],
  [/\bkink\s?e\b/gi, 'Kenkey'],
  [/\bcan\s?key\b/gi, 'Kenkey'],
  [/\bken\s?key\b/gi, 'Kenkey'],
  [/\bfu\s?fu(?:\s|$)/gi, 'Fufu '],
  [/\bfoo\s?foo\b/gi, 'Fufu'],
  [/\btwo\s?zafi\b/gi, 'Tuo Zaafi'],
  [/\btoo\s?zafi\b/gi, 'Tuo Zaafi'],
  [/\bto\s+zafi\b/gi, 'Tuo Zaafi'],
  [/\bgary\b/gi, 'Gari'],
  [/\bgory\b/gi, 'Gari'],
  [/\bam\s?pacy\b/gi, 'Ampesi'],
  [/\bamp\s?a\s?see\b/gi, 'Ampesi'],

  // ── Soups & stews ──
  [/\blight\s+soup\b/gi, 'Light soup'],
  [/\bpalm\s?nut\b/gi, 'Palm nut'],
  [/\bgrounds?\s?nut\s+soup\b/gi, 'Groundnut soup'],
  [/\bokra\s?(?:stew|soup)?\b/gi, 'Okra'],
  [/\bshe\s?toe\b/gi, 'Shito'],
  [/\bcheetoe\b/gi, 'Shito'],
  [/\bshi\s?to\b/gi, 'Shito'],

  // ── Proteins ──
  [/\btill?\s?a\s?pia\b/gi, 'Tilapia'],
  [/\btill?\s?op\s?ia\b/gi, 'Tilapia'],
  [/\bto lo\b/gi, 'Tolo'],
  [/\bchick\s?one?\b/gi, 'Chicken'],

  // ── Snacks & sides ──
  [/\bkelly?\s?welly?\b/gi, 'Kelewele'],
  [/\bkelly\s?wally\b/gi, 'Kelewele'],
  [/\bkel\s?uh?\s?well\s?a\b/gi, 'Kelewele'],
  [/\bcozy?\b/gi, 'Koose'],
  [/\bcosie\b/gi, 'Koose'],
  [/\bcosey\b/gi, 'Koose'],
  [/\bco\s?see\b/gi, 'Koose'],
  [/\byam\s?chips?\b/gi, 'Yam chips'],
  [/\bred\s+red\b/gi, 'Red Red'],
  [/\bwhat?\s?che\b/gi, 'Waakye'],

  // ── Drinks ──
  [/\bso\s?bo\s?lo\b/gi, 'Sobolo'],
  [/\bsa\s?bo\s?lo\b/gi, 'Sobolo'],
];

/**
 * Fix common speech-recognition mishearings of Ghanaian food names.
 * Runs all corrections against the transcript and returns the cleaned text.
 */
export function correctFoodNames(transcript: string): string {
  let result = transcript;
  for (const [pattern, replacement] of CORRECTIONS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}
