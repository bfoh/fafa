# Public Food Marketplace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Didi homepage a public marketplace that auto-publishes active kitchens with menus, lets patrons search by dish + cuisine and find the nearest vendors, while preserving the vendor-onboarding path.

**Architecture:** Server-rendered marketplace (option #1). The homepage `/` is a server component that reads URL filter params and calls one Postgres RPC (`search_kitchens`) via the service-role admin client; the RPC handles the listing rule, dish/cuisine filtering, distance, and `open_now`. Client islands add only geolocation + debounced search + cuisine chips. The old marketing landing moves to `/for-restaurants`. Onboarding/settings gain cuisine tags + a Leaflet map pin.

**Tech Stack:** Next.js 16 (App Router, Turbopack), React 19, Supabase (Postgres + RLS), Tailwind v4, Leaflet + OpenStreetMap (new), TypeScript.

**Repo facts the engineer must know:**
- Working dir for all commands: `/Users/ebenezerbarning/Desktop/fafa/apps/web`. Typecheck: `npx tsc --noEmit`. Lint: `npx eslint <files>`. There is **no test runner** — verification is typecheck + lint + manual app checks.
- Supabase server clients live in `lib/supabase/`. `createAdminClient()` = service-role, bypasses RLS, server-only (already used by `app/(storefront)/[slug]/layout.tsx`). `createBrowserClient()` = anon, RLS-bound, used in `'use client'` pages.
- Migrations live in `/Users/ebenezerbarning/Desktop/fafa/supabase/migrations/`. Apply them in the Supabase SQL editor or via the Supabase CLI; this plan cannot run them for you.
- `tenants` columns already include: `name, slug, tagline, description, logo_url, cover_image_url, city, region, location_lat, location_lng, delivery_fee, min_order_amount, status, is_featured?` — NOTE: `tenants` has **no** `is_featured` (only `menu_items` does); ordering uses `created_at`.
- `operating_hours(tenant_id, day_of_week 0-6, open_time time, close_time time, is_closed bool)`; `day_of_week` 0 = Sunday (registration seeds Sunday as day 0).
- `menu_items(tenant_id, name, is_available, ...)`.
- Currency helper: `formatGHS` from `@/lib/utils/currency`.
- Commit message footer line for every commit: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

## File Structure

**Create:**
- `supabase/migrations/007_marketplace.sql` — cuisines column, GIN index, `search_kitchens` RPC.
- `apps/web/lib/marketplace/cuisines.ts` — curated cuisine constant + label map.
- `apps/web/lib/marketplace/geo.ts` — GH city coordinates + default map center + km formatter.
- `apps/web/components/marketplace/kitchen-card.tsx` — presentational card + `KitchenResult` type.
- `apps/web/components/marketplace/kitchen-grid.tsx` — grid + empty state.
- `apps/web/components/marketplace/cuisine-chips.tsx` — client chip filter (URL-driven).
- `apps/web/components/marketplace/hero-search.tsx` — client search + "Use my location".
- `apps/web/components/onboarding/location-picker.tsx` — client Leaflet map pin.
- `apps/web/app/for-restaurants/page.tsx` — relocated marketing landing.

**Modify:**
- `apps/web/app/page.tsx` — replace landing with marketplace.
- `apps/web/middleware.ts` — add `for-restaurants` to `KNOWN_PATHS`.
- `apps/web/app/api/auth/register/route.ts` — accept + store `cuisines`, `location_lat`, `location_lng`.
- `apps/web/app/(auth)/register/page.tsx` — cuisine chips + location picker.
- `apps/web/app/(dashboard)/settings/profile/page.tsx` — edit cuisines + location.

---

## Task 1: Database — cuisines column + `search_kitchens` RPC

**Files:**
- Create: `supabase/migrations/007_marketplace.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/007_marketplace.sql`:

```sql
-- ============================================================
-- Migration 007: Marketplace (cuisines + discovery RPC)
-- ============================================================

-- ─── Cuisine tags on tenants ────────────────────────────────
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS cuisines TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_tenants_cuisines
  ON tenants USING GIN (cuisines);

-- ─── Marketplace search function ────────────────────────────
-- Returns only public-safe fields. Enforces the listing rule:
-- status='active' AND has >=1 available menu item.
CREATE OR REPLACE FUNCTION public.search_kitchens(
  p_q        TEXT DEFAULT NULL,
  p_cuisines TEXT[] DEFAULT NULL,
  p_city     TEXT DEFAULT NULL,
  p_lat      DOUBLE PRECISION DEFAULT NULL,
  p_lng      DOUBLE PRECISION DEFAULT NULL,
  p_limit    INT DEFAULT 24,
  p_offset   INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  tagline TEXT,
  logo_url TEXT,
  cover_image_url TEXT,
  city TEXT,
  region TEXT,
  cuisines TEXT[],
  delivery_fee NUMERIC,
  min_order_amount NUMERIC,
  item_count INT,
  open_now BOOLEAN,
  distance_km DOUBLE PRECISION
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH loc AS (
    SELECT
      (now() AT TIME ZONE 'Africa/Accra')::time AS lt,
      EXTRACT(DOW FROM (now() AT TIME ZONE 'Africa/Accra'))::int AS ld
  )
  SELECT
    t.id, t.name, t.slug, t.tagline, t.logo_url, t.cover_image_url,
    t.city, t.region, t.cuisines, t.delivery_fee, t.min_order_amount,
    (SELECT count(*)::int FROM menu_items mi
       WHERE mi.tenant_id = t.id AND mi.is_available) AS item_count,
    COALESCE(
      (SELECT (NOT oh.is_closed)
              AND ((SELECT lt FROM loc) BETWEEN oh.open_time AND oh.close_time)
         FROM operating_hours oh
         WHERE oh.tenant_id = t.id
           AND oh.day_of_week = (SELECT ld FROM loc)
         LIMIT 1),
      (SELECT count(*) = 0 FROM operating_hours oh2 WHERE oh2.tenant_id = t.id)
    ) AS open_now,
    CASE
      WHEN p_lat IS NOT NULL AND p_lng IS NOT NULL
       AND t.location_lat IS NOT NULL AND t.location_lng IS NOT NULL
      THEN 6371 * acos(LEAST(1, GREATEST(-1,
        cos(radians(p_lat)) * cos(radians(t.location_lat)) *
        cos(radians(t.location_lng) - radians(p_lng)) +
        sin(radians(p_lat)) * sin(radians(t.location_lat))
      )))
      ELSE NULL
    END AS distance_km
  FROM tenants t
  WHERE t.status = 'active'
    AND EXISTS (SELECT 1 FROM menu_items mi
                 WHERE mi.tenant_id = t.id AND mi.is_available)
    AND (p_cuisines IS NULL OR array_length(p_cuisines, 1) IS NULL
         OR t.cuisines && p_cuisines)
    AND (p_city IS NULL OR p_city = '' OR t.city = p_city)
    AND (
      p_q IS NULL OR p_q = '' OR
      t.name ILIKE '%' || p_q || '%' OR
      COALESCE(t.tagline, '') ILIKE '%' || p_q || '%' OR
      COALESCE(t.description, '') ILIKE '%' || p_q || '%' OR
      EXISTS (SELECT 1 FROM menu_items mi
                WHERE mi.tenant_id = t.id AND mi.is_available
                  AND mi.name ILIKE '%' || p_q || '%')
    )
  ORDER BY
    distance_km ASC NULLS LAST,
    (CASE WHEN p_city IS NOT NULL AND p_city <> '' AND t.city = p_city
          THEN 0 ELSE 1 END),
    open_now DESC,
    t.created_at DESC
  LIMIT GREATEST(1, LEAST(p_limit, 60))
  OFFSET GREATEST(0, p_offset);
$$;

GRANT EXECUTE ON FUNCTION public.search_kitchens(
  TEXT, TEXT[], TEXT, DOUBLE PRECISION, DOUBLE PRECISION, INT, INT
) TO anon, authenticated;
```

- [ ] **Step 2: Apply the migration**

Apply `007_marketplace.sql` in the Supabase SQL editor (paste + run) or via the Supabase CLI. There is no local DB to run it against in this repo.

- [ ] **Step 3: Smoke-test the RPC**

In the Supabase SQL editor run:

```sql
SELECT name, slug, item_count, open_now, distance_km
FROM search_kitchens(NULL, NULL, NULL, 5.6037, -0.1870, 24, 0);
```

Expected: rows for active kitchens that have ≥1 available item; `distance_km` populated for kitchens with coords, `NULL` otherwise; no errors.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/007_marketplace.sql
git commit -m "feat(db): add cuisines column + search_kitchens marketplace RPC

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Cuisine + geo constants

**Files:**
- Create: `apps/web/lib/marketplace/cuisines.ts`
- Create: `apps/web/lib/marketplace/geo.ts`

- [ ] **Step 1: Write `cuisines.ts`**

```ts
export interface Cuisine {
  slug: string;
  label: string;
  emoji: string;
}

// Single source of truth for cuisine tags (onboarding, settings, chips).
export const CUISINES: Cuisine[] = [
  { slug: 'local', label: 'Local', emoji: '🍛' },
  { slug: 'continental', label: 'Continental', emoji: '🍽️' },
  { slug: 'fast-food', label: 'Fast Food', emoji: '🍔' },
  { slug: 'grills', label: 'Grills', emoji: '🍗' },
  { slug: 'pizza', label: 'Pizza', emoji: '🍕' },
  { slug: 'chinese', label: 'Chinese', emoji: '🥡' },
  { slug: 'pastries', label: 'Pastries', emoji: '🥐' },
  { slug: 'drinks', label: 'Drinks', emoji: '🥤' },
  { slug: 'healthy', label: 'Healthy', emoji: '🥗' },
  { slug: 'breakfast', label: 'Breakfast', emoji: '🍳' },
];

export const CUISINE_LABEL: Record<string, string> = Object.fromEntries(
  CUISINES.map((c) => [c.slug, c.label])
);
```

- [ ] **Step 2: Write `geo.ts`**

```ts
// Approximate centroids for GH cities (used to center the onboarding map).
export const CITY_COORDS: Record<string, [number, number]> = {
  Accra: [5.6037, -0.187],
  Kumasi: [6.6885, -1.6244],
  Tamale: [9.4008, -0.8393],
  Takoradi: [4.8845, -1.7554],
  'Cape Coast': [5.1053, -1.2466],
  Tema: [5.6698, -0.0166],
  Sunyani: [7.3349, -2.3123],
  Ho: [6.611, 0.471],
  Koforidua: [6.0941, -0.2591],
};

export const DEFAULT_CENTER: [number, number] = [5.6037, -0.187]; // Accra

export function formatDistance(km: number | null): string | null {
  if (km == null) return null;
  if (km < 1) return `${Math.round(km * 1000)} m away`;
  return `${km.toFixed(1)} km away`;
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add lib/marketplace/cuisines.ts lib/marketplace/geo.ts
git commit -m "feat(marketplace): add cuisine + geo constants

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: KitchenCard + KitchenGrid

**Files:**
- Create: `apps/web/components/marketplace/kitchen-card.tsx`
- Create: `apps/web/components/marketplace/kitchen-grid.tsx`

- [ ] **Step 1: Write `kitchen-card.tsx`**

```tsx
import Link from 'next/link';
import { CUISINE_LABEL } from '@/lib/marketplace/cuisines';
import { formatDistance } from '@/lib/marketplace/geo';
import { formatGHS } from '@/lib/utils/currency';

export interface KitchenResult {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
  city: string | null;
  region: string | null;
  cuisines: string[];
  delivery_fee: number | null;
  min_order_amount: number | null;
  item_count: number;
  open_now: boolean;
  distance_km: number | null;
}

export default function KitchenCard({ k }: { k: KitchenResult }) {
  const distance = formatDistance(k.distance_km);
  const cuisineLine = k.cuisines.length
    ? k.cuisines.map((c) => CUISINE_LABEL[c] || c).slice(0, 3).join(' · ')
    : k.city || 'Kitchen';

  return (
    <Link
      href={`/${k.slug}`}
      className="group bg-white rounded-2xl border border-surface-100 overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all"
    >
      <div className="relative h-28 bg-surface-100">
        {k.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={k.cover_image_url}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-brand-400 to-brand-600" />
        )}
        <span
          className={`absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
            k.open_now
              ? 'bg-white/95 text-success-700'
              : 'bg-white/95 text-error-700'
          }`}
        >
          ● {k.open_now ? 'Open' : 'Closed'}
        </span>
        <div className="absolute -bottom-5 left-4 w-12 h-12 rounded-xl border-[3px] border-white bg-brand-500 overflow-hidden flex items-center justify-center text-white font-bold">
          {k.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={k.logo_url} alt="" className="w-full h-full object-cover" />
          ) : (
            k.name.charAt(0)
          )}
        </div>
      </div>

      <div className="pt-7 px-4 pb-4">
        <h3 className="font-bold text-surface-900 group-hover:text-brand-600 transition-colors truncate">
          {k.name}
        </h3>
        <p className="text-xs text-surface-400 mt-0.5 truncate">{cuisineLine}</p>
        <div className="flex items-center gap-3 text-[11px] text-surface-500 mt-3 pt-3 border-t border-surface-100">
          {distance && <span className="font-semibold text-surface-800">{distance}</span>}
          <span>{k.item_count} items</span>
          <span>{formatGHS(Number(k.delivery_fee || 0))} delivery</span>
        </div>
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: Write `kitchen-grid.tsx`**

```tsx
import { Search } from 'lucide-react';
import KitchenCard, { type KitchenResult } from './kitchen-card';

export default function KitchenGrid({ kitchens }: { kitchens: KitchenResult[] }) {
  if (kitchens.length === 0) {
    return (
      <div className="py-16 text-center">
        <div className="w-14 h-14 mx-auto rounded-full bg-surface-100 flex items-center justify-center mb-4">
          <Search className="w-6 h-6 text-surface-400" />
        </div>
        <p className="font-semibold text-surface-700">No kitchens found</p>
        <p className="text-sm text-surface-400 mt-1">
          Try a different dish, cuisine, or clear your filters.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {kitchens.map((k) => (
        <KitchenCard key={k.id} k={k} />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit && npx eslint components/marketplace/kitchen-card.tsx components/marketplace/kitchen-grid.tsx`
Expected: exit 0, no errors.

- [ ] **Step 4: Commit**

```bash
git add components/marketplace/kitchen-card.tsx components/marketplace/kitchen-grid.tsx
git commit -m "feat(marketplace): kitchen card + grid with empty state

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: CuisineChips + HeroSearch (client islands)

**Files:**
- Create: `apps/web/components/marketplace/cuisine-chips.tsx`
- Create: `apps/web/components/marketplace/hero-search.tsx`

These update the URL search params; the server page re-renders results. Both use `useRouter`/`useSearchParams` from `next/navigation`.

- [ ] **Step 1: Write `cuisine-chips.tsx`**

```tsx
'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { CUISINES } from '@/lib/marketplace/cuisines';

export default function CuisineChips() {
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const active = params.get('cuisine') || 'all';

  function select(slug: string) {
    const next = new URLSearchParams(params.toString());
    if (slug === 'all') next.delete('cuisine');
    else next.set('cuisine', slug);
    startTransition(() => router.replace(`/?${next.toString()}`, { scroll: false }));
  }

  const chip = (slug: string, label: string) => {
    const on = active === slug;
    return (
      <button
        key={slug}
        onClick={() => select(slug)}
        disabled={isPending}
        className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors disabled:opacity-60 ${
          on
            ? 'bg-surface-900 text-white border-surface-900'
            : 'bg-white text-surface-600 border-surface-200 hover:border-surface-300'
        }`}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="flex flex-wrap gap-2 justify-center">
      {chip('all', 'All')}
      {CUISINES.map((c) => chip(c.slug, `${c.emoji} ${c.label}`))}
    </div>
  );
}
```

- [ ] **Step 2: Write `hero-search.tsx`**

```tsx
'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import { MapPin, Search, Loader2 } from 'lucide-react';

export default function HeroSearch() {
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [q, setQ] = useState(params.get('q') || '');
  const [locating, setLocating] = useState(false);
  const nearActive = !!params.get('near');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const next = new URLSearchParams(params.toString());
    if (q.trim()) next.set('q', q.trim());
    else next.delete('q');
    startTransition(() => router.replace(`/?${next.toString()}`, { scroll: false }));
  }

  function useMyLocation() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = new URLSearchParams(params.toString());
        next.set('near', `${pos.coords.latitude},${pos.coords.longitude}`);
        setLocating(false);
        startTransition(() => router.replace(`/?${next.toString()}`, { scroll: false }));
      },
      () => setLocating(false), // denied/unavailable: silently keep default sort
      { timeout: 8000 }
    );
  }

  return (
    <form
      onSubmit={submit}
      className="flex max-w-xl mx-auto bg-white border border-surface-200 rounded-full shadow-lg overflow-hidden"
    >
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search jollof, waakye, pizza, a kitchen…"
        className="flex-1 px-5 py-3.5 text-sm outline-none bg-transparent text-surface-900 placeholder:text-surface-400"
      />
      <button
        type="button"
        onClick={useMyLocation}
        className={`flex items-center gap-1.5 px-4 text-xs font-bold border-l border-surface-100 ${
          nearActive ? 'text-success-600' : 'text-brand-500'
        }`}
      >
        {locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
        {nearActive ? 'Near you' : 'Near me'}
      </button>
      <button
        type="submit"
        disabled={isPending}
        className="bg-brand-500 hover:bg-brand-600 text-white px-5 flex items-center font-bold text-sm disabled:opacity-60"
      >
        {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit && npx eslint components/marketplace/cuisine-chips.tsx components/marketplace/hero-search.tsx`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add components/marketplace/cuisine-chips.tsx components/marketplace/hero-search.tsx
git commit -m "feat(marketplace): cuisine chips + hero search client islands

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Move landing → /for-restaurants, build marketplace homepage, fix middleware

**Files:**
- Create: `apps/web/app/for-restaurants/page.tsx`
- Modify: `apps/web/app/page.tsx`
- Modify: `apps/web/middleware.ts`

- [ ] **Step 1: Relocate the current landing page**

Copy the **entire current contents** of `apps/web/app/page.tsx` into a new file `apps/web/app/for-restaurants/page.tsx`, changing only the component name on its `export default function` line from `LandingPage` to `ForRestaurantsPage`. Keep the leading `'use client';` and all imports/JSX identical.

```bash
# from apps/web
cp "app/page.tsx" "app/for-restaurants/page.tsx"
# then edit app/for-restaurants/page.tsx: rename the default export function to ForRestaurantsPage
```

- [ ] **Step 2: Add `for-restaurants` to middleware KNOWN_PATHS**

In `apps/web/middleware.ts`, the `KNOWN_PATHS` set currently lists `dashboard, login, register, forgot-password, admin, api, _next, favicon.ico, sounds, images`. Add `'for-restaurants'`:

```ts
const KNOWN_PATHS = new Set([
  'dashboard',
  'login',
  'register',
  'forgot-password',
  'admin',
  'api',
  '_next',
  'favicon.ico',
  'sounds',
  'images',
  'for-restaurants',
]);
```

- [ ] **Step 3: Replace `app/page.tsx` with the marketplace**

Overwrite `apps/web/app/page.tsx` with:

```tsx
import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';
import HeroSearch from '@/components/marketplace/hero-search';
import CuisineChips from '@/components/marketplace/cuisine-chips';
import KitchenGrid from '@/components/marketplace/kitchen-grid';
import type { KitchenResult } from '@/components/marketplace/kitchen-card';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Didi — Order Food Online in Ghana',
  description:
    'Discover and order from the best local kitchens near you. Search by dish or cuisine, pay with Mobile Money or card.',
};

function parseNear(near?: string): { lat: number | null; lng: number | null } {
  if (!near) return { lat: null, lng: null };
  const [a, b] = near.split(',').map((n) => Number(n));
  if (Number.isFinite(a) && Number.isFinite(b)) return { lat: a, lng: b };
  return { lat: null, lng: null };
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; cuisine?: string; city?: string; near?: string }>;
}) {
  const sp = await searchParams;
  const { lat, lng } = parseNear(sp.near);

  let kitchens: KitchenResult[] = [];
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc('search_kitchens', {
      p_q: sp.q || null,
      p_cuisines: sp.cuisine ? [sp.cuisine] : null,
      p_city: sp.city || null,
      p_lat: lat,
      p_lng: lng,
      p_limit: 24,
      p_offset: 0,
    });
    if (error) throw error;
    kitchens = (data as KitchenResult[]) || [];
  } catch (err) {
    console.error('Marketplace load failed:', err);
    kitchens = [];
  }

  const nearActive = lat != null && lng != null;

  return (
    <div className="min-h-screen bg-surface-50">
      {/* Header */}
      <header className="bg-white border-b border-surface-100">
        <div className="max-w-6xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <span className="text-xl font-extrabold text-brand-500">Didi</span>
          <nav className="flex items-center gap-4 text-sm">
            <Link
              href="/for-restaurants"
              className="px-3.5 py-2 rounded-full bg-brand-500 text-white font-bold text-xs hover:bg-brand-600 transition-colors"
            >
              List your kitchen ▸
            </Link>
            <Link href="/login" className="text-surface-600 font-medium hover:text-surface-900">
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-b from-white to-surface-50 px-4 pt-10 pb-6 text-center">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-surface-900">
          What do you want to eat?
        </h1>
        <p className="text-surface-500 mt-2 mb-6">Order from the best local kitchens near you</p>
        <HeroSearch />
        <div className="mt-5">
          <CuisineChips />
        </div>
      </section>

      {/* Results */}
      <section className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-baseline justify-between mb-5">
          <h2 className="text-lg font-bold text-surface-900">
            {nearActive ? 'Kitchens near you' : 'All kitchens'}
          </h2>
          <span className="text-xs text-surface-400">{kitchens.length} found</span>
        </div>
        <KitchenGrid kitchens={kitchens} />
      </section>

      {/* Vendor strip */}
      <section className="max-w-6xl mx-auto px-4 pb-12">
        <div className="rounded-2xl bg-gradient-to-r from-surface-900 to-[#2a2a4a] text-white px-6 py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold">Run a kitchen?</h3>
            <p className="text-sm text-white/70 mt-0.5">
              Get your own storefront and start taking orders in 5 minutes.
            </p>
          </div>
          <Link
            href="/for-restaurants"
            className="px-5 py-2.5 rounded-full bg-brand-500 hover:bg-brand-600 font-bold text-sm transition-colors"
          >
            List your kitchen →
          </Link>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit && npx eslint app/page.tsx app/for-restaurants/page.tsx middleware.ts`
Expected: exit 0. (Pre-existing `no-img-element` warnings inside the moved `for-restaurants` file are acceptable — they existed before the move.)

- [ ] **Step 5: Manual check**

Start/refresh dev server. Visit `/` → marketplace renders (kitchens or empty state, header, hero, chips, vendor strip). Visit `/for-restaurants` → old marketing landing renders (not a 404, not treated as a kitchen slug). Click a kitchen card → lands on `/[slug]`.

- [ ] **Step 6: Commit**

```bash
git add app/page.tsx app/for-restaurants/page.tsx middleware.ts
git commit -m "feat(marketplace): homepage marketplace + relocate landing to /for-restaurants

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Onboarding — location picker + cuisines on register

**Files:**
- Create: `apps/web/components/onboarding/location-picker.tsx`
- Modify: `apps/web/app/api/auth/register/route.ts`
- Modify: `apps/web/app/(auth)/register/page.tsx`

- [ ] **Step 1: Install Leaflet**

```bash
# from apps/web
npm i leaflet
npm i -D @types/leaflet
```

- [ ] **Step 2: Write `location-picker.tsx`**

Leaflet needs `window`, so import it inside `useEffect`. Marker is draggable; clicking the map also moves it. Calls `onChange(lat, lng)`.

```tsx
'use client';

import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import { DEFAULT_CENTER } from '@/lib/marketplace/geo';

export default function LocationPicker({
  center,
  value,
  onChange,
}: {
  center?: [number, number];
  value?: { lat: number; lng: number } | null;
  onChange: (lat: number, lng: number) => void;
}) {
  const elRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !elRef.current || mapRef.current) return;

      const start: [number, number] = value
        ? [value.lat, value.lng]
        : center || DEFAULT_CENTER;

      const map = L.map(elRef.current).setView(start, 13);
      mapRef.current = map;
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19,
      }).addTo(map);

      const icon = L.icon({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
      });
      const marker = L.marker(start, { draggable: true, icon }).addTo(map);
      markerRef.current = marker;

      marker.on('dragend', () => {
        const p = marker.getLatLng();
        onChange(p.lat, p.lng);
      });
      map.on('click', (e: { latlng: { lat: number; lng: number } }) => {
        marker.setLatLng(e.latlng);
        onChange(e.latlng.lat, e.latlng.lng);
      });
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-center when the chosen city changes (map already mounted).
  useEffect(() => {
    if (mapRef.current && center && !value) {
      mapRef.current.setView(center, 13);
      if (markerRef.current) markerRef.current.setLatLng(center);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center?.[0], center?.[1]]);

  return (
    <div
      ref={elRef}
      className="w-full h-56 rounded-xl border border-surface-200 overflow-hidden z-0"
    />
  );
}
```

- [ ] **Step 3: Update the register API**

In `apps/web/app/api/auth/register/route.ts`:

Change the destructure of the request body (currently
`const { email, phone, password, restaurantName, description, city } = await req.json();`) to also read the new fields:

```ts
const {
  email,
  phone,
  password,
  restaurantName,
  description,
  city,
  cuisines,
  locationLat,
  locationLng,
} = await req.json();
```

Then change the tenant `.insert({...})` call (currently inserting
`name, slug, description, phone, email, city, status`) to also store the new fields:

```ts
.insert({
  name: restaurantName,
  slug,
  description: description || null,
  phone,
  email,
  city: city || null,
  cuisines: Array.isArray(cuisines) ? cuisines : [],
  location_lat: typeof locationLat === 'number' ? locationLat : null,
  location_lng: typeof locationLng === 'number' ? locationLng : null,
  status: 'active',
})
```

- [ ] **Step 4: Add cuisines + location to the register form (step 2)**

In `apps/web/app/(auth)/register/page.tsx`:

(a) Add state near the other step-2 state (after `const [city, setCity] = useState('');`):

```tsx
const [cuisines, setCuisines] = useState<string[]>([]);
const [loc, setLoc] = useState<{ lat: number; lng: number } | null>(null);
```

(b) Add imports at the top (after the existing imports):

```tsx
import dynamic from 'next/dynamic';
import { CUISINES } from '@/lib/marketplace/cuisines';
import { CITY_COORDS } from '@/lib/marketplace/geo';

const LocationPicker = dynamic(
  () => import('@/components/onboarding/location-picker'),
  { ssr: false }
);
```

(c) Include the new fields in the POST body inside `handleSubmit` (extend the existing `body: JSON.stringify({ ... })`):

```tsx
body: JSON.stringify({
  email,
  phone,
  password,
  restaurantName,
  description,
  city,
  cuisines,
  locationLat: loc?.lat ?? null,
  locationLng: loc?.lng ?? null,
}),
```

(d) In the `step === 2` JSX block, after the City `<select>` `</div>`, add the cuisine chips + map:

```tsx
<div>
  <label className="block text-sm font-medium text-surface-700 mb-1.5">
    What food do you serve?{' '}
    <span className="text-surface-400">(pick a few)</span>
  </label>
  <div className="flex flex-wrap gap-2">
    {CUISINES.map((c) => {
      const on = cuisines.includes(c.slug);
      return (
        <button
          key={c.slug}
          type="button"
          onClick={() =>
            setCuisines((prev) =>
              on ? prev.filter((s) => s !== c.slug) : [...prev, c.slug]
            )
          }
          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
            on
              ? 'bg-brand-500 text-white border-brand-500'
              : 'bg-white text-surface-600 border-surface-200'
          }`}
        >
          {c.emoji} {c.label}
        </button>
      );
    })}
  </div>
</div>

<div>
  <label className="block text-sm font-medium text-surface-700 mb-1.5">
    Pin your location{' '}
    <span className="text-surface-400">(helps nearby customers find you)</span>
  </label>
  <LocationPicker
    center={city && CITY_COORDS[city] ? CITY_COORDS[city] : undefined}
    value={loc}
    onChange={(lat, lng) => setLoc({ lat, lng })}
  />
  {loc && (
    <p className="text-[11px] text-success-600 mt-1">
      Location set ✓
    </p>
  )}
</div>
```

- [ ] **Step 5: Typecheck + lint**

Run: `npx tsc --noEmit && npx eslint components/onboarding/location-picker.tsx app/api/auth/register/route.ts "app/(auth)/register/page.tsx"`
Expected: exit 0.

- [ ] **Step 6: Manual check**

Open `/register`, go to step 2 → cuisine chips toggle, map renders, dragging/clicking the pin shows "Location set ✓". Complete a registration → new tenant has `cuisines` + `location_lat/lng` set (verify in Supabase or by seeing it on `/` with a distance after "Near me").

- [ ] **Step 7: Commit**

```bash
git add components/onboarding/location-picker.tsx app/api/auth/register/route.ts "app/(auth)/register/page.tsx" package.json package-lock.json
git commit -m "feat(onboarding): capture cuisines + map location at registration

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Settings — edit cuisines + location

**Files:**
- Modify: `apps/web/app/(dashboard)/settings/profile/page.tsx`

- [ ] **Step 1: Add imports**

At the top of `apps/web/app/(dashboard)/settings/profile/page.tsx`, after the existing imports:

```tsx
import dynamic from 'next/dynamic';
import { CUISINES } from '@/lib/marketplace/cuisines';
import { CITY_COORDS } from '@/lib/marketplace/geo';

const LocationPicker = dynamic(
  () => import('@/components/onboarding/location-picker'),
  { ssr: false }
);
```

- [ ] **Step 2: Add state**

After `const [notifyEmail, setNotifyEmail] = useState(true);`:

```tsx
const [cuisines, setCuisines] = useState<string[]>([]);
const [loc, setLoc] = useState<{ lat: number; lng: number } | null>(null);
```

- [ ] **Step 3: Hydrate from the tenant on load**

Inside the `if (tenant) { ... }` block in `loadTenant`, after `setNotifyEmail(...)`:

```tsx
setCuisines(Array.isArray(tenant.cuisines) ? tenant.cuisines : []);
if (tenant.location_lat != null && tenant.location_lng != null) {
  setLoc({ lat: Number(tenant.location_lat), lng: Number(tenant.location_lng) });
}
```

- [ ] **Step 4: Persist on save**

In `handleSubmit`, extend the `.update({...})` object (add before `updated_at`):

```tsx
cuisines,
location_lat: loc?.lat ?? null,
location_lng: loc?.lng ?? null,
```

- [ ] **Step 5: Add the UI**

In the form JSX, after the closing `</div>` of the "Detailed Description" field and before the Notifications block (`{/* Notifications config */}`), insert:

```tsx
<div className="border-t border-surface-100 pt-5 space-y-4">
  <div>
    <label className="block text-xs font-bold text-surface-500 uppercase tracking-wider mb-2">
      Cuisines
    </label>
    <div className="flex flex-wrap gap-2">
      {CUISINES.map((c) => {
        const on = cuisines.includes(c.slug);
        return (
          <button
            key={c.slug}
            type="button"
            onClick={() =>
              setCuisines((prev) =>
                on ? prev.filter((s) => s !== c.slug) : [...prev, c.slug]
              )
            }
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              on
                ? 'bg-brand-500 text-white border-brand-500'
                : 'bg-white text-surface-600 border-surface-200'
            }`}
          >
            {c.emoji} {c.label}
          </button>
        );
      })}
    </div>
  </div>

  <div>
    <label className="block text-xs font-bold text-surface-500 uppercase tracking-wider mb-2">
      Map Location
    </label>
    <LocationPicker
      center={city && CITY_COORDS[city] ? CITY_COORDS[city] : undefined}
      value={loc}
      onChange={(lat, lng) => setLoc({ lat, lng })}
    />
    {loc && <p className="text-[11px] text-success-600 mt-1">Location set ✓</p>}
  </div>
</div>
```

- [ ] **Step 6: Typecheck + lint**

Run: `npx tsc --noEmit && npx eslint "app/(dashboard)/settings/profile/page.tsx"`
Expected: exit 0.

- [ ] **Step 7: Manual check**

Open `/settings/profile` as a logged-in kitchen → cuisines preselect from saved values, map shows saved pin (or city center), edit + Save → reload shows persisted values; the kitchen now appears on `/` with its cuisines and a distance when "Near me" is used.

- [ ] **Step 8: Commit**

```bash
git add "app/(dashboard)/settings/profile/page.tsx"
git commit -m "feat(settings): edit cuisines + map location for existing kitchens

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: Full manual verification pass

**Files:** none (verification only).

- [ ] **Step 1: Seed/confirm data**

Ensure ≥2 active kitchens exist, each with cuisines, `location_lat/lng`, and ≥1 available menu item. Use `/register` (new) and/or `/settings/profile` (existing). Leave one kitchen with **no** available items.

- [ ] **Step 2: Marketplace happy path**

Visit `/`. Expected: located kitchens render; the no-available-items kitchen is **absent**; cards show open/closed, item count, delivery fee.

- [ ] **Step 3: Near me**

Click "Near me", allow location. Expected: heading switches to "Kitchens near you", cards show `X km away`, order changes to nearest-first.

- [ ] **Step 4: Cuisine + dish search**

Click a cuisine chip → list filters. Type a dish in a kitchen's menu (e.g. `jollof`) + Search → only kitchens serving it remain. Clear → full list returns. Empty query with a nonsense term → empty state.

- [ ] **Step 5: Final gate**

Run: `npx tsc --noEmit && npx eslint app components lib middleware.ts`
Expected: exit 0 (only pre-existing warnings in untouched/moved files).

- [ ] **Step 6: Commit any verification fixes** (only if changes were needed)

```bash
git add -A
git commit -m "fix(marketplace): verification pass adjustments

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review Notes (author)

- **Spec coverage:** auto-publish (Task 1 listing rule), cuisines (Task 1/2/6/7), distance hybrid (Task 1 RPC + Task 4 geolocation + Task 6/7 capture), dish+cuisine search (Task 1 RPC + Task 4), IA option A (Task 5), `/for-restaurants` + middleware (Task 5), error fallbacks (Task 4 silent geo fallback, Task 5 RPC try/catch, Task 3 empty state), settings edit (Task 7). All covered.
- **Deviation from spec:** spec mentioned `is_featured` in ordering; `tenants` has no such column, so ordering uses `created_at` (documented in header + Task 1). Favorites heart icon from the mockup is omitted (MVP per spec Open Items).
- **Type consistency:** `KitchenResult` defined once in `kitchen-card.tsx`, imported by `kitchen-grid.tsx` and `app/page.tsx`. RPC return columns match `KitchenResult` field names exactly. `onChange(lat, lng)` signature consistent across LocationPicker usages.
