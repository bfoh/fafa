# Live Order Tracking on the Lock Screen — Design

**Date:** 2026-06-11
**Status:** Approved
**Platforms:** iOS (Live Activities) + Android (ongoing progress notification, ships untested until test device arrives)

## Goal

Uber/Bolt-style lock-screen tracking for customer orders. When the customer backgrounds the app or locks the phone, a persistent lock-screen widget shows the full order lifecycle as a segmented progress bar (Confirmed → Preparing → Ready → On the way → Delivered). During the delivery leg, the final segment fills in real time with the rider's distance to the customer, alongside a live ETA in minutes. Tapping the widget opens the order tracker page in the app.

Pickup orders show three segments (Confirmed → Preparing → Ready) with no rider leg.

## Architecture (event-driven server push)

Lock-screen surfaces cannot run app code. All progress/ETA computation happens on the backend, which pushes tiny content-state payloads to the OS:

- **iOS:** ActivityKit Live Activity, updated via direct APNs HTTP/2 pushes (`apns-push-type: liveactivity`). FCM cannot deliver Live Activity updates, so the backend talks to Apple directly using an APNs auth key (.p8).
- **Android:** silent FCM **data** messages handled by a native `FirebaseMessagingService`, rendered as an ongoing notification with a progress bar.

Two existing backend touchpoints already fire at exactly the right moments and gain one call each:

1. **Order status changes** — `sendOrderNotifications` in `apps/web/lib/notifications/send.ts` (already fans out SMS/email/FCM push) additionally calls `updateLiveActivity(ctx, 'status')`.
2. **Rider GPS breadcrumbs** — `POST /api/rider/location` (rider app posts batched fixes) fires `updateLiveActivity(ctx, 'rider', latestFix)` after insert, fire-and-forget.

### Lifecycle

| Step | Trigger | Action |
|---|---|---|
| Start | Customer lands on tracker page after ordering (app foreground, native iOS) | JS calls `LiveActivity.start()` Capacitor plugin → `Activity.request(pushType: .token)` → APNs update token POSTed to `/api/live-activity/register` |
| Update (status) | confirmed / preparing / ready / out_for_delivery | Push new content state; segment advances |
| Update (rider) | Each breadcrumb batch during delivery, throttled | Recompute progress + ETA; final segment fills |
| End | delivered / cancelled | APNs `event: end` with final state (iOS); notification dismissed (Android) |

Android requires no registration step: device tokens are already stored in `device_tokens` keyed by `customer_phone` (same lookup as `sendOrderPush`). The `live_activities` row is created lazily on first push if no iOS registration happened.

## Data model

New Supabase table `live_activities`, one row per order:

```sql
create table live_activities (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references orders(id) on delete cascade,
  apns_token text,                  -- ActivityKit update token; null = Android-only
  initial_distance_m double precision, -- rider→customer distance at first out-for-delivery fix
  last_progress double precision,   -- throttle state
  last_eta_minutes integer,
  last_pushed_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);
```

No RLS exposure to the anon key; accessed only via the service role (same trust model as `rider_locations`).

## Content state (the payload both platforms render)

```ts
interface ActivityContentState {
  phase: 'confirmed' | 'preparing' | 'ready' | 'on_the_way' | 'delivered' | 'cancelled';
  progress: number;        // 0..1 within the on_the_way leg; 1 for completed phases
  etaMinutes: number | null;
  statusText: string;      // e.g. "Rider is on the way — 1.8 km"
  distanceMeters: number | null;
}
```

### Computation (pure functions, fully unit-tested)

- **Distance:** haversine between latest rider fix and `orders.delivery_lat/lng`.
- **Progress (delivery leg):** `1 − remaining / initial_distance_m`, clamped 0..1, monotonically non-decreasing (never moves backward on GPS jitter).
- **ETA (delivery leg):** `remaining ÷ speed`, speed from recent fixes' `speed` field smoothed and clamped to 1.5–15 m/s (≈5–54 km/h), fallback 5.5 m/s (≈20 km/h) when missing.
- **ETA (pre-delivery):** minutes until `orders.estimated_ready_at`, plus the delivery zone's `estimated_minutes` when present.
- **Status texts:** short copy per phase, matching the approved mockups ("Preparing your order", "Rider is on the way — 1.8 km", "Rider is arriving 🛵", "Delivered. Enjoy your meal! 🎉").

### Throttling (rider trigger only)

Skip the push when EITHER:
- `last_pushed_at` is under 20 seconds ago, OR
- the bar would not visibly move: |Δprogress| < 0.02 AND etaMinutes unchanged.

Status-change pushes always go out. APNs priority 10 for status changes and arrival, 5 for routine bar movement.

## Backend modules (apps/web)

| Module | Responsibility |
|---|---|
| `lib/push/apns.ts` | Env-gated APNs client mirroring `fcm.ts`: ES256 JWT (cached ~50 min), `node:http2` request, `sendLiveActivityPush(token, { event, contentState, ... })`. 410/`BadDeviceToken` → mark row ended. Env: `APNS_TEAM_ID`, `APNS_KEY_ID`, `APNS_PRIVATE_KEY` (\n-escaped ok), `APNS_ENV` (`production`\|`sandbox`). Topic: `com.ghdidi.app.push-type.liveactivity`. |
| `lib/live-activity/content-state.ts` | Pure: haversine, progress, ETA, phase mapping (incl. pickup), status copy, throttle decision. |
| `lib/live-activity/update.ts` | `updateLiveActivity(ctx, trigger, riderFix?)`: load/upsert row, compute state, throttle, push APNs + FCM data message, persist throttle state, set `ended_at` on terminal phases. Never throws into callers. |
| `app/api/live-activity/register/route.ts` | POST `{ orderId, token }`. CORS'd, public-by-UUID trust model (same as `/api/orders/[id]/location`). Validates order exists and is active; upserts row. |
| `lib/push/fcm.ts` (extension) | Data-only message variant (no `notification` block, `android.priority: high`) so Android updates render silently via the native service instead of as a banner. |

## iOS native (apps/mobile/ios)

- **Widget extension target `DidiWidgets`** (SwiftUI + WidgetKit + ActivityKit):
  - `OrderActivityAttributes` — fixed: `orderId`, `orderNumber`, `tenantName`, `slug`, `deliveryType`; `ContentState` mirrors the JSON above.
  - Lock-screen card per approved mockups: brand row, status line, ETA, segmented bar (4 delivery / 3 pickup), order number.
  - Dynamic Island: compact = progress ring + "~N min"; expanded = condensed card.
  - `widgetURL` = `https://ghdidi.com/{slug}/order/{orderId}` (universal link; AASA already served from the web app).
- **`LiveActivityPlugin`** (Swift, App target, auto-registered Capacitor plugin):
  - `start(attributes)` → `Activity.request(pushType: .token)`, await `pushTokenUpdates`, resolve token (hex) to JS.
  - `end(orderId)` → local end fallback.
  - `isAvailable()` → false below iOS 16.1 or when Live Activities are disabled; JS degrades to current behavior silently.
- **Known risk:** adding the extension target means hand-editing `project.pbxproj` (no local Xcode). Codemagic build is the verification loop; budget an iteration or two. Signing: existing automatic signing via App Store Connect API key must also provision the widget extension bundle id (`com.ghdidi.app.DidiWidgets`).

## Android native (apps/mobile/android)

- `DidiMessagingService extends` the `@capacitor-firebase/messaging` service; manifest swaps the plugin's service for ours. `type=live_activity` data messages → ongoing notification; all other messages → `super` (existing push behavior unchanged).
- Notification: channel `order_tracking` (`IMPORTANCE_LOW`), `setOngoing(true)`, `setOnlyAlertOnce(true)`, `setProgress(100, progress×100, false)`, title `{tenantName}`, text `{statusText} · ~{eta} min`. Content intent → `MainActivity` with `orderId`/`slug` extras (reuses the existing cold-start deep-link path). Terminal phases → cancel ongoing, post brief non-ongoing final state with `timeoutAfter`.
- Ships blind; functional verification deferred until the test device arrives (Android release itself is currently shelved).

## Web app integration (apps/web)

- Order tracker client component (`packages/storefront/order-tracker`): on mount with an active order on native iOS → `LiveActivity.start()` + POST token to register route. Plugin absent (web, Android, old iOS) → silent no-op.
- `components/native-bridge.tsx`: add `appUrlOpen` listener mapping `/{slug}/order/{orderId}` universal links to `router.push` (widget tap → tracker page).

## Error handling

- Every push path best-effort with caught/logged errors — order flow and rider ingest never block or fail on activity problems (mirrors `sendOrderPush`).
- Stale/invalid APNs token (410/400) → mark `ended_at`, stop pushing.
- Missing env (no APNs key) → `isApnsConfigured()` false → iOS path inert; FCM data path independent. Fully env-gated like existing push.
- No rider GPS (rider app closed): bar stays at leg start; status pushes still advance phases. ETA falls back to pre-delivery estimate.
- GPS jitter: progress monotonic; speed clamped.

## Testing

- **Vitest (apps/web):** content-state suite — haversine known distances, progress clamps/monotonicity, ETA speed clamps + fallback, phase mapping incl. pickup, status copy, throttle decision matrix; APNs JWT header/claims shape; register route validation.
- **iOS manual:** TestFlight build → place real order → background app → verify lock screen + Dynamic Island through full lifecycle incl. rider movement; tap-through to tracker.
- **Android:** deferred to device arrival.

## Prerequisites (user actions)

1. Apple Developer portal → Certificates, Identifiers & Profiles → Keys → create APNs auth key (.p8), note Key ID + Team ID.
2. Vercel env: `APNS_TEAM_ID`, `APNS_KEY_ID`, `APNS_PRIVATE_KEY`, `APNS_ENV=production`.

## Out of scope

- Road-routing ETA (Google/Mapbox) — content-state interface is transport-agnostic; can swap in later without UI changes.
- iOS push-to-start (17.2+) — unnecessary: the app is always foreground at order time.
- Rider-facing or restaurant-facing activities.
