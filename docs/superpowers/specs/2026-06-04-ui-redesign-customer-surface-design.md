# UI Redesign — Design Language + Customer Ordering Surface (Slice 1)

**Date:** 2026-06-04
**Status:** Approved (design), pending implementation plan
**Owner:** Ebenezer Barning

## Goal

Elevate the app's UI to a clean, sleek, modern "refined warm premium" look. Establish a shared design language (tokens + primitives), then apply it first to the customer ordering surface (storefront, checkout, order tracker). The restaurant portal, admin, auth, and marketplace home are later slices using the same language.

## Locked Decisions

1. **Aesthetic:** Refined warm premium — keep brand orange `#FF6B35` + light base; elevate with stronger type-scale contrast, generous whitespace, layered soft shadows + hairline borders, `rounded-2xl` cards, tasteful micro-motion, image-forward storefront.
2. **Dashboard theme:** Light, elevated (no dark mode). Applies to the later portal slice.
3. **Order:** Shared design system → customer ordering pages first → restaurant portal later.

## Non-Negotiable Constraints

- **Do not change behavior or data flow.** This is visual/structural only. All existing props, fetches, cart logic, checkout submission, payment, realtime, and tracker polling must keep working unchanged.
- **Mobile-first.** Primary users are on Ghana mobile. Every page must be excellent at 360–414px wide first, then scale up. Preserve existing safe-area + 16px input-zoom handling.
- **Tenant branding preserved.** Each storefront themes its accent from the tenant `primary_color` (passed as a CSS var / inline style as today). Primitives must accept a brand color override so per-restaurant theming still works.
- **PWA + performance.** Keep `next/image` usage where present, lazy-load heavy bits, avoid layout shift, keep bundle lean. No heavy animation libs — use CSS + the existing keyframes.
- **Next.js is a non-standard fork** — read `node_modules/next/dist/docs/` before touching Next APIs.

## Current State (relevant)

- Design tokens in `app/globals.css` `@theme`: brand orange ramp, `surface` zinc ramp, semantic colors, Inter/Outfit fonts, soft shadows, radii. Existing animation keyframes: `fadeIn`, `fadeInScale`, `slideUp`, `slideDown`, `pulse-soft`, `shimmer`, `spin-slow`; badge utility classes per order status.
- Customer surface:
  - `app/(storefront)/[slug]/page.tsx` (126 lines) — storefront entry.
  - `app/(storefront)/[slug]/layout.tsx` (167 lines) — storefront shell/branding.
  - `components/storefront/storefront-menu.tsx` (1084 lines) — menu, item cards, cart drawer, chop-bar customizer. **Oversized; split during redesign** (see below).
  - `components/storefront/order-tracker.tsx` (613 lines) — order status timeline + chat.
  - `app/(storefront)/[slug]/checkout/page.tsx` — checkout (recently reworked for delivery/pin/ETA).

## A. Design Language

### A1. Token additions (`app/globals.css`)

- Warm page background: add `--color-canvas: #FCFBFA` (use for storefront/page backgrounds instead of flat `surface-50`).
- Layered shadows (ambient + key) for cards, e.g. `--shadow-card: 0 1px 2px rgb(0 0 0/0.04), 0 8px 24px -12px rgb(0 0 0/0.12)`; `--shadow-card-hover` slightly stronger.
- Hairline border token: `--color-hairline: rgb(0 0 0 / 0.06)`.
- Type-scale utility classes (display vs body) documented in globals; titles use `--font-display` (Outfit) tracking-tight.
- Motion tokens: standard duration `--ease-out-quick: 180ms cubic-bezier(0.4,0,0.2,1)`.

These are **additive** — existing tokens stay so the un-redesigned portal pages keep working.

### A2. Shared primitives — `apps/web/components/ui/`

Small, focused, composable, brand-color-aware. Each is presentational (no data fetching):

| Component | Responsibility | Key props |
|---|---|---|
| `button.tsx` | All buttons | `variant: 'primary'|'secondary'|'ghost'|'danger'`, `size`, `loading`, `brandColor?` |
| `card.tsx` | Surface container | `as`, `interactive?` (hover lift), `padding` |
| `badge.tsx` | Status/labels | `tone: 'brand'|'success'|'warning'|'error'|'info'|'neutral'` |
| `field.tsx` | Labeled input/textarea/select wrapper | `label`, `hint`, `error`, `brandColor?` |
| `skeleton.tsx` | Loading placeholders | `className` (uses `shimmer`) |
| `empty-state.tsx` | Zero-data states | `icon`, `title`, `description`, `action?` |

Existing `components/ui/bottom-sheet.tsx`, `mobile-tab-bar.tsx`, `install-prompt.tsx` are reused (restyled if needed). The new primitives are introduced now and used by the customer surface; the portal slice will adopt them later. Buttons/inputs accept a `brandColor` so storefronts theme correctly.

### A3. Motion & states

- Cards/buttons: hover lift + shadow grow, press `scale-[0.98]`, all `--ease-out-quick`.
- Page/section mount: `animate-fade-in` / `animate-slide-up` (existing).
- Loading: skeletons (no spinners for content areas; spinners only for button-local actions).
- Respect `prefers-reduced-motion` (add a global media query that disables transforms/animations).

## B. Customer Ordering Surface (Slice 1 scope)

### B1. Storefront shell — `[slug]/layout.tsx`

Shared header (compact, sticky, branded), content container with `canvas` bg, footer ("Powered by Didi" + `ghdidi.com`). Branding (logo, name, primary color) wired as today.

### B2. Storefront page + menu — `[slug]/page.tsx` + `storefront-menu.tsx`

- **Hero:** cover image with gradient scrim, logo chip, name, rating, open/closed pill, cuisine + delivery/min-order summary. Collapses gracefully when no cover.
- **Category nav:** sticky, horizontally scrollable chips; active state branded; scroll-spy to sections.
- **Menu item card:** image-forward, name, short description (clamped), price, quick-add button with add motion; chop-bar items show "Customize". Clear sold-out treatment.
- **Cart:** sticky bottom bar (count + total + View cart) → bottom sheet/drawer with line items, qty steppers, subtotal, checkout CTA.
- **Refactor:** split `storefront-menu.tsx` (1084 lines) into focused files: `menu-hero.tsx`, `category-nav.tsx`, `menu-item-card.tsx`, `cart-drawer.tsx`, `chop-bar-customizer.tsx`, with `storefront-menu.tsx` as the orchestrator. **No behavior change** — pure structural split + restyle. Cart logic (`use-cart`) and chop-bar pricing untouched.

### B3. Checkout — `[slug]/checkout/page.tsx`

Restyle only (logic already correct): sectioned cards (Your details / Delivery / Payment / Summary), refined inputs via `field.tsx`, clearer delivery-option toggle, ETA + fee-breakdown styled, premium sticky pay bar. Keep all state, the resolver-driven fee, pin/map block, and submit payload exactly as-is.

### B4. Order tracker — `order-tracker.tsx`

- Status hero (big current-state + order number + ETA/arrival).
- Animated vertical timeline (placed → confirmed → preparing → ready → out-for-delivery/pickup → delivered), with done/active/upcoming states and subtle progress motion.
- Order summary card (items, totals, payment, address).
- Contact actions (call/WhatsApp), and the existing chat thread restyled.
- Keep polling, payment verify-on-poll, and realtime behavior unchanged.

## C. Error / Edge States

- Loading: skeleton hero + skeleton menu cards; skeleton tracker timeline.
- Empty cart, sold-out items, closed restaurant, not-deliverable area, order-not-found — all use `empty-state.tsx` styling, consistent.
- Image fallbacks: branded placeholder when no cover/logo/item image.

## D. Out of Scope (this slice)

Restaurant portal (dashboard, orders, menu mgmt, customers, payments, analytics, share, settings), admin, auth, `for-restaurants`, marketplace home, `offline`. They keep working on existing tokens until their slice.

## E. Verification

- `npx tsc --noEmit` clean; `npm run build` succeeds.
- Manual: storefront, checkout, tracker render correctly at 375px and desktop; add-to-cart, checkout submit, payment redirect, tracker live updates all still work (behavior unchanged).
- Visual review of the storefront flagship page before propagating to checkout + tracker.
- `prefers-reduced-motion` disables transforms.

## F. Build Sequence (high level; detailed in the plan)

1. Token additions + motion/reduced-motion utilities (`globals.css`).
2. Shared primitives (`components/ui/*`).
3. Storefront layout shell.
4. Storefront page + menu split & restyle (flagship — review gate here).
5. Checkout restyle.
6. Order tracker restyle.
7. Build + manual verification.

## Known Risks

- `storefront-menu.tsx` split is the riskiest step (large file, cart + chop-bar logic). Mitigate: split first with zero style change, verify behavior, then restyle.
- Per-tenant brand color must thread through new primitives — verify a non-orange tenant still themes correctly.
