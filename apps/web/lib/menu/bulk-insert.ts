import type { SupabaseClient } from '@supabase/supabase-js';

export interface BulkRow {
  name: string;
  price: number;
  description?: string;
  category: string; // resolved category name (may be new)
  chopBar?: boolean;
}

/**
 * Ensure all referenced categories exist, then insert all dishes. Mirrors the
 * existing sample-seed insert path (browser client + member RLS). Returns the
 * number of dishes inserted.
 */
export async function bulkInsertMenu(
  supabase: SupabaseClient,
  tenantId: string,
  rows: BulkRow[]
): Promise<number> {
  const clean = rows.filter(
    (r) => r.name.trim() && Number.isFinite(r.price) && r.price >= 0
  );
  if (clean.length === 0) return 0;

  // 1. Load existing categories.
  const { data: existing } = await supabase
    .from('menu_categories')
    .select('id, name, sort_order')
    .eq('tenant_id', tenantId);

  const byName = new Map<string, string>();
  let maxCatSort = -1;
  for (const c of existing || []) {
    byName.set(c.name.trim().toLowerCase(), c.id);
    if ((c.sort_order ?? 0) > maxCatSort) maxCatSort = c.sort_order ?? 0;
  }

  // 2. Create any missing categories.
  const wanted = Array.from(
    new Set(clean.map((r) => r.category.trim()).filter(Boolean))
  );
  const toCreate = wanted.filter((name) => !byName.has(name.toLowerCase()));
  if (toCreate.length > 0) {
    const newCats = toCreate.map((name, i) => ({
      tenant_id: tenantId,
      name,
      sort_order: maxCatSort + 1 + i,
    }));
    const { data: created } = await supabase
      .from('menu_categories')
      .insert(newCats)
      .select('id, name');
    for (const c of created || []) byName.set(c.name.trim().toLowerCase(), c.id);
  }

  // 3. Fallback category for blank-category rows.
  const fallbackId = byName.values().next().value ?? null;

  // 4. Append after the current max item sort_order.
  const { data: lastItem } = await supabase
    .from('menu_items')
    .select('sort_order')
    .eq('tenant_id', tenantId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  let sort = (lastItem?.sort_order ?? -1) + 1;

  // Only set is_chop_bar if the column exists (008_chop_bar migration applied).
  const { error: probe } = await supabase.from('menu_items').select('is_chop_bar').limit(1);
  const hasChopBarColumn = !probe;

  const itemRows = clean.map((r) => ({
    tenant_id: tenantId,
    category_id: byName.get(r.category.trim().toLowerCase()) ?? fallbackId,
    name: r.name.trim(),
    description: r.description?.trim() || null,
    price: r.price,
    is_available: true,
    sort_order: sort++,
    ...(hasChopBarColumn ? { is_chop_bar: !!r.chopBar } : {}),
  }));

  const { error } = await supabase.from('menu_items').insert(itemRows);
  if (error) throw new Error(error.message);
  return itemRows.length;
}
