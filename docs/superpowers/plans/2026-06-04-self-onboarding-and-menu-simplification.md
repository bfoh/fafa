# Self-Onboarding + Menu Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (recommended — UI flow with review checkpoints) or superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make self-onboarding and menu creation effortless: minimal signup → guided Setup Wizard, and a simple-by-default menu add with advanced features behind an accordion — without changing any existing functionality.

**Architecture:** Extract the sample-menu seeder into a shared helper; collapse the menu item modal to Name/Price/Photo/Category with an auto-expanding "More options" accordion; trim signup to the essentials and redirect new owners to a new `/welcome` Setup Wizard that orchestrates existing capabilities (menu add, sample seed, payments/branding settings, location, share).

**Tech Stack:** Next.js (App Router, non-standard fork — read `node_modules/next/dist/docs/`), React client components, Supabase, Tailwind v4, the existing UI primitives (`components/ui/*`).

Spec: `docs/superpowers/specs/2026-06-04-self-onboarding-and-menu-simplification-design.md`

**Discipline:** Behavior/data unchanged. After each task: `npx tsc --noEmit`. `npm run build` + `npx vitest run` (must stay 41 pass) at the end. Run git from the repo root (`/Users/ebenezerbarning/Desktop/fafa`); paths with `(...)`/`[...]` need quoting.

---

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `apps/web/lib/onboarding/sample-menu.ts` | `SAMPLE_MENU` data + `seedSampleMenu()` (shared) | 1 |
| `apps/web/components/dashboard/setup-checklist.tsx` | Use shared seeder; add "Resume setup" link | 1, 5 |
| `apps/web/app/(dashboard)/menu/page.tsx` | Simple-by-default item modal + "More options" accordion | 2 |
| `apps/web/app/(auth)/register/page.tsx` | Trim to email/phone/password/name; redirect `/welcome` | 3 |
| `apps/web/app/(dashboard)/welcome/page.tsx` | Setup Wizard orchestrator | 4 |
| `apps/web/lib/onboarding/setup-status.ts` | Compute done-state (menu/payments/branding/location) | 4 |

---

## Task 1: Extract the shared sample-menu seeder

**Files:**
- Create: `apps/web/lib/onboarding/sample-menu.ts`
- Modify: `apps/web/components/dashboard/setup-checklist.tsx`

- [ ] **Step 1: Create the helper (move data + logic verbatim)**

Create `apps/web/lib/onboarding/sample-menu.ts`:
```ts
import type { SupabaseClient } from '@supabase/supabase-js';

export interface SampleDish {
  category: string;
  name: string;
  description: string;
  price: number;
}

// Sample Ghanaian dishes seeded into the default categories created at signup.
export const SAMPLE_MENU: SampleDish[] = [
  { category: 'Main Dishes', name: 'Jollof Rice with Chicken', description: 'Smoky party jollof served with grilled chicken', price: 45 },
  { category: 'Main Dishes', name: 'Waakye Special', description: 'Rice and beans with spaghetti, egg, gari and shito', price: 35 },
  { category: 'Main Dishes', name: 'Banku with Tilapia', description: 'Fresh grilled tilapia with hot pepper and banku', price: 50 },
  { category: 'Main Dishes', name: 'Fried Rice with Chicken', description: 'Vegetable fried rice with seasoned chicken', price: 45 },
  { category: 'Sides & Extras', name: 'Kelewele', description: 'Spicy fried ripe plantain cubes', price: 15 },
  { category: 'Sides & Extras', name: 'Fried Plantain', description: 'Golden fried ripe plantain', price: 12 },
  { category: 'Drinks', name: 'Sobolo', description: 'Chilled hibiscus drink', price: 10 },
  { category: 'Drinks', name: 'Bottled Water', description: '500ml bottled water', price: 5 },
];

/**
 * Seed the sample menu for a tenant. Idempotent: no-op if the store already has
 * items. Returns the number of dishes inserted (0 if it was already populated).
 */
export async function seedSampleMenu(
  supabase: SupabaseClient,
  tenantId: string
): Promise<number> {
  const { count } = await supabase
    .from('menu_items')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId);

  if ((count || 0) > 0) return 0;

  const { data: categories } = await supabase
    .from('menu_categories')
    .select('id, name, sort_order')
    .eq('tenant_id', tenantId)
    .order('sort_order', { ascending: true });

  if (!categories || categories.length === 0) {
    throw new Error('No menu categories found. Add a category first.');
  }

  const byName = new Map(categories.map((c) => [c.name, c.id]));
  const fallbackId = categories[0].id;

  const rows = SAMPLE_MENU.map((dish, i) => ({
    tenant_id: tenantId,
    category_id: byName.get(dish.category) ?? fallbackId,
    name: dish.name,
    description: dish.description,
    price: dish.price,
    is_available: true,
    sort_order: i,
  }));

  const { error } = await supabase.from('menu_items').insert(rows);
  if (error) throw new Error(error.message);
  return rows.length;
}
```

- [ ] **Step 2: Point `setup-checklist.tsx` at the helper**

In `apps/web/components/dashboard/setup-checklist.tsx`:
- Remove the inline `SAMPLE_MENU` constant (lines defining the dish array).
- Add the import: `import { seedSampleMenu } from '@/lib/onboarding/sample-menu';`
- Replace the body of `handleSeedSample` with:
```tsx
  async function handleSeedSample() {
    setSeeding(true);
    setSeedError('');
    try {
      const supabase = createBrowserClient();
      await seedSampleMenu(supabase, tenantId);
      router.refresh();
    } catch (err) {
      setSeedError(err instanceof Error ? err.message : 'Could not add sample menu.');
    } finally {
      setSeeding(false);
    }
  }
```

- [ ] **Step 3: Verify + commit**

Run: `cd apps/web && npx tsc --noEmit`
Expected: clean. (Behavior identical — the seeder is the same logic.)
```bash
git add apps/web/lib/onboarding/sample-menu.ts apps/web/components/dashboard/setup-checklist.tsx
git commit -m "refactor(onboarding): extract shared sample-menu seeder"
```

---

## Task 2: Simple-by-default menu item modal

**Files:** Modify `apps/web/app/(dashboard)/menu/page.tsx`

- [ ] **Step 1: Read the item modal JSX**

Open `apps/web/app/(dashboard)/menu/page.tsx` and locate the item modal render block (gated by `itemModalOpen`). Identify the field groups: Name, Price, Category, Image (the simple set) vs Description, Available, Featured, chop-bar toggle, and the option builder (the advanced set).

- [ ] **Step 2: Add an accordion state**

Near the other item-form state (around the `useState` block for `itemName`/`itemPrice`), add:
```tsx
  const [showAdvanced, setShowAdvanced] = useState(false);
```

- [ ] **Step 3: Auto-expand on edit when advanced config exists**

In `openEditItemModal(item)`, after the existing setters, add:
```tsx
    setShowAdvanced(
      Boolean(
        item.description ||
          item.is_chop_bar ||
          (item.menu_item_options && item.menu_item_options.length > 0) ||
          item.is_featured ||
          item.is_available === false
      )
    );
```
In `openNewItemModal()`, after the existing resets, add:
```tsx
    setShowAdvanced(false);
```

- [ ] **Step 4: Reorder the modal — simple fields first, advanced inside an accordion**

In the modal JSX, arrange so the always-visible block contains only: **Name**, **Price**, **Photo/Image**, **Category** (default it to the active/first category for new items). Then wrap the remaining fields (Description, Available, Featured, chop-bar toggle, and the entire option builder) in:
```tsx
              <div className="border-t border-hairline pt-4">
                <button
                  type="button"
                  onClick={() => setShowAdvanced((v) => !v)}
                  className="flex items-center gap-2 text-sm font-semibold text-surface-700"
                >
                  <ChevronDown className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
                  More options
                  <span className="text-xs font-normal text-surface-400">extras, chop bar, availability…</span>
                </button>
                {showAdvanced && (
                  <div className="mt-4 space-y-4 animate-fade-in">
                    {/* … existing Description / Available / Featured / chop-bar / option builder JSX, moved here verbatim … */}
                  </div>
                )}
              </div>
```
Import `ChevronDown` from `lucide-react` if not already imported. Do not change any field's state binding, handlers, or the save payload — only their position/visibility.

- [ ] **Step 5: Default category for new dishes**

In `openNewItemModal()`, set `itemCategoryId` to the first available category if not already: ensure `setItemCategoryId(categories[0]?.id ?? '')` so a new dish needs no category choice in the common case.

- [ ] **Step 6: Verify behavior unchanged**

Run: `cd apps/web && npx tsc --noEmit`
Expected: clean. Manually: create a simple dish (name + price only) → saves; open "More options" → add a chop-bar/option → saves; edit an existing dish with options → accordion auto-opens showing them.

- [ ] **Step 7: Commit**
```bash
git add "apps/web/app/(dashboard)/menu/page.tsx"
git commit -m "feat(menu): simple-by-default item modal with advanced 'More options' accordion"
```

---

## Task 3: Trim signup + redirect to the wizard

**Files:** Modify `apps/web/app/(auth)/register/page.tsx`

- [ ] **Step 1: Collapse to one step**

Replace the 2-step flow with a single short form collecting only **email, phone, password, restaurant name**. Remove the `step` machinery, the step-2 fields (description, city select, cuisines multiselect), and the `LocationPicker` import/usage. Keep the brand mark, the password-≥6 validation, and error handling.

- [ ] **Step 2: Post fewer fields**

The submit handler posts:
```tsx
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, phone, password, restaurantName }),
      });
```
(The API already treats `description/city/cuisines/locationLat/locationLng` as optional — omitting them stores nulls / empty cuisines.)

- [ ] **Step 3: Redirect to the wizard on success**

On a successful response, replace the success-screen + dashboard redirect with:
```tsx
      router.push('/welcome');
      router.refresh();
```
Remove the now-unused `step === 3` success block and the `setStep` calls.

- [ ] **Step 4: Verify**

Run: `cd apps/web && npx tsc --noEmit`
Expected: clean. Remove any now-unused imports (`CUISINES`, `CITY_COORDS`, `LocationPicker`, `dynamic`) flagged by tsc/eslint.

- [ ] **Step 5: Commit**
```bash
git add "apps/web/app/(auth)/register/page.tsx"
git commit -m "feat(onboarding): trim signup to essentials; route new owners to /welcome"
```

---

## Task 4: Setup Wizard (`/welcome`)

**Files:**
- Create: `apps/web/lib/onboarding/setup-status.ts`
- Create: `apps/web/app/(dashboard)/welcome/page.tsx`

The wizard lives inside the `(dashboard)` group so it inherits the auth + tenant guard. It orchestrates existing capabilities: it does the easy steps inline (sample seed / first dish, location, share) and links out to the existing settings pages for the heavy steps (payments, branding), detecting completion on return.

- [ ] **Step 1: Setup-status helper (client)**

Create `apps/web/lib/onboarding/setup-status.ts`:
```ts
import type { SupabaseClient } from '@supabase/supabase-js';

export interface SetupStatus {
  menuDone: boolean;
  paymentsDone: boolean;
  brandingDone: boolean;
  locationDone: boolean;
}

export async function loadSetupStatus(
  supabase: SupabaseClient,
  tenantId: string
): Promise<SetupStatus> {
  const [{ count: menuCount }, { data: tenant }] = await Promise.all([
    supabase.from('menu_items').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    supabase
      .from('tenants')
      .select('paystack_subaccount_code, logo_url, location_lat, location_lng')
      .eq('id', tenantId)
      .single(),
  ]);

  return {
    menuDone: (menuCount || 0) > 0,
    paymentsDone: Boolean(tenant?.paystack_subaccount_code),
    brandingDone: Boolean(tenant?.logo_url),
    locationDone: tenant?.location_lat != null && tenant?.location_lng != null,
  };
}
```

- [ ] **Step 2: Wizard page scaffold**

Create `apps/web/app/(dashboard)/welcome/page.tsx`:
```tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { createBrowserClient } from '@/lib/supabase/client';
import { getResolvedTenantIdClient } from '@/lib/admin/impersonate';
import { getBaseUrl } from '@/lib/utils';
import { seedSampleMenu } from '@/lib/onboarding/sample-menu';
import { loadSetupStatus, type SetupStatus } from '@/lib/onboarding/setup-status';
import { CUISINES } from '@/lib/marketplace/cuisines';
import { CITY_COORDS } from '@/lib/marketplace/geo';
import { Button } from '@/components/ui/button';
import { Loader2, Check, ArrowRight, Sparkles, CreditCard, Palette, MapPin, Copy } from 'lucide-react';

const LocationPicker = dynamic(() => import('@/components/onboarding/location-picker'), { ssr: false });

const GH_CITIES = ['Accra', 'Kumasi', 'Tamale', 'Takoradi', 'Cape Coast', 'Tema', 'Sunyani', 'Ho', 'Koforidua', 'Other'];

export default function WelcomeWizardPage() {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserClient(), []);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [slug, setSlug] = useState('');
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [stepIdx, setStepIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // Location step local state
  const [city, setCity] = useState('');
  const [cuisines, setCuisines] = useState<string[]>([]);
  const [loc, setLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [copied, setCopied] = useState(false);

  async function refresh(tId: string) {
    setStatus(await loadSetupStatus(supabase, tId));
  }

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }
      const tId = await getResolvedTenantIdClient(supabase, session);
      if (!tId) { router.push('/register'); return; }
      setTenantId(tId);
      const { data: t } = await supabase.from('tenants').select('slug, city, cuisines').eq('id', tId).single();
      if (t) { setSlug(t.slug); setCity(t.city || ''); setCuisines(Array.isArray(t.cuisines) ? t.cuisines : []); }
      await refresh(tId);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-check status when returning to the tab (e.g. after connecting payments).
  useEffect(() => {
    function onVisible() { if (document.visibilityState === 'visible' && tenantId) refresh(tenantId); }
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [tenantId]);

  async function handleSampleSeed() {
    if (!tenantId) return;
    setBusy(true); setErr('');
    try { await seedSampleMenu(supabase, tenantId); await refresh(tenantId); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Could not add sample menu.'); }
    finally { setBusy(false); }
  }

  async function handleSaveLocation() {
    if (!tenantId) return;
    setBusy(true); setErr('');
    try {
      await supabase.from('tenants').update({
        city: city || null,
        cuisines,
        location_lat: loc?.lat ?? null,
        location_lng: loc?.lng ?? null,
        updated_at: new Date().toISOString(),
      }).eq('id', tenantId);
      await refresh(tenantId);
      setStepIdx((i) => i + 1);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Could not save location.'); }
    finally { setBusy(false); }
  }

  async function handleCopy() {
    try { await navigator.clipboard.writeText(`${getBaseUrl()}/${slug}`); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
  }

  if (!status) {
    return <div className="flex justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-brand-500" /></div>;
  }

  const steps = [
    { key: 'menu', title: 'Add your first dish', required: true, done: status.menuDone },
    { key: 'payments', title: 'Turn on payments', required: true, done: status.paymentsDone },
    { key: 'branding', title: 'Brand your store', required: false, done: status.brandingDone },
    { key: 'location', title: 'Where are you?', required: false, done: status.locationDone },
    { key: 'live', title: "You're live", required: false, done: false },
  ];
  const current = steps[stepIdx];
  const pct = Math.round((steps.filter((s) => s.done).length / 4) * 100);

  return (
    <div className="max-w-lg mx-auto py-6 space-y-6">
      {/* Progress */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold text-surface-900 tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
            Set up your store
          </h1>
          <Link href="/dashboard" className="text-sm text-surface-500 hover:text-surface-800">Skip to dashboard</Link>
        </div>
        <div className="h-2 rounded-full bg-surface-100 overflow-hidden">
          <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Stepper rail */}
      <div className="flex gap-2">
        {steps.map((s, i) => (
          <button key={s.key} onClick={() => setStepIdx(i)}
            className={`flex-1 h-1.5 rounded-full ${i === stepIdx ? 'bg-brand-500' : s.done ? 'bg-success-500' : 'bg-surface-200'}`} />
        ))}
      </div>

      {err && <div className="p-3 rounded-xl bg-error-500/10 text-error-600 text-sm">{err}</div>}

      {/* Step body */}
      <div className="bg-white rounded-2xl border border-hairline shadow-card p-6 animate-fade-in">
        {current.key === 'menu' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2"><Sparkles className="w-5 h-5 text-brand-500" /><h2 className="font-bold text-surface-900">Add your first dish</h2></div>
            <p className="text-sm text-surface-500">Start with a ready-made Ghanaian menu, or add dishes yourself.</p>
            <Button onClick={handleSampleSeed} loading={busy} className="w-full">Add a sample menu for me</Button>
            <Link href="/menu" className="block text-center text-sm font-semibold text-brand-600">Or build my own menu →</Link>
            {status.menuDone && <p className="text-sm text-success-600 flex items-center gap-1"><Check className="w-4 h-4" /> Menu added</p>}
          </div>
        )}

        {current.key === 'payments' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2"><CreditCard className="w-5 h-5 text-brand-500" /><h2 className="font-bold text-surface-900">Turn on payments</h2></div>
            <p className="text-sm text-surface-500">Connect Paystack to accept Mobile Money and cards. You&apos;ll need your bank or MoMo settlement details.</p>
            <Link href="/settings/payments"><Button className="w-full">Connect payments</Button></Link>
            {status.paymentsDone
              ? <p className="text-sm text-success-600 flex items-center gap-1"><Check className="w-4 h-4" /> Payments connected</p>
              : <p className="text-xs text-surface-400">Come back here after connecting — we&apos;ll detect it automatically.</p>}
          </div>
        )}

        {current.key === 'branding' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2"><Palette className="w-5 h-5 text-brand-500" /><h2 className="font-bold text-surface-900">Brand your store</h2><span className="text-xs text-surface-400">optional</span></div>
            <p className="text-sm text-surface-500">Add your logo and colour so your storefront looks like you.</p>
            <Link href="/settings/branding"><Button variant="secondary" className="w-full">Add logo &amp; colour</Button></Link>
          </div>
        )}

        {current.key === 'location' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2"><MapPin className="w-5 h-5 text-brand-500" /><h2 className="font-bold text-surface-900">Where are you?</h2><span className="text-xs text-surface-400">optional</span></div>
            <p className="text-sm text-surface-500">Helps nearby customers find you on the marketplace.</p>
            <select value={city} onChange={(e) => setCity(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-hairline bg-white text-sm">
              <option value="">Select your city</option>
              {GH_CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <div className="flex flex-wrap gap-2">
              {CUISINES.map((c) => {
                const on = cuisines.includes(c.slug);
                return <button key={c.slug} type="button" onClick={() => setCuisines((p) => on ? p.filter((s) => s !== c.slug) : [...p, c.slug])}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${on ? 'bg-brand-500 text-white border-brand-500' : 'bg-white text-surface-600 border-hairline'}`}>{c.emoji} {c.label}</button>;
              })}
            </div>
            <LocationPicker center={city && CITY_COORDS[city] ? CITY_COORDS[city] : undefined} value={loc} onChange={(lat, lng) => setLoc({ lat, lng })} />
            <Button onClick={handleSaveLocation} loading={busy} className="w-full">Save &amp; continue</Button>
          </div>
        )}

        {current.key === 'live' && (
          <div className="space-y-4 text-center">
            <div className="text-4xl">🎉</div>
            <h2 className="font-bold text-surface-900">You&apos;re ready!</h2>
            <p className="text-sm text-surface-500">Share your store link and start taking orders.</p>
            <Button onClick={handleCopy} className="w-full">{copied ? 'Copied!' : 'Copy store link'} {!copied && <Copy className="w-4 h-4" />}</Button>
            <Link href="/dashboard"><Button variant="secondary" className="w-full">Go to dashboard</Button></Link>
          </div>
        )}
      </div>

      {/* Nav */}
      <div className="flex justify-between">
        <button disabled={stepIdx === 0} onClick={() => setStepIdx((i) => Math.max(0, i - 1))} className="text-sm text-surface-500 disabled:opacity-0">Back</button>
        {current.key !== 'location' && stepIdx < steps.length - 1 && (
          <button onClick={() => setStepIdx((i) => i + 1)} className="text-sm font-semibold text-brand-600 inline-flex items-center gap-1">
            {current.required && !current.done ? 'Skip for now' : 'Next'} <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify**

Run: `cd apps/web && npx tsc --noEmit`
Expected: clean. Confirm `getResolvedTenantIdClient`, `CUISINES` (has `slug/emoji/label`), `CITY_COORDS`, and `LocationPicker` prop shapes match usage (they mirror the current register page). Fix any prop mismatch revealed by tsc.

- [ ] **Step 4: Commit**
```bash
git add apps/web/lib/onboarding/setup-status.ts "apps/web/app/(dashboard)/welcome/page.tsx"
git commit -m "feat(onboarding): guided Setup Wizard at /welcome"
```

---

## Task 5: "Resume setup" entry on the dashboard checklist

**Files:** Modify `apps/web/components/dashboard/setup-checklist.tsx`

- [ ] **Step 1: Add a resume link in the checklist header**

In the not-all-done checklist header (the block with "Get your store live" + progress bar), add below the progress bar:
```tsx
        <Link href="/welcome" className="inline-flex items-center gap-1 mt-3 text-xs font-semibold text-brand-600 hover:text-brand-700">
          Resume guided setup →
        </Link>
```
(`Link` is already imported.)

- [ ] **Step 2: Verify + commit**
```bash
cd apps/web && npx tsc --noEmit
git add apps/web/components/dashboard/setup-checklist.tsx
git commit -m "feat(onboarding): link the dashboard checklist to the guided wizard"
```

---

## Final Verification

- [ ] `cd apps/web && npx tsc --noEmit` clean.
- [ ] `cd apps/web && npm run build` succeeds (all routes compile, including `/welcome`).
- [ ] `cd apps/web && npx vitest run` still 41 passing.
- [ ] Manual flow: register (4 fields) → lands on `/welcome` → "Add a sample menu" marks menu done → "Connect payments" opens settings, returns and auto-detects → skip branding → set city/cuisines/pin → live step copies link. Editing an existing dish with options still shows them (accordion auto-opens). A non-orange tenant still themes correctly.

---

## Notes for the Implementer

- **Reuse, don't rebuild.** Payments and branding are heavy existing settings pages — the wizard links to them and detects completion via `loadSetupStatus` (re-checked on tab focus). Don't re-implement Paystack/branding inside the wizard.
- **Nothing is removed.** Deferred signup fields (city/cuisines/description/location) are all still captured — in the wizard's location step and editable in existing settings. The register API already accepts their absence.
- **Menu accordion preserves everything.** Advanced fields keep identical state/handlers/payload; they're only repositioned + auto-expanded when an edited item already uses them.
- Read each large file (`menu/page.tsx`, `register/page.tsx`, `setup-checklist.tsx`) before editing.
