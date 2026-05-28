# Onboarding "Get Your Store Live" Checklist — Design

**Date:** 2026-05-28
**Status:** Approved (pending spec review)

## Goal

Bridge the gap between merchant signup and a live, order-ready storefront.
Today, registration creates a tenant with default categories + hours and drops
the merchant on an empty dashboard with no guidance. New merchants don't know
they still need to add dishes, connect payments, and share their link.

Make the path to "live" obvious, simple, and user-friendly — without blocking
anyone or adding new routes/wizards.

## Non-Goals

- No full-screen wizard or `/onboarding` route.
- No changes to the registration API or auth flow.
- No new payment/branding logic — just link to the pages that already do it.

## Approach

A single **"Get your store live" card** rendered at the top of the dashboard.
It auto-detects which setup steps are done from real data, shows progress, and
removes itself once the store is fully set up. Each step links to the existing
page that performs the work.

This is the simplest effective shape: zero new routes, no duplicated page
logic, non-blocking, and it never nags an already-live store.

## Steps (4)

| # | Label                  | Links to             | Done when                                   |
|---|------------------------|----------------------|---------------------------------------------|
| 1 | Add your first dish    | `/menu`              | `menu_items` count > 0 for tenant           |
| 2 | Turn on payments       | `/settings/payments` | `tenants.paystack_subaccount_code` is set   |
| 3 | Brand your store       | `/settings/branding` | `tenants.logo_url` is set                   |
| 4 | Share your link        | `/share`             | `orders` count > 0 for tenant               |

Step 1 also offers a **"Add sample menu"** button when the merchant has zero
items: one tap seeds ~8 common Ghanaian dishes into the existing default
categories so the storefront isn't empty. Merchant edits/deletes afterward.

## Architecture

**Server (`app/(dashboard)/dashboard/page.tsx`)** — already a server component
doing queries. Extend it to:
- Select `slug, paystack_subaccount_code, logo_url` from the tenant (currently
  it only reads `tenant_id` from `tenant_members`).
- Add one `menu_items` count query (head/exact) to the existing
  `Promise.all`. The orders count for step 4 reuses `totalOrders` is today-only,
  so add a separate all-time orders `head` count (cheap).
- Compute 4 booleans + the tenant slug, pass them to `<SetupChecklist>`.
- Render `<SetupChecklist>` above the stats grid. If all 4 booleans are true,
  the component renders nothing (or the dismissible "live" banner — see below).

**Client island (`components/dashboard/setup-checklist.tsx`)** — `'use client'`.
Props: `{ steps: {menuDone, paymentsDone, brandingDone, shareDone}, slug, hasMenuItems }`.
Handles the three interactive bits:
- **Sample menu seed:** when `!hasMenuItems`, show the "Add sample menu" button.
  On click, use `createBrowserClient()` (same RLS pattern as the menu page) to
  fetch the tenant's `menu_categories`, insert ~8 mapped dishes, then
  `router.refresh()`. Disabled/spinner while running.
- **Copy storefront link:** in the all-done banner, copy `${origin}/${slug}`.
- **Dismiss:** the all-done "🎉 You're live!" banner is dismissible; store the
  flag in `localStorage` (`didi:setup-dismissed`) so it stays gone.

While not all done: render the checklist (progress bar `X of 4 done`, one row
per step — icon + label, green check if done, else an arrow link to the page).
When all 4 done and not dismissed: render the green live banner with copy-link.
When all done and dismissed: render nothing.

## Sample dish data (seeded client-side)

Mapped into the three default categories created at registration:

- **Main Dishes:** Jollof Rice w/ Chicken ₵45, Waakye Special ₵35,
  Banku w/ Tilapia ₵50, Fried Rice w/ Chicken ₵45
- **Sides & Extras:** Kelewele ₵15, Fried Plantain ₵12
- **Drinks:** Sobolo ₵10, Bottled Water ₵5

Insert maps each dish to the category by name. If a category is missing
(merchant renamed/deleted defaults), fall back to the first available category.
Guard: only seed when the merchant currently has 0 items (button only shows
then anyway, but re-check before insert to avoid double-seed on double-click).

## Error handling

- Server count/select failures: the dashboard already has a try/catch fatal
  fallback. Treat a failed checklist query as "step not done" rather than
  crashing — wrap checklist data derivation so a null result = false, never throw.
- Sample seed insert failure: show inline error text in the card, keep button
  enabled to retry. No partial-state worry — inserts are independent rows;
  re-running with 0 items is the only guarded path.

## Testing

No test suite exists in the repo. Verification will be manual via the running
app (typecheck must stay clean): brand-new tenant shows 4 open steps + sample
button; seeding flips step 1 and populates storefront; completing each step
flips its check; all-done shows the live banner; dismiss persists across reload.

## Files

- **Modify:** `apps/web/app/(dashboard)/dashboard/page.tsx` — extra queries +
  render checklist.
- **Create:** `apps/web/components/dashboard/setup-checklist.tsx` — client island.
