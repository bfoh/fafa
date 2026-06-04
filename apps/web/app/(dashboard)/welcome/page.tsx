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
    try {
      await navigator.clipboard.writeText(`${getBaseUrl()}/${slug}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable — no-op.
    }
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

      <div className="flex gap-2">
        {steps.map((s, i) => (
          <button
            key={s.key}
            onClick={() => setStepIdx(i)}
            aria-label={s.title}
            className={`flex-1 h-1.5 rounded-full ${i === stepIdx ? 'bg-brand-500' : s.done ? 'bg-success-500' : 'bg-surface-200'}`}
          />
        ))}
      </div>

      {err && <div className="p-3 rounded-xl bg-error-500/10 text-error-600 text-sm">{err}</div>}

      <div className="bg-white rounded-2xl border border-hairline shadow-card p-6 animate-fade-in">
        {current.key === 'menu' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2"><Sparkles className="w-5 h-5 text-brand-500" /><h2 className="font-bold text-surface-900">Add your first dish</h2></div>
            <p className="text-sm text-surface-500">Start with a ready-made Ghanaian menu, or build your own.</p>
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
            {status.brandingDone && <p className="text-sm text-success-600 flex items-center gap-1"><Check className="w-4 h-4" /> Branding added</p>}
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
                return (
                  <button
                    key={c.slug}
                    type="button"
                    onClick={() => setCuisines((p) => on ? p.filter((s) => s !== c.slug) : [...p, c.slug])}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${on ? 'bg-brand-500 text-white border-brand-500' : 'bg-white text-surface-600 border-hairline'}`}
                  >
                    {c.emoji} {c.label}
                  </button>
                );
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
