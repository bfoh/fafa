# Didi Mobile — Phase 0 cross-alias spike

Capacitor shell that ships the **customer storefront only** as a static export.
Shared UI/logic lives in **`@fafa/storefront`** (hoisted in Phase 1); both this
app and `apps/web` consume it (web via re-export shims at the original paths).
Phase 0 used a tsconfig cross-alias into `apps/web`; that is now replaced by the
real package boundary.

## How it fits together

```
apps/mobile (this)            apps/web (backend, unchanged)
  output:'export' bundle  ──►   /api/storefront/[slug]   (tenant+menu+zones)
  Capacitor WebView       ──►   /api/orders/[id]/verify  (track + settle)
  TanStack Query cache    ──►   Supabase (anon)          (realtime/auth)
```

- Heavy UI (`StorefrontMenu`, `OrderTracker`, `AdepaWidget`) imports from
  `@fafa/storefront` (transpiled via `transpilePackages`).
- Server-only modules (admin client, Paystack server, settle, notifications) are
  **banned** from this app by `eslint.config.mjs` → no secrets in the binary.

## First run

```bash
# 1. install workspace deps (from repo root)
npm install

# 2. env
cp apps/mobile/.env.example apps/mobile/.env.local   # fill anon key + API base

# 3. static export
npm run mobile:export            # → apps/mobile/out

# 4. add native platforms (one-time)
cd apps/mobile
npx cap add android
npx cap add ios

# 5. build + open
npm run mobile:android           # from repo root: export → sync → open
npm run mobile:ios
```

## Phase 0 exit criteria

1. Emulator boots the bundle — no white screen, no `file://` errors.
2. App fetches `/api/storefront/<real-slug>` and renders a real menu (CORS passes
   from `capacitor://localhost` / `https://localhost`).
3. Airplane-mode relaunch still paints the last menu (TanStack persisted cache).
4. `git diff --stat apps/web` is **empty** except the additive API routes
   (`/api/storefront`, `/api/orders/[orderId]/verify`, `lib/http/cors`,
   `lib/storefront/payload`).
5. `npm -w mobile run lint` green → no server/secret module reachable here.

## Phase 2 — native integrations (code done, build-verified)

Implemented (no-ops off-device; need native config + a real device to test):

- **Session storage**: `app/lib/supabase.ts` persists the Supabase session via
  Capacitor Preferences (encrypted-storage hardening is a follow-up).
- **Push**: `app/hooks/use-push.ts` registers FCM/APNs and POSTs the token to
  `/api/devices/register`; taps deep-link into the order tracker. Server send
  path: `apps/web/lib/push/fcm.ts` (FCM v1, env-gated) wired into the order
  notification dispatcher — inert until `FCM_*` env is set.
- **Deep links**: `app/hooks/use-deep-links.ts` maps `ghdidi.com/<slug>` →
  `/store/?slug=` and `.../order/<id>` → `/order/?id=`. Association files at
  `apps/web/public/.well-known/{assetlinks.json,apple-app-site-association}`.

### Native config still required (your machine)
```bash
npx cap add android && npx cap add ios
# Android: android/app/google-services.json (Firebase)
# iOS: Xcode → Push Notifications capability; APNs key in Firebase
# Fill placeholders in the two .well-known files (SHA256 fingerprint, Team ID)
# Server: set FCM_PROJECT_ID / FCM_CLIENT_EMAIL / FCM_PRIVATE_KEY on apps/web
```

## Phase 3 — rider tracking + customer live map (code done, build-verified)

- **Rider app** (`/rider`): Supabase sign-in (uses the Phase 2 persisted session),
  active-delivery queue from `/api/rider/orders`, and a per-order "Share location"
  toggle.
- **Background geolocation**: `app/hooks/use-rider-tracking.ts` wraps
  `@capacitor-community/background-geolocation` — `distanceFilter: 25m` (battery),
  Android foreground-service notification, batched upload to
  `/api/rider/location` (5 points / 15s), requeue on failure.
- **Customer live map**: `app/order/rider-map.tsx` (Leaflet) subscribes to
  `rider_locations` via Supabase Realtime; shown on the tracker when the order is
  `out_for_delivery`.
- **Server/DB**: migration **024** adds `orders.rider_id` + `rider_locations`
  (public read by order_id, service-role writes, added to the realtime
  publication). Routes `/api/rider/{orders,location}` are bearer-authed
  (`lib/auth/bearer.ts`) and verify rider↔order assignment.

### Native config still required (your machine)
```bash
# After `cap add`: declare location usage + background mode
# iOS Info.plist: NSLocationWhenInUseUsageDescription,
#   NSLocationAlwaysAndWhenInUseUsageDescription; UIBackgroundModes: location
# Android: ACCESS_FINE_LOCATION + ACCESS_BACKGROUND_LOCATION + FOREGROUND_SERVICE
```
Production hardening: swap the community geolocation plugin for Transistorsoft
(best iOS background + Android Doze handling) — same start/stop/batch shape.

## Later

- Encrypted secure-storage plugin swap for the Supabase session.
