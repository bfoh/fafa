# Bulk Menu Import — Design Spec

**Date:** 2026-06-04
**Status:** Approved (design), pending implementation plan
**Owner:** Ebenezer Barning

## Problem

Restaurant owners with long menus must add dishes one-by-one through the single-item modal — slow and discouraging. They need a simple way to load many dishes at once, on mobile, without losing quality or functionality.

## Locked Decisions

1. **Three input methods, one shared pipeline:** Paste-a-list, CSV/Excel upload, and Photo→auto-extract all feed a common `parse → editable preview → confirm → bulk insert`.
2. **Categories via section headers:** in a pasted/extracted list, a line with no price is a category header; dishes under it join that category (auto-created if new). Items before any header go to a chosen default category.
3. **Build order:** Slice 1 = Paste + CSV (no new infrastructure). Slice 2 = Photo→AI extract (adds an API route + Anthropic/AI-gateway key).

## Non-Negotiable Constraints

- **No existing functionality changes.** The single-item modal, chop-bar, option groups, images, categories, and the sample-seed all keep working. Bulk import is additive.
- **Bulk covers simple dishes only** — name, price, optional description, category. Advanced per-dish config (chop-bar, option groups, photo, featured) is done afterward in the existing item editor. Nothing is removed; bulk just doesn't set those.
- **Mobile-first.** Primary users are on Ghana mobile; the paste flow must be excellent on a phone. Reuse the redesign design language + primitives.
- **Same insert path + RLS as today.** Bulk insert uses the browser Supabase client under the member's session (the sample-seed already inserts `menu_items` this way), so no new permissions.
- **Next.js is a non-standard fork** — read `node_modules/next/dist/docs/` before touching Next APIs (relevant to the Slice-2 API route).

## Current State (relevant)

- `menu_categories(id, tenant_id, name, sort_order)` and `menu_items(id, tenant_id, category_id, name, description, price, image_url, is_available, is_featured, sort_order, ...)`.
- `app/(dashboard)/menu/page.tsx` — menu management; single-item modal; "Add many" entry point will live here.
- `lib/onboarding/sample-menu.ts` — `seedSampleMenu()` shows the exact bulk-insert pattern (lookup categories by name, map dishes to `category_id`, insert rows with `sort_order`). The bulk inserter mirrors this.
- Vitest available for unit-testing the pure parser.

## A. Shared Core

### A1. Parser — `apps/web/lib/menu/parse-list.ts` (pure, unit-tested)

```ts
export interface ParsedItem { name: string; price: number; description?: string; }
export interface ParsedSection { category: string | null; items: ParsedItem[]; }

export function parseMenuList(text: string, defaultCategory?: string): ParsedSection[];
```

Rules:
- Split on newlines; trim; ignore blank lines.
- A line containing a parseable price → a **dish**. Price = the last number in the line (supports `45`, `45.00`, `GHS 45`, `₵45`, `45 cedis`). The dish `name` is the text before the price; an optional `description` is text after a ` - ` / ` — ` / `:` separator within the name part.
- A line with **no parseable price** → a **category header**; subsequent dishes attach to it. Header categories are title-cased/trimmed.
- Dishes before the first header attach to `defaultCategory ?? null`.
- Skip lines that parse to neither a valid dish (name present) nor a header.

### A2. Preview/Edit model

The preview is an editable flat list of rows derived from the parsed sections: `{ name, price, category, description }`. The UI lets the owner edit any field, change a row's category (existing categories + any new ones from headers), remove rows, and shows a live count + validation (name required, price ≥ 0, ≤ some sane max). Nothing is written until "Add all".

### A3. Inserter — `apps/web/lib/menu/bulk-insert.ts`

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
export interface BulkRow { name: string; price: number; description?: string; category: string; }
export async function bulkInsertMenu(
  supabase: SupabaseClient, tenantId: string, rows: BulkRow[]
): Promise<number>; // returns count inserted
```

- Resolve distinct category names to ids: fetch existing `menu_categories` for the tenant; create any missing (insert, append `sort_order` after current max); build a name→id map.
- Insert all `menu_items` in one call with incrementing `sort_order` (appended after the current max for the tenant), `is_available: true`. Returns the number inserted.
- Validation: drop rows with empty name or invalid price before insert (the preview already enforces this; the inserter is defensive).

## B. Input Adapters → same preview

### B1. Paste / type (Slice 1)

A large textarea; `parseMenuList` runs live (debounced) into the preview. Placeholder shows the format (section header + `Name Price` lines). Zero infrastructure.

### B2. CSV / Excel (Slice 1)

- "Download template" produces `name,price,category,description` (a Blob download, like the admin CSV export).
- Upload a `.csv` → parse client-side (simple comma split with quote handling, mirroring the export's escaping) → map to preview rows. Excel users "Save As CSV".
- Rows feed the same preview/inserter.

### B3. Photo → auto-extract (Slice 2)

- Owner snaps/uploads a photo of a printed/written menu.
- `POST /api/menu/extract` (server) sends the image to Claude vision via the AI gateway (model string `"anthropic/claude-..."`, key from env) with a strict prompt to return JSON `{ sections: [{ category, items: [{ name, price, description? }] }] }`.
- The route validates/normalizes the JSON and returns it; the client loads it into the **same editable preview** for review/correction before insert.
- **Requires** an Anthropic/AI-gateway API key in the environment and incurs per-call cost. Guarded: feature shows a friendly "not configured" message if the key is absent.

## C. UX Placement

- `menu/page.tsx` header gains an **"Add many"** button beside "Add dish".
- Opens a **Bulk Import** sheet (reuse `bottom-sheet`/modal patterns) with three tabs: **Paste · Upload · Photo**.
- All tabs render the shared **Preview** below, then a primary **"Add all dishes (N)"** button → `bulkInsertMenu` → refresh the menu list → close.

## Data Flow

Input (paste text / CSV file / photo) → adapter produces `ParsedSection[]` → preview rows (editable) → on confirm → `bulkInsertMenu` (ensure categories, insert items) → menu list refresh.

## Error / Edge States

- Empty/garbage input → preview empty, "Add" disabled with a hint.
- Rows failing validation are flagged inline and excluded from the count until fixed.
- Photo: no key → "Photo import isn't available yet" notice; AI returns unparseable → "Couldn't read that menu — try a clearer photo or paste the list".
- Large lists: cap a single import to a sane max (e.g. 200 rows) with a message; insert in one batch.
- Duplicate names: allowed (no dedupe) — the editable preview is the guard; a soft "looks like a duplicate of an existing dish" hint is optional, not blocking.

## Verification

- **Unit (`parse-list.test.ts`):** headers vs dishes; price formats (`45`, `45.00`, `GHS 45`, `₵45`); description separators; items before first header → default category; junk lines skipped.
- `npx tsc --noEmit` clean; `npm run build` succeeds; existing 41 tests still pass.
- Manual: paste a 2-section list → preview → add → items appear in the right categories; CSV round-trip via the template; (Slice 2) a menu photo extracts into the preview.

## Build Sequence

**Slice 1 (no new infra):**
1. `parse-list.ts` + unit tests.
2. `bulk-insert.ts` (mirrors the sample-seed insert pattern).
3. Bulk Import sheet UI with Paste + CSV tabs + shared preview; wire "Add many" on the menu page.

**Slice 2 (AI):**
4. `POST /api/menu/extract` (Claude vision via AI gateway) + the Photo tab; env-guarded.

## Known Risks

- **Parser ambiguity** (e.g. a dish named with a number, or a header that contains a number) → mitigate with "last number is the price" + the always-editable preview as the human check.
- **AI accuracy/cost** (Slice 2) → the mandatory review step + env guard; ship Slice 1 independently so value lands without AI.
- **Category explosion** from typos in headers → preview shows the resolved category per row so the owner can correct before insert.
