import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import HeroSearch from '@/components/marketplace/hero-search';
import CuisineChips from '@/components/marketplace/cuisine-chips';
import KitchenGrid from '@/components/marketplace/kitchen-grid';
import { MarketplaceTabBar } from '@/components/marketplace/marketplace-tab-bar';
import { AdepaWidget } from '@/components/adepa/adepa-widget';
import type {
  KitchenResult,
  MenuPreview,
} from '@/components/marketplace/kitchen-card';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Didi — Order Food Online in Ghana',
  description:
    'Discover and order from the best local kitchens near you. Search by dish or cuisine, pay with Mobile Money or card.',
};

function parseNear(near?: string): { lat: number | null; lng: number | null } {
  if (!near) return { lat: null, lng: null };
  const [a, b] = near.split(',').map((n) => Number(n));
  if (Number.isFinite(a) && Number.isFinite(b)) return { lat: a, lng: b };
  return { lat: null, lng: null };
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    cuisine?: string;
    city?: string;
    near?: string;
  }>;
}) {
  const sp = await searchParams;
  const { lat, lng } = parseNear(sp.near);

  let kitchens: KitchenResult[] = [];
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc('search_kitchens', {
      p_q: sp.q || null,
      p_cuisines: sp.cuisine ? [sp.cuisine] : null,
      p_city: sp.city || null,
      p_lat: lat,
      p_lng: lng,
      p_limit: 24,
      p_offset: 0,
    });
    if (error) throw error;
    kitchens = (data as KitchenResult[]) || [];
  } catch (err) {
    console.error('Marketplace load failed:', err);
    kitchens = [];
  }

  // Attach up to 3 dishes per kitchen (one batched query, grouped in-app).
  if (kitchens.length > 0) {
    try {
      const supabase = createAdminClient();
      const { data: items } = await supabase
        .from('menu_items')
        .select('tenant_id, name, price, image_url, is_featured, sort_order, is_chop_bar')
        .in(
          'tenant_id',
          kitchens.map((k) => k.id)
        )
        .eq('is_available', true)
        .order('is_featured', { ascending: false })
        .order('sort_order', { ascending: true });

      const byTenant = new Map<string, MenuPreview[]>();
      for (const it of items || []) {
        const arr = byTenant.get(it.tenant_id) || [];
        if (arr.length < 3) {
          arr.push({
            name: it.name,
            price: Number(it.price),
            image_url: it.image_url,
            is_chop_bar: Boolean(it.is_chop_bar),
          });
          byTenant.set(it.tenant_id, arr);
        }
      }

      // Ratings (denormalized on tenants) — batch fetch and attach.
      const { data: ratings } = await supabase
        .from('tenants')
        .select('id, rating_avg, rating_count')
        .in('id', kitchens.map((k) => k.id));
      const ratingById = new Map(
        (ratings || []).map((r) => [r.id, { avg: Number(r.rating_avg) || 0, count: Number(r.rating_count) || 0 }])
      );

      kitchens = kitchens.map((k) => ({
        ...k,
        items: byTenant.get(k.id) || [],
        rating_avg: ratingById.get(k.id)?.avg ?? 0,
        rating_count: ratingById.get(k.id)?.count ?? 0,
      }));
    } catch (err) {
      console.error('Dish preview load failed:', err);
    }
  }

  const nearActive = lat != null && lng != null;

  return (
    <div
      className="relative min-h-[100dvh] text-surface-900 antialiased overflow-x-hidden"
      style={{
        backgroundColor: '#FCFBFA',
        backgroundImage: [
          'radial-gradient(70% 55% at 50% -5%, rgba(255,107,53,0.10), transparent 70%)',
          'radial-gradient(45% 35% at 88% 8%, rgba(255,150,90,0.07), transparent 70%)',
        ].join(','),
      }}
    >
      <div className="relative z-10 pb-[calc(env(safe-area-inset-bottom)+5rem)] md:pb-0">
        {/* Header */}
        <header className="sticky top-0 z-30 border-b border-hairline bg-white/80 backdrop-blur-2xl pt-safe">
          <div className="max-w-6xl mx-auto px-4 py-3.5 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5">
              <Image
                src="/images/didi_favicon.png"
                alt="Didi"
                width={34}
                height={34}
                className="rounded-xl ring-1 ring-black/5"
              />
              <span
                className="text-2xl font-extrabold bg-gradient-to-br from-brand-400 to-brand-600 bg-clip-text text-transparent"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Didi
              </span>
            </Link>
            <nav className="flex items-center gap-3 text-sm">
              <Link
                href="/register"
                className="inline-flex items-center gap-1 px-4 py-2 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-white font-bold text-xs shadow-[0_6px_20px_-6px_rgba(255,107,53,0.5)] hover:brightness-110 transition-all"
              >
                List your kitchen
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                href="/login"
                className="px-4 py-2 rounded-full border border-hairline bg-white text-surface-700 font-semibold text-xs hover:bg-surface-50 hover:text-surface-900 transition-colors shadow-sm"
              >
                Sign in
              </Link>
            </nav>
          </div>
        </header>

        {/* Hero */}
        <section className="px-4 pt-8 sm:pt-14 pb-8 text-center">
          <p className="text-[11px] sm:text-xs font-semibold tracking-[0.22em] sm:tracking-[0.25em] uppercase text-brand-600/80 mb-3 sm:mb-4">
            Ghana&apos;s kitchens, delivered
          </p>
          <h1
            className="text-[clamp(2.1rem,9vw,3.75rem)] font-extrabold leading-[1.05] tracking-tight text-surface-900"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            What do you want
            <br />
            to <span className="text-brand-500">eat?</span>
          </h1>
          <p className="text-sm sm:text-base text-surface-500 mt-3 sm:mt-4 mb-7 sm:mb-8 max-w-md mx-auto">
            Order from the best local kitchens near you — pay with Mobile Money
            or card.
          </p>
          <div id="hero-search" className="scroll-mt-24">
            <HeroSearch />
          </div>
          <div className="mt-6">
            <CuisineChips />
          </div>
        </section>

        {/* Results */}
        <section className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex items-baseline justify-between mb-6">
            <h2
              className="text-xl font-bold text-surface-900"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {nearActive ? 'Kitchens near you' : 'All kitchens'}
            </h2>
            <span className="text-xs text-surface-400">{kitchens.length} found</span>
          </div>
          <KitchenGrid kitchens={kitchens} />
        </section>

        {/* Vendor strip */}
        <section className="max-w-6xl mx-auto px-4 pb-16 pt-4">
          <div className="relative overflow-hidden rounded-[26px] border border-hairline bg-white shadow-card px-7 py-7 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
            <div
              className="pointer-events-none absolute -right-10 -top-16 w-64 h-64 rounded-full blur-3xl"
              style={{ background: 'rgba(255,107,53,0.10)' }}
            />
            <div className="relative">
              <h3
                className="text-xl font-bold text-surface-900"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Run a kitchen?
              </h3>
              <p className="text-sm text-surface-500 mt-1">
                Get your own storefront and start taking orders in 5 minutes.
              </p>
            </div>
            <Link
              href="/register"
              className="relative inline-flex items-center gap-1.5 px-6 py-3 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-white font-bold text-sm shadow-[0_8px_28px_-8px_rgba(255,107,53,0.6)] hover:brightness-110 transition-all"
            >
              List your kitchen
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-hairline bg-white/70 backdrop-blur-xl">
          <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <Image
                src="/images/didi_favicon.png"
                alt="Didi"
                width={30}
                height={30}
                className="rounded-lg ring-1 ring-black/5"
              />
              <span
                className="text-lg font-extrabold bg-gradient-to-br from-brand-400 to-brand-600 bg-clip-text text-transparent"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Didi
              </span>
              <span className="text-xs text-surface-400 ml-1">
                Ghana&apos;s kitchens, delivered
              </span>
            </div>
            <div className="flex items-center gap-5 text-xs text-surface-500">
              <Link href="/for-restaurants" className="hover:text-surface-900 transition-colors">
                For restaurants
              </Link>
              <Link href="/login" className="hover:text-surface-900 transition-colors">
                Sign in
              </Link>
              <span className="text-surface-400">
                © {new Date().getFullYear()} Didi
              </span>
            </div>
          </div>
        </footer>
      </div>

      <MarketplaceTabBar />
      <AdepaWidget />
    </div>
  );
}
