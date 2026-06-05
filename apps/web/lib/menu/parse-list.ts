export interface ParsedItem {
  name: string;
  price: number;
  description?: string;
  chopBar?: boolean;
}

// A "(chop bar)" / "(chopbar)" / "[chop]" tag flags a build-your-own item.
const CHOP_TAG = /\s*[([]\s*chop\s?bar?\s*[)\]]/i;
export interface ParsedSection {
  category: string | null;
  items: ParsedItem[];
}

// Title-case a header line ("DRINKS" / "drinks" → "Drinks").
function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

// Pull the last standalone number out of a line. Returns null if none.
function extractPrice(line: string): { price: number; rest: string } | null {
  const matches = [...line.matchAll(/(\d+(?:\.\d{1,2})?)/g)];
  if (matches.length === 0) return null;
  const last = matches[matches.length - 1];
  const price = parseFloat(last[1]);
  if (!Number.isFinite(price)) return null;
  const before = line.slice(0, last.index).trim();
  return { price, rest: before };
}

function cleanName(raw: string): { name: string; description?: string; chopBar?: boolean } {
  const chopBar = CHOP_TAG.test(raw);
  const cleaned = raw
    .replace(CHOP_TAG, ' ')
    .replace(/^[-•*\s]+/, '')
    .replace(/[₵$]|ghs|gh¢|cedis?/gi, '')
    .trim();
  const parts = cleaned.split(/\s+[-—:|]\s+/);
  if (parts.length >= 2) {
    return { name: parts[0].trim(), description: parts.slice(1).join(' - ').trim(), chopBar: chopBar || undefined };
  }
  return { name: cleaned, chopBar: chopBar || undefined };
}

export function parseMenuList(text: string, defaultCategory?: string): ParsedSection[] {
  const sections: ParsedSection[] = [];
  let current: ParsedSection | null = null;

  const ensureSection = (category: string | null) => {
    current = { category, items: [] };
    sections.push(current);
  };

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const priced = extractPrice(line);
    if (priced && priced.rest) {
      const { name, description, chopBar } = cleanName(priced.rest);
      if (!name) continue; // price with no name → skip
      if (!current) ensureSection(defaultCategory ? titleCase(defaultCategory) : null);
      const item: ParsedItem = { name, price: priced.price };
      if (description) item.description = description;
      if (chopBar) item.chopBar = true;
      current!.items.push(item);
    } else if (!priced) {
      // No price → a category header.
      ensureSection(titleCase(line));
    }
    // priced but empty rest (e.g. a lone "99") → skip.
  }

  // Keep sections that have items, or named (header) sections so the user sees them.
  return sections.filter((s) => s.items.length > 0 || s.category !== null);
}
