# Distance-Based Delivery Pricing — Design Spec

**Date:** 2026-06-03
**Status:** Approved (design), pending implementation plan
**Owner:** Ebenezer Barning

## Problem

The checkout "Select neighborhood" dropdown lists free-text area names that each
restaurant types manually into `delivery_zones`. The names are inconsistent and
not tied to real geography, so customers see arbitrary labels and delivery fees
are flat per typed zone.

We want:

1. Customers select a **city**, then a **neighborhood** chosen from a curated
   list of real areas in that city.
2. A delivery-pricing algorithm (Bolt Food / Uber Eats style, tuned for Ghana)
   that uses the restaurant's configured rate as the **base** for orders within a
   free radius (default 3 km) of the restaurant, then charges more with distance.

This is a core part of the product, so pricing must be predictable, server-
authoritative (not client-tamperable), work on poor networks, and incur no
recurring third-party cost.

## Goals

- City → neighborhood selection backed by real Ghana geography.
- Distance-based delivery fee: restaurant base rate covers a free radius; beyond
  that, fee grows per km.
- Per-restaurant override of radius and per-km rate, with sane platform defaults.
- Authoritative server-side fee recomputation.
- Incremental rollout that does not break existing restaurants or orders.

## Non-Goals (YAGNI)

- Surge / time-of-day pricing.
- Live road-network routing (we use straight-line haversine distance).
- A platform-admin UI for editing global defaults (constants in code for now).
- A map pin at checkout (deferred to v2; optional refinement of centroid).
- Rider assignment / dispatch.

## Current State (as of this spec)

- `tenants` already has `location_lat`, `location_lng`, `city`, `region`,
  `address`, and base `delivery_fee`.
- `delivery_zones(tenant_id, name, fee, estimated_minutes, is_active)` holds the
  free-text manual zones shown in the checkout dropdown today. No geo data.
- Restaurant location is captured during onboarding via a Leaflet/OSM pin
  (`components/onboarding/location-picker.tsx`).
- Haversine distance is already computed in SQL in
  `supabase/migrations/007_marketplace.sql` (marketplace "near me" sort) — the
  pattern is proven in this codebase.
- Checkout (`app/(storefront)/[slug]/checkout/page.tsx`) does NOT capture
  customer coordinates. The customer only types an address and picks a zone.
- The orders API (`app/api/orders/route.ts`) recomputes the fee server-side from
  `delivery_zones` / base `delivery_fee` — good pattern to extend.

## Locked Decisions

1. **Customer location** — Curated neighborhood centroids. City → neighborhood
   pick; each neighborhood has a fixed lat/lng centroid; distance = restaurant →
   centroid. No map, no geocoding API.
2. **Geo data source** — Curated static dataset shipped in code. Zero API cost,
   offline-capable, stable data.
3. **Pricing model** — Free radius + per-km beyond. Base rate covers the free
   radius; beyond it, `base + ceil(d - radius) * per_km`.
4. **Rate control** — Platform defaults with per-restaurant override.

## Architecture

Three units, each independently testable:

### A. Geo dataset — `apps/web/lib/delivery/ghana-areas.ts`

```ts
export interface Neighborhood { name: string; lat: number; lng: number; }
export interface City {
  name: string;
  lat: number;   // city centroid (for default map / fallback)
  lng: number;
  neighborhoods: Neighborhood[];
}
export const GHANA_CITIES: City[];

// Helpers:
export function findCity(name: string): City | undefined;       // case-insensitive
export function findNeighborhood(city: string, area: string): Neighborhood | undefined;
```

- Single source of truth: both the checkout dropdown and the server-side fee
  lookup read this file.
- Seed major metros first (Accra + its areas: East Legon, Osu, Spintex, Madina,
  Adenta, Dansoman, Achimota; Tema, Kumasi, Takoradi, Cape Coast). Expand over
  time without code changes elsewhere.
- Reuse / consolidate with `lib/marketplace/geo.ts` `CITY_COORDS` so city
  centroids are not duplicated.

### B. Pricing engine — `apps/web/lib/delivery/pricing.ts`

```ts
export interface LatLng { lat: number; lng: number; }

export const DEFAULT_FREE_RADIUS_KM = 3;
export const DEFAULT_PER_KM_RATE = 2.5;   // GH₵ per km beyond the free radius
export const FEE_ROUNDING = 0.5;          // round fee to nearest ₵0.50

export function haversineKm(a: LatLng, b: LatLng): number;

export interface FeeInput {
  baseFee: number;
  distanceKm: number;
  freeRadiusKm?: number;   // default DEFAULT_FREE_RADIUS_KM
  perKmRate?: number;      // default DEFAULT_PER_KM_RATE
  maxDistanceKm?: number;  // optional hard cap; beyond → not deliverable
}

export interface FeeResult {
  fee: number;
  deliverable: boolean;
  distanceKm: number;
  withinRadius: boolean;
}

export function computeDeliveryFee(input: FeeInput): FeeResult;
```

Formula:

```
radius   = freeRadiusKm ?? DEFAULT_FREE_RADIUS_KM
perKm    = perKmRate    ?? DEFAULT_PER_KM_RATE

if maxDistanceKm && distanceKm > maxDistanceKm:
    deliverable = false           // caller blocks delivery
else:
    deliverable = true

if distanceKm <= radius:
    fee = baseFee                 // restaurant rate covers the free radius
else:
    fee = baseFee + ceil(distanceKm - radius) * perKm

fee = roundToNearest(fee, FEE_ROUNDING)
fee = max(fee, baseFee)           // never below base
```

Pure functions — no I/O, no DB. Imported by both the checkout client (live
preview) and the orders API (authoritative recompute).

### C. Wiring

- **Checkout** computes the fee for live display.
- **Orders API** recomputes from trusted DB + dataset values and ignores any
  client-supplied fee.
- **Delivery settings** lets a restaurant set radius / per-km override.

## Schema Changes — migration `018_distance_delivery.sql`

`tenants` add:

| Column | Type | Default | Meaning |
|---|---|---|---|
| `free_delivery_radius_km` | `NUMERIC` | `3` | Distance the base fee covers |
| `per_km_rate` | `NUMERIC` | `NULL` | Override; `NULL` → platform default |
| `max_delivery_distance_km` | `NUMERIC` | `NULL` | Hard delivery cap; `NULL` → none |

`orders` add:

| Column | Type | Meaning |
|---|---|---|
| `delivery_area_name` | `TEXT` | Neighborhood the customer selected |
| `delivery_distance_km` | `NUMERIC` | Recorded straight-line distance |

`delivery_lat` / `delivery_lng` already exist on `orders`. `delivery_zone_id`
stays for the manual-override path. No destructive changes; all additive with
defaults, so existing rows and restaurants keep working.

## Data Flow (checkout → order)

1. Customer selects **Delivery**.
2. **City** select — defaults to the restaurant's `city`; customer may change it.
   Options come from `GHANA_CITIES`.
3. **Neighborhood** select — real areas for the chosen city, from the dataset.
4. Client looks up the neighborhood centroid, computes
   `haversineKm(restaurant, centroid)`, calls `computeDeliveryFee(...)`, and shows
   the fee + estimated time live in the order summary. If `deliverable === false`,
   show "Outside delivery range" and block submit.
5. Address textarea + notes are kept (the rider still needs them).
6. Submit sends `{ city, areaName }` (centroid optional, for reference only).

## Override Resolution (identical order on client and server)

1. If the chosen area name matches an **active** manual `delivery_zone`
   (case-insensitive name equality) → use that flat `fee`. Lets a restaurant pin
   a special price for an area (e.g. "East Legon → flat ₵15").
2. Else if the restaurant has `location_lat/lng` and the neighborhood is found in
   the dataset → distance formula via `computeDeliveryFee`.
3. Else → fall back to the base `delivery_fee` (graceful; still orderable).

## Server Authority (orders API)

On `POST /api/orders` for `deliveryType === 'delivery'`:

1. Load the restaurant's `location_lat/lng`, `delivery_fee`,
   `free_delivery_radius_km`, `per_km_rate`, `max_delivery_distance_km`.
2. Look up the neighborhood centroid server-side from `GHANA_CITIES` using the
   submitted `{ city, areaName }`.
3. Run the same override resolution and `computeDeliveryFee`.
4. If `deliverable === false`, reject with a clear error.
5. Persist `delivery_fee`, `delivery_area_name`, `delivery_distance_km`,
   `delivery_lat/lng` (centroid).
6. The client-sent fee is never trusted.

## Estimated Time

Simple, distance-derived (no routing):

```
estMinutes = basePrepMinutes + round(distanceKm / AVG_SPEED_KM_PER_MIN)
```

Use a single constant for average speed; keep prep time from existing settings if
present, else a constant default. Display only — not used for pricing.

## Restaurant Settings Changes — `settings/delivery/page.tsx`

- Relabel "Base Delivery Fee" → make clear it "covers the first {radius} km."
- Add a **free-radius** input (default 3 km).
- Add a **per-km rate** override input; placeholder shows the platform default so
  leaving it blank uses the default.
- Keep the existing "Custom Neighborhood Zones" section, reframed as optional
  **fixed-price area overrides** (the override path above).

## Error Handling

| Case | Behavior |
|---|---|
| Restaurant has no coords | Base fee fallback; log a warning; still orderable |
| Area not in dataset / city mismatch | Base fee fallback |
| `distanceKm > max_delivery_distance_km` | Block delivery: "Outside delivery range" |
| Pickup | Fee 0; skip all distance logic |
| Manual zone match | Use zone flat fee (override) |

## Testing

- **Unit — `pricing.ts`:**
  - `haversineKm` against known coordinate pairs (tolerance-checked).
  - `computeDeliveryFee`: within radius (= base), just beyond radius, far,
    `maxDistanceKm` exceeded (not deliverable), ₵0.50 rounding, never-below-base.
- **Dataset integrity:** every neighborhood has finite lat/lng in valid GH range;
  neighborhood names unique within a city; every city has ≥1 neighborhood.
- **Server trust:** a request with a forged low fee is recomputed and ignored.
- **Override:** an area matching an active manual zone uses the zone fee, not the
  computed fee.

## Build Sequence

1. Geo dataset file + types + helpers (+ consolidate `CITY_COORDS`).
2. Pricing lib + unit tests.
3. Migration `018_distance_delivery.sql`.
4. Checkout UI: city + neighborhood selects, live fee, not-deliverable state.
5. Orders API: server-side recompute, override resolution, persistence.
6. Delivery settings UI: radius + per-km inputs, relabels, override reframing.
7. End-to-end verification.

## Known Risk

**Centroid coarseness** — a large area (e.g. Spintex) is represented by one
centroid, so customers at its edges get a slightly off distance/fee. Mitigation:
keep neighborhoods granular; add an optional map-pin refinement in v2.
