# Didi Mobile — Phase 0 cross-alias spike

Capacitor shell that ships the **customer storefront only** as a static export.
It reuses `apps/web`'s React/Tailwind components **in place** via tsconfig
cross-alias (`@/* → ../web/*`) — no files moved, `apps/web` untouched.

## How it fits together

```
apps/mobile (this)            apps/web (backend, unchanged)
  output:'export' bundle  ──►   /api/storefront/[slug]   (tenant+menu+zones)
  Capacitor WebView       ──►   /api/orders/[id]/verify  (track + settle)
  TanStack Query cache    ──►   Supabase (anon)          (realtime/auth)
```

- Heavy UI (`StorefrontMenu`, `OrderTracker`, `AdepaWidget`) resolves cross-alias
  into `apps/web` — see `tsconfig.json` paths.
- Server-only modules (admin client, Paystack server, settle, notifications) are
  **banned** from this package by `eslint.config.mjs` → no secrets in the binary.

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

## Not in Phase 0 (later phases)

- Hoist shared code into `packages/storefront` (Phase 1, with re-export shims).
- Capacitor Secure Storage adapter for the Supabase session (Phase 2).
- Push (FCM/APNs), background geolocation, deep links (Phase 2–3).
