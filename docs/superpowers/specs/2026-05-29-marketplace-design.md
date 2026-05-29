# Phase 2 — Public Food Marketplace — Design

**Date:** 2026-05-29
**Status:** Approved (pending spec review)

## Goal

Turn Didi from a set of isolated tenant storefronts into a discoverable
marketplace. When a kitchen is onboarded and has a menu, it is **automatically
published** to a public marketplace that becomes the homepage. Patrons browse
and search kitchens, find the **nearest** vendors to them, and search by **type
of food / specific dishes**. Would-be vendors still find an easy path to
onboard. Marketing and marketplace coexist on one professional, cohesive site.

## Decisions (locked during brainstorm)

- **Information architecture (option A):** the homepage `/` **becomes** the
  marketplace (patron-first, one front door). The existing marketing landing
  page moves to `/for-restaurants` and is reached via a header "List your
  kitchen" CTA and a vendor invite strip on the marketplace.
- **Location model — hybrid:** capture kitchen GPS at onboarding (map pin →
  lat/lng); patrons tap "Use my location" → kitchens ranked by real distance
  (km), each card shows "2.3 km away"; kitchens without GPS fall back to
  city matching and sort after located ones.
- **Food search — cuisine tags + dish search:** kitchens pick curated cuisine
  tags; patrons filter by cuisine chips AND type free-text to match specific
  dishes across menu item names + kitchen names.
- **Build approach #1 — server-rendered + URL filters:** SEO-indexable, fast
  first paint, scales. Client adds only the geolocation button + debounced
  search. Structured to grow into a server+client-refine hybrid later.

## Non-Goals (MVP)

- No ratings/reviews (no system exists yet).
- No new kitchen detail page — cards link to the existing `/[slug]` storefront.
- No client-side SPA marketplace, no map view of results (list/grid only).
- No paid promotion/ranking, no favorites persistence (heart icon is visual
  only for MVP, or omitted — see Open Items).

## Data Model

Migration `supabase/migrations/007_marketplace.sql`:

- Add `tenants.cuisines text[] NOT NULL DEFAULT '{}'`.
- Add a GIN index on `tenants.cuisines` for `&&` (overlap) filtering.
- Reuse existing `tenants.location_lat`, `tenants.location_lng`, `city`,
  `region`. No new location columns.
- **Curated cuisine list lives in app code** (`lib/marketplace/cuisines.ts`),
  not the DB — a single source of truth used by onboarding, settings, and the
  chips. The column stores whatever subset the kitchen selected.

### Listing rule (auto-publish)

A kitchen appears in the marketplace when:

1. `status = 'active'`, AND
2. it has at least one `menu_items` row with `is_available = true`.

This prevents empty kitchens from showing. It ties into the Phase-1 onboarding
checklist naturally (a kitchen becomes visible once it has added a dish).

### RPC: `search_kitchens`

A single `SECURITY DEFINER` SQL function centralizes filtering, distance, and
the listing rule, and returns only public-safe fields. Signature:

```sql
search_kitchens(
  p_q          text    default null,   -- free-text dish/kitchen search
  p_cuisines   text[]  default null,   -- filter: overlap with tenants.cuisines
  p_city       text    default null,   -- filter: exact city
  p_lat        double precision default null,
  p_lng        double precision default null,
  p_limit      int     default 24,
  p_offset     int     default 0
)
returns table (
  id uuid, name text, slug text, tagline text,
  logo_url text, cover_image_url text,
  city text, region text,
  cuisines text[],
  delivery_fee numeric, min_order_amount numeric,
  item_count int,
  open_now boolean,
  distance_km double precision   -- null when coords missing on either side
)
```

Behavior:

- **Listing rule** enforced via `status='active'` AND
  `EXISTS (available menu_item)`.
- **Text match** (`p_q` non-empty): kitchen `name`/`tagline`/`description`
  ILIKE `%q%` OR `EXISTS` an available `menu_items.name` ILIKE `%q%`.
- **Cuisine filter** (`p_cuisines` non-empty): `cuisines && p_cuisines`.
- **City filter** (`p_city` non-empty): `city = p_city`.
- **`item_count`**: count of available menu items.
- **`open_now`**: derived from `operating_hours` for the current day/time
  (handles `is_closed`); kitchens with no hours rows treated as open.
- **`distance_km`**: haversine between `p_lat/p_lng` and the kitchen's
  `location_lat/lng` when all four present; else `null`.
- **Ordering**: when `p_lat/p_lng` provided → `distance_km` ASC NULLS LAST,
  then `open_now` DESC, then `is_featured`/`created_at`. Otherwise →
  `open_now` DESC, then a city match boost (if `p_city`), then
  `is_featured` DESC, `created_at` DESC.
- Grant `EXECUTE` to `anon` and `authenticated` (returns only public fields;
  callable safely). The server still calls it via the admin client.

## Pages & Components

### `/` — marketplace (replaces current `app/page.tsx`)

Server component. Reads `searchParams`:

- `q` — text query
- `cuisine` — single cuisine slug (chip); `all`/absent = no filter
- `city` — optional city filter
- `near` — `"<lat>,<lng>"` when the patron shared location

Flow: parse params → call `search_kitchens` via the **server admin client**
(`createAdminClient`, same pattern as the storefront layout) → render:

1. **Header** — Didi logo, "List your kitchen" CTA (→ `/for-restaurants`),
   Sign in.
2. **`<HeroSearch>`** (client) — the "What do you want to eat?" search input +
   "Use my location" button. Submitting/typing (debounced) updates the URL
   params; "Use my location" calls `navigator.geolocation`, sets `near`.
3. **`<CuisineChips>`** (client) — curated cuisine chips, **single-select for
   MVP** (one active cuisine or "All"); selecting one sets `cuisine` in the
   URL. The page wraps it as a one-element array for the RPC's `p_cuisines`
   (so multi-select is a later no-schema-change upgrade). Uses `router.replace`
   + a transition for snappy, shareable, back-button-friendly filtering.
4. **`<KitchenGrid>`** (server) — maps results to `<KitchenCard>`; renders the
   empty state when there are none.
5. **Vendor strip** — "Run a kitchen?" → `/for-restaurants`.

`export const dynamic = 'force-dynamic'` (results depend on params/time);
metadata tuned for discovery SEO ("Order food online in Ghana…").

### `<KitchenCard>` (server, presentational)

Cover (image or brand-color gradient) + open/closed badge + logo + name +
cuisine line + meta row (distance when present, item count, delivery fee / min
order). Whole card links to `/[slug]`.

### `/for-restaurants` (new)

The current marketing/landing content (vendor pitch, "start selling in 5 min",
CTA to `/register`) relocated here, lightly adapted. Add `for-restaurants` to
the middleware `KNOWN_PATHS` set so it is not treated as a tenant slug.

### New files

- `lib/marketplace/cuisines.ts` — `CUISINES` constant (slug, label, emoji).
- `components/marketplace/hero-search.tsx` (client)
- `components/marketplace/cuisine-chips.tsx` (client)
- `components/marketplace/kitchen-card.tsx` (server)
- `components/marketplace/kitchen-grid.tsx` (server)
- `components/onboarding/location-picker.tsx` (client; Leaflet + OSM tiles)
- `app/for-restaurants/page.tsx`

### Modified files

- `app/page.tsx` → marketplace.
- `app/api/auth/register/route.ts` → accept + store `cuisines`, `location_lat`,
  `location_lng`.
- `app/(auth)/register/page.tsx` → add cuisine multi-select + location picker.
- `app/(dashboard)/settings/profile/page.tsx` → edit cuisines + location for
  existing kitchens.
- `middleware.ts` → add `for-restaurants` to `KNOWN_PATHS`.

## Onboarding & Settings

- **Register:** new optional-but-encouraged inputs — cuisine multi-select
  (chips from the curated list) and a location map pin. The picker uses Leaflet
  with free OpenStreetMap tiles (no API key); it centers on the selected city
  and lets the kitchen drag a pin to produce `lat/lng`.
- **Settings → Profile:** the same cuisine selector + location picker so
  existing kitchens (and anyone who skipped it) can set/update them. This is
  how kitchens onboarded in Phase 1 become fully marketplace-ready.
- The Phase-1 onboarding checklist is unchanged; a kitchen still auto-publishes
  once it is active and has a dish. Cuisines/location enhance discovery but are
  not required to be listed.

## Error Handling

- **Geolocation denied/unavailable:** no error UI; silently fall back to
  city/featured sort and label the section "All kitchens" instead of "Near
  you".
- **Kitchen missing coords:** still listed; no distance shown; sorts after
  located kitchens (NULLS LAST).
- **No results:** friendly empty state with a "clear filters" action and a hint
  to broaden the search.
- **RPC error:** the marketplace renders an empty grid with a brief retry
  message; the homepage never throws (wrap the data call, treat failure as
  zero results + a logged error).

## Testing

No automated suite exists in the repo. Verification is manual against the
running app (typecheck + lint must stay clean):

1. Seed 2–3 kitchens with cuisines, coords, and available menu items.
2. Load `/` → kitchens render; cards show open/closed, item count, fee.
3. "Use my location" (or `?near=`) → distance appears, order changes.
4. Cuisine chip → filters; dish search (`jollof`) → matches across kitchens.
5. Empty state → clearing filters restores results.
6. New register with cuisines + pin → kitchen appears with tags + distance.
7. A kitchen with no available items does **not** appear.

## Build Sequence (for the implementation plan)

1. Migration 007 (column, index, `search_kitchens` RPC).
2. `lib/marketplace/cuisines.ts`.
3. Marketplace components + new `/` page + empty state.
4. `/for-restaurants` (move landing) + middleware `KNOWN_PATHS`.
5. Onboarding/settings: cuisines + location picker + register API.
6. Manual verification pass.

## Open Items (intentionally deferred / confirm during implementation)

- **Favorites (heart icon):** shown in the mockup. MVP = omit or visual-only;
  real persistence deferred.
- **Map view** of results: deferred (list/grid only).
- **`open_now` correctness** around timezones: kitchens are GH-local; compute
  in `Africa/Accra`.
