# UI Redesign — Customer Ordering Surface (Slice 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (recommended here — the page restyles are visual and reviewed together) or superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Apply a "refined warm premium" design language to the customer ordering surface (storefront, checkout, order tracker) via shared tokens + primitives, without changing any behavior or data flow.

**Architecture:** Add additive design tokens + a small set of brand-color-aware UI primitives, then restyle the storefront (splitting the 1084-line menu component first with zero style change, verifying behavior, then restyling), checkout, and order tracker. Tenant `primary_color` continues to theme each storefront.

**Tech Stack:** Next.js (App Router, non-standard fork — read `node_modules/next/dist/docs/`), React client components, Tailwind v4 (`@theme` in `app/globals.css`), lucide-react, existing CSS keyframes.

Spec: `docs/superpowers/specs/2026-06-04-ui-redesign-customer-surface-design.md`

**Discipline for every task:** behavior/data unchanged. Verify with `npx tsc --noEmit` after each task; `npm run build` at the end. The flagship review gate is after Task 4 (storefront) — stop and let the user look before checkout/tracker.

---

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `app/globals.css` | New tokens (canvas, card shadow, hairline, motion) + reduced-motion + helper utilities | 1 |
| `components/ui/button.tsx` | Button primitive (variants, loading, brandColor) | 2 |
| `components/ui/card.tsx` | Surface card (interactive lift) | 2 |
| `components/ui/badge.tsx` | Status/label badge (tones) | 2 |
| `components/ui/field.tsx` | Labeled input/textarea/select wrapper | 2 |
| `components/ui/skeleton.tsx` | Shimmer loading placeholder | 2 |
| `components/ui/empty-state.tsx` | Zero-data state | 2 |
| `app/(storefront)/[slug]/layout.tsx` | Storefront shell (header/footer/canvas) | 3 |
| `app/(storefront)/[slug]/page.tsx` | Hero + restaurant info | 4 |
| `components/storefront/menu-hero.tsx` | Cover/logo/name/rating hero (split out) | 4 |
| `components/storefront/category-nav.tsx` | Sticky category chips + scroll-spy (split out) | 4 |
| `components/storefront/menu-item-card.tsx` | Menu item card + quick-add (split out) | 4 |
| `components/storefront/cart-drawer.tsx` | Cart bottom sheet (split out) | 4 |
| `components/storefront/chop-bar-customizer.tsx` | Chop-bar modal (split out) | 4 |
| `components/storefront/storefront-menu.tsx` | Orchestrator after split | 4 |
| `app/(storefront)/[slug]/checkout/page.tsx` | Checkout restyle | 5 |
| `components/storefront/order-tracker.tsx` | Tracker restyle | 6 |

---

## Task 1: Design tokens + motion utilities

**Files:** Modify `app/globals.css`

- [ ] **Step 1: Add tokens to the `@theme` block**

In `app/globals.css`, inside `@theme { ... }`, after the radius tokens add:
```css
  /* ─── Redesign additions ────────────────────────────────── */
  --color-canvas: #FCFBFA;
  --color-hairline: rgba(0, 0, 0, 0.06);
  --shadow-card: 0 1px 2px rgb(0 0 0 / 0.04), 0 8px 24px -12px rgb(0 0 0 / 0.12);
  --shadow-card-hover: 0 2px 4px rgb(0 0 0 / 0.05), 0 16px 32px -14px rgb(0 0 0 / 0.16);
  --ease-quick: cubic-bezier(0.4, 0, 0.2, 1);
```

- [ ] **Step 2: Add helper utilities + reduced-motion (after the existing animation utilities)**

Append near the other utility classes:
```css
/* Redesign helpers */
.bg-canvas { background-color: var(--color-canvas); }
.border-hairline { border-color: var(--color-hairline); }
.shadow-card { box-shadow: var(--shadow-card); }
.shadow-card-hover { box-shadow: var(--shadow-card-hover); }
.press { transition: transform 180ms var(--ease-quick); }
.press:active { transform: scale(0.97); }
.lift { transition: box-shadow 180ms var(--ease-quick), transform 180ms var(--ease-quick); }
.lift:hover { box-shadow: var(--shadow-card-hover); transform: translateY(-2px); }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
    scroll-behavior: auto !important;
  }
}
```

- [ ] **Step 3: Verify**

Run: `cd apps/web && npx tsc --noEmit` (CSS doesn't type-check, but confirms nothing else broke) then `npm run build` once at the end of the task to confirm Tailwind compiles the new utilities.
Expected: build succeeds.

- [ ] **Step 4: Commit**
```bash
git add apps/web/app/globals.css
git commit -m "feat(ui): redesign tokens (canvas, card shadow, hairline) + motion helpers"
```

---

## Task 2: Shared UI primitives

**Files:** Create `components/ui/button.tsx`, `card.tsx`, `badge.tsx`, `field.tsx`, `skeleton.tsx`, `empty-state.tsx`

- [ ] **Step 1: Button**

Create `apps/web/components/ui/button.tsx`:
```tsx
'use client';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  brandColor?: string;
}

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-xs rounded-lg gap-1.5',
  md: 'h-11 px-5 text-sm rounded-xl gap-2',
  lg: 'h-14 px-6 text-base rounded-2xl gap-2',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  brandColor,
  className,
  children,
  disabled,
  style,
  ...props
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center font-semibold press select-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer';
  const brand = brandColor || '#FF6B35';
  const variantClass =
    variant === 'secondary'
      ? 'bg-white text-surface-800 border border-hairline hover:bg-surface-50'
      : variant === 'ghost'
      ? 'bg-transparent text-surface-600 hover:bg-surface-100'
      : variant === 'danger'
      ? 'bg-error-600 text-white hover:bg-error-700'
      : 'text-white shadow-sm hover:brightness-105';
  const brandStyle =
    variant === 'primary'
      ? { backgroundImage: `linear-gradient(135deg, ${brand}, ${brand}dd)`, ...style }
      : style;
  return (
    <button
      className={cn(base, sizes[size], variantClass, className)}
      style={brandStyle}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
}
```

- [ ] **Step 2: Card**

Create `apps/web/components/ui/card.tsx`:
```tsx
import { cn } from '@/lib/utils';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const pads = { none: '', sm: 'p-3', md: 'p-5', lg: 'p-6' } as const;

export function Card({ interactive, padding = 'md', className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'bg-white rounded-2xl border border-hairline shadow-card',
        interactive && 'lift cursor-pointer',
        pads[padding],
        className
      )}
      {...props}
    />
  );
}
```

- [ ] **Step 3: Badge**

Create `apps/web/components/ui/badge.tsx`:
```tsx
import { cn } from '@/lib/utils';

type Tone = 'brand' | 'success' | 'warning' | 'error' | 'info' | 'neutral';

const tones: Record<Tone, string> = {
  brand: 'bg-brand-500/10 text-brand-600',
  success: 'bg-success-500/10 text-success-600',
  warning: 'bg-warning-500/10 text-warning-600',
  error: 'bg-error-500/10 text-error-600',
  info: 'bg-info-500/10 text-info-600',
  neutral: 'bg-surface-100 text-surface-600',
};

export function Badge({
  tone = 'neutral',
  className,
  ...props
}: { tone?: Tone } & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold',
        tones[tone],
        className
      )}
      {...props}
    />
  );
}
```

- [ ] **Step 4: Field**

Create `apps/web/components/ui/field.tsx`:
```tsx
'use client';
import { cn } from '@/lib/utils';

interface FieldProps {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function Field({ label, htmlFor, hint, error, optional, children, className }: FieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-surface-700">
        {label}
        {optional && <span className="text-surface-400 font-normal"> (optional)</span>}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-error-600">{error}</p>
      ) : hint ? (
        <p className="text-xs text-surface-400">{hint}</p>
      ) : null}
    </div>
  );
}

export const fieldInputClass =
  'w-full px-4 py-3 rounded-xl border border-hairline bg-white text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 transition-all text-sm';
```

- [ ] **Step 5: Skeleton + EmptyState**

Create `apps/web/components/ui/skeleton.tsx`:
```tsx
import { cn } from '@/lib/utils';

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('rounded-xl bg-surface-200/60 relative overflow-hidden', className)}
      style={{
        backgroundImage:
          'linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.4s ease-in-out infinite',
      }}
    />
  );
}
```

Create `apps/web/components/ui/empty-state.tsx`:
```tsx
import { cn } from '@/lib/utils';

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('text-center py-12 px-6', className)}>
      {icon && (
        <div className="w-14 h-14 rounded-2xl bg-surface-100 flex items-center justify-center mx-auto mb-4 text-surface-400">
          {icon}
        </div>
      )}
      <p className="font-semibold text-surface-900">{title}</p>
      {description && <p className="text-sm text-surface-500 mt-1">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
```

- [ ] **Step 6: Verify `shimmer` keyframe exists**

Run: `grep -n "@keyframes shimmer" apps/web/app/globals.css`
Expected: a match (already defined). If the shimmer keyframe doesn't animate `background-position`, the Skeleton still renders statically — acceptable.

- [ ] **Step 7: Type-check + commit**
```bash
cd apps/web && npx tsc --noEmit
git add apps/web/components/ui/button.tsx apps/web/components/ui/card.tsx apps/web/components/ui/badge.tsx apps/web/components/ui/field.tsx apps/web/components/ui/skeleton.tsx apps/web/components/ui/empty-state.tsx
git commit -m "feat(ui): shared primitives (Button, Card, Badge, Field, Skeleton, EmptyState)"
```

---

## Task 3: Storefront shell (layout)

**Files:** Modify `app/(storefront)/[slug]/layout.tsx`

- [ ] **Step 1: Read the current layout**

Run: `sed -n '1,167p' "apps/web/app/(storefront)/[slug]/layout.tsx"` to capture the current header/branding/footer structure and props.

- [ ] **Step 2: Restyle the shell (no behavior change)**

Keep all data fetching, branding cache, and props identical. Apply: `bg-canvas` page background; a compact sticky top header (logo chip + restaurant name + a cart/▾ affordance if present) with `backdrop-blur` and `border-hairline`; max-width container `max-w-lg mx-auto`; a slim footer ("Powered by Didi · ghdidi.com"). Use the tenant primary color for accents via the existing branding value. Do not remove existing providers (cart/branding).

- [ ] **Step 3: Verify**

Run: `cd apps/web && npx tsc --noEmit`
Expected: clean. Manually confirm the storefront still renders with header + content.

- [ ] **Step 4: Commit**
```bash
git add "apps/web/app/(storefront)/[slug]/layout.tsx"
git commit -m "feat(ui): premium storefront shell (sticky header, canvas bg, footer)"
```

---

## Task 4: Storefront hero + menu (split first, then restyle) — FLAGSHIP

**Files:** as listed in File Structure.

- [ ] **Step 1: Split `storefront-menu.tsx` with ZERO style change**

Read `components/storefront/storefront-menu.tsx` fully. Extract, verbatim (move code, don't restyle yet), into new files:
- `menu-hero.tsx` — the cover/logo/name/info header.
- `category-nav.tsx` — the category chips + scroll-spy logic.
- `menu-item-card.tsx` — a single menu item card + add/customize button.
- `cart-drawer.tsx` — the cart drawer/sheet.
- `chop-bar-customizer.tsx` — the chop-bar modal (`ChopBarCustomizer`).

`storefront-menu.tsx` becomes the orchestrator importing these. Keep every prop, state, handler, and the `use-cart` integration unchanged.

- [ ] **Step 2: Verify the split changed nothing**

Run: `cd apps/web && npx tsc --noEmit`
Expected: clean. Manually: add-to-cart, qty change, chop-bar customize, open cart, proceed to checkout — all behave exactly as before.

- [ ] **Step 3: Commit the split**
```bash
git add apps/web/components/storefront/
git commit -m "refactor(storefront): split storefront-menu into focused components (no behavior change)"
```

- [ ] **Step 4: Restyle the hero (`menu-hero.tsx` + `page.tsx`)**

Cover image with bottom gradient scrim; overlapping logo chip (rounded-2xl, ring); restaurant name in display font; a row of `Badge`s (rating ⭐, open/closed, delivery/min-order, pickup); description clamped to 2 lines. Branded accent from `primary_color`. Graceful no-cover fallback (brand tint banner). Use `next/image` if already used; otherwise keep `<img>` with `loading="lazy"`.

- [ ] **Step 5: Restyle the category nav (`category-nav.tsx`)**

Sticky under the header; horizontally scrollable pill chips; active chip uses the brand color (filled) others `surface-100`; keep the existing scroll-spy/active logic.

- [ ] **Step 6: Restyle menu item cards (`menu-item-card.tsx`)**

Image-left or image-top card using `Card`; name (semibold), description (clamped, `text-surface-500`), price (display font), and a circular quick-add button (brand) with a press + add micro-animation; chop-bar items show a "Customize" `Button` (secondary). Sold-out: dim + "Sold out" `Badge`, disabled add.

- [ ] **Step 7: Restyle cart bar + drawer (`cart-drawer.tsx`)**

Sticky bottom cart bar (count + total + "View cart") with safe-area padding; drawer uses the existing `bottom-sheet` styling — line items with qty steppers, subtotal, and a brand `Button` to checkout. Empty cart uses `EmptyState`.

- [ ] **Step 8: Restyle the chop-bar customizer (`chop-bar-customizer.tsx`)**

Cleaner sheet: title, base price, option groups with clear selected states (brand ring), running total, sticky add button. Keep the pricing logic (`customBowl.basePrice` + options) byte-for-byte.

- [ ] **Step 9: Loading + empty states**

Add a skeleton hero + skeleton item cards for the menu's loading state (if any client loading exists); closed-restaurant and no-items use `EmptyState`.

- [ ] **Step 10: Verify + commit + REVIEW GATE**

Run: `cd apps/web && npx tsc --noEmit && npm run build`
Expected: build succeeds.
```bash
git add apps/web/components/storefront/ "apps/web/app/(storefront)/[slug]/page.tsx"
git commit -m "feat(ui): redesign storefront hero, category nav, menu cards, cart"
```
**STOP. This is the flagship review gate.** Ask the user to look at the storefront before continuing to checkout/tracker. Apply any direction adjustments here, then propagate the same patterns forward.

---

## Task 5: Checkout restyle

**Files:** Modify `app/(storefront)/[slug]/checkout/page.tsx`

- [ ] **Step 1: Restyle only (no logic change)**

Wrap each section (Your details / Delivery option / Payment / Summary) in `Card`s. Replace raw inputs with `Field` + `fieldInputClass` (keep the brand `--tw-ring-color` style). Make the delivery/pickup toggle a segmented control; payment methods become selectable `Card`-like tiles with the brand ring on selection. Style the ETA + fee-breakdown lines. Keep the sticky pay bar but use `Button size="lg"`. Do NOT touch: state, `resolveDeliveryFee` usage, the pin/map block, `notDeliverable` logic, `handleSubmit` body, or the request payload.

- [ ] **Step 2: Verify + commit**

Run: `cd apps/web && npx tsc --noEmit`
Expected: clean. Manually: fee/ETA still compute, submit still redirects to payment / order page.
```bash
git add "apps/web/app/(storefront)/[slug]/checkout/page.tsx"
git commit -m "feat(ui): redesign checkout (sectioned cards, fields, premium pay bar)"
```

---

## Task 6: Order tracker restyle

**Files:** Modify `components/storefront/order-tracker.tsx`

- [ ] **Step 1: Read the current tracker** to capture status steps, polling, payment-verify, and chat logic.

- [ ] **Step 2: Restyle (no behavior change)**

Status hero card (big current status label + order number + ETA/arrival). Replace the timeline with a premium vertical stepper: each step has a node (done = filled brand/success check, active = pulsing brand ring via `pulse-soft`, upcoming = `surface-200`) and a connecting line; label + timestamp. Order summary in a `Card` (items, totals, payment, address). Contact actions as `Button`s (call / WhatsApp). Restyle the chat thread (bubbles, brand for restaurant side). Keep polling, payment verify-on-poll, realtime, and chat send logic unchanged.

- [ ] **Step 3: Verify + commit**

Run: `cd apps/web && npx tsc --noEmit && npm run build`
Expected: build succeeds.
```bash
git add apps/web/components/storefront/order-tracker.tsx
git commit -m "feat(ui): redesign order tracker (status hero, animated timeline, chat)"
```

---

## Final Verification

- [ ] `cd apps/web && npx tsc --noEmit` clean.
- [ ] `cd apps/web && npm run build` succeeds (all routes compile).
- [ ] `npx vitest run` still 41 passing (no logic touched).
- [ ] Manual at 375px + desktop: storefront browse → add to cart → checkout → pay → order tracker, all functioning; a non-orange tenant still themes its accent.

---

## Notes for the Implementer

- **Behavior is sacred.** Every task is visual/structural. If a restyle requires touching logic, stop — that's out of scope for this slice.
- **Split before restyle** (Task 4) so any behavior regression is caught while the diff is still a pure move.
- **Brand color threads through** `Button`/`Field` via `brandColor`/inline style and via `--tw-ring-color`. Test with a tenant whose `primary_color` isn't `#FF6B35`.
- The restyle tasks are intentionally directive (not full final JSX) because the files are large and depend on reading current markup; follow the design language in Task 1–2 and the spec. Read each file before editing.
