# Didi Mobile-App Overhaul — Design

**Date:** 2026-06-02
**Status:** Approved (build order: foundations-first; execution: autonomous, report at end)

## Problem

The Didi web app (Next 16, React 19, Tailwind v4) renders poorly on mobile.
The immediate symptom: on the marketplace landing page the hero search's submit
button is pushed off the right edge of the viewport on narrow screens. More
broadly, mobile layout/ergonomics are inconsistent across surfaces and the app
does not feel like a native mobile app.

**Root cause of the visible bug:** `components/marketplace/hero-search.tsx`
packs three elements into a single flex row — a `flex-1` search input, a
"Near me" text button, and a round submit button. On ~360px viewports they
overflow and the submit button slides off-screen.

## Goal

Make every surface highly mobile-friendly and make the web app *feel* like a
native mobile app: installable (PWA), bottom navigation, bottom sheets,
safe-area aware, momentum scroll, no layout overflow. Cover all surfaces:
landing/marketplace, storefront (menu/cart/checkout/order tracking), auth,
vendor dashboard, admin.

## Constraints & existing model (do not break)

- **No customer accounts.** Customer identity is device-local only
  (`lib/utils/customer-prefs.ts`: `didi_customer`, `didi_last_order_<slug>`).
  Auth routes (`app/(auth)`) are for vendors.
- **Cart is per-kitchen.** `hooks/use-cart.tsx` stores cart under
  `CART_KEY(tenantSlug)` in localStorage. There is no global cross-kitchen cart.
- `app/globals.css` already provides mobile primitives to reuse: safe-area
  helpers (`pt-safe`, `pb-safe`, `min-h-screen-safe`, `pb-safe-plus`),
  `tap-target` (44px hit area), iOS input zoom fix (16px on `<640px`),
  `no-scrollbar`, snap-rail utilities, tap-highlight removal.
- **Next 16 has breaking changes** (per `apps/web/AGENTS.md`). Before writing
  PWA/manifest/viewport/service-worker code, consult
  `node_modules/next/dist/docs/` and heed deprecations.

## Architecture: a shared mobile app shell

Build reusable mobile primitives once and apply them everywhere, rather than
patching each page. This is what prevents the per-page inconsistency that
produced the cut-off button.

### New shared primitives (`apps/web/components/ui/`)

- **`bottom-sheet.tsx`** — `BottomSheet`: drag-handle sheet with backdrop,
  safe-area bottom padding, `overscroll-contain-y`, focus trap, ESC/back to
  close, scroll lock on body. Used by: storefront item detail, cart, filters,
  account panel.
- **`mobile-tab-bar.tsx`** — `MobileTabBar`: fixed bottom nav, safe-area
  padding, active-tab highlight, optional count badge. Hidden on `md:+`
  (desktop keeps top nav). Context-aware via props (caller supplies tab set).
- **`install-prompt.tsx`** — `InstallPrompt`: captures `beforeinstallprompt`,
  shows a dismissible "Add Didi to your home screen" banner; shows iOS-specific
  Share→Add to Home Screen instructions when `beforeinstallprompt` is
  unavailable. Dismissal persisted in localStorage.

### PWA layer

- `app/manifest.ts` (Next 16 metadata route): `name`/`short_name` Didi,
  `display: standalone`, `theme_color: #0b0910`, `background_color: #0b0910`,
  `start_url: /`, `orientation: portrait`, icons.
- App icons generated from `public/images/didi_favicon.png`: `icon-192.png`,
  `icon-512.png`, a maskable variant, and `apple-touch-icon.png` (180).
- `viewport` export in root layout: `viewport-fit=cover`, `themeColor`,
  `interactiveWidget: 'resizes-content'`.
- **Service worker** (`public/sw.js` + client registration): precache app
  shell + static assets, network-first for navigation/data with cached
  fallback, offline fallback page. Kept minimal and hand-written (no
  `next-pwa`); registration guarded to production. Verify against Next 16 docs.
- iOS standalone `<meta>`: `apple-mobile-web-app-capable`,
  `apple-mobile-web-app-status-bar-style: black-translucent`,
  `apple-mobile-web-app-title`.

### Context-aware bottom navigation

| Context | Tabs |
|---|---|
| Marketplace / landing | Home · Search · Orders¹ · Account² |
| Inside a kitchen (storefront) | Menu · Search · **Cart (badge)** · Info |
| Vendor dashboard | refine existing `components/layout/mobile-nav.tsx` |

¹ **Orders** = recent order-tracking links saved device-local (new helper in
`customer-prefs.ts`: `saveRecentOrder(slug, orderId, orderNumber)` /
`loadRecentOrders()`), opening `/[slug]/order/[orderId]`.
² **Account** = view/edit saved customer details, clear device data, install
prompt entry. Guest model preserved — no login introduced.

### Global layout fixes

- Root layout `app/layout.tsx`: add `viewport`/`themeColor`, ensure
  `viewport-fit=cover`, register SW, mount `InstallPrompt`.
- Use `100dvh`/`min-h-[100dvh]` instead of `100vh` so content is not hidden
  behind mobile browser chrome.
- Reuse existing safe-area + tap-target utilities consistently.

## Per-surface scope

1. **Landing / marketplace** (`app/page.tsx`, `components/marketplace/*`):
   - Rebuild `hero-search.tsx` mobile-first: full-width search pill on row 1;
     "Near me" chip + submit button on row 2 on mobile; single row on `sm:+`.
     Submit always visible, ≥44px target. (Fixes the screenshot bug.)
   - Fluid hero type scale, chip rail polish, kitchen-card tap/active states,
     mount marketplace `MobileTabBar`, bottom padding so content clears the bar.
2. **Storefront** (`components/storefront/storefront-menu.tsx`,
   `order-tracker.tsx`): category rail snap, item detail in `BottomSheet`,
   floating cart → cart `BottomSheet`, sticky header, storefront `MobileTabBar`.
3. **Checkout** (`app/(storefront)/[slug]/checkout/page.tsx`): mobile form
   ergonomics (proper input types/`inputmode`), sticky pay CTA above safe area,
   MoMo/card flow legible on small screens.
4. **Order tracking** (`app/(storefront)/[slug]/order/[orderId]/page.tsx`):
   mobile timeline, sticky status header; record into recent orders.
5. **Auth** (`app/(auth)/*`): mobile form layout, sticky submit, safe areas.
6. **Dashboard + admin** (`app/(dashboard)/*`, `app/admin/*`): refine
   `mobile-nav.tsx`; convert wide tables to stacked cards on mobile; safe areas.

## Phasing (each phase independently shippable & verifiable)

- **P0 — Foundations:** viewport/dvh in root layout; PWA (manifest, icons, SW,
  install prompt, iOS meta); `BottomSheet` + `MobileTabBar` primitives;
  `customer-prefs` recent-orders helpers.
- **P1 — Landing/marketplace:** search fix + full mobile polish + bottom nav.
- **P2 — Storefront:** menu, item sheet, cart sheet, bottom nav.
- **P3 — Checkout + order tracking.**
- **P4 — Auth.**
- **P5 — Dashboard + admin.**

## Testing / verification

- After each phase: `npm run build` (or `next build`) for the web app passes;
  `npm run lint` clean for touched files; `npm run type-check` passes.
- Manual mobile viewport check (~360–414px) on each touched surface: no
  horizontal overflow, primary CTA visible, nav/safe-area correct.
- PWA: manifest served, icons load, `display: standalone`, install prompt
  appears (Chrome) / iOS instructions path works, SW registers and offline
  fallback renders.
- Specifically verify the original bug: hero search submit button fully visible
  and tappable at 360px width.

## Out of scope

- Real customer accounts / server-side order history.
- Cross-kitchen global cart.
- Push notifications (separate WhatsApp/notifications work already exists).
- Unrelated refactors beyond what each touched file needs for the mobile pass.
