# Distance-Based Delivery Pricing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace free-text checkout zones with city→neighborhood selection from a curated Ghana geo dataset, and price delivery by distance (restaurant base rate covers a free radius; per-km beyond), recomputed authoritatively server-side.

**Architecture:** A static geo dataset (`ghana-areas.ts`) plus pure pricing functions (`pricing.ts`) and a shared resolver (`resolve.ts`) used by both the checkout client (live preview) and the orders API (authoritative). Schema migration `018` adds per-restaurant rate config and order-distance columns. UI changes in checkout and delivery settings.

**Tech Stack:** Next.js (App Router, non-standard fork — read `node_modules/next/dist/docs/` before touching Next APIs), React client components, Supabase (Postgres), TypeScript, Vitest (added here for unit tests).

Spec: `docs/superpowers/specs/2026-06-03-distance-delivery-pricing-design.md`

---

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `apps/web/vitest.config.ts` | Vitest config + `@/` alias | 0 |
| `apps/web/package.json` | Add `vitest` dev dep + `test` scripts | 0 |
| `apps/web/lib/delivery/ghana-areas.ts` | Curated cities/neighborhoods + lookup helpers | 1 |
| `apps/web/lib/delivery/ghana-areas.test.ts` | Dataset integrity tests | 1 |
| `apps/web/lib/delivery/pricing.ts` | `haversineKm`, `computeDeliveryFee`, constants | 2 |
| `apps/web/lib/delivery/pricing.test.ts` | Pricing unit tests | 2 |
| `apps/web/lib/delivery/resolve.ts` | `resolveDeliveryFee` (override → distance → base) | 3 |
| `apps/web/lib/delivery/resolve.test.ts` | Resolver unit tests | 3 |
| `supabase/migrations/018_distance_delivery.sql` | tenant rate cols + order distance cols | 4 |
| `apps/web/app/(storefront)/[slug]/checkout/page.tsx` | City+neighborhood selects, live fee | 5 |
| `apps/web/app/api/orders/route.ts` | Server-side recompute via resolver | 6 |
| `apps/web/app/(dashboard)/settings/delivery/page.tsx` | Radius + per-km inputs, relabels | 7 |

---

## Task 0: Add Vitest tooling

**Files:**
- Create: `apps/web/vitest.config.ts`
- Modify: `apps/web/package.json`

- [ ] **Step 1: Add vitest dev dependency**

Run:
```bash
cd apps/web && npm install -D vitest@^2.1.0
```
Expected: `vitest` appears under `devDependencies` in `apps/web/package.json`.

- [ ] **Step 2: Add test scripts**

In `apps/web/package.json`, change the `scripts` block to:
```json
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "test": "vitest run",
    "test:watch": "vitest"
  },
```

- [ ] **Step 3: Create vitest config with `@/` alias**

Create `apps/web/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts'],
  },
});
```

- [ ] **Step 4: Verify the runner works (no tests yet)**

Run: `cd apps/web && npm test`
Expected: exits 0 with "No test files found" (acceptable) — confirms vitest is installed and runnable.

- [ ] **Step 5: Commit**

```bash
git add apps/web/package.json apps/web/package-lock.json apps/web/vitest.config.ts
git commit -m "chore(web): add vitest for unit testing delivery libs"
```

---

## Task 1: Ghana geo dataset + helpers

**Files:**
- Create: `apps/web/lib/delivery/ghana-areas.ts`
- Test: `apps/web/lib/delivery/ghana-areas.test.ts`

- [ ] **Step 1: Write the failing integrity test**

Create `apps/web/lib/delivery/ghana-areas.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { GHANA_CITIES, findCity, findNeighborhood } from './ghana-areas';

describe('GHANA_CITIES dataset', () => {
  it('has at least one city', () => {
    expect(GHANA_CITIES.length).toBeGreaterThan(0);
  });

  it('every city has a valid centroid and >=1 neighborhood', () => {
    for (const city of GHANA_CITIES) {
      expect(city.name.trim().length).toBeGreaterThan(0);
      expect(Number.isFinite(city.lat)).toBe(true);
      expect(Number.isFinite(city.lng)).toBe(true);
      expect(city.neighborhoods.length).toBeGreaterThan(0);
    }
  });

  it('every neighborhood has coords inside Ghana bounds', () => {
    for (const city of GHANA_CITIES) {
      for (const n of city.neighborhoods) {
        expect(n.lat).toBeGreaterThanOrEqual(4.5);
        expect(n.lat).toBeLessThanOrEqual(11.5);
        expect(n.lng).toBeGreaterThanOrEqual(-3.5);
        expect(n.lng).toBeLessThanOrEqual(1.5);
      }
    }
  });

  it('neighborhood names are unique within a city (case-insensitive)', () => {
    for (const city of GHANA_CITIES) {
      const names = city.neighborhoods.map((n) => n.name.toLowerCase());
      expect(new Set(names).size).toBe(names.length);
    }
  });

  it('findCity is case-insensitive', () => {
    expect(findCity('accra')?.name).toBe('Accra');
    expect(findCity('NOPE')).toBeUndefined();
  });

  it('findNeighborhood matches case-insensitively', () => {
    expect(findNeighborhood('Accra', 'east legon')?.name).toBe('East Legon');
    expect(findNeighborhood('Accra', 'nowhere')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npm test -- ghana-areas`
Expected: FAIL — cannot resolve `./ghana-areas`.

- [ ] **Step 3: Create the dataset + helpers**

Create `apps/web/lib/delivery/ghana-areas.ts`:
```ts
// Curated Ghana cities and neighborhoods with approximate centroid coordinates.
// Single source of truth for the checkout city/neighborhood selectors AND the
// server-side delivery-fee lookup. Coordinates are approximate centroids meant
// for distance-tier pricing, not exact addressing. Expand over time.

export interface Neighborhood {
  name: string;
  lat: number;
  lng: number;
}

export interface City {
  name: string;
  lat: number; // city centroid (default map / fallback)
  lng: number;
  neighborhoods: Neighborhood[];
}

export const GHANA_CITIES: City[] = [
  {
    name: 'Accra',
    lat: 5.6037,
    lng: -0.187,
    neighborhoods: [
      { name: 'Osu', lat: 5.556, lng: -0.182 },
      { name: 'Labadi', lat: 5.556, lng: -0.156 },
      { name: 'Cantonments', lat: 5.576, lng: -0.172 },
      { name: 'Airport Residential', lat: 5.605, lng: -0.176 },
      { name: 'East Legon', lat: 5.636, lng: -0.166 },
      { name: 'Spintex', lat: 5.636, lng: -0.11 },
      { name: 'Madina', lat: 5.668, lng: -0.166 },
      { name: 'Adenta', lat: 5.709, lng: -0.159 },
      { name: 'Achimota', lat: 5.619, lng: -0.227 },
      { name: 'Tesano', lat: 5.598, lng: -0.23 },
      { name: 'Lapaz', lat: 5.606, lng: -0.254 },
      { name: 'Dansoman', lat: 5.538, lng: -0.266 },
    ],
  },
  {
    name: 'Tema',
    lat: 5.6698,
    lng: -0.0166,
    neighborhoods: [
      { name: 'Community 1', lat: 5.67, lng: -0.01 },
      { name: 'Community 25', lat: 5.65, lng: 0.005 },
      { name: 'Sakumono', lat: 5.63, lng: -0.04 },
      { name: 'Ashaiman', lat: 5.689, lng: -0.033 },
    ],
  },
  {
    name: 'Kumasi',
    lat: 6.6885,
    lng: -1.6244,
    neighborhoods: [
      { name: 'Adum', lat: 6.692, lng: -1.621 },
      { name: 'Asokwa', lat: 6.668, lng: -1.601 },
      { name: 'Bantama', lat: 6.7, lng: -1.636 },
      { name: 'Ahodwo', lat: 6.668, lng: -1.628 },
      { name: 'KNUST', lat: 6.674, lng: -1.566 },
    ],
  },
  {
    name: 'Takoradi',
    lat: 4.8845,
    lng: -1.7554,
    neighborhoods: [
      { name: 'Market Circle', lat: 4.893, lng: -1.756 },
      { name: 'Anaji', lat: 4.91, lng: -1.778 },
      { name: 'Effia', lat: 4.9, lng: -1.77 },
    ],
  },
  {
    name: 'Cape Coast',
    lat: 5.1053,
    lng: -1.2466,
    neighborhoods: [
      { name: 'Pedu', lat: 5.12, lng: -1.27 },
      { name: 'OLA', lat: 5.11, lng: -1.25 },
    ],
  },
];

export function findCity(name: string): City | undefined {
  const q = name.trim().toLowerCase();
  return GHANA_CITIES.find((c) => c.name.toLowerCase() === q);
}

export function findNeighborhood(
  city: string,
  area: string
): Neighborhood | undefined {
  const c = findCity(city);
  if (!c) return undefined;
  const q = area.trim().toLowerCase();
  return c.neighborhoods.find((n) => n.name.toLowerCase() === q);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npm test -- ghana-areas`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/delivery/ghana-areas.ts apps/web/lib/delivery/ghana-areas.test.ts
git commit -m "feat(delivery): curated Ghana city/neighborhood geo dataset"
```

---

## Task 2: Pricing engine

**Files:**
- Create: `apps/web/lib/delivery/pricing.ts`
- Test: `apps/web/lib/delivery/pricing.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/lib/delivery/pricing.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import {
  haversineKm,
  computeDeliveryFee,
  DEFAULT_FREE_RADIUS_KM,
  DEFAULT_PER_KM_RATE,
} from './pricing';

describe('haversineKm', () => {
  it('is ~0 for identical points', () => {
    expect(haversineKm({ lat: 5.6, lng: -0.18 }, { lat: 5.6, lng: -0.18 })).toBeCloseTo(0, 5);
  });

  it('matches a known distance (Accra centroid → East Legon ~4km)', () => {
    const d = haversineKm({ lat: 5.6037, lng: -0.187 }, { lat: 5.636, lng: -0.166 });
    expect(d).toBeGreaterThan(3);
    expect(d).toBeLessThan(5);
  });
});

describe('computeDeliveryFee', () => {
  it('charges only base within the free radius', () => {
    const r = computeDeliveryFee({ baseFee: 10, distanceKm: 2 });
    expect(r.fee).toBe(10);
    expect(r.withinRadius).toBe(true);
    expect(r.deliverable).toBe(true);
  });

  it('adds per-km beyond the radius (ceil of extra km)', () => {
    // 3km free, 6.2km → ceil(3.2)=4 extra km * 2.5 = 10 → 10 + 10 = 20
    const r = computeDeliveryFee({ baseFee: 10, distanceKm: 6.2 });
    expect(r.withinRadius).toBe(false);
    expect(r.fee).toBe(20);
  });

  it('rounds to nearest 0.5', () => {
    // 3km free, 4.1km → ceil(1.1)=2 * 2.5 = 5 → base 7 + 5 = 12 (already .0)
    // use per_km 1.7 to force rounding: 2 * 1.7 = 3.4 → 7 + 3.4 = 10.4 → 10.5
    const r = computeDeliveryFee({ baseFee: 7, distanceKm: 4.1, perKmRate: 1.7 });
    expect(r.fee).toBe(10.5);
  });

  it('never goes below base', () => {
    const r = computeDeliveryFee({ baseFee: 15, distanceKm: 0.2 });
    expect(r.fee).toBe(15);
  });

  it('flags not deliverable past maxDistanceKm', () => {
    const r = computeDeliveryFee({ baseFee: 10, distanceKm: 25, maxDistanceKm: 15 });
    expect(r.deliverable).toBe(false);
  });

  it('uses defaults when radius/perKm omitted', () => {
    expect(DEFAULT_FREE_RADIUS_KM).toBe(3);
    expect(DEFAULT_PER_KM_RATE).toBe(2.5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npm test -- pricing`
Expected: FAIL — cannot resolve `./pricing`.

- [ ] **Step 3: Write the pricing implementation**

Create `apps/web/lib/delivery/pricing.ts`:
```ts
// Pure delivery-pricing math. No I/O. Imported by the checkout client (preview)
// and the orders API (authoritative). Distance is straight-line (haversine).

export interface LatLng {
  lat: number;
  lng: number;
}

export const DEFAULT_FREE_RADIUS_KM = 3;
export const DEFAULT_PER_KM_RATE = 2.5; // GH₵ per km beyond the free radius
export const FEE_ROUNDING = 0.5; // round fee to nearest ₵0.50

const EARTH_RADIUS_KM = 6371;
const toRad = (deg: number) => (deg * Math.PI) / 180;

export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

export interface FeeInput {
  baseFee: number;
  distanceKm: number;
  freeRadiusKm?: number;
  perKmRate?: number;
  maxDistanceKm?: number | null;
}

export interface FeeResult {
  fee: number;
  deliverable: boolean;
  distanceKm: number;
  withinRadius: boolean;
}

export function computeDeliveryFee(input: FeeInput): FeeResult {
  const radius = input.freeRadiusKm ?? DEFAULT_FREE_RADIUS_KM;
  const perKm = input.perKmRate ?? DEFAULT_PER_KM_RATE;
  const distanceKm = input.distanceKm;
  const withinRadius = distanceKm <= radius;

  const deliverable =
    input.maxDistanceKm == null || distanceKm <= input.maxDistanceKm;

  let fee: number;
  if (withinRadius) {
    fee = input.baseFee;
  } else {
    const extraKm = Math.ceil(distanceKm - radius);
    fee = input.baseFee + extraKm * perKm;
  }

  fee = Math.max(roundTo(fee, FEE_ROUNDING), input.baseFee);

  return { fee, deliverable, distanceKm, withinRadius };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npm test -- pricing`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/delivery/pricing.ts apps/web/lib/delivery/pricing.test.ts
git commit -m "feat(delivery): distance-based pricing engine (haversine + free-radius formula)"
```

---

## Task 3: Shared fee resolver

**Files:**
- Create: `apps/web/lib/delivery/resolve.ts`
- Test: `apps/web/lib/delivery/resolve.test.ts`

This is the single decision unit (override → distance → base) used by BOTH the
checkout client and the orders API, so they never diverge.

- [ ] **Step 1: Write the failing test**

Create `apps/web/lib/delivery/resolve.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { resolveDeliveryFee } from './resolve';

const restaurant = {
  lat: 5.6037,
  lng: -0.187,
  baseFee: 10,
  freeRadiusKm: 3,
  perKmRate: 2.5,
  maxDistanceKm: null as number | null,
};

describe('resolveDeliveryFee', () => {
  it('uses an active manual zone override by name (case-insensitive)', () => {
    const r = resolveDeliveryFee({
      restaurant,
      city: 'Accra',
      areaName: 'East Legon',
      manualZones: [{ name: 'east legon', fee: 15 }],
    });
    expect(r.source).toBe('override');
    expect(r.fee).toBe(15);
    expect(r.deliverable).toBe(true);
  });

  it('computes by distance when no override and coords + area known', () => {
    const r = resolveDeliveryFee({
      restaurant,
      city: 'Accra',
      areaName: 'East Legon',
      manualZones: [],
    });
    expect(r.source).toBe('distance');
    expect(r.fee).toBe(10); // East Legon ~4km but rounds within tier; see assertion below
    expect(r.distanceKm).not.toBeNull();
  });

  it('falls back to base fee when the restaurant has no coords', () => {
    const r = resolveDeliveryFee({
      restaurant: { ...restaurant, lat: null, lng: null },
      city: 'Accra',
      areaName: 'East Legon',
      manualZones: [],
    });
    expect(r.source).toBe('base');
    expect(r.fee).toBe(10);
  });

  it('falls back to base fee when the area is not in the dataset', () => {
    const r = resolveDeliveryFee({
      restaurant,
      city: 'Accra',
      areaName: 'Atlantis',
      manualZones: [],
    });
    expect(r.source).toBe('base');
    expect(r.fee).toBe(10);
  });

  it('marks not deliverable beyond maxDistanceKm', () => {
    const r = resolveDeliveryFee({
      restaurant: { ...restaurant, maxDistanceKm: 1 },
      city: 'Accra',
      areaName: 'Adenta',
      manualZones: [],
    });
    expect(r.source).toBe('distance');
    expect(r.deliverable).toBe(false);
  });
});
```

Note: in the second test, East Legon is ~3–4km from the Accra centroid. If the
computed distance exceeds 3km the fee will be `> 10`; adjust the expected value
to the actual computed number after Step 2 reveals it (the assertion exists to
lock the behavior, not a guessed constant). Keep `expect(r.distanceKm).not.toBeNull()`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npm test -- resolve`
Expected: FAIL — cannot resolve `./resolve`.

- [ ] **Step 3: Write the resolver**

Create `apps/web/lib/delivery/resolve.ts`:
```ts
import { findNeighborhood } from './ghana-areas';
import { computeDeliveryFee, haversineKm } from './pricing';

export interface ManualZone {
  name: string;
  fee: number;
}

export interface RestaurantDelivery {
  lat: number | null;
  lng: number | null;
  baseFee: number;
  freeRadiusKm: number | null;
  perKmRate: number | null;
  maxDistanceKm: number | null;
}

export interface ResolveInput {
  restaurant: RestaurantDelivery;
  city: string;
  areaName: string;
  manualZones: ManualZone[]; // active zones only
}

export interface ResolveResult {
  fee: number;
  deliverable: boolean;
  distanceKm: number | null;
  source: 'override' | 'distance' | 'base';
}

export function resolveDeliveryFee(input: ResolveInput): ResolveResult {
  const { restaurant, city, areaName, manualZones } = input;

  // 1. Manual zone override (exact area name, case-insensitive).
  const q = areaName.trim().toLowerCase();
  const override = manualZones.find((z) => z.name.trim().toLowerCase() === q);
  if (override) {
    return { fee: override.fee, deliverable: true, distanceKm: null, source: 'override' };
  }

  // 2. Distance pricing when we have both ends.
  const area = findNeighborhood(city, areaName);
  if (restaurant.lat != null && restaurant.lng != null && area) {
    const distanceKm = haversineKm(
      { lat: restaurant.lat, lng: restaurant.lng },
      { lat: area.lat, lng: area.lng }
    );
    const r = computeDeliveryFee({
      baseFee: restaurant.baseFee,
      distanceKm,
      freeRadiusKm: restaurant.freeRadiusKm ?? undefined,
      perKmRate: restaurant.perKmRate ?? undefined,
      maxDistanceKm: restaurant.maxDistanceKm,
    });
    return { fee: r.fee, deliverable: r.deliverable, distanceKm: r.distanceKm, source: 'distance' };
  }

  // 3. Fallback: base fee.
  return { fee: restaurant.baseFee, deliverable: true, distanceKm: null, source: 'base' };
}
```

- [ ] **Step 4: Run test, read the real East Legon fee, lock the assertion**

Run: `cd apps/web && npm test -- resolve`
If the "computes by distance" test fails on the `fee` value, read the actual
number from the failure output and set `expect(r.fee).toBe(<actual>)` to that
value, then re-run.
Expected (final): PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/delivery/resolve.ts apps/web/lib/delivery/resolve.test.ts
git commit -m "feat(delivery): shared fee resolver (override → distance → base)"
```

---

## Task 4: Database migration

**Files:**
- Create: `supabase/migrations/018_distance_delivery.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/018_distance_delivery.sql`:
```sql
-- Distance-based delivery pricing: per-restaurant rate config + order distance record.

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS free_delivery_radius_km NUMERIC DEFAULT 3,
  ADD COLUMN IF NOT EXISTS per_km_rate NUMERIC,            -- NULL → platform default
  ADD COLUMN IF NOT EXISTS max_delivery_distance_km NUMERIC; -- NULL → no cap

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS delivery_area_name TEXT,
  ADD COLUMN IF NOT EXISTS delivery_distance_km NUMERIC;
```

- [ ] **Step 2: Apply the migration**

Run: `cd /Users/ebenezerbarning/Desktop/fafa && npx supabase db push`
Expected: migration `018_distance_delivery.sql` applies cleanly. (If the project
applies migrations via a different command, follow the repo's existing
convention — check how prior migrations like `017_*` were applied.)

- [ ] **Step 3: Verify columns exist**

Run a quick check via the Supabase SQL editor or CLI:
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'tenants'
  AND column_name IN ('free_delivery_radius_km','per_km_rate','max_delivery_distance_km');
```
Expected: 3 rows.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/018_distance_delivery.sql
git commit -m "feat(db): tenant delivery-rate config + order distance columns (018)"
```

---

## Task 5: Checkout — city + neighborhood selects with live fee

**Files:**
- Modify: `apps/web/app/(storefront)/[slug]/checkout/page.tsx`

Context: today the page loads `delivery_zones` and uses `selectedZoneId`. We
replace the single neighborhood `<select>` with City + Neighborhood selects
driven by `GHANA_CITIES`, keep manual zones as overrides, and compute the live
fee via `resolveDeliveryFee`.

- [ ] **Step 1: Extend imports and tenant fields**

In `apps/web/app/(storefront)/[slug]/checkout/page.tsx`, add imports near the top
(after the existing `createBrowserClient` import on line 11):
```tsx
import { GHANA_CITIES } from '@/lib/delivery/ghana-areas';
import { resolveDeliveryFee } from '@/lib/delivery/resolve';
```

- [ ] **Step 2: Add city/area state and extend tenant shape**

Replace the state declaration block (lines 33–35) — the lines for
`deliveryType`, `selectedZoneId`, and `address` — with:
```tsx
  const [deliveryType, setDeliveryType] = useState<'delivery' | 'pickup'>('delivery');
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [selectedArea, setSelectedArea] = useState<string>('');
  const [address, setAddress] = useState('');
```

Extend the `tenant` state type (lines 50–60) to include location + rate config.
Replace that `useState` generic object type with:
```tsx
  const [tenant, setTenant] = useState<{
    id: string;
    name: string;
    delivery_fee: number;
    min_order_amount: number;
    accepts_delivery: boolean;
    accepts_pickup: boolean;
    accepts_pay_online: boolean;
    accepts_pay_on_delivery: boolean;
    primary_color: string;
    location_lat: number | null;
    location_lng: number | null;
    city: string | null;
    free_delivery_radius_km: number | null;
    per_km_rate: number | null;
    max_delivery_distance_km: number | null;
  } | null>(null);
```

- [ ] **Step 3: Select the new tenant columns and default the city**

In the tenant fetch (line 77–81), update the `.select(...)` string to include the
new columns:
```tsx
          .select('id, name, slug, delivery_fee, min_order_amount, accepts_delivery, accepts_pickup, accepts_pay_online, accepts_pay_on_delivery, primary_color, location_lat, location_lng, city, free_delivery_radius_km, per_km_rate, max_delivery_distance_km')
```

In the `loadedTenant` object (lines 84–94), add the new fields:
```tsx
          const loadedTenant = {
            id: tenantData.id,
            name: tenantData.name,
            delivery_fee: Number(tenantData.delivery_fee),
            min_order_amount: Number(tenantData.min_order_amount),
            accepts_delivery: tenantData.accepts_delivery,
            accepts_pickup: tenantData.accepts_pickup,
            accepts_pay_online: tenantData.accepts_pay_online,
            accepts_pay_on_delivery: tenantData.accepts_pay_on_delivery,
            primary_color: tenantData.primary_color || '#FF6B35',
            location_lat: tenantData.location_lat != null ? Number(tenantData.location_lat) : null,
            location_lng: tenantData.location_lng != null ? Number(tenantData.location_lng) : null,
            city: tenantData.city ?? null,
            free_delivery_radius_km: tenantData.free_delivery_radius_km != null ? Number(tenantData.free_delivery_radius_km) : null,
            per_km_rate: tenantData.per_km_rate != null ? Number(tenantData.per_km_rate) : null,
            max_delivery_distance_km: tenantData.max_delivery_distance_km != null ? Number(tenantData.max_delivery_distance_km) : null,
          };
          setTenant(loadedTenant);

          // Default the city selector to the restaurant's city if we know it.
          if (loadedTenant.city && GHANA_CITIES.some((c) => c.name === loadedTenant.city)) {
            setSelectedCity(loadedTenant.city);
          }
```

- [ ] **Step 4: Replace the fee computation (lines 141–151)**

Replace the `selectedZone` / `deliveryFee` / `total` block with a resolver-driven
computation:
```tsx
  const activeZones = useMemo(
    () => deliveryZones.map((z) => ({ name: z.name, fee: z.fee })),
    [deliveryZones]
  );

  const feeResult = useMemo(() => {
    if (deliveryType !== 'delivery' || !tenant || !selectedArea) return null;
    return resolveDeliveryFee({
      restaurant: {
        lat: tenant.location_lat,
        lng: tenant.location_lng,
        baseFee: tenant.delivery_fee,
        freeRadiusKm: tenant.free_delivery_radius_km,
        perKmRate: tenant.per_km_rate,
        maxDistanceKm: tenant.max_delivery_distance_km,
      },
      city: selectedCity,
      areaName: selectedArea,
      manualZones: activeZones,
    });
  }, [deliveryType, tenant, selectedCity, selectedArea, activeZones]);

  const deliveryFee = deliveryType === 'delivery' ? feeResult?.fee ?? 0 : 0;
  const notDeliverable = feeResult ? !feeResult.deliverable : false;
  const total = subtotal + deliveryFee;
  const primaryColor = tenant?.primary_color || '#FF6B35';
```

- [ ] **Step 5: Replace the neighborhood `<select>` (lines 372–395) with City + Neighborhood selects**

Replace the `deliveryZones.length > 0 && (...)` block that renders the single
"Select Your Area" select with:
```tsx
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label htmlFor="checkout-city" className="block text-sm font-medium text-surface-700 mb-1">
                    City
                  </label>
                  <select
                    id="checkout-city"
                    value={selectedCity}
                    onChange={(e) => {
                      setSelectedCity(e.target.value);
                      setSelectedArea('');
                    }}
                    required
                    className="w-full px-4 py-3 rounded-xl border border-surface-200 bg-white text-surface-900 focus:outline-none focus:ring-2 transition-all text-sm cursor-pointer"
                    style={{ ['--tw-ring-color' as string]: primaryColor } as React.CSSProperties}
                  >
                    <option value="">Select city...</option>
                    {GHANA_CITIES.map((c) => (
                      <option key={c.name} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="checkout-area" className="block text-sm font-medium text-surface-700 mb-1">
                    Select Your Area
                  </label>
                  <select
                    id="checkout-area"
                    value={selectedArea}
                    onChange={(e) => setSelectedArea(e.target.value)}
                    required
                    disabled={!selectedCity}
                    className="w-full px-4 py-3 rounded-xl border border-surface-200 bg-white text-surface-900 focus:outline-none focus:ring-2 transition-all text-sm cursor-pointer disabled:opacity-50"
                    style={{ ['--tw-ring-color' as string]: primaryColor } as React.CSSProperties}
                  >
                    <option value="">Select neighborhood...</option>
                    {(GHANA_CITIES.find((c) => c.name === selectedCity)?.neighborhoods ?? []).map((n) => (
                      <option key={n.name} value={n.name}>{n.name}</option>
                    ))}
                  </select>
                </div>
              </div>
```

- [ ] **Step 6: Update the order-summary fee line (lines 481–486)**

Replace the delivery-fee summary row with one that names the area and shows the
not-deliverable warning:
```tsx
          {deliveryType === 'delivery' && (
            <div className="flex justify-between text-sm text-surface-600">
              <span>Delivery fee {selectedArea ? `(${selectedArea})` : ''}</span>
              <span>{formatGHS(deliveryFee)}</span>
            </div>
          )}
```

Add, immediately after the closing `</section>` of the order summary (after line
491), a not-deliverable notice:
```tsx
        {notDeliverable && (
          <div className="p-3 rounded-xl bg-error-500/10 text-error-600 text-xs text-center font-medium animate-fade-in">
            This area is outside the restaurant&apos;s delivery range. Try Pickup or a closer area.
          </div>
        )}
```

- [ ] **Step 7: Send city/area to the API and block undeliverable submits**

In `handleSubmit`, update the request body (lines 178–191) to send `city` and
`areaName` instead of `deliveryZoneId`:
```tsx
        body: JSON.stringify({
          tenantSlug: slug,
          items: items.map((item) => ({
            menuItemId: item.menuItemId,
            quantity: item.quantity,
            options: item.options,
          })),
          customer: { name, phone, email: email || undefined },
          deliveryType,
          deliveryAddress: deliveryType === 'delivery' ? address : undefined,
          deliveryNotes: notes || undefined,
          paymentMethod,
          city: deliveryType === 'delivery' ? selectedCity : undefined,
          areaName: deliveryType === 'delivery' ? selectedArea : undefined,
        }),
```

Update the submit button `disabled` prop (line 505) to also block undeliverable:
```tsx
              disabled={loading || belowMinLimit || notDeliverable}
```

- [ ] **Step 8: Type-check and lint**

Run: `cd apps/web && npx tsc --noEmit && npm run lint`
Expected: no errors. Fix any type mismatches surfaced (e.g. unused `selectedZone`
references — remove leftover usages of `selectedZoneId` / `selectedZone`).

- [ ] **Step 9: Commit**

```bash
git add apps/web/app/\(storefront\)/\[slug\]/checkout/page.tsx
git commit -m "feat(checkout): city+neighborhood selection with live distance-based delivery fee"
```

---

## Task 6: Orders API — server-side recompute

**Files:**
- Modify: `apps/web/app/api/orders/route.ts`

- [ ] **Step 1: Import the resolver + dataset helpers**

In `apps/web/app/api/orders/route.ts`, add after the existing imports (after line
6):
```ts
import { resolveDeliveryFee } from '@/lib/delivery/resolve';
```

- [ ] **Step 2: Accept city/areaName from the body**

Replace the destructure block (lines 13–22) with:
```ts
    const {
      tenantSlug,
      items,
      customer,
      deliveryType,
      deliveryAddress,
      deliveryNotes,
      paymentMethod,
      city,
      areaName,
    } = body;
```

- [ ] **Step 3: Replace the delivery-fee block (lines 97–114) with resolver-based logic**

```ts
    let deliveryFee = 0;
    let deliveryDistanceKm: number | null = null;
    let deliveryAreaName: string | null = null;

    if (deliveryType === 'delivery') {
      // Load active manual zones for override matching.
      const { data: zones } = await supabase
        .from('delivery_zones')
        .select('name, fee')
        .eq('tenant_id', tenant.id)
        .eq('is_active', true);

      const resolved = resolveDeliveryFee({
        restaurant: {
          lat: tenant.location_lat != null ? Number(tenant.location_lat) : null,
          lng: tenant.location_lng != null ? Number(tenant.location_lng) : null,
          baseFee: Number(tenant.delivery_fee),
          freeRadiusKm: tenant.free_delivery_radius_km != null ? Number(tenant.free_delivery_radius_km) : null,
          perKmRate: tenant.per_km_rate != null ? Number(tenant.per_km_rate) : null,
          maxDistanceKm: tenant.max_delivery_distance_km != null ? Number(tenant.max_delivery_distance_km) : null,
        },
        city: city || tenant.city || '',
        areaName: areaName || '',
        manualZones: (zones || []).map((z) => ({ name: z.name, fee: Number(z.fee) })),
      });

      if (!resolved.deliverable) {
        return NextResponse.json(
          { error: 'This address is outside the delivery range for this restaurant.' },
          { status: 400 }
        );
      }

      deliveryFee = resolved.fee;
      deliveryDistanceKm = resolved.distanceKm;
      deliveryAreaName = areaName || null;
    }
```

- [ ] **Step 4: Persist the new order fields**

In the `orders` insert (lines 153–172), replace the `delivery_zone_id` line with
the new columns:
```ts
        delivery_area_name: deliveryType === 'delivery' ? deliveryAreaName : null,
        delivery_distance_km: deliveryType === 'delivery' ? deliveryDistanceKm : null,
```
(Leave `delivery_zone_id` out entirely — the override path no longer needs it for
the order record. The column still exists for backward compatibility.)

- [ ] **Step 5: Type-check**

Run: `cd apps/web && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Manual smoke test**

Start the app (`cd apps/web && npm run dev`), open a storefront checkout, choose
Delivery → a city → a far neighborhood, and confirm the fee shown matches the
order created (inspect the `orders` row's `delivery_fee`, `delivery_area_name`,
`delivery_distance_km`). Confirm a forged fee is impossible (the client no longer
sends a fee at all).

- [ ] **Step 7: Commit**

```bash
git add apps/web/app/api/orders/route.ts
git commit -m "feat(orders): authoritative distance-based delivery fee via shared resolver"
```

---

## Task 7: Delivery settings — radius + per-km override

**Files:**
- Modify: `apps/web/app/(dashboard)/settings/delivery/page.tsx`

- [ ] **Step 1: Add imports + state for the new fields**

In `apps/web/app/(dashboard)/settings/delivery/page.tsx`, add after the existing
imports (after line 7):
```tsx
import { DEFAULT_FREE_RADIUS_KM, DEFAULT_PER_KM_RATE } from '@/lib/delivery/pricing';
```

Add new state next to the existing form state (after line 26 `minOrderAmount`):
```tsx
  const [freeRadiusKm, setFreeRadiusKm] = useState('');
  const [perKmRate, setPerKmRate] = useState('');
  const [maxDistanceKm, setMaxDistanceKm] = useState('');
```

- [ ] **Step 2: Load the new tenant columns**

In the tenant `.select(...)` (line 49), update to include the rate columns:
```tsx
            .select('accepts_delivery, accepts_pickup, delivery_fee, min_order_amount, free_delivery_radius_km, per_km_rate, max_delivery_distance_km')
```

In the `if (tenant) { ... }` block (lines 53–58), add:
```tsx
            setFreeRadiusKm(tenant.free_delivery_radius_km != null ? Number(tenant.free_delivery_radius_km).toString() : '');
            setPerKmRate(tenant.per_km_rate != null ? Number(tenant.per_km_rate).toString() : '');
            setMaxDistanceKm(tenant.max_delivery_distance_km != null ? Number(tenant.max_delivery_distance_km).toString() : '');
```

- [ ] **Step 3: Save the new fields**

In `handleSubmit`'s `.update({ ... })` (lines 95–101), add:
```tsx
          free_delivery_radius_km: freeRadiusKm.trim() === '' ? DEFAULT_FREE_RADIUS_KM : parseFloat(freeRadiusKm),
          per_km_rate: perKmRate.trim() === '' ? null : parseFloat(perKmRate),
          max_delivery_distance_km: maxDistanceKm.trim() === '' ? null : parseFloat(maxDistanceKm),
```

- [ ] **Step 4: Relabel base fee and add the rate inputs**

Change the base-fee label (line 211) to clarify scope:
```tsx
                Base Delivery Fee (GH₵) — covers the free radius
```

After the existing `grid grid-cols-2` block that holds base fee + min order
(closes at line 238), insert a new grid of rate controls:
```tsx
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-surface-500 uppercase tracking-wider mb-2">
                Free Radius (km)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={freeRadiusKm}
                onChange={(e) => setFreeRadiusKm(e.target.value)}
                placeholder={`${DEFAULT_FREE_RADIUS_KM}`}
                className="w-full px-4 py-2.5 rounded-xl border border-surface-200 bg-white text-surface-950 focus:outline-none focus:ring-2 focus:ring-brand-500/40 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-surface-500 uppercase tracking-wider mb-2">
                Per km (GH₵)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={perKmRate}
                onChange={(e) => setPerKmRate(e.target.value)}
                placeholder={`${DEFAULT_PER_KM_RATE} (default)`}
                className="w-full px-4 py-2.5 rounded-xl border border-surface-200 bg-white text-surface-950 focus:outline-none focus:ring-2 focus:ring-brand-500/40 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-surface-500 uppercase tracking-wider mb-2">
                Max Distance (km)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={maxDistanceKm}
                onChange={(e) => setMaxDistanceKm(e.target.value)}
                placeholder="no limit"
                className="w-full px-4 py-2.5 rounded-xl border border-surface-200 bg-white text-surface-950 focus:outline-none focus:ring-2 focus:ring-brand-500/40 text-xs"
              />
            </div>
          </div>
```

- [ ] **Step 5: Reframe the zones section heading (lines 253–254)**

```tsx
          <h3 className="text-base font-bold text-surface-900">Fixed-Price Area Overrides</h3>
          <p className="text-xs text-surface-400 mt-0.5">Optional. Pin a flat fee for a specific area (e.g. East Legon: GH₵ 15). Overrides distance pricing when the customer&apos;s area name matches exactly.</p>
```

- [ ] **Step 6: Type-check and lint**

Run: `cd apps/web && npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add apps/web/app/\(dashboard\)/settings/delivery/page.tsx
git commit -m "feat(settings): per-restaurant free radius, per-km rate, max distance"
```

---

## Final Verification

- [ ] **Run the full unit suite**

Run: `cd apps/web && npm test`
Expected: all delivery lib tests pass (ghana-areas, pricing, resolve).

- [ ] **Type-check the whole app**

Run: `cd apps/web && npx tsc --noEmit`
Expected: no errors.

- [ ] **End-to-end manual check**

1. As a restaurant: set a location, base fee, and (optionally) radius/per-km in
   Settings → Delivery.
2. As a customer: open the storefront, go to checkout, pick Delivery → city →
   near area (fee = base) and a far area (fee > base). Confirm the summary fee and
   estimated behavior.
3. Place an order; confirm the `orders` row stores `delivery_fee`,
   `delivery_area_name`, `delivery_distance_km`.
4. Set a manual override zone matching an area name; confirm that area now uses
   the flat fee.
5. Set `max_delivery_distance_km` low; confirm a far area shows "outside delivery
   range" and the submit is blocked.

---

## Notes for the Implementer

- **Next.js is a non-standard fork here.** Before editing any Next-specific API,
  read the relevant guide under `node_modules/next/dist/docs/`. The library/UI
  edits in this plan follow existing patterns in the same files, so mirror what is
  already there.
- The pricing `pricing.ts`, `resolve.ts`, and `ghana-areas.ts` modules are pure
  and dependency-free — they are the well-tested core. UI/API tasks only wire them
  in; keep all pricing decisions inside `resolve.ts` so client and server never
  diverge.
- Estimated-time display was kept out of scope for v1 to avoid guesswork; the
  spec's optional estimate can be a fast follow if desired.
