# Didi Mobile-App Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every Didi surface highly mobile-friendly and feel like a native mobile app (installable PWA, bottom nav, bottom sheets, safe-area aware, no overflow), starting with shared foundations then each surface.

**Architecture:** Build reusable mobile primitives (`BottomSheet`, `MobileTabBar`, `InstallPrompt`) and a PWA layer (manifest, icons, service worker) once, then retrofit each surface to use them. Customer model stays guest/device-local; cart stays per-kitchen.

**Tech Stack:** Next.js 16 (App Router, metadata routes), React 19, Tailwind v4, lucide-react. No test runner present — verification per task is `next build` + `tsc`/type-check + `eslint` + manual mobile-viewport inspection (~360–414px). Pure-logic helpers get assertion checks via a throwaway node script.

**Next 16 caveat:** `apps/web/AGENTS.md` says this Next has breaking changes. Before writing manifest/viewport/service-worker code, read the relevant file under `apps/web/node_modules/next/dist/docs/` and heed deprecations.

**Working dir for all commands:** `apps/web` unless stated. Commit from repo root `/Users/ebenezerbarning/Desktop/fafa`.

---

## File Structure

**New files:**
- `apps/web/components/ui/bottom-sheet.tsx` — reusable bottom sheet primitive.
- `apps/web/components/ui/mobile-tab-bar.tsx` — context-aware fixed bottom nav.
- `apps/web/components/ui/install-prompt.tsx` — PWA install banner (+ iOS path).
- `apps/web/components/ui/sw-register.tsx` — client SW registration.
- `apps/web/app/manifest.ts` — PWA web manifest (metadata route).
- `apps/web/app/offline/page.tsx` — offline fallback page.
- `apps/web/public/sw.js` — hand-written service worker.
- `apps/web/public/icons/` — generated PWA icons.

**Modified:**
- `apps/web/app/layout.tsx` — mount SW register + install prompt; manifest link is automatic via metadata route.
- `apps/web/lib/utils/customer-prefs.ts` — add recent-orders helpers.
- `apps/web/components/marketplace/hero-search.tsx` — mobile-first restructure (search fix).
- `apps/web/app/page.tsx`, `components/marketplace/{cuisine-chips,kitchen-card,kitchen-grid}.tsx` — landing polish + marketplace tab bar.
- `apps/web/components/storefront/{storefront-menu,order-tracker}.tsx` — sheets + storefront tab bar.
- `apps/web/app/(storefront)/[slug]/checkout/page.tsx` — mobile checkout.
- `apps/web/app/(auth)/{login,register,forgot-password}/page.tsx` — mobile forms.
- `apps/web/app/(dashboard)/**` , `app/admin/**` — table→card on mobile.

---

## PHASE 0 — Foundations

### Task 0.1: Recent-orders device-local helpers

**Files:**
- Modify: `apps/web/lib/utils/customer-prefs.ts`

- [ ] **Step 1: Add recent-orders types + functions** (append to file)

```ts
const RECENT_ORDERS_KEY = 'didi_recent_orders';

export interface RecentOrder {
  slug: string;
  orderId: string;
  orderNumber: string;
  savedAt: number;
}

export function saveRecentOrder(slug: string, orderId: string, orderNumber: string) {
  try {
    const list = loadRecentOrders().filter((o) => o.orderId !== orderId);
    list.unshift({ slug, orderId, orderNumber, savedAt: Date.now() });
    localStorage.setItem(RECENT_ORDERS_KEY, JSON.stringify(list.slice(0, 10)));
  } catch {
    /* ignore quota/availability */
  }
}

export function loadRecentOrders(): RecentOrder[] {
  try {
    const raw = localStorage.getItem(RECENT_ORDERS_KEY);
    const list = raw ? (JSON.parse(raw) as RecentOrder[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}
```

- [ ] **Step 2: Verify logic with a throwaway node check**

Run from `apps/web`:
```bash
node -e "global.localStorage={_s:{},getItem(k){return this._s[k]??null},setItem(k,v){this._s[k]=v}}; const m={save(slug,id,n){const l=this.load().filter(o=>o.orderId!==id);l.unshift({slug,orderId:id,orderNumber:n,savedAt:Date.now()});localStorage.setItem('k',JSON.stringify(l.slice(0,10)))},load(){const r=localStorage.getItem('k');return r?JSON.parse(r):[]}}; m.save('a','1','#1'); m.save('a','1','#1'); m.save('b','2','#2'); const l=m.load(); if(l.length!==2||l[0].orderId!=='2')throw new Error('FAIL '+JSON.stringify(l)); console.log('OK dedupe+order',l.map(x=>x.orderId))"
```
Expected: `OK dedupe+order [ '2', '1' ]`

- [ ] **Step 3: type-check**

Run from `apps/web`: `npx tsc --noEmit -p tsconfig.json` → Expected: no new errors in `customer-prefs.ts`.

- [ ] **Step 4: Commit**

```bash
git -C /Users/ebenezerbarning/Desktop/fafa add apps/web/lib/utils/customer-prefs.ts
git -C /Users/ebenezerbarning/Desktop/fafa commit -m "feat(mobile): device-local recent-orders helpers"
```

### Task 0.2: BottomSheet primitive

**Files:**
- Create: `apps/web/components/ui/bottom-sheet.tsx`

- [ ] **Step 1: Implement BottomSheet**

```tsx
'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  /** Max height of the sheet (default 88vh). */
  maxHeight?: string;
  /** Hide the default header (drag handle stays). */
  hideHeader?: boolean;
}

export function BottomSheet({
  open,
  onClose,
  title,
  children,
  maxHeight = '88dvh',
  hideHeader = false,
}: BottomSheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Lock body scroll + close on Escape / Android back.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label={title}>
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        className="absolute inset-x-0 bottom-0 bg-white text-surface-900 rounded-t-3xl shadow-2xl animate-slide-up flex flex-col overscroll-contain-y pb-safe"
        style={{ maxHeight }}
      >
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-surface-300" />
        </div>
        {!hideHeader && (
          <div className="flex items-center justify-between px-5 py-2.5 border-b border-surface-100 shrink-0">
            <h2 className="text-base font-bold">{title}</h2>
            <button
              onClick={onClose}
              aria-label="Close"
              className="w-10 h-10 grid place-items-center rounded-xl hover:bg-surface-100 active:scale-95 transition-all"
            >
              <X className="w-5 h-5 text-surface-500" />
            </button>
          </div>
        )}
        <div className="overflow-y-auto overscroll-contain-y flex-1 scrollbar-thin">
          {children}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: type-check** — `npx tsc --noEmit` from `apps/web`. Expected: no errors.
- [ ] **Step 3: Commit**

```bash
git -C /Users/ebenezerbarning/Desktop/fafa add apps/web/components/ui/bottom-sheet.tsx
git -C /Users/ebenezerbarning/Desktop/fafa commit -m "feat(mobile): reusable BottomSheet primitive"
```

### Task 0.3: MobileTabBar primitive

**Files:**
- Create: `apps/web/components/ui/mobile-tab-bar.tsx`

- [ ] **Step 1: Implement MobileTabBar**

```tsx
'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';

export interface TabItem {
  label: string;
  icon: LucideIcon;
  href?: string;
  onClick?: () => void;
  active?: boolean;
  badge?: number;
}

/**
 * Fixed bottom navigation for customer-facing surfaces. Hidden on md:+
 * (desktop keeps top navigation). Caller supplies the context-specific tabs.
 * Add `pb-[calc(env(safe-area-inset-bottom)+4.5rem)]` to scroll content so it
 * clears this bar.
 */
export function MobileTabBar({
  tabs,
  accent = '#FF6B35',
}: {
  tabs: TabItem[];
  accent?: string;
}) {
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-black/70 backdrop-blur-2xl border-t border-white/10 pb-safe">
      <div
        className="grid h-16"
        style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const inner = (
            <span className="relative flex flex-col items-center justify-center gap-1 h-full transition-transform active:scale-90">
              <span className="relative">
                <Icon
                  className="w-[22px] h-[22px]"
                  style={{ color: tab.active ? accent : 'rgba(255,255,255,0.55)' }}
                />
                {!!tab.badge && tab.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 grid place-items-center rounded-full bg-brand-500 text-white text-[10px] font-bold leading-none">
                    {tab.badge > 9 ? '9+' : tab.badge}
                  </span>
                )}
              </span>
              <span
                className="text-[10px] font-bold"
                style={{ color: tab.active ? accent : 'rgba(255,255,255,0.55)' }}
              >
                {tab.label}
              </span>
            </span>
          );
          return tab.href ? (
            <Link key={tab.label} href={tab.href} className="block h-full">
              {inner}
            </Link>
          ) : (
            <button key={tab.label} type="button" onClick={tab.onClick} className="block h-full">
              {inner}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
```

- [ ] **Step 2: type-check** — `npx tsc --noEmit`. Expected: no errors.
- [ ] **Step 3: Commit**

```bash
git -C /Users/ebenezerbarning/Desktop/fafa add apps/web/components/ui/mobile-tab-bar.tsx
git -C /Users/ebenezerbarning/Desktop/fafa commit -m "feat(mobile): context-aware MobileTabBar primitive"
```

### Task 0.4: PWA icons

**Files:**
- Create: `apps/web/public/icons/icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png`

- [ ] **Step 1: Generate icons from existing favicon**

Use `sips` (macOS built-in) to resize `public/images/didi_favicon.png`. Run from `apps/web`:
```bash
mkdir -p public/icons
sips -z 192 192 public/images/didi_favicon.png --out public/icons/icon-192.png
sips -z 512 512 public/images/didi_favicon.png --out public/icons/icon-512.png
sips -z 512 512 public/images/didi_favicon.png --out public/icons/icon-maskable-512.png
sips -z 180 180 public/images/didi_favicon.png --out public/icons/apple-touch-icon.png
```
Expected: four files written. Verify: `ls -la public/icons`.

- [ ] **Step 2: Commit**

```bash
git -C /Users/ebenezerbarning/Desktop/fafa add apps/web/public/icons
git -C /Users/ebenezerbarning/Desktop/fafa commit -m "feat(pwa): app icons"
```

### Task 0.5: Web manifest (metadata route)

**Files:**
- Create: `apps/web/app/manifest.ts`

- [ ] **Step 1: Read Next 16 metadata docs**

Run: `ls apps/web/node_modules/next/dist/docs/ 2>/dev/null; grep -rl "manifest" apps/web/node_modules/next/dist/docs/ 2>/dev/null | head`. Skim the manifest/metadata doc if present to confirm the `MetadataRoute.Manifest` shape for this version.

- [ ] **Step 2: Implement manifest**

```ts
import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Didi — Order Food in Ghana',
    short_name: 'Didi',
    description: 'Order from the best local kitchens near you.',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0b0910',
    theme_color: '#0b0910',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
```

- [ ] **Step 3: Verify build serves it** — `npm run build` from `apps/web`. Expected: build succeeds, `/manifest.webmanifest` route listed.
- [ ] **Step 4: Commit**

```bash
git -C /Users/ebenezerbarning/Desktop/fafa add apps/web/app/manifest.ts
git -C /Users/ebenezerbarning/Desktop/fafa commit -m "feat(pwa): web manifest"
```

### Task 0.6: Service worker + offline page + registration

**Files:**
- Create: `apps/web/public/sw.js`, `apps/web/app/offline/page.tsx`, `apps/web/components/ui/sw-register.tsx`

- [ ] **Step 1: Implement service worker** (`public/sw.js`)

```js
const CACHE = 'didi-shell-v1';
const SHELL = ['/', '/offline'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Never cache API / auth / Supabase calls.
  if (url.pathname.startsWith('/api')) return;

  if (request.mode === 'navigate') {
    // Network-first for pages, fall back to cache then offline page.
    e.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request).then((r) => r || caches.match('/offline')))
    );
    return;
  }

  // Cache-first for static assets.
  if (url.pathname.startsWith('/_next/static') || url.pathname.startsWith('/icons') || url.pathname.startsWith('/images')) {
    e.respondWith(
      caches.match(request).then((r) =>
        r ||
        fetch(request).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
          return res;
        })
      )
    );
  }
});
```

- [ ] **Step 2: Implement offline page** (`app/offline/page.tsx`)

```tsx
export const metadata = { title: 'Offline' };

export default function OfflinePage() {
  return (
    <div className="min-h-[100dvh] grid place-items-center bg-[#0b0910] text-white px-6 text-center">
      <div>
        <div className="text-5xl mb-4">📶</div>
        <h1 className="text-xl font-bold">You&apos;re offline</h1>
        <p className="text-white/50 mt-2 text-sm">
          Check your connection and try again. Didi needs the internet to load kitchens.
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Implement SW registration** (`components/ui/sw-register.tsx`)

```tsx
'use client';

import { useEffect } from 'react';

export function SwRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;
    const onLoad = () => navigator.serviceWorker.register('/sw.js').catch(() => {});
    window.addEventListener('load', onLoad);
    return () => window.removeEventListener('load', onLoad);
  }, []);
  return null;
}
```

- [ ] **Step 4: type-check + build** — `npm run build` from `apps/web`. Expected: success.
- [ ] **Step 5: Commit**

```bash
git -C /Users/ebenezerbarning/Desktop/fafa add apps/web/public/sw.js apps/web/app/offline/page.tsx apps/web/components/ui/sw-register.tsx
git -C /Users/ebenezerbarning/Desktop/fafa commit -m "feat(pwa): service worker, offline page, registration"
```

### Task 0.7: InstallPrompt

**Files:**
- Create: `apps/web/components/ui/install-prompt.tsx`

- [ ] **Step 1: Implement InstallPrompt**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { Download, X, Share } from 'lucide-react';

const DISMISS_KEY = 'didi_install_dismissed';

interface BIPEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [show, setShow] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISS_KEY)) return;
    } catch {}
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      // @ts-expect-error iOS Safari
      window.navigator.standalone === true;
    if (standalone) return;

    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
      setShow(true);
    };
    window.addEventListener('beforeinstallprompt', onBIP);

    // iOS Safari has no beforeinstallprompt — detect and show manual hint.
    const isIOS = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
    const isSafari = /safari/i.test(window.navigator.userAgent) && !/crios|fxios/i.test(window.navigator.userAgent);
    if (isIOS && isSafari) {
      const t = setTimeout(() => {
        setIosHint(true);
        setShow(true);
      }, 3000);
      return () => {
        clearTimeout(t);
        window.removeEventListener('beforeinstallprompt', onBIP);
      };
    }
    return () => window.removeEventListener('beforeinstallprompt', onBIP);
  }, []);

  function dismiss() {
    setShow(false);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {}
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    dismiss();
  }

  if (!show) return null;

  return (
    <div className="md:hidden fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] z-[55] animate-slide-up">
      <div className="flex items-center gap-3 rounded-2xl bg-white text-surface-900 shadow-2xl border border-surface-100 px-4 py-3">
        <img src="/icons/icon-192.png" alt="" className="w-10 h-10 rounded-xl" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold leading-tight">Install Didi</p>
          {iosHint ? (
            <p className="text-xs text-surface-500 flex items-center gap-1">
              Tap <Share className="w-3.5 h-3.5 inline" /> then “Add to Home Screen”
            </p>
          ) : (
            <p className="text-xs text-surface-500">Add to your home screen for the app experience.</p>
          )}
        </div>
        {!iosHint && (
          <button
            onClick={install}
            className="shrink-0 flex items-center gap-1.5 px-3.5 h-9 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-white text-xs font-bold active:scale-95 transition-transform"
          >
            <Download className="w-4 h-4" /> Install
          </button>
        )}
        <button onClick={dismiss} aria-label="Dismiss" className="shrink-0 w-8 h-8 grid place-items-center rounded-lg hover:bg-surface-100">
          <X className="w-4 h-4 text-surface-400" />
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: type-check** — `npx tsc --noEmit`. Expected: no errors.
- [ ] **Step 3: Commit**

```bash
git -C /Users/ebenezerbarning/Desktop/fafa add apps/web/components/ui/install-prompt.tsx
git -C /Users/ebenezerbarning/Desktop/fafa commit -m "feat(pwa): install prompt with iOS fallback"
```

### Task 0.8: Wire SW + InstallPrompt into root layout

**Files:**
- Modify: `apps/web/app/layout.tsx`

- [ ] **Step 1: Import and mount** — add imports for `SwRegister` and `InstallPrompt`, and update `appleWebApp.statusBarStyle` to `'black-translucent'`. Body becomes:

```tsx
import { SwRegister } from '@/components/ui/sw-register';
import { InstallPrompt } from '@/components/ui/install-prompt';
// ...
      <body className="min-h-full flex flex-col antialiased">
        {children}
        <SwRegister />
        <InstallPrompt />
      </body>
```

And in `metadata.appleWebApp`, set `statusBarStyle: 'black-translucent'`.

- [ ] **Step 2: build** — `npm run build` from `apps/web`. Expected: success.
- [ ] **Step 3: Commit**

```bash
git -C /Users/ebenezerbarning/Desktop/fafa add apps/web/app/layout.tsx
git -C /Users/ebenezerbarning/Desktop/fafa commit -m "feat(pwa): mount SW registration + install prompt"
```

---

## PHASE 1 — Landing / Marketplace (includes the search-button fix)

### Task 1.1: Mobile-first hero search (fixes the cut-off button)

**Files:**
- Modify: `apps/web/components/marketplace/hero-search.tsx`

- [ ] **Step 1: Restructure to a two-row mobile layout / one-row on sm+**

Replace the returned `<form>` with: the search input as a full-width pill on its own row; the "Near me" chip + submit button on a second row on mobile, collapsing to a single inline row at `sm:`. Submit always rendered, ≥44px.

```tsx
  return (
    <form
      onSubmit={submit}
      className="max-w-xl mx-auto flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-1.5 sm:p-1.5 sm:bg-white/[0.07] sm:border sm:border-white/15 sm:rounded-full sm:backdrop-blur-2xl sm:shadow-[0_12px_40px_-10px_rgba(0,0,0,0.6)]"
    >
      {/* Search field */}
      <div className="flex items-center flex-1 px-4 h-12 bg-white/[0.07] border border-white/15 rounded-full backdrop-blur-2xl sm:bg-transparent sm:border-0 sm:h-auto sm:px-0 sm:pl-4">
        <Search className="w-4 h-4 text-white/40 shrink-0" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search jollof, waakye, pizza…"
          className="flex-1 min-w-0 px-3 py-2.5 text-sm outline-none bg-transparent text-white placeholder:text-white/40"
        />
      </div>
      {/* Actions row */}
      <div className="flex items-center gap-2 sm:gap-1.5">
        <button
          type="button"
          onClick={useMyLocation}
          className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 h-11 rounded-full text-xs font-bold transition-colors ${
            nearActive
              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/30'
              : 'bg-white/[0.07] sm:bg-transparent border border-white/15 sm:border-0 text-white/80 hover:bg-white/10'
          }`}
        >
          {locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
          {nearActive ? 'Near you' : 'Near me'}
        </button>
        <button
          type="submit"
          disabled={isPending}
          aria-label="Search"
          className="grid place-items-center w-11 h-11 shrink-0 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-[0_6px_20px_-6px_rgba(255,107,53,0.8)] hover:brightness-110 disabled:opacity-60 transition-all"
        >
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
        </button>
      </div>
    </form>
  );
```

- [ ] **Step 2: build** — `npm run build`. Expected: success.
- [ ] **Step 3: Manual verify** — Run `npm run dev`, open `http://localhost:3000` at 360px width (DevTools device toolbar). Confirm: search input full-width, "Near me" + orange submit both fully visible on a second row, no horizontal scroll. On ≥640px it renders as the original single pill.
- [ ] **Step 4: Commit**

```bash
git -C /Users/ebenezerbarning/Desktop/fafa add apps/web/components/marketplace/hero-search.tsx
git -C /Users/ebenezerbarning/Desktop/fafa commit -m "fix(marketplace): hero search submit no longer cut off on mobile"
```

### Task 1.2: Marketplace bottom nav + content padding + landing polish

**Files:**
- Create: `apps/web/components/marketplace/marketplace-tab-bar.tsx`
- Modify: `apps/web/app/page.tsx`

- [ ] **Step 1: Create `MarketplaceTabBar`** (client) — renders `MobileTabBar` with Home / Search / Orders / Account, active state from `usePathname`. Search scrolls to the hero search input (`#hero-search`); Orders and Account open `BottomSheet`s populated from `loadRecentOrders()` / `loadCustomer()`.

```tsx
'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Home, Search, ReceiptText, User } from 'lucide-react';
import { MobileTabBar } from '@/components/ui/mobile-tab-bar';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { loadRecentOrders, loadCustomer, type RecentOrder, type SavedCustomer } from '@/lib/utils/customer-prefs';
import Link from 'next/link';

export function MarketplaceTabBar() {
  const pathname = usePathname();
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [orders, setOrders] = useState<RecentOrder[]>([]);
  const [customer, setCustomer] = useState<SavedCustomer | null>(null);

  return (
    <>
      <MobileTabBar
        tabs={[
          { label: 'Home', icon: Home, href: '/', active: pathname === '/' },
          {
            label: 'Search',
            icon: Search,
            onClick: () => document.getElementById('hero-search')?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
          },
          { label: 'Orders', icon: ReceiptText, onClick: () => { setOrders(loadRecentOrders()); setOrdersOpen(true); } },
          { label: 'Account', icon: User, onClick: () => { setCustomer(loadCustomer()); setAccountOpen(true); } },
        ]}
      />
      <BottomSheet open={ordersOpen} onClose={() => setOrdersOpen(false)} title="Your recent orders">
        <div className="p-4 space-y-2">
          {orders.length === 0 && <p className="text-sm text-surface-500 py-8 text-center">No recent orders yet.</p>}
          {orders.map((o) => (
            <Link key={o.orderId} href={`/${o.slug}/order/${o.orderId}`} onClick={() => setOrdersOpen(false)}
              className="flex items-center justify-between rounded-xl border border-surface-100 px-4 py-3 active:bg-surface-50">
              <span className="font-semibold text-sm">{o.orderNumber}</span>
              <span className="text-xs text-surface-400">{new Date(o.savedAt).toLocaleDateString()}</span>
            </Link>
          ))}
        </div>
      </BottomSheet>
      <BottomSheet open={accountOpen} onClose={() => setAccountOpen(false)} title="Your details">
        <div className="p-4 space-y-3 text-sm">
          {customer ? (
            <>
              <p><span className="text-surface-400">Name:</span> <b>{customer.name}</b></p>
              <p><span className="text-surface-400">Phone:</span> <b>{customer.phone}</b></p>
              {customer.address && <p><span className="text-surface-400">Address:</span> {customer.address}</p>}
            </>
          ) : (
            <p className="text-surface-500 py-6 text-center">No saved details yet. They&apos;ll appear after your first order.</p>
          )}
        </div>
      </BottomSheet>
    </>
  );
}
```

- [ ] **Step 2: Mount in `page.tsx`** — add `id="hero-search"` to the `<HeroSearch />` wrapper, mount `<MarketplaceTabBar />` inside the root `div`, and add bottom padding to the outer container so content clears the bar: add `pb-[calc(env(safe-area-inset-bottom)+5rem)] md:pb-0` to the `relative z-10` wrapper.

- [ ] **Step 3: build** — `npm run build`. Expected: success.
- [ ] **Step 4: Manual verify** at 360px: bottom nav visible, tabs tappable, Orders/Account sheets open, footer/content not hidden behind bar.
- [ ] **Step 5: Commit**

```bash
git -C /Users/ebenezerbarning/Desktop/fafa add apps/web/components/marketplace/marketplace-tab-bar.tsx apps/web/app/page.tsx
git -C /Users/ebenezerbarning/Desktop/fafa commit -m "feat(marketplace): native bottom nav + recent orders/account sheets"
```

### Task 1.3: Hero type scale + chip rail polish

**Files:**
- Modify: `apps/web/app/page.tsx` (hero `<h1>`/spacing), `apps/web/components/marketplace/cuisine-chips.tsx`

- [ ] **Step 1: Tighten hero on small screens** — change hero `<h1>` to `text-[clamp(2rem,9vw,3.75rem)]` and reduce hero section top padding on mobile: `pt-8 sm:pt-14`.
- [ ] **Step 2: Convert chips to a horizontal snap rail on mobile** — wrap chips in a `flex gap-2 overflow-x-auto no-scrollbar snap-rail px-4 -mx-4 sm:flex-wrap sm:justify-center sm:overflow-visible sm:mx-0 sm:px-0` container; add `snap-start-item` to each chip and keep `whitespace-nowrap`. This stops chips from wrapping into the tall block seen in the screenshot.
- [ ] **Step 3: build + manual verify** at 360px: hero fits without overpowering; chips scroll horizontally in one row.
- [ ] **Step 4: Commit**

```bash
git -C /Users/ebenezerbarning/Desktop/fafa add apps/web/app/page.tsx apps/web/components/marketplace/cuisine-chips.tsx
git -C /Users/ebenezerbarning/Desktop/fafa commit -m "feat(marketplace): fluid hero type + horizontal chip rail on mobile"
```

### Task 1.4: Kitchen card tap ergonomics

**Files:**
- Modify: `apps/web/components/marketplace/kitchen-card.tsx`

- [ ] **Step 1: Read the file**, then ensure: the whole card is a single tappable target with `active:scale-[0.98] transition-transform`, image uses fixed aspect ratio (`aspect-[16/10]`) to prevent layout shift, text truncates (`line-clamp`), and touch targets ≥44px. Do not change data/props.
- [ ] **Step 2: build + manual verify** at 360px: cards full-width, tap feedback present, no overflow.
- [ ] **Step 3: Commit**

```bash
git -C /Users/ebenezerbarning/Desktop/fafa add apps/web/components/marketplace/kitchen-card.tsx
git -C /Users/ebenezerbarning/Desktop/fafa commit -m "feat(marketplace): kitchen card tap ergonomics + stable image ratio"
```

---

## PHASE 2 — Storefront

### Task 2.1: Item detail + cart as BottomSheet

**Files:**
- Modify: `apps/web/components/storefront/storefront-menu.tsx`

- [ ] **Step 1: Read the file fully** (it is ~44KB / 1000+ lines). Identify the existing item-detail modal and floating cart implementations.
- [ ] **Step 2: Replace the bespoke item-detail modal markup with `<BottomSheet open onClose title={item.name}>`** keeping all existing state/handlers (quantity, options, add-to-cart). Replace the cart drawer markup (currently `cartOpen` block ~line 338) with `<BottomSheet open={cartOpen} onClose={() => setCartOpen(false)} title="Your order">`. Keep the floating cart bar trigger.
- [ ] **Step 3: Ensure the sticky bottom cart bar uses `pb-safe`** and the scroll area has `pb-[calc(env(safe-area-inset-bottom)+5.5rem)]` so items clear it.
- [ ] **Step 4: build** — `npm run build`. Expected: success. **Manual verify** at 360px: item sheet opens from bottom, drags/scrolls, add to cart works; cart sheet opens; no overflow.
- [ ] **Step 5: Commit**

```bash
git -C /Users/ebenezerbarning/Desktop/fafa add apps/web/components/storefront/storefront-menu.tsx
git -C /Users/ebenezerbarning/Desktop/fafa commit -m "feat(storefront): item detail + cart as native bottom sheets"
```

### Task 2.2: Storefront bottom nav + category rail

**Files:**
- Modify: `apps/web/components/storefront/storefront-menu.tsx`

- [ ] **Step 1: Add storefront `MobileTabBar`** with tabs Menu (scroll top) · Search (focus in-menu search) · Cart (badge = item count, opens cart sheet) · Info (opens info sheet with hours/location). Use `useCart()` count for the badge and the storefront `primaryColor` as accent.
- [ ] **Step 2: Make the category selector a horizontal snap rail** (`overflow-x-auto no-scrollbar snap-rail`) sticky under the header if not already.
- [ ] **Step 3: build + manual verify** at 360px: bottom nav shows cart badge updating as items added; categories scroll horizontally.
- [ ] **Step 4: Commit**

```bash
git -C /Users/ebenezerbarning/Desktop/fafa add apps/web/components/storefront/storefront-menu.tsx
git -C /Users/ebenezerbarning/Desktop/fafa commit -m "feat(storefront): native bottom nav with live cart badge + category rail"
```

---

## PHASE 3 — Checkout + Order tracking

### Task 3.1: Mobile checkout ergonomics

**Files:**
- Modify: `apps/web/app/(storefront)/[slug]/checkout/page.tsx`

- [ ] **Step 1: Read the file.** Then: set correct mobile keyboards — phone input `type="tel" inputMode="tel"`, any numeric `inputMode="numeric"`; ensure inputs inherit the 16px mobile rule (no override below 16px). Stack form sections single-column on mobile.
- [ ] **Step 2: Make the pay/submit CTA a sticky bottom bar** on mobile: `fixed bottom-0 inset-x-0 p-4 pb-safe bg-white border-t z-40 md:static md:p-0 md:border-0`, showing total + button; add matching bottom padding to the form so fields aren't hidden.
- [ ] **Step 3: build + manual verify** at 360px: keyboards correct, CTA always reachable, no field hidden behind it.
- [ ] **Step 4: Commit**

```bash
git -C /Users/ebenezerbarning/Desktop/fafa add "apps/web/app/(storefront)/[slug]/checkout/page.tsx"
git -C /Users/ebenezerbarning/Desktop/fafa commit -m "feat(checkout): mobile keyboards + sticky pay CTA"
```

### Task 3.2: Order tracking mobile + record recent order

**Files:**
- Modify: `apps/web/components/storefront/order-tracker.tsx`, and the checkout success path / order page where an order id is known.

- [ ] **Step 1: Read `order-tracker.tsx`.** Ensure the status timeline is single-column and legible on mobile, the live status header is sticky with `pt-safe`, and chat/actions use ≥44px targets and `BottomSheet` where a modal is used.
- [ ] **Step 2: Call `saveRecentOrder(slug, orderId, orderNumber)`** in a `useEffect` on the order tracking page once the order loads, so it appears in the marketplace Orders sheet.
- [ ] **Step 3: build + manual verify** at 360px: timeline readable, then return to landing → Orders sheet lists the order.
- [ ] **Step 4: Commit**

```bash
git -C /Users/ebenezerbarning/Desktop/fafa add apps/web/components/storefront/order-tracker.tsx
git -C /Users/ebenezerbarning/Desktop/fafa commit -m "feat(orders): mobile tracking layout + record recent orders"
```

---

## PHASE 4 — Auth

### Task 4.1: Mobile auth forms

**Files:**
- Modify: `apps/web/app/(auth)/login/page.tsx`, `register/page.tsx`, `forgot-password/page.tsx`, and `app/(auth)/layout.tsx`.

- [ ] **Step 1: Read each.** Ensure: single-column card centered with `min-h-[100dvh]` and safe-area padding; inputs use correct `type`/`inputMode`/`autoComplete` (email/tel/password); submit is full-width ≥48px; no horizontal overflow; `pt-safe`/`pb-safe` on the layout.
- [ ] **Step 2: build + manual verify** each at 360px.
- [ ] **Step 3: Commit**

```bash
git -C /Users/ebenezerbarning/Desktop/fafa add "apps/web/app/(auth)"
git -C /Users/ebenezerbarning/Desktop/fafa commit -m "feat(auth): mobile-optimized auth forms"
```

---

## PHASE 5 — Dashboard + Admin

### Task 5.1: Dashboard tables → stacked cards on mobile

**Files:**
- Modify dashboard pages with wide tables: `app/(dashboard)/orders/page.tsx`, `customers/page.tsx`, `payments/page.tsx`, and any list views; refine `components/layout/mobile-nav.tsx` only if needed (it is already solid).

- [ ] **Step 1: Read each list/table page.** For each wide `<table>`, add a mobile card layout: hide the table on mobile (`hidden md:table`) and render a `md:hidden` stack of cards showing the same fields with ≥44px tap targets. Add `pb-[calc(env(safe-area-inset-bottom)+4.5rem)]` to page content so it clears the existing dashboard bottom nav.
- [ ] **Step 2: build + manual verify** at 360px for each touched page: no horizontal scroll, all data visible as cards, nav clears content.
- [ ] **Step 3: Commit**

```bash
git -C /Users/ebenezerbarning/Desktop/fafa add "apps/web/app/(dashboard)"
git -C /Users/ebenezerbarning/Desktop/fafa commit -m "feat(dashboard): responsive tables→cards on mobile"
```

### Task 5.2: Admin responsive pass

**Files:**
- Modify: `app/admin/page.tsx`, `app/admin/tenants/[id]/page.tsx`

- [ ] **Step 1: Read each.** Apply the same table→card treatment + safe-area padding + no-overflow checks. Admin is internal/low-traffic on mobile — keep changes minimal but ensure usable.
- [ ] **Step 2: build + manual verify** at 360px.
- [ ] **Step 3: Commit**

```bash
git -C /Users/ebenezerbarning/Desktop/fafa add apps/web/app/admin
git -C /Users/ebenezerbarning/Desktop/fafa commit -m "feat(admin): mobile responsive pass"
```

---

## Final verification (after P5)

- [ ] From `apps/web`: `npm run build` succeeds.
- [ ] From `apps/web`: `npm run lint` — no new errors in touched files.
- [ ] From `apps/web`: `npx tsc --noEmit` — clean.
- [ ] Manual sweep at 360px across: landing, a storefront, item sheet, cart, checkout, order tracking, login, dashboard orders, admin. No horizontal overflow on any; primary CTA always visible; bottom nav + safe areas correct.
- [ ] Original bug confirmed fixed: hero search submit button fully visible/tappable at 360px.
- [ ] PWA: manifest served at `/manifest.webmanifest`; icons load; install prompt appears (Chrome) and iOS hint path works; SW registers (production build) and `/offline` renders when offline.

## Notes for the implementer

- DRY: reuse `BottomSheet` / `MobileTabBar` everywhere; do not hand-roll new sheets.
- YAGNI: do not add customer accounts, global cart, or push — out of scope.
- Follow existing Tailwind v4 tokens (`brand-*`, `surface-*`) and existing safe-area utilities in `globals.css`.
- Respect `apps/web/AGENTS.md`: consult `node_modules/next/dist/docs/` before manifest/SW/viewport work.
