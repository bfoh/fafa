# Bulk Menu Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (recommended) or superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Let owners load many dishes at once via paste / CSV / photo, through one shared `parse → editable preview → bulk insert` pipeline, without changing existing menu functionality.

**Architecture:** A pure parser turns text into category sections; a bulk inserter mirrors the existing sample-seed insert; a Bulk Import sheet offers Paste + CSV (Slice 1) and Photo→AI (Slice 2) tabs that all feed the same editable preview. Bulk handles simple dishes (name/price/description/category); advanced config stays in the single-item editor.

**Tech Stack:** Next.js (App Router, non-standard fork — read `node_modules/next/dist/docs/`), React client components, Supabase (browser client + RLS), Tailwind v4 + UI primitives, Vitest. Slice 2: Claude vision via the Vercel AI gateway.

Spec: `docs/superpowers/specs/2026-06-04-bulk-menu-import-design.md`

**Discipline:** Behavior unchanged. After each task `npx tsc --noEmit`; `npm run build` + `npx vitest run` at slice end. Git from repo root (`/Users/ebenezerbarning/Desktop/fafa`); quote paths with `(...)`.

---

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `apps/web/lib/menu/parse-list.ts` | Parse pasted text → category sections | 1 |
| `apps/web/lib/menu/parse-list.test.ts` | Parser unit tests | 1 |
| `apps/web/lib/menu/parse-csv.ts` | Parse CSV text → preview rows | 2 |
| `apps/web/lib/menu/parse-csv.test.ts` | CSV parser tests | 2 |
| `apps/web/lib/menu/bulk-insert.ts` | Ensure categories + insert items | 3 |
| `apps/web/components/menu/bulk-import-sheet.tsx` | Sheet: tabs + shared preview + insert | 4 |
| `apps/web/app/(dashboard)/menu/page.tsx` | "Add many" button → open the sheet; refresh on done | 5 |
| `apps/web/app/api/menu/extract/route.ts` | Slice 2: photo → Claude vision → sections | 6 |
| `apps/web/components/menu/bulk-import-sheet.tsx` | Slice 2: Photo tab | 7 |

---

# SLICE 1 — Paste + CSV (no new infrastructure)

## Task 1: List parser

**Files:** Create `apps/web/lib/menu/parse-list.ts`, `apps/web/lib/menu/parse-list.test.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/web/lib/menu/parse-list.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { parseMenuList } from './parse-list';

describe('parseMenuList', () => {
  it('parses a dish with a trailing price', () => {
    expect(parseMenuList('Jollof Rice 45')).toEqual([
      { category: null, items: [{ name: 'Jollof Rice', price: 45 }] },
    ]);
  });

  it('treats a line with no price as a category header', () => {
    const out = parseMenuList('Drinks\nSobolo 10\nWater 5');
    expect(out).toEqual([
      { category: 'Drinks', items: [{ name: 'Sobolo', price: 10 }, { name: 'Water', price: 5 }] },
    ]);
  });

  it('supports multiple sections', () => {
    const out = parseMenuList('DRINKS\nSobolo 10\nMAINS\nJollof 45');
    expect(out.map((s) => s.category)).toEqual(['Drinks', 'Mains']);
    expect(out[1].items).toEqual([{ name: 'Jollof', price: 45 }]);
  });

  it('handles GHS / cedi / decimal price formats', () => {
    expect(parseMenuList('Banku GHS 50')[0].items[0]).toEqual({ name: 'Banku', price: 50 });
    expect(parseMenuList('Kelewele ₵15.50')[0].items[0]).toEqual({ name: 'Kelewele', price: 15.5 });
    expect(parseMenuList('Water 5 cedis')[0].items[0]).toEqual({ name: 'Water', price: 5 });
  });

  it('extracts a description after a dash or colon', () => {
    expect(parseMenuList('Jollof - smoky party rice 45')[0].items[0]).toEqual({
      name: 'Jollof', price: 45, description: 'smoky party rice',
    });
  });

  it('puts items before any header into the default category', () => {
    expect(parseMenuList('Jollof 45', 'Main Dishes')).toEqual([
      { category: 'Main Dishes', items: [{ name: 'Jollof', price: 45 }] },
    ]);
  });

  it('skips blank and nameless lines', () => {
    const out = parseMenuList('\n  \nJollof 45\n   99');
    expect(out).toEqual([{ category: null, items: [{ name: 'Jollof', price: 45 }] }]);
  });
});
```

- [ ] **Step 2: Run — expect fail**

Run: `cd apps/web && npx vitest run parse-list`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement the parser**

Create `apps/web/lib/menu/parse-list.ts`:
```ts
export interface ParsedItem {
  name: string;
  price: number;
  description?: string;
}
export interface ParsedSection {
  category: string | null;
  items: ParsedItem[];
}

// Title-case a header line ("DRINKS" / "drinks" → "Drinks"), preserving spacing.
function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

// Pull the last standalone number out of a line. Returns null if none.
function extractPrice(line: string): { price: number; rest: string } | null {
  // Match the last number (optionally decimal), ignoring currency tokens around it.
  const matches = [...line.matchAll(/(\d+(?:\.\d{1,2})?)/g)];
  if (matches.length === 0) return null;
  const last = matches[matches.length - 1];
  const price = parseFloat(last[1]);
  if (!Number.isFinite(price)) return null;
  // Everything before the price number (drop trailing currency words/symbols).
  const before = line.slice(0, last.index).trim();
  return { price, rest: before };
}

function cleanName(raw: string): { name: string; description?: string } {
  // Strip leading currency/bullets; split an optional description after - — : |
  const cleaned = raw.replace(/^[-•*\s]+/, '').replace(/[₵$]|ghs|gh¢|cedis?/gi, '').trim();
  const m = cleaned.split(/\s+[-—:|]\s+/);
  if (m.length >= 2) {
    return { name: m[0].trim(), description: m.slice(1).join(' - ').trim() };
  }
  return { name: cleaned };
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
      const { name, description } = cleanName(priced.rest);
      if (!name) continue; // price with no name → skip
      if (!current) ensureSection(defaultCategory ? titleCase(defaultCategory) : null);
      current!.items.push(description ? { name, price: priced.price, description } : { name, price: priced.price });
    } else if (!priced) {
      // No price → a category header.
      ensureSection(titleCase(line));
    }
    // priced but empty rest (e.g. a lone "99") → skip.
  }

  // Drop empty sections (a header with no items still counts so the user sees it).
  return sections.filter((s) => s.items.length > 0 || s.category !== null);
}
```

- [ ] **Step 4: Run — expect pass**

Run: `cd apps/web && npx vitest run parse-list`
Expected: PASS (7 tests). If the "skips nameless line `99`" case keeps an empty section, confirm the final filter drops a `{category:null, items:[]}` section — adjust the filter to also drop null-category empty sections if needed.

- [ ] **Step 5: Commit**
```bash
git add apps/web/lib/menu/parse-list.ts apps/web/lib/menu/parse-list.test.ts
git commit -m "feat(menu): list parser for bulk import (sections + price formats)"
```

---

## Task 2: CSV parser

**Files:** Create `apps/web/lib/menu/parse-csv.ts`, `apps/web/lib/menu/parse-csv.test.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/web/lib/menu/parse-csv.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { parseMenuCsv, MENU_CSV_TEMPLATE } from './parse-csv';

describe('parseMenuCsv', () => {
  it('parses name,price,category,description with a header row', () => {
    const csv = 'name,price,category,description\nJollof,45,Mains,Smoky rice\nWater,5,Drinks,';
    expect(parseMenuCsv(csv)).toEqual([
      { name: 'Jollof', price: 45, category: 'Mains', description: 'Smoky rice' },
      { name: 'Water', price: 5, category: 'Drinks' },
    ]);
  });

  it('handles quoted fields containing commas', () => {
    const csv = 'name,price,category\n"Rice, beans & egg",35,Mains';
    expect(parseMenuCsv(csv)[0]).toEqual({ name: 'Rice, beans & egg', price: 35, category: 'Mains' });
  });

  it('skips rows with no name or bad price', () => {
    const csv = 'name,price\n,10\nJollof,abc\nWaakye,35';
    expect(parseMenuCsv(csv)).toEqual([{ name: 'Waakye', price: 35, category: '' }]);
  });

  it('exposes a template string', () => {
    expect(MENU_CSV_TEMPLATE.split('\n')[0]).toBe('name,price,category,description');
  });
});
```

- [ ] **Step 2: Run — expect fail**

Run: `cd apps/web && npx vitest run parse-csv`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `apps/web/lib/menu/parse-csv.ts`:
```ts
export interface CsvRow {
  name: string;
  price: number;
  category: string;
  description?: string;
}

export const MENU_CSV_TEMPLATE =
  'name,price,category,description\nJollof Rice,45,Main Dishes,Smoky party jollof\nSobolo,10,Drinks,Chilled hibiscus drink\n';

// Parse a single CSV line into fields, honouring double-quoted values.
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else cur += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export function parseMenuCsv(text: string): CsvRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return [];

  // Detect a header row and map column positions.
  const first = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const hasHeader = first.includes('name') || first.includes('price');
  const idx = {
    name: hasHeader ? first.indexOf('name') : 0,
    price: hasHeader ? first.indexOf('price') : 1,
    category: hasHeader ? first.indexOf('category') : 2,
    description: hasHeader ? first.indexOf('description') : 3,
  };

  const rows: CsvRow[] = [];
  for (const line of lines.slice(hasHeader ? 1 : 0)) {
    const cols = splitCsvLine(line);
    const name = (cols[idx.name] ?? '').trim();
    const price = parseFloat((cols[idx.price] ?? '').replace(/[^\d.]/g, ''));
    if (!name || !Number.isFinite(price)) continue;
    const category = idx.category >= 0 ? (cols[idx.category] ?? '').trim() : '';
    const description = idx.description >= 0 ? (cols[idx.description] ?? '').trim() : '';
    rows.push(description ? { name, price, category, description } : { name, price, category });
  }
  return rows;
}
```

- [ ] **Step 4: Run — expect pass**

Run: `cd apps/web && npx vitest run parse-csv`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**
```bash
git add apps/web/lib/menu/parse-csv.ts apps/web/lib/menu/parse-csv.test.ts
git commit -m "feat(menu): CSV parser + template for bulk import"
```

---

## Task 3: Bulk inserter

**Files:** Create `apps/web/lib/menu/bulk-insert.ts`

- [ ] **Step 1: Implement (mirrors the sample-seed insert)**

Create `apps/web/lib/menu/bulk-insert.ts`:
```ts
import type { SupabaseClient } from '@supabase/supabase-js';

export interface BulkRow {
  name: string;
  price: number;
  description?: string;
  category: string; // resolved category name (may be new)
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
  const clean = rows.filter((r) => r.name.trim() && Number.isFinite(r.price) && r.price >= 0);
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

  // 2. Create any missing categories (skip blank category → fallback later).
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
    const { data: created } = await supabase.from('menu_categories').insert(newCats).select('id, name');
    for (const c of created || []) byName.set(c.name.trim().toLowerCase(), c.id);
  }

  // 3. Fallback category for blank-category rows: first existing/created category.
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

  const itemRows = clean.map((r) => ({
    tenant_id: tenantId,
    category_id: byName.get(r.category.trim().toLowerCase()) ?? fallbackId,
    name: r.name.trim(),
    description: r.description?.trim() || null,
    price: r.price,
    is_available: true,
    sort_order: sort++,
  }));

  const { error } = await supabase.from('menu_items').insert(itemRows);
  if (error) throw new Error(error.message);
  return itemRows.length;
}
```

- [ ] **Step 2: Verify + commit**
```bash
cd apps/web && npx tsc --noEmit
git add apps/web/lib/menu/bulk-insert.ts
git commit -m "feat(menu): bulk inserter (ensure categories + insert dishes)"
```

---

## Task 4: Bulk Import sheet (Paste + CSV + preview)

**Files:** Create `apps/web/components/menu/bulk-import-sheet.tsx`

- [ ] **Step 1: Build the sheet**

Create `apps/web/components/menu/bulk-import-sheet.tsx`:
```tsx
'use client';

import { useMemo, useState } from 'react';
import { X, Trash2, Loader2, Download, ClipboardList, Upload } from 'lucide-react';
import { createBrowserClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { parseMenuList } from '@/lib/menu/parse-list';
import { parseMenuCsv, MENU_CSV_TEMPLATE } from '@/lib/menu/parse-csv';
import { bulkInsertMenu, type BulkRow } from '@/lib/menu/bulk-insert';

type Tab = 'paste' | 'csv';

export function BulkImportSheet({
  tenantId,
  categories,
  onClose,
  onDone,
}: {
  tenantId: string;
  categories: { id: string; name: string }[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [tab, setTab] = useState<Tab>('paste');
  const [pasteText, setPasteText] = useState('');
  const [rows, setRows] = useState<BulkRow[]>([]);
  const [edited, setEdited] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const defaultCategory = categories[0]?.name || 'Main Dishes';

  // Live-parse paste text into editable rows (unless the user has hand-edited).
  const parsedFromPaste = useMemo<BulkRow[]>(() => {
    return parseMenuList(pasteText, defaultCategory).flatMap((s) =>
      s.items.map((it) => ({
        name: it.name,
        price: it.price,
        description: it.description,
        category: s.category || defaultCategory,
      }))
    );
  }, [pasteText, defaultCategory]);

  const previewRows = edited ? rows : tab === 'paste' ? parsedFromPaste : rows;
  const validCount = previewRows.filter((r) => r.name.trim() && r.price >= 0).length;

  function startEditing() {
    if (!edited) { setRows(previewRows); setEdited(true); }
  }
  function updateRow(i: number, patch: Partial<BulkRow>) {
    startEditing();
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function removeRow(i: number) {
    startEditing();
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  function downloadTemplate() {
    const blob = new Blob(['﻿' + MENU_CSV_TEMPLATE], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'menu-template.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  async function handleCsvFile(file: File) {
    const text = await file.text();
    const csvRows = parseMenuCsv(text).map((r) => ({
      name: r.name, price: r.price, description: r.description,
      category: r.category || defaultCategory,
    }));
    setRows(csvRows); setEdited(true);
  }

  async function handleSave() {
    setSaving(true); setErr('');
    try {
      const supabase = createBrowserClient();
      await bulkInsertMenu(supabase, tenantId, previewRows);
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not add dishes.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-2xl max-h-[92dvh] flex flex-col animate-slide-up">
        <div className="flex items-center justify-between px-5 py-4 border-b border-hairline shrink-0">
          <h2 className="text-lg font-bold text-surface-900">Add many dishes</h2>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-surface-100" aria-label="Close">
            <X className="w-5 h-5 text-surface-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 px-5 pt-3 shrink-0">
          {([['paste', 'Paste a list', ClipboardList], ['csv', 'Upload CSV', Upload]] as const).map(([key, label, Icon]) => (
            <button key={key} onClick={() => { setTab(key); setEdited(false); }}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold ${tab === key ? 'bg-brand-500 text-white' : 'bg-surface-100 text-surface-600'}`}>
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 scrollbar-thin">
          {tab === 'paste' && (
            <div className="space-y-2">
              <p className="text-xs text-surface-500">One dish per line, e.g. <span className="font-mono">Jollof Rice 45</span>. A line with no price becomes a category.</p>
              <textarea
                value={pasteText}
                onChange={(e) => { setPasteText(e.target.value); setEdited(false); }}
                rows={6}
                placeholder={'DRINKS\nSobolo 10\nWater 5\n\nMAINS\nJollof Rice 45\nWaakye 35'}
                className="w-full px-4 py-3 rounded-xl border border-hairline bg-white text-surface-900 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500/40"
              />
            </div>
          )}

          {tab === 'csv' && (
            <div className="space-y-3">
              <button onClick={downloadTemplate} className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600">
                <Download className="w-4 h-4" /> Download template
              </button>
              <input type="file" accept=".csv,text/csv" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCsvFile(f); }}
                className="block w-full text-sm text-surface-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-brand-500/10 file:text-brand-600" />
            </div>
          )}

          {/* Preview */}
          {previewRows.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-surface-400 uppercase tracking-widest">Preview — edit before adding</p>
              <div className="space-y-2">
                {previewRows.map((r, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input value={r.name} onChange={(e) => updateRow(i, { name: e.target.value })}
                      className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-hairline text-sm" placeholder="Dish name" />
                    <input value={r.price} onChange={(e) => updateRow(i, { price: parseFloat(e.target.value) || 0 })}
                      type="number" step="0.01" className="w-20 px-2 py-2 rounded-lg border border-hairline text-sm" />
                    <select value={r.category} onChange={(e) => updateRow(i, { category: e.target.value })}
                      className="w-28 px-2 py-2 rounded-lg border border-hairline text-sm">
                      {Array.from(new Set([r.category, ...categories.map((c) => c.name)])).filter(Boolean).map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <button onClick={() => removeRow(i)} className="p-2 text-surface-400 hover:text-error-600" aria-label="Remove"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {err && <p className="text-sm text-error-600">{err}</p>}
        </div>

        <div className="border-t border-hairline px-5 pt-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shrink-0">
          <Button onClick={handleSave} loading={saving} disabled={validCount === 0} className="w-full">
            {saving ? 'Adding…' : `Add ${validCount} dish${validCount === 1 ? '' : 'es'}`}
          </Button>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Verify + commit**
```bash
cd apps/web && npx tsc --noEmit
git add apps/web/components/menu/bulk-import-sheet.tsx
git commit -m "feat(menu): bulk import sheet (paste + CSV + editable preview)"
```

---

## Task 5: Wire "Add many" into the menu page

**Files:** Modify `apps/web/app/(dashboard)/menu/page.tsx`

- [ ] **Step 1: Import + state**

Add the import near the top: `import { BulkImportSheet } from '@/components/menu/bulk-import-sheet';`
Add state near the other modal flags: `const [bulkOpen, setBulkOpen] = useState(false);`

- [ ] **Step 2: Add the button**

In the page header action row (where the "Add Category" / item buttons live, around the `setCategoryModalOpen(true)` button), add an "Add many" button beside the existing add buttons:
```tsx
          <button
            onClick={() => setBulkOpen(true)}
            className="px-4 py-2 border border-hairline text-surface-700 font-semibold rounded-xl text-sm hover:bg-surface-50 transition-colors"
          >
            Add many
          </button>
```

- [ ] **Step 3: Render the sheet**

Near where the other modals render (e.g. after the item modal block), add:
```tsx
      {bulkOpen && tenantId && (
        <BulkImportSheet
          tenantId={tenantId}
          categories={categories.map((c) => ({ id: c.id, name: c.name }))}
          onClose={() => setBulkOpen(false)}
          onDone={() => { setBulkOpen(false); fetchMenuData(); }}
        />
      )}
```
Use the page's existing data-refresh function name (it loads categories + items — confirm the actual name by reading the file; it is the function the category/item modals call after saving). If it differs from `fetchMenuData`, use that name.

- [ ] **Step 4: Verify + commit**
```bash
cd apps/web && npx tsc --noEmit && npm run build
git add "apps/web/app/(dashboard)/menu/page.tsx"
git commit -m "feat(menu): 'Add many' opens the bulk import sheet"
```

- [ ] **Step 5: Slice 1 verification**

Run: `cd apps/web && npx vitest run` (parser + csv tests + the existing 41 pass) and `npm run build`.
Manual: Menu → Add many → paste `DRINKS\nSobolo 10\nMAINS\nJollof 45` → preview shows 2 rows in 2 categories → Add → items appear; CSV template round-trip works; single-item add/edit and chop-bar unchanged.
**STOP — Slice 1 review gate.** Confirm with the user before Slice 2 (photo/AI).

---

# SLICE 2 — Photo → AI extract (adds API route + key)

## Task 6: Extraction API route

**Files:** Create `apps/web/app/api/menu/extract/route.ts`

- [ ] **Step 1: Implement the route**

Create `apps/web/app/api/menu/extract/route.ts`. It accepts a base64 image, calls Claude vision via the Vercel AI gateway, and returns `{ sections }`. Guard on a missing key.
```ts
import { NextResponse } from 'next/server';
import { getResolvedTenantId } from '@/lib/admin/guard';

const SYSTEM = `You extract menu items from a photo of a restaurant menu. Return ONLY valid JSON of shape {"sections":[{"category":string|null,"items":[{"name":string,"price":number,"description":string|null}]}]}. Prices are numbers in the local currency (Ghana Cedis), no symbols. Group items under their printed category headings. If unsure of a price, omit that item. No prose, JSON only.`;

export async function POST(req: Request) {
  const { tenantId } = await getResolvedTenantId();
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const key = process.env.AI_GATEWAY_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return NextResponse.json({ error: 'Photo import is not configured yet.' }, { status: 503 });
  }

  try {
    const { imageBase64, mediaType } = await req.json();
    if (!imageBase64) return NextResponse.json({ error: 'No image provided' }, { status: 400 });

    const res = await fetch('https://ai-gateway.vercel.sh/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: 'anthropic/claude-sonnet-4-6',
        messages: [
          { role: 'system', content: SYSTEM },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Extract the menu as JSON.' },
              { type: 'image_url', image_url: { url: `data:${mediaType || 'image/jpeg'};base64,${imageBase64}` } },
            ],
          },
        ],
        temperature: 0,
      }),
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'Could not read the menu image.' }, { status: 502 });
    }
    const data = await res.json();
    const content: string = data.choices?.[0]?.message?.content ?? '';
    const jsonText = content.slice(content.indexOf('{'), content.lastIndexOf('}') + 1);
    const parsed = JSON.parse(jsonText);
    const sections = Array.isArray(parsed.sections) ? parsed.sections : [];
    return NextResponse.json({ sections });
  } catch {
    return NextResponse.json({ error: 'Could not read that menu — try a clearer photo or paste the list.' }, { status: 422 });
  }
}
```
Note: the exact AI-gateway request shape may need adjusting to the current gateway API — verify against `vercel:ai-gateway` docs before finalizing. Keep the response contract `{ sections }` stable regardless.

- [ ] **Step 2: Type-check + commit**
```bash
cd apps/web && npx tsc --noEmit
git add apps/web/app/api/menu/extract/route.ts
git commit -m "feat(menu): photo→menu extraction API (Claude vision via AI gateway)"
```

## Task 7: Photo tab

**Files:** Modify `apps/web/components/menu/bulk-import-sheet.tsx`

- [ ] **Step 1: Add a 'photo' tab**

Extend `type Tab` to `'paste' | 'csv' | 'photo'`; add a Photo tab button. In the photo panel: a file input (`accept="image/*" capture="environment"`), an "Extracting…" state, and on success map the returned `sections` to `BulkRow[]` exactly like the paste mapping (so the same preview/edit/insert applies):
```tsx
  const [extracting, setExtracting] = useState(false);
  async function handlePhoto(file: File) {
    setExtracting(true); setErr('');
    try {
      const b64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).split(',')[1]);
        r.onerror = reject;
        r.readAsDataURL(file);
      });
      const res = await fetch('/api/menu/extract', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: b64, mediaType: file.type }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not read the menu.');
      const mapped: BulkRow[] = (data.sections || []).flatMap((s: { category: string | null; items: { name: string; price: number; description?: string }[] }) =>
        (s.items || []).map((it) => ({ name: it.name, price: Number(it.price) || 0, description: it.description || undefined, category: s.category || defaultCategory }))
      );
      setRows(mapped); setEdited(true);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Could not read the menu.'); }
    finally { setExtracting(false); }
  }
```
Render the photo panel when `tab === 'photo'` with the file input + `{extracting && <Loader2 className="w-4 h-4 animate-spin" />}`.

- [ ] **Step 2: Verify + commit**
```bash
cd apps/web && npx tsc --noEmit && npm run build
git add apps/web/components/menu/bulk-import-sheet.tsx
git commit -m "feat(menu): photo tab — extract a menu from a picture"
```

---

## Final Verification

- [ ] `cd apps/web && npx vitest run` — parser + CSV tests pass + existing 41 still pass.
- [ ] `cd apps/web && npx tsc --noEmit` clean; `npm run build` succeeds.
- [ ] Manual: paste, CSV, and (if a key is set) photo all land in the shared preview and insert correctly into the right categories; single-item editor + chop-bar unchanged.

## Notes for the Implementer

- **Reuse the seed pattern.** `bulkInsertMenu` deliberately mirrors `seedSampleMenu`'s category-lookup + insert so RLS/permissions match what already works.
- **Preview is the guard.** No dedupe — the editable preview lets the owner fix everything before insert.
- **Slice 2 is independent.** Ship Slice 1 (paste + CSV) without any AI key. Photo needs `AI_GATEWAY_API_KEY` (or `ANTHROPIC_API_KEY`) and is env-guarded; verify the AI-gateway request shape against current `vercel:ai-gateway` docs.
- Read `menu/page.tsx` before Task 5 to use its real refresh-function name and confirm the header action row.
