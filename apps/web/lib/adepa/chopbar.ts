import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * In-chat chop-bar config. Translates a plain-language bowl request
 * ("banku, tilapia, extra pepper, no shito") into the exact option
 * structure the storefront already uses — grounded: it can only ever
 * select from the item's real options, never invent one.
 */

export interface ChopBarOption {
  id: string;
  name: string;
  price_modifier: number | string | null;
  option_type?: string | null;
  sub_options?: string | null;
  min_quantity?: number | string | null;
  price_tiers?: Array<{ label: string; price: number }> | string | null;
}

export interface ChopBarItem {
  id: string;
  name: string;
  price: number | string;
  menu_item_options?: ChopBarOption[] | null;
}

export interface MatchedBowl {
  itemId: string;
  name: string;
  basePrice: number;
  // Shape matches CartItem.options so the widget can add it directly.
  selected: Array<{ name: string; priceModifier: number }>;
  total: number;
  unmatched: string[];
}

const NEGATIONS = ['no', 'without', 'skip', 'hold', 'minus'];
const LARGE = ['large', 'big', 'jumbo', 'full', 'max'];
const SMALL = ['small', 'mini', 'little'];
const MEDIUM = ['medium', 'regular', 'normal'];

function parseTiers(
  raw: ChopBarOption['price_tiers']
): Array<{ label: string; price: number }> {
  if (!raw) return [];
  try {
    const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((t) => t && typeof t.price !== 'undefined')
      .map((t) => ({ label: String(t.label ?? ''), price: Number(t.price) || 0 }));
  } catch {
    return [];
  }
}

// Terms that identify an option in free text: its name plus any sub-options.
function optionTerms(opt: ChopBarOption): string[] {
  const terms = [opt.name];
  if (opt.sub_options) {
    terms.push(...opt.sub_options.split(',').map((s) => s.trim()).filter(Boolean));
  }
  return terms.map((t) => t.toLowerCase()).filter((t) => t.length >= 3);
}

function isNegated(request: string, term: string): boolean {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`\\b(?:${NEGATIONS.join('|')})\\s+(?:the\\s+|any\\s+)?${escaped}`, 'i');
  return re.test(request);
}

function tierPrice(
  tiers: Array<{ label: string; price: number }>,
  request: string
): number {
  if (!tiers.length) return 0;
  if (LARGE.some((w) => request.includes(w))) return tiers[tiers.length - 1].price;
  if (SMALL.some((w) => request.includes(w))) return tiers[0].price;
  if (MEDIUM.some((w) => request.includes(w))) {
    return tiers[Math.floor((tiers.length - 1) / 2)].price;
  }
  return tiers[0].price;
}

/**
 * Pure matcher — given an item and a request, returns the selected options.
 * Unit-tested. No I/O.
 */
export function matchChopBarOptions(item: ChopBarItem, request: string): MatchedBowl {
  const req = ` ${request.toLowerCase()} `;
  const basePrice = Number(item.price) || 0;
  const options = item.menu_item_options || [];

  const selected: Array<{ name: string; priceModifier: number }> = [];
  const matchedTerms = new Set<string>();

  for (const opt of options) {
    const terms = optionTerms(opt);
    const hit = terms.find((t) => req.includes(t) && !isNegated(req, t));
    if (!hit) continue;
    matchedTerms.add(hit);

    const tiers = parseTiers(opt.price_tiers);
    let priceModifier = 0;
    if (tiers.length) priceModifier = tierPrice(tiers, req);
    else if (Number(opt.price_modifier) > 0) priceModifier = Number(opt.price_modifier);
    else priceModifier = Number(opt.min_quantity) || 0;

    selected.push({ name: opt.name, priceModifier });
  }

  // Requested words (3+ chars) we couldn't ground to a real option — so Adepa
  // can honestly say "we don't have X" instead of silently dropping it.
  const stop = new Set([
    ...NEGATIONS,
    ...LARGE,
    ...SMALL,
    ...MEDIUM,
    'and',
    'with',
    'extra',
    'some',
    'please',
    'the',
    'add',
    'plus',
  ]);
  const unmatched = Array.from(
    new Set(
      request
        .toLowerCase()
        .split(/[,\s]+/)
        .map((w) => w.replace(/[^a-z]/g, ''))
        .filter((w) => w.length >= 3 && !stop.has(w))
        .filter((w) => !Array.from(matchedTerms).some((t) => t.includes(w)))
    )
  );

  const total = basePrice + selected.reduce((s, o) => s + o.priceModifier, 0);
  return { itemId: item.id, name: item.name, basePrice, selected, total, unmatched };
}

/**
 * Executor — loads the chop-bar item (within the active tenant) and runs the
 * matcher. Returns { found: false } when the named item isn't a chop-bar dish.
 */
export async function customiseChopBar(
  supabase: SupabaseClient,
  tenantId: string | null,
  args: { item: string; request: string }
): Promise<{ found: boolean; bowl?: MatchedBowl }> {
  let q = supabase
    .from('menu_items')
    .select('id, name, price, is_chop_bar, menu_item_options(*)')
    .eq('is_chop_bar', true)
    .eq('is_available', true)
    .ilike('name', `%${args.item}%`)
    .limit(1);
  if (tenantId) q = q.eq('tenant_id', tenantId);
  const { data } = await q.maybeSingle();
  if (!data) return { found: false };

  const bowl = matchChopBarOptions(data as unknown as ChopBarItem, args.request);
  return { found: true, bowl };
}
