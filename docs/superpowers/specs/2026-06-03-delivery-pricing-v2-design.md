# Delivery Pricing V2 — Design Spec

**Date:** 2026-06-03
**Status:** Approved (design), pending implementation plan
**Owner:** Ebenezer Barning
**Builds on:** `2026-06-03-distance-delivery-pricing-design.md` (V1, shipped)

## Problem

V1 prices delivery by straight-line distance from the restaurant to a curated
neighborhood **centroid**. Centroids are coarse: a large area (e.g. Spintex)
mis-estimates the fee for customers near its edges. V1 also shows only a fee —
no delivery-time estimate and no explanation of how the fee was derived. Coverage
is limited to a handful of cities.

V2 closes these gaps:

1. **Exact-location refinement** — the customer can optionally pin their precise
   location (device GPS or a draggable map); the pin overrides the area centroid
   for distance pricing.
2. **Estimated delivery time** — show an ETA at checkout (prep time + travel).
3. **Fee transparency** — show how the fee breaks down (base + per-km).
4. **Dataset expansion** — more cities and finer neighborhoods.

## Goals

- Pin-based distance overrides centroid distance when the customer provides one.
- ETA derived from a per-restaurant prep time plus travel time.
- A human-readable fee breakdown at checkout.
- Wider, finer geo coverage.
- All pricing stays server-authoritative (the orders API recomputes).

## Non-Goals (YAGNI)

- Reverse geocoding the pin to a text address (the rider already gets the typed
  address + notes; the pin is only for distance).
- Road-network routing for ETA (straight-line travel-time estimate only).
- Saving the customer's pin across sessions.
- Surge / time-of-day pricing.

## Locked Decisions

1. **Pin input** — "Use my location" GPS button **and** a draggable Leaflet map
   (reuse the existing `LocationPicker`). Covers the fast path and manual
   correction.
2. **ETA prep time** — new per-restaurant column `avg_prep_minutes` (default 20),
   editable in delivery settings.

## Current State (V1, relevant pieces)

- `apps/web/lib/delivery/pricing.ts` — `haversineKm`, `computeDeliveryFee`
  (returns `{ fee, deliverable, distanceKm, withinRadius }`), constants.
- `apps/web/lib/delivery/resolve.ts` — `resolveDeliveryFee` (override → distance →
  base); takes `{ restaurant, city, areaName, manualZones }`.
- `apps/web/lib/delivery/ghana-areas.ts` — `GHANA_CITIES` + `findCity` /
  `findNeighborhood`.
- `apps/web/components/onboarding/location-picker.tsx` — client Leaflet map with a
  draggable marker; props `{ center?, value?, onChange(lat,lng) }`. Reusable.
- Checkout (`app/(storefront)/[slug]/checkout/page.tsx`) — city + neighborhood
  selects, live fee via `resolveDeliveryFee`.
- Orders API (`app/api/orders/route.ts`) — recomputes fee via `resolveDeliveryFee`,
  persists `delivery_fee`, `delivery_area_name`, `delivery_distance_km`. The
  `orders` table already has `delivery_lat` / `delivery_lng` (currently unused on
  this path).
- Tests run on Vitest: `lib/delivery/*.test.ts`.

## Architecture

### A. Pricing engine — extend `apps/web/lib/delivery/pricing.ts`

Add a breakdown to the fee result and an ETA helper. Existing callers keep
working (new field is additive).

```ts
export interface FeeBreakdown {
  base: number;     // restaurant base fee (covers the free radius)
  extraKm: number;  // billable km beyond the radius (ceil)
  perKm: number;    // per-km rate applied
  extraCharge: number; // extraKm * perKm (pre-rounding)
}

export interface FeeResult {
  fee: number;
  deliverable: boolean;
  distanceKm: number;
  withinRadius: boolean;
  breakdown: FeeBreakdown;
}

export const AVG_SPEED_KM_PER_MIN = 0.4; // ~24 km/h city travel
export const DEFAULT_PREP_MINUTES = 20;

export function estimateMinutes(args: {
  distanceKm: number | null;
  prepMinutes: number;
}): number;
// = prepMinutes + (distanceKm == null ? 0 : Math.round(distanceKm / AVG_SPEED_KM_PER_MIN))
```

`computeDeliveryFee` is updated to populate `breakdown`. Within the radius:
`{ base, extraKm: 0, perKm, extraCharge: 0 }`.

### B. Resolver — extend `apps/web/lib/delivery/resolve.ts`

Accept an optional customer pin; when present (and the restaurant has coords), use
the pin for distance instead of the area centroid.

```ts
import type { LatLng } from './pricing';

export interface ResolveInput {
  restaurant: RestaurantDelivery;
  city: string;
  areaName: string;
  manualZones: ManualZone[];
  customer?: LatLng | null; // optional exact pin
}

export interface ResolveResult {
  fee: number;
  deliverable: boolean;
  distanceKm: number | null;
  source: 'override' | 'distance' | 'base';
  distanceSource: 'pin' | 'centroid' | null;
  breakdown: FeeBreakdown | null;
}
```

Precedence (unchanged order; pin only affects step 2's distance origin):

1. **Manual zone name match** (case-insensitive) → flat fee.
   `source: 'override'`, `distanceKm: null`, `distanceSource: null`,
   `breakdown: null`.
2. **Distance** — needs restaurant coords. Destination = `customer` pin if
   provided, else `findNeighborhood(city, areaName)` centroid. If neither the pin
   nor a known centroid is available, fall through to step 3. Run
   `computeDeliveryFee`. `source: 'distance'`,
   `distanceSource: 'pin' | 'centroid'`, includes `breakdown`.
3. **Base fallback** → `source: 'base'`, `distanceKm: null`,
   `distanceSource: null`, `breakdown: null`.

ETA is **not** computed in the resolver. The checkout computes it from
`distanceKm` + the restaurant's `avg_prep_minutes` via `estimateMinutes`.

### C. Schema — migration `019_delivery_prep_time.sql`

```sql
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS avg_prep_minutes INT DEFAULT 20;
```

No order-table change: the customer pin is stored in the existing
`orders.delivery_lat` / `delivery_lng`.

### D. Checkout UI — `app/(storefront)/[slug]/checkout/page.tsx`

Below the neighborhood select, add an optional "Exact location" block (only shown
once an area is chosen):

- A `📍 Use my location` button → `navigator.geolocation.getCurrentPosition` →
  sets `customerPin = { lat, lng }`.
- A draggable map (reuse `LocationPicker`, dynamically imported with SSR off),
  `center` = chosen area centroid, `value` = `customerPin`, `onChange` updates
  `customerPin`.
- The live fee uses `resolveDeliveryFee({ ..., customer: customerPin })`.
- Order summary additions:
  - ETA line: `Est. arrival ~{estimateMinutes(...)} min`.
  - Breakdown line when `source === 'distance'`:
    `₵{fee} = base ₵{base} ({radius}km) + {extraKm}km × ₵{perKm}` (omit the
    `+ …` part when `withinRadius`).
- `handleSubmit` sends `customerLat` / `customerLng` (from `customerPin`).
- Load `avg_prep_minutes` with the other tenant fields for the ETA.

### E. Orders API — `app/api/orders/route.ts`

- Accept `customerLat`, `customerLng` from the body.
- Pass `customer: (customerLat != null && customerLng != null) ? { lat, lng } : null`
  to `resolveDeliveryFee`.
- Persist the pin into `orders.delivery_lat` / `delivery_lng`.
- Keep the existing not-deliverable rejection and distance/area persistence.

### F. Dataset expansion — `apps/web/lib/delivery/ghana-areas.ts`

Add cities (with centroids + neighborhoods): **Kasoa, Ho, Koforidua, Sunyani**.
Add finer Accra neighborhoods: **Teshie, Nungua, Haatso, Dome, Kwabenya,
Kaneshie, Abeka**. Names unique within each city (integrity test enforces this).

### G. Settings — `app/(dashboard)/settings/delivery/page.tsx`

Add an **Avg prep (min)** number input next to the rate controls; load and save
`avg_prep_minutes` (blank → default 20).

## Data Flow (checkout → order)

1. Customer picks Delivery → city → neighborhood (V1).
2. Optionally taps "Use my location" or drags the map → `customerPin`.
3. Checkout calls `resolveDeliveryFee` with the pin (or null) → live fee,
   breakdown, `distanceKm`; computes ETA via `estimateMinutes(distanceKm,
   avg_prep_minutes)`.
4. Submit sends `{ city, areaName, customerLat, customerLng }`.
5. Orders API recomputes authoritatively with the same resolver, persists fee +
   distance + area + pin.

## Error Handling

| Case | Behavior |
|---|---|
| Geolocation denied / unavailable / times out | Keep centroid distance; show a small hint; still orderable |
| Pin beyond `max_delivery_distance_km` | Not deliverable; block submit (existing path) |
| Pin set but restaurant has no coords | Base-fee fallback |
| `distanceKm` null (override/base) | ETA shows prep minutes only |

## Testing

- **`pricing.test.ts`** — `computeDeliveryFee` populates `breakdown` correctly
  (within radius: zeros; beyond: `extraKm`, `extraCharge`); `estimateMinutes`
  (null distance → prep only; with distance → prep + travel).
- **`resolve.test.ts`** — a `customer` pin yields `distanceSource: 'pin'` and a
  distance measured from the pin (different from the centroid result); no pin →
  `distanceSource: 'centroid'`; manual override still wins over a pin;
  `breakdown` present on distance, null on override/base.
- **`ghana-areas.test.ts`** — existing integrity tests must still pass for the
  expanded dataset (valid GH bounds, unique names per city).

## Build Sequence

1. Pricing engine: `breakdown` + `estimateMinutes` + tests.
2. Resolver: `customer` pin + `distanceSource` + `breakdown` passthrough + tests.
3. Migration `019` (`avg_prep_minutes`).
4. Dataset expansion + integrity test run.
5. Checkout: pin block (GPS + map), ETA, breakdown, send pin.
6. Orders API: accept pin, recompute, persist.
7. Settings: avg-prep input.
8. End-to-end verification.

## Known Risks

- **Device GPS accuracy** varies on Ghana mobile; the draggable map is the
  correction path. Acceptable.
- **ETA is an estimate** (no traffic/routing). Label it clearly as approximate.
