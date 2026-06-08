/**
 * Ghanaian food vocabulary corrections for speech recognition.
 *
 * Browser speech engines don't know Ghanaian food names, so "Jollof" comes
 * back as "jello", "Waakye" as "walkie", etc. This module repairs the
 * transcript BEFORE it reaches the LLM and the menu search, so Fafa can act
 * on what the customer actually said.
 *
 * Two layers run in order:
 *   1. CURATED  — a hand-tuned regex map for the most common, highest-value
 *                 mishearings. Guarantees the famous dishes are always right.
 *   2. PHONETIC — a fuzzy matcher that GUESSES the nearest local dish for
 *                 spellings nobody listed. This is what lets Fafa rightfully
 *                 guess a food from an unclear pronunciation she's never seen.
 *
 * Both layers are intentionally generous — a wrong guess is cheap because the
 * LLM + menu search recover gracefully, while a missed dish frustrates the
 * customer.
 */

// ── Layer 1: curated mishearings → correct spelling ──────────────────────────
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

// ── Layer 2: phonetic lexicon ────────────────────────────────────────────────
// Canonical display names of common Ghanaian dishes & drinks. The fuzzy matcher
// guesses the nearest of these for any close-sounding word the customer says.
const LEXICON: string[] = [
  // Rice & one-pot
  'Jollof', 'Waakye', 'Angwamu', 'Omotuo', 'Aprapransa',
  // Staples / swallow
  'Banku', 'Kenkey', 'Fufu', 'Tuo Zaafi', 'Konkonte', 'Ampesi', 'Akple',
  'Eba', 'Gari', 'Yakeyake', 'Tatale', 'Abolo', 'Mpotompoto',
  // Soups & stews
  'Light soup', 'Palm nut soup', 'Groundnut soup', 'Okra soup', 'Abenkwan',
  'Nkatenkwan', 'Kontomire', 'Egusi', 'Red Red', 'Gob3',
  // Proteins & sides
  'Tilapia', 'Wele', 'Khebab', 'Chichinga', 'Domedo', 'Shito', 'Gari Foto',
  // Snacks & street food
  'Kelewele', 'Koose', 'Akara', 'Bofrot', 'Yam chips', 'Plantain', 'Kokonte',
  // Drinks
  'Sobolo', 'Asaana', 'Lamugin', 'Brukina', 'Nmedaa',
];

// Common English words that sound close to a dish but must never be rewritten.
const STOPWORDS = new Set([
  'would', 'could', 'should', 'like', 'want', 'order', 'please', 'with',
  'your', 'have', 'this', 'that', 'them', 'then', 'well', 'will', 'what',
  'when', 'where', 'good', 'going', 'help', 'thanks', 'thank', 'hello',
  'water', 'work', 'walk', 'more', 'made', 'make', 'name', 'time', 'some',
  'they', 'their', 'about', 'around', 'before', 'after', 'here', 'there',
  'right', 'left', 'today', 'tonight', 'really', 'maybe',
]);

/** Reduce a word to a coarse phonetic skeleton tuned for Ghana-English ASR. */
function phoneticCode(word: string): string {
  const letters = word.toLowerCase().replace(/[^a-z]/g, '');
  let raw = '';
  for (const ch of letters) {
    switch (ch) {
      case 'a': case 'e': case 'i': case 'o': case 'u': case 'y': raw += '0'; break;
      case 'b': case 'p': raw += 'B'; break;
      case 'd': case 't': raw += 'D'; break;
      case 'k': case 'g': case 'c': case 'q': raw += 'K'; break;
      case 'f': case 'v': raw += 'F'; break;
      case 's': case 'z': raw += 'S'; break;
      case 'l': case 'r': raw += 'L'; break; // l/r blur badly in West-African ASR
      case 'm': case 'n': raw += 'N'; break;
      case 'w': raw += 'W'; break;
      case 'j': raw += 'J'; break;
      case 'x': raw += 'KS'; break;
      case 'h': break; // usually silent / dropped
      default: break;
    }
  }
  // Collapse runs of the same symbol (doubled letters, vowel clusters).
  return raw.replace(/(.)\1+/g, '$1');
}

/** Letters-only form of a word, for length checks. */
function letters(word: string): string {
  return word.toLowerCase().replace(/[^a-z]/g, '');
}

/** Classic Levenshtein edit distance. */
function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    prev = cur;
  }
  return prev[b.length];
}

interface Entry { name: string; code: string; wordCount: number }
const ENTRIES: Entry[] = LEXICON.map((name) => ({
  name,
  code: phoneticCode(name),
  wordCount: name.trim().split(/\s+/).length,
}));
const MAX_WORDS = Math.max(3, ...ENTRIES.map((e) => e.wordCount));

/**
 * Find the nearest lexicon dish for a window of words, or null if none is close
 * enough to risk a rewrite.
 */
function bestMatch(slice: string[]): string | null {
  const joinedLetters = slice.map(letters).join('');
  if (joinedLetters.length < 3) return null;
  const code = phoneticCode(joinedLetters);
  if (!code) return null;

  let best: Entry | null = null;
  let bestDist = Infinity;
  for (const e of ENTRIES) {
    const d = editDistance(code, e.code);
    if (d < bestDist) { bestDist = d; best = e; }
  }
  if (!best) return null;

  const isSingle = slice.length === 1;
  const singleWord = isSingle ? letters(slice[0]) : '';

  // A single ordinary English word is never a dish, even on an exact skeleton.
  if (isSingle && STOPWORDS.has(singleWord)) return null;

  if (bestDist === 0) return best.name;

  // One edit of slack, but ONLY for a single word long enough to be meaningful.
  // Multi-word windows must match exactly — fuzzy joins of ordinary words
  // (e.g. "can you", "with the") collide with dishes far too easily.
  if (bestDist === 1 && isSingle) {
    if (Math.max(code.length, best.code.length) < 4) return null;
    if (singleWord.length < 5) return null;
    return best.name;
  }

  return null;
}

/** Run the fuzzy phonetic guesser across a transcript, longest match first. */
function phoneticPass(text: string): string {
  // Split into words and the whitespace between them, preserving both.
  const parts = text.split(/(\s+)/);
  const out = [...parts];
  const wordPositions: number[] = [];
  for (let i = 0; i < parts.length; i++) {
    if (parts[i] && !/^\s+$/.test(parts[i])) wordPositions.push(i);
  }

  let w = 0;
  while (w < wordPositions.length) {
    let matched = false;
    const maxWindow = Math.min(MAX_WORDS, wordPositions.length - w);
    for (let n = maxWindow; n >= 1; n--) {
      const slice = [];
      for (let k = 0; k < n; k++) slice.push(parts[wordPositions[w + k]]);
      const guess = bestMatch(slice);
      if (guess) {
        out[wordPositions[w]] = guess;
        // Blank the consumed trailing words and their leading separators.
        for (let k = 1; k < n; k++) {
          out[wordPositions[w + k]] = '';
          out[wordPositions[w + k] - 1] = '';
        }
        w += n;
        matched = true;
        break;
      }
    }
    if (!matched) w += 1;
  }
  return out.join('');
}

/**
 * Fix common speech-recognition mishearings of Ghanaian food names and guess
 * the nearest local dish for unclear pronunciations. Returns the cleaned text.
 */
export function correctFoodNames(transcript: string): string {
  if (!transcript) return transcript;
  let result = transcript;
  for (const [pattern, replacement] of CORRECTIONS) {
    result = result.replace(pattern, replacement);
  }
  return phoneticPass(result);
}
