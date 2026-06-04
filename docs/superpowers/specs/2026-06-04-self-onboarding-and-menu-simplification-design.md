# Self-Onboarding + Menu Creation Simplification — Design Spec

**Date:** 2026-06-04
**Status:** Approved (design), pending implementation plan
**Owner:** Ebenezer Barning

## Problem

Restaurant owners struggle to self-onboard, undermining the product's core promise of simplicity. Two flows are the culprits:

1. **Signup** asks for too much before showing any value — including a Leaflet **map-pin**, city, cuisines, and description — which is high-friction on Ghana mobile. After signup the owner lands on a passive **4-link checklist** (menu, payments, branding, share) with no guided path.
2. **Menu item creation** opens one dense modal exposing every power feature at once (option groups, sub-options, min-quantity, price tiers, chop-bar, image, availability, featured) — overwhelming for the common case ("add Jollof, ₵45").

Goal: make both flows feel effortless for a non-technical kitchen owner, **without changing or removing any existing functionality**.

## Locked Decisions

1. **Onboarding model:** Minimal signup + an in-app **guided Setup Wizard**. Signup collects only email, phone, password, restaurant name. Everything else moves into a friendly, mostly-skippable post-signup wizard.
2. **Payments stays a required setup step** (not a skip-to-live-with-COD model). The wizard guides it and makes it as easy as possible.
3. **Menu add is simple by default**, with advanced features behind a "More options" accordion.

## Non-Negotiable Constraints

- **No functionality or data-flow changes.** Chop-bar, option groups/types, sub-options, price tiers, image upload, Paystack subaccount, marketplace geo "near me", operating hours, default categories — all keep working exactly as today. This is flow/UX restructuring only.
- **Deferred fields stay fully functional**, just collected later: city, cuisines, description, and location lat/lng move from signup into the wizard (and remain editable in existing settings). Marketplace "near me" still works once location is set.
- **Mobile-first** (Ghana mobile). Preserve existing safe-area + 16px input-zoom handling and the redesign design language (canvas, hairline, card depth, primitives).
- **Next.js is a non-standard fork** — read `node_modules/next/dist/docs/` before touching Next APIs.

## Current State (relevant)

- `app/(auth)/register/page.tsx` — 2-step signup. Step 1: email/phone/password. Step 2: restaurantName, description, **city (select), cuisines (multiselect), LocationPicker map-pin**. Posts to `/api/auth/register`, then shows a success screen and redirects to `/dashboard`.
- `app/api/auth/register/route.ts` — creates auth user, unique slug, **tenant** (with city/cuisines/location), `tenant_members` (owner), sets `app_metadata.tenant_id`, seeds **3 default categories** + **operating hours**. Returns `{ tenant, storefront_url }`.
- `components/dashboard/setup-checklist.tsx` — passive 4-step checklist on the dashboard (menu/payments/branding/share), a "Add a sample menu for me" seeder, and a "store is live" banner. Reads done-state from props computed in `dashboard/page.tsx`.
- `app/(dashboard)/menu/page.tsx` (~1888 lines) — menu management with an **item modal** exposing: name, price, category, description, featured, available, image upload, chop-bar toggle, and an option builder (option_type soup/protein/extra, sub-options, min_quantity, price_tiers). Has a dish-preset picker and integrates with the sample seed.
- `components/onboarding/location-picker.tsx` — Leaflet map pin (reused by register today; will be reused by the wizard).
- Design primitives exist: `components/ui/{button,card,badge,field,skeleton,empty-state}.tsx`; tokens (canvas, hairline, shadow-card, motion) in `globals.css`.

## A. Onboarding Redesign

### A1. Trimmed signup — `app/(auth)/register/page.tsx`

- Collapse to a **single short step**: email, phone, password, restaurant name. Remove the city select, cuisines multiselect, description, and the LocationPicker from signup.
- On submit, POST to `/api/auth/register` with `city/cuisines/description/locationLat/locationLng` omitted (or null). On success, redirect to **`/welcome`** (the wizard) instead of `/dashboard`.
- Keep the brand mark, validation (password ≥ 6), and error handling.

### A2. Register API — `app/api/auth/register/route.ts`

- No behavior change required: it already tolerates null `description/city/location` and an empty `cuisines` array. Verify it stores nulls gracefully (it does). The default categories + operating-hours seeding stays.

### A3. Setup Wizard — new `app/(dashboard)/welcome/page.tsx` (+ step components in `components/onboarding/`)

A focused, full-screen, single-action-per-screen wizard with a progress indicator and a persistent "Skip for now / I'll do this later" affordance on optional steps. Steps:

1. **Add your first dish** — embeds the new **simple add** (name + price + optional photo) and a prominent **"Add a sample Ghanaian menu"** (reuse the existing seeder logic from `setup-checklist.tsx`, extracted into a shared helper so both call it). Completing = ≥1 menu item exists.
2. **Turn on payments** *(required)* — guided Paystack connect. Reuse the existing payments settings flow/components; present it with clear, friendly bank-detail help and a "why we need this" line. Completing = `paystack_subaccount_code` set.
3. **Brand your store** *(optional, skippable)* — logo upload + primary color (reuse branding settings components).
4. **Where are you?** *(optional, skippable)* — city select, cuisines multiselect, and the **LocationPicker map-pin** (moved here from signup). Writes `city/cuisines/location_lat/location_lng` to the tenant via the existing update path. Powers marketplace "near me".
5. **You're live** — show the storefront link + copy + QR/share (reuse share logic). CTA to the dashboard.

The wizard reads/writes the same tenant + menu tables as today; it is an orchestration layer over existing capabilities, not new business logic. Each step shows done/required/optional state and lets the user jump to the dashboard at any time.

### A4. Dashboard checklist — `components/dashboard/setup-checklist.tsx`

- Keep it as the **passive progress tracker** for owners who skip or leave the wizard. Add a single "Resume setup" link to `/welcome`. No duplication of logic — both wizard and checklist derive done-state from the same fields and share the sample-seed helper.

### A5. Shared seed helper

Extract the sample-menu seeding (currently inline in `setup-checklist.tsx`) into `lib/onboarding/sample-menu.ts` (`SAMPLE_MENU` data + `seedSampleMenu(supabase, tenantId)`), used by both the checklist and the wizard. Pure move — identical behavior + the existing 0-item guard.

## B. Menu Creation Simplification

### B1. Item modal — `app/(dashboard)/menu/page.tsx`

- **Default (collapsed) view:** Name, Price, Photo (optional), Category (defaults to the first/active category). A primary "Save dish" button. This covers the common dish in one tap.
- **"▾ More options" accordion** (collapsed by default) contains everything advanced, unchanged: description, availability toggle, featured toggle, **chop-bar toggle**, and the full option builder (types, sub-options, min-qty, price tiers).
- **Editing** an item that already has a description/options/chop-bar/etc. **auto-expands** the accordion so nothing is hidden from existing items.
- All existing state, handlers, validation, image upload, option logic, and save payload are unchanged — this is layout/disclosure restructuring only.
- Keep the dish-preset picker and sample-seed entry points prominent.

## Data Flow

- Signup → `/api/auth/register` (fewer fields) → tenant created → redirect `/welcome`.
- Wizard steps write to the same tables/endpoints as the corresponding settings pages (menu items, tenant branding/location/cuisines, Paystack subaccount). No new business endpoints; reuse existing ones.
- Done-state for wizard + checklist both derive from: `menu_items` count, `paystack_subaccount_code`, `logo_url`, location/`order`-share — same as `dashboard/page.tsx` computes today.

## Error / Edge States

- Wizard reachable only when authenticated with a tenant (same guard as the dashboard layout). If a tenant already completed everything, `/welcome` shows the "you're live" step.
- Each optional step is skippable; required step (payments) is clearly marked but the user can still leave to the dashboard and resume later.
- Menu simple-add validation identical to today (name + price required); advanced fields validate only when the accordion is used.

## Verification

- `npx tsc --noEmit` clean; `npm run build` succeeds; `npx vitest run` still 41 passing (no business logic touched).
- Manual: new signup → lands in wizard → add sample menu → connect payments → (skip optional) → live; existing dish edit still shows all advanced config; chop-bar item create/edit unchanged; marketplace "near me" still works after the location step sets coords.

## Build Sequence (high level; detailed in the plan)

1. Extract `sample-menu.ts` helper; point `setup-checklist.tsx` at it (no behavior change).
2. Menu modal: collapse to simple-by-default + "More options" accordion (auto-expand on edit).
3. Trim signup fields; redirect to `/welcome`.
4. Build the Setup Wizard (`/welcome`) reusing menu/payments/branding/location components.
5. Add "Resume setup" to the dashboard checklist.
6. Verify end-to-end.

## Known Risks

- **Hiding advanced menu fields** must not hide config on existing items → auto-expand on edit when any advanced field is set.
- **Deferring location** must not break marketplace "near me" → the wizard's location step writes the same coords the signup pin used to; until set, "near me" simply lacks that tenant (same as a tenant who skipped the pin today).
- **Wizard ≠ new source of truth** → it orchestrates existing endpoints; the checklist remains the durable progress indicator so no state divergence.
