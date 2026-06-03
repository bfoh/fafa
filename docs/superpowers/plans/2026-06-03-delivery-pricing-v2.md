# Delivery Pricing V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add optional exact-location pin (GPS + draggable map) that overrides the area centroid for distance pricing, a delivery-time estimate, a fee breakdown at checkout, and wider geo coverage.

**Architecture:** Extend the pure pricing engine (`pricing.ts`) with a fee breakdown + ETA helper, extend the shared resolver (`resolve.ts`) to accept a customer pin, add a `tenants.avg_prep_minutes` column, and wire it all into checkout (pin block, ETA, breakdown), the orders API (authoritative recompute + pin persistence), and delivery settings.

**Tech Stack:** Next.js (App Router — non-standard fork; read `node_modules/next/dist/docs/` before touching Next APIs), React client components, Leaflet (already a dep, reuse `LocationPicker`), Supabase (Postgres), TypeScript, Vitest.

Spec: `docs/superpowers/specs/2026-06-03-delivery-pricing-v2-design.md`
Builds on V1: `docs/superpowers/specs/2026-06-03-distance-delivery-pricing-design.md`

---

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `apps/web/lib/delivery/pricing.ts` | Add `FeeBreakdown`, breakdown in `FeeResult`, `estimateMinutes`, constants | 1 |
| `apps/web/lib/delivery/pricing.test.ts` | Tests for breakdown + ETA | 1 |
| `apps/web/lib/delivery/resolve.ts` | Accept `customer` pin, return `distanceSource` + `breakdown` | 2 |
| `apps/web/lib/delivery/resolve.test.ts` | Tests for pin override + distanceSource | 2 |
| `supabase/migrations/019_delivery_prep_time.sql` | `tenants.avg_prep_minutes` | 3 |
| `apps/web/lib/delivery/ghana-areas.ts` | More cities + finer Accra areas | 4 |
| `apps/web/app/(storefront)/[slug]/checkout/page.tsx` | Pin block, ETA, breakdown, send pin | 5 |
| `apps/web/app/api/orders/route.ts` | Accept pin, recompute, persist `delivery_lat/lng` | 6 |
| `apps/web/app/(dashboard)/settings/delivery/page.tsx` | Avg-prep input | 7 |

---

## Task 1: Pricing engine — breakdown + ETA

**Files:**
- Modify: `apps/web/lib/delivery/pricing.ts`
- Test: `apps/web/lib/delivery/pricing.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `apps/web/lib/delivery/pricing.test.ts` (inside the file, after the
existing `computeDeliveryFee` describe block). Also add the new imports to the
existing top-of-file import: change the import line to include `estimateMinutes`,
`AVG_SPEED_KM_PER_MIN`, and `DEFAULT_PREP_MINUTES`:
```ts
import {
  haversineKm,
  computeDeliveryFee,
  estimateMinutes,
  DEFAULT_FREE_RADIUS_KM,
  DEFAULT_PER_KM_RATE,
  AVG_SPEED_KM_PER_MIN,
  DEFAULT_PREP_MINUTES,
} from './pricing';
```
Then append:
```ts
describe('computeDeliveryFee breakdown', () => {
  it('is all base with zero extras within the radius', () => {
    const r = computeDeliveryFee({ baseFee: 10, distanceKm: 2 });
    expect(r.breakdown).toEqual({ base: 10, extraKm: 0, perKm: DEFAULT_PER_KM_RATE, extraCharge: 0 });
  });

  it('reports extra km and charge beyond the radius', () => {
    // 3km free, 6.2km → ceil(3.2)=4 extra km * 2.5 = 10
    const r = computeDeliveryFee({ baseFee: 10, distanceKm: 6.2 });
    expect(r.breakdown.base).toBe(10);
    expect(r.breakdown.extraKm).toBe(4);
    expect(r.breakdown.perKm).toBe(2.5);
    expect(r.breakdown.extraCharge).toBe(10);
  });
});

describe('estimateMinutes', () => {
  it('returns prep only when distance is null', () => {
    expect(estimateMinutes({ distanceKm: null, prepMinutes: 20 })).toBe(20);
  });

  it('adds travel time from distance', () => {
    // 4km / 0.4 km-per-min = 10 min travel; + 20 prep = 30
    expect(estimateMinutes({ distanceKm: 4, prepMinutes: 20 })).toBe(30);
  });

  it('exposes ETA constants', () => {
    expect(AVG_SPEED_KM_PER_MIN).toBe(0.4);
    expect(DEFAULT_PREP_MINUTES).toBe(20);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/web && npx vitest run pricing`
Expected: FAIL — `estimateMinutes` is not exported; `r.breakdown` is undefined.

- [ ] **Step 3: Extend `pricing.ts`**

In `apps/web/lib/delivery/pricing.ts`, add the new constants after the existing
`FEE_ROUNDING` line:
```ts
export const AVG_SPEED_KM_PER_MIN = 0.4; // ~24 km/h city travel
export const DEFAULT_PREP_MINUTES = 20;
```

Add the `FeeBreakdown` interface and extend `FeeResult` (replace the existing
`FeeResult` interface):
```ts
export interface FeeBreakdown {
  base: number;
  extraKm: number;
  perKm: number;
  extraCharge: number;
}

export interface FeeResult {
  fee: number;
  deliverable: boolean;
  distanceKm: number;
  withinRadius: boolean;
  breakdown: FeeBreakdown;
}
```

Replace the body of `computeDeliveryFee` (keep the signature) so it builds the
breakdown:
```ts
export function computeDeliveryFee(input: FeeInput): FeeResult {
  const radius = input.freeRadiusKm ?? DEFAULT_FREE_RADIUS_KM;
  const perKm = input.perKmRate ?? DEFAULT_PER_KM_RATE;
  const distanceKm = input.distanceKm;
  const withinRadius = distanceKm <= radius;

  const deliverable =
    input.maxDistanceKm == null || distanceKm <= input.maxDistanceKm;

  const extraKm = withinRadius ? 0 : Math.ceil(distanceKm - radius);
  const extraCharge = extraKm * perKm;

  let fee = input.baseFee + extraCharge;
  fee = Math.max(roundTo(fee, FEE_ROUNDING), input.baseFee);

  return {
    fee,
    deliverable,
    distanceKm,
    withinRadius,
    breakdown: { base: input.baseFee, extraKm, perKm, extraCharge },
  };
}
```

Add the ETA helper at the end of the file:
```ts
export function estimateMinutes(args: {
  distanceKm: number | null;
  prepMinutes: number;
}): number {
  const travel =
    args.distanceKm == null ? 0 : Math.round(args.distanceKm / AVG_SPEED_KM_PER_MIN);
  return args.prepMinutes + travel;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && npx vitest run pricing`
Expected: PASS (all pricing tests, including the new breakdown + ETA ones).

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/delivery/pricing.ts apps/web/lib/delivery/pricing.test.ts
git commit -m "feat(delivery): fee breakdown + ETA estimate in pricing engine"
```

---

## Task 2: Resolver — customer pin + distanceSource

**Files:**
- Modify: `apps/web/lib/delivery/resolve.ts`
- Test: `apps/web/lib/delivery/resolve.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `apps/web/lib/delivery/resolve.test.ts` (after the existing describe
block):
```ts
describe('resolveDeliveryFee with a customer pin', () => {
  it('measures distance from the pin and reports distanceSource = pin', () => {
    // A pin far north-east of the restaurant; centroid would give a different number.
    const r = resolveDeliveryFee({
      restaurant,
      city: 'Accra',
      areaName: 'East Legon',
      manualZones: [],
      customer: { lat: 5.71, lng: -0.1 },
    });
    expect(r.source).toBe('distance');
    expect(r.distanceSource).toBe('pin');
    expect(r.distanceKm).not.toBeNull();
    expect(r.breakdown).not.toBeNull();
  });

  it('uses the centroid (distanceSource = centroid) when no pin is given', () => {
    const r = resolveDeliveryFee({
      restaurant,
      city: 'Accra',
      areaName: 'East Legon',
      manualZones: [],
    });
    expect(r.distanceSource).toBe('centroid');
  });

  it('lets a manual override win over a pin', () => {
    const r = resolveDeliveryFee({
      restaurant,
      city: 'Accra',
      areaName: 'East Legon',
      manualZones: [{ name: 'East Legon', fee: 15 }],
      customer: { lat: 5.71, lng: -0.1 },
    });
    expect(r.source).toBe('override');
    expect(r.distanceSource).toBeNull();
    expect(r.breakdown).toBeNull();
    expect(r.fee).toBe(15);
  });

  it('computes from the pin even when the area is unknown', () => {
    const r = resolveDeliveryFee({
      restaurant,
      city: 'Accra',
      areaName: 'Atlantis',
      manualZones: [],
      customer: { lat: 5.71, lng: -0.1 },
    });
    expect(r.source).toBe('distance');
    expect(r.distanceSource).toBe('pin');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/web && npx vitest run resolve`
Expected: FAIL — `customer` not accepted; `distanceSource` / `breakdown` not on
the result.

- [ ] **Step 3: Extend `resolve.ts`**

In `apps/web/lib/delivery/resolve.ts`, update the imports line to also pull the
`LatLng` and `FeeBreakdown` types:
```ts
import { computeDeliveryFee, haversineKm, type LatLng, type FeeBreakdown } from './pricing';
```

Add `customer` to `ResolveInput` (add the field to the existing interface):
```ts
export interface ResolveInput {
  restaurant: RestaurantDelivery;
  city: string;
  areaName: string;
  manualZones: ManualZone[]; // active zones only
  customer?: LatLng | null; // optional exact pin
}
```

Replace `ResolveResult` with the extended shape:
```ts
export interface ResolveResult {
  fee: number;
  deliverable: boolean;
  distanceKm: number | null;
  source: 'override' | 'distance' | 'base';
  distanceSource: 'pin' | 'centroid' | null;
  breakdown: FeeBreakdown | null;
}
```

Replace the body of `resolveDeliveryFee` with the pin-aware version:
```ts
export function resolveDeliveryFee(input: ResolveInput): ResolveResult {
  const { restaurant, city, areaName, manualZones, customer } = input;

  // 1. Manual zone override (exact area name, case-insensitive).
  const q = areaName.trim().toLowerCase();
  const override = manualZones.find((z) => z.name.trim().toLowerCase() === q);
  if (override) {
    return {
      fee: override.fee,
      deliverable: true,
      distanceKm: null,
      source: 'override',
      distanceSource: null,
      breakdown: null,
    };
  }

  // 2. Distance pricing. Destination = pin if given, else the area centroid.
  const hasCoords = restaurant.lat != null && restaurant.lng != null;
  const area = findNeighborhood(city, areaName);
  const dest: LatLng | null = customer ?? (area ? { lat: area.lat, lng: area.lng } : null);
  const distanceSource: 'pin' | 'centroid' | null = customer
    ? 'pin'
    : area
    ? 'centroid'
    : null;

  if (hasCoords && dest) {
    const distanceKm = haversineKm(
      { lat: restaurant.lat as number, lng: restaurant.lng as number },
      dest
    );
    const r = computeDeliveryFee({
      baseFee: restaurant.baseFee,
      distanceKm,
      freeRadiusKm: restaurant.freeRadiusKm ?? undefined,
      perKmRate: restaurant.perKmRate ?? undefined,
      maxDistanceKm: restaurant.maxDistanceKm,
    });
    return {
      fee: r.fee,
      deliverable: r.deliverable,
      distanceKm: r.distanceKm,
      source: 'distance',
      distanceSource,
      breakdown: r.breakdown,
    };
  }

  // 3. Fallback: base fee.
  return {
    fee: restaurant.baseFee,
    deliverable: true,
    distanceKm: null,
    source: 'base',
    distanceSource: null,
    breakdown: null,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && npx vitest run resolve`
Expected: PASS (existing + new pin tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/delivery/resolve.ts apps/web/lib/delivery/resolve.test.ts
git commit -m "feat(delivery): resolver accepts customer pin (overrides centroid)"
```

---

## Task 3: Migration — avg_prep_minutes

**Files:**
- Create: `supabase/migrations/019_delivery_prep_time.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/019_delivery_prep_time.sql`:
```sql
-- Per-restaurant average prep time, used for the checkout delivery-time estimate.
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS avg_prep_minutes INT DEFAULT 20;
```

- [ ] **Step 2: Apply the migration**

Run: `cd /Users/ebenezerbarning/Desktop/fafa && npx supabase db push`
Expected: `019_delivery_prep_time.sql` applies. (If migrations are applied via a
different command in this project, follow the same path used for `018`.)

- [ ] **Step 3: Verify the column**

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'tenants' AND column_name = 'avg_prep_minutes';
```
Expected: 1 row.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/019_delivery_prep_time.sql
git commit -m "feat(db): tenants.avg_prep_minutes for delivery ETA (019)"
```

---

## Task 4: Dataset expansion

**Files:**
- Modify: `apps/web/lib/delivery/ghana-areas.ts`
- Test: `apps/web/lib/delivery/ghana-areas.test.ts` (no change; integrity tests gate it)

- [ ] **Step 1: Add finer Accra neighborhoods**

In `apps/web/lib/delivery/ghana-areas.ts`, inside the `Accra` city's
`neighborhoods` array, add these entries after the existing `Dansoman` line:
```ts
      { name: 'Teshie', lat: 5.585, lng: -0.106 },
      { name: 'Nungua', lat: 5.6, lng: -0.072 },
      { name: 'Haatso', lat: 5.66, lng: -0.197 },
      { name: 'Dome', lat: 5.654, lng: -0.226 },
      { name: 'Kwabenya', lat: 5.69, lng: -0.214 },
      { name: 'Kaneshie', lat: 5.564, lng: -0.234 },
      { name: 'Abeka', lat: 5.588, lng: -0.243 },
```

- [ ] **Step 2: Add new cities**

In the same file, add these city objects to the `GHANA_CITIES` array, after the
`Cape Coast` city object (before the closing `];`):
```ts
  {
    name: 'Kasoa',
    lat: 5.5347,
    lng: -0.4167,
    neighborhoods: [
      { name: 'Kasoa Central', lat: 5.535, lng: -0.417 },
      { name: 'Ofaakor', lat: 5.51, lng: -0.43 },
      { name: 'Opeikuma', lat: 5.55, lng: -0.4 },
    ],
  },
  {
    name: 'Ho',
    lat: 6.6113,
    lng: 0.4703,
    neighborhoods: [
      { name: 'Ho Central', lat: 6.611, lng: 0.47 },
      { name: 'Bankoe', lat: 6.6, lng: 0.472 },
      { name: 'Ahoe', lat: 6.62, lng: 0.48 },
    ],
  },
  {
    name: 'Koforidua',
    lat: 6.0941,
    lng: -0.2591,
    neighborhoods: [
      { name: 'Central', lat: 6.094, lng: -0.259 },
      { name: 'Adweso', lat: 6.11, lng: -0.27 },
      { name: 'Srodae', lat: 6.085, lng: -0.25 },
    ],
  },
  {
    name: 'Sunyani',
    lat: 7.3349,
    lng: -2.3123,
    neighborhoods: [
      { name: 'Sunyani Central', lat: 7.335, lng: -2.312 },
      { name: 'Fiapre', lat: 7.35, lng: -2.34 },
      { name: 'Penkwase', lat: 7.32, lng: -2.3 },
    ],
  },
```

- [ ] **Step 3: Run the integrity tests**

Run: `cd apps/web && npx vitest run ghana-areas`
Expected: PASS — all coords inside GH bounds, names unique per city.

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/delivery/ghana-areas.ts
git commit -m "feat(delivery): expand geo dataset (more cities + finer Accra areas)"
```

---

## Task 5: Checkout — pin block, ETA, breakdown

**Files:**
- Modify: `apps/web/app/(storefront)/[slug]/checkout/page.tsx`

- [ ] **Step 1: Add imports**

After the existing `import { resolveDeliveryFee } from '@/lib/delivery/resolve';`
line, add:
```tsx
import { estimateMinutes, DEFAULT_PREP_MINUTES } from '@/lib/delivery/pricing';
import dynamic from 'next/dynamic';

const LocationPicker = dynamic(() => import('@/components/onboarding/location-picker'), {
  ssr: false,
});
```

- [ ] **Step 2: Add pin + map-visibility state**

After the existing `const [selectedArea, setSelectedArea] = useState<string>('');`
line, add:
```tsx
  const [customerPin, setCustomerPin] = useState<{ lat: number; lng: number } | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [geoError, setGeoError] = useState('');
```

- [ ] **Step 3: Add `avg_prep_minutes` to the tenant type**

In the `tenant` state type object, add after `max_delivery_distance_km: number | null;`:
```tsx
    avg_prep_minutes: number | null;
```

- [ ] **Step 4: Select + map the new tenant column**

In the tenant `.select(...)` string, append `, avg_prep_minutes` to the selected
columns. Then, in the `loadedTenant` object literal, add after the
`max_delivery_distance_km:` line:
```tsx
            avg_prep_minutes: tenantData.avg_prep_minutes != null ? Number(tenantData.avg_prep_minutes) : null,
```

- [ ] **Step 5: Pass the pin to the resolver and compute ETA**

Replace the `feeResult` memo and the lines just below it (the current
`feeResult` useMemo through the `const primaryColor` line) with:
```tsx
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
      customer: customerPin,
    });
  }, [deliveryType, tenant, selectedCity, selectedArea, activeZones, customerPin]);

  const deliveryFee = deliveryType === 'delivery' ? feeResult?.fee ?? 0 : 0;
  const notDeliverable = feeResult ? !feeResult.deliverable : false;
  const etaMinutes =
    feeResult && tenant
      ? estimateMinutes({
          distanceKm: feeResult.distanceKm,
          prepMinutes: tenant.avg_prep_minutes ?? DEFAULT_PREP_MINUTES,
        })
      : null;
  const total = subtotal + deliveryFee;
  const primaryColor = tenant?.primary_color || '#FF6B35';

  // Centroid of the chosen area — used to center the optional location map.
  const areaCenter = useMemo(() => {
    const city = GHANA_CITIES.find((c) => c.name === selectedCity);
    const n = city?.neighborhoods.find((x) => x.name === selectedArea);
    return n ? ([n.lat, n.lng] as [number, number]) : undefined;
  }, [selectedCity, selectedArea]);

  function useMyLocation() {
    setGeoError('');
    if (!('geolocation' in navigator)) {
      setGeoError('Location not supported on this device. Drag the map instead.');
      setShowMap(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCustomerPin({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setShowMap(true);
      },
      () => {
        setGeoError('Could not get your location. Drag the map to set it.');
        setShowMap(true);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }
```

- [ ] **Step 6: Add the optional pin block under the neighborhood select**

In the JSX, find the closing `</div>` of the `grid grid-cols-1 gap-3` block that
holds the City + Neighborhood selects. Immediately after that closing `</div>`,
insert:
```tsx
              {selectedArea && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-surface-700">Pinpoint your location <span className="text-surface-400">(optional)</span></span>
                    <button
                      type="button"
                      onClick={useMyLocation}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-surface-200 hover:bg-surface-50 transition-colors"
                      style={{ color: primaryColor }}
                    >
                      📍 Use my location
                    </button>
                  </div>
                  {geoError && <p className="text-xs text-warning-700">{geoError}</p>}
                  {(showMap || customerPin) && (
                    <LocationPicker
                      center={areaCenter}
                      value={customerPin}
                      onChange={(lat, lng) => setCustomerPin({ lat, lng })}
                    />
                  )}
                  {!showMap && !customerPin && (
                    <button
                      type="button"
                      onClick={() => setShowMap(true)}
                      className="text-xs text-surface-500 underline"
                    >
                      Or drop a pin on the map
                    </button>
                  )}
                  {customerPin && (
                    <p className="text-xs text-success-600">✓ Using your exact location for a precise fee.</p>
                  )}
                </div>
              )}
```

- [ ] **Step 7: Show ETA + breakdown in the order summary**

Replace the existing delivery-fee summary row (the
`{deliveryType === 'delivery' && (...)}` block that renders the
`Delivery fee (area)` line) with one that also shows ETA and breakdown:
```tsx
          {deliveryType === 'delivery' && (
            <>
              <div className="flex justify-between text-sm text-surface-600">
                <span>Delivery fee {selectedArea ? `(${selectedArea})` : ''}</span>
                <span>{formatGHS(deliveryFee)}</span>
              </div>
              {feeResult?.source === 'distance' && feeResult.breakdown && (
                <p className="text-[11px] text-surface-400">
                  {formatGHS(feeResult.fee)} = base {formatGHS(feeResult.breakdown.base)}
                  {feeResult.withinRadius
                    ? ` (within ${tenant?.free_delivery_radius_km ?? 3}km)`
                    : ` + ${feeResult.breakdown.extraKm}km × ${formatGHS(feeResult.breakdown.perKm)}`}
                </p>
              )}
              {etaMinutes != null && (
                <div className="flex justify-between text-xs text-surface-500">
                  <span>Est. arrival</span>
                  <span>~{etaMinutes} min</span>
                </div>
              )}
            </>
          )}
```

- [ ] **Step 8: Send the pin to the API**

In `handleSubmit`'s request body, after the `areaName: ...` line, add:
```tsx
          customerLat: deliveryType === 'delivery' ? customerPin?.lat : undefined,
          customerLng: deliveryType === 'delivery' ? customerPin?.lng : undefined,
```

- [ ] **Step 9: Type-check and lint**

Run: `cd apps/web && npx tsc --noEmit && npx eslint "app/(storefront)/[slug]/checkout/page.tsx"`
Expected: no NEW errors. (A pre-existing `set-state-in-effect` error on the
`loadCustomer` prefill effect around line 46 is unrelated to this task — leave it.)

- [ ] **Step 10: Commit**

```bash
git add apps/web/app/\(storefront\)/\[slug\]/checkout/page.tsx
git commit -m "feat(checkout): optional GPS/map pin, ETA, and fee breakdown"
```

---

## Task 6: Orders API — accept + persist pin

**Files:**
- Modify: `apps/web/app/api/orders/route.ts`

- [ ] **Step 1: Accept pin fields from the body**

In the body destructure, replace the `areaName,` line region so the block reads:
```ts
      paymentMethod,
      city,
      areaName,
      customerLat,
      customerLng,
    } = body;
```

- [ ] **Step 2: Pass the pin to the resolver**

In the `if (deliveryType === 'delivery') { ... }` block, add a pin variable before
the `resolveDeliveryFee(...)` call and pass it in. Insert immediately after the
`const { data: zones } = await supabase...` query:
```ts
      const customerPin =
        customerLat != null && customerLng != null
          ? { lat: Number(customerLat), lng: Number(customerLng) }
          : null;
```
Then add `customer: customerPin,` to the `resolveDeliveryFee({ ... })` argument
object (after the `manualZones: ...` line).

- [ ] **Step 3: Persist the pin onto the order**

In the `orders` insert object, replace the two delivery-distance/area lines with
ones that also store the pin:
```ts
        delivery_area_name: deliveryType === 'delivery' ? deliveryAreaName : null,
        delivery_distance_km: deliveryType === 'delivery' ? deliveryDistanceKm : null,
        delivery_lat:
          deliveryType === 'delivery' && customerLat != null ? Number(customerLat) : null,
        delivery_lng:
          deliveryType === 'delivery' && customerLng != null ? Number(customerLng) : null,
```

- [ ] **Step 4: Type-check**

Run: `cd apps/web && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/api/orders/route.ts
git commit -m "feat(orders): accept + persist customer pin, recompute from it"
```

---

## Task 7: Settings — avg prep input

**Files:**
- Modify: `apps/web/app/(dashboard)/settings/delivery/page.tsx`

- [ ] **Step 1: Add state**

After the existing `const [maxDistanceKm, setMaxDistanceKm] = useState('');` line,
add:
```tsx
  const [avgPrepMinutes, setAvgPrepMinutes] = useState('');
```

- [ ] **Step 2: Load the column**

In the tenant `.select(...)` string, append `, avg_prep_minutes`. Then, in the
`if (tenant) { ... }` block, after the `setMaxDistanceKm(...)` line, add:
```tsx
            setAvgPrepMinutes(tenant.avg_prep_minutes != null ? Number(tenant.avg_prep_minutes).toString() : '');
```

- [ ] **Step 3: Save the column**

In `handleSubmit`'s `.update({ ... })`, after the `max_delivery_distance_km:` line,
add:
```tsx
          avg_prep_minutes: avgPrepMinutes.trim() === '' ? 20 : parseInt(avgPrepMinutes, 10),
```

- [ ] **Step 4: Add the input**

Inside the `grid grid-cols-3 gap-4` rate-controls block, the third cell is "Max
Distance (km)". Change that grid to `grid-cols-2 sm:grid-cols-4` so a fourth cell
fits, then add a fourth cell after the Max Distance `</div>`:
```tsx
            <div>
              <label className="block text-xs font-bold text-surface-500 uppercase tracking-wider mb-2">
                Avg Prep (min)
              </label>
              <input
                type="number"
                step="1"
                min="0"
                value={avgPrepMinutes}
                onChange={(e) => setAvgPrepMinutes(e.target.value)}
                placeholder="20"
                className="w-full px-4 py-2.5 rounded-xl border border-surface-200 bg-white text-surface-950 focus:outline-none focus:ring-2 focus:ring-brand-500/40 text-xs"
              />
            </div>
```

- [ ] **Step 5: Type-check and lint**

Run: `cd apps/web && npx tsc --noEmit && npx eslint "app/(dashboard)/settings/delivery/page.tsx"`
Expected: no new errors (the pre-existing unused-`X` and exhaustive-deps warnings
are unrelated).

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/\(dashboard\)/settings/delivery/page.tsx
git commit -m "feat(settings): average prep time input for delivery ETA"
```

---

## Final Verification

- [ ] **Full unit suite**

Run: `cd apps/web && npx vitest run`
Expected: all `lib/delivery/*` tests pass (ghana-areas, pricing, resolve).

- [ ] **Whole-app type-check**

Run: `cd apps/web && npx tsc --noEmit`
Expected: no errors.

- [ ] **End-to-end manual check**

1. Apply migration `019` (and confirm `018` from V1 is applied).
2. As a restaurant: set location, base fee, and Avg Prep (e.g. 25) in Settings →
   Delivery.
3. As a customer: checkout → Delivery → city → area. Confirm fee, ETA, and
   breakdown line appear.
4. Tap "Use my location" (allow permission) → confirm a pin appears, the
   breakdown's distance/fee updates, and `✓ Using your exact location` shows.
5. Drag the map pin → confirm the fee recomputes live.
6. Place the order → confirm the `orders` row stores `delivery_lat/lng`,
   `delivery_distance_km`, `delivery_fee`.
7. Pick a far area with the restaurant's `max_delivery_distance_km` set low →
   confirm "outside delivery range" blocks submit.

---

## Notes for the Implementer

- **Next.js is a non-standard fork.** Read `node_modules/next/dist/docs/` before
  touching Next APIs. `LocationPicker` is already a `'use client'` Leaflet
  component; importing it via `next/dynamic` with `ssr: false` keeps Leaflet off
  the server.
- All pricing logic stays in `pricing.ts` + `resolve.ts` (pure, fully tested).
  Checkout and the orders API only wire them in and must pass identical inputs so
  the client preview and the authoritative server fee match.
- The customer pin reuses the existing `orders.delivery_lat` / `delivery_lng`
  columns — no order-table migration is needed.
