import Link from 'next/link';
import Image from 'next/image';
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
    <div className="relative min-h-[100dvh] bg-canvas text-surface-900 antialiased overflow-x-hidden">
      {/* Soft warm glow behind the hero — barely-there, not a gradient wash */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[520px]"
        style={{
          backgroundImage:
            'radial-gradient(60% 70% at 50% -10%, rgba(255,107,53,0.08), transparent 70%)',
        }}
      />

      <div className="relative z-10 pb-[calc(env(safe-area-inset-bottom)+5rem)] md:pb-0">
        {/* Header */}
        <header className="sticky top-0 z-30 border-b border-hairline bg-white/75 backdrop-blur-xl pt-safe">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5">
              <Image
                src="/images/didi_favicon.png"
                alt="Didi"
                width={34}
                height={34}
                className="rounded-xl ring-1 ring-black/5"
              />
              <span className="text-2xl font-extrabold tracking-tight text-surface-900">
                Didi
              </span>
            </Link>
            <nav className="flex items-center gap-2.5 text-sm">
              <Link
                href="/register"
                className="px-4 py-2 rounded-full bg-brand-500 text-white font-bold text-xs shadow-cta hover:bg-brand-600 transition-all duration-300 ease-out active:scale-[0.98]"
              >
                List your kitchen
              </Link>
              <Link
                href="/login"
                className="px-4 py-2 rounded-full border border-hairline bg-white text-surface-700 font-semibold text-xs hover:bg-surface-50 hover:text-surface-900 transition-colors duration-300 active:scale-[0.98]"
              >
                Sign in
              </Link>
            </nav>
          </div>
        </header>

        {/* Hero */}
        <section className="px-4 pt-10 sm:pt-16 pb-8 text-center">
          <p className="micro-label text-brand-600 mb-3 sm:mb-4">
            Ghana&apos;s kitchens, delivered
          </p>
          <h1 className="text-[clamp(2.2rem,9vw,4rem)] font-extrabold leading-[1.04] tracking-tight text-surface-900">
            What do you want
            <br />
            to{' '}
            <span className="bg-gradient-to-br from-brand-400 to-brand-600 bg-clip-text text-transparent">
              eat?
            </span>
          </h1>
          <p className="text-sm sm:text-base text-surface-500 mt-4 mb-8 max-w-md mx-auto">
            Order from the best local kitchens near you — pay with Mobile Money
            or card.
          </p>
          <div id="hero-search" className="scroll-mt-24">
            <HeroSearch />
          </div>
          <div className="mt-7">
            <CuisineChips />
          </div>
        </section>

        {/* Results */}
        <section className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex items-baseline justify-between mb-6">
            <h2 className="text-xl font-extrabold tracking-tight text-surface-900">
              {nearActive ? 'Kitchens near you' : 'All kitchens'}
            </h2>
            <span className="text-xs font-medium text-surface-400">
              {kitchens.length} found
            </span>
          </div>
          <KitchenGrid kitchens={kitchens} />
        </section>

        {/* Vendor strip */}
        <section className="max-w-6xl mx-auto px-4 pb-16 pt-4">
          <div className="relative overflow-hidden rounded-3xl bg-surface-900 text-white px-7 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 shadow-float">
            <div
              className="pointer-events-none absolute -right-12 -top-20 w-72 h-72 rounded-full blur-3xl"
              style={{ background: 'rgba(255,107,53,0.35)' }}
            />
            <div className="relative">
              <h3 className="text-xl font-extrabold tracking-tight">Run a kitchen?</h3>
              <p className="text-sm text-white/60 mt-1">
                Get your own storefront and start taking orders in 5 minutes.
              </p>
            </div>
            <Link
              href="/register"
              className="relative px-6 py-3 rounded-full bg-brand-500 font-bold text-sm shadow-cta hover:bg-brand-600 transition-all duration-300 ease-out active:scale-[0.98]"
            >
              List your kitchen →
            </Link>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-hairline bg-white/60 backdrop-blur-xl">
          <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <Image
                src="/images/didi_favicon.png"
                alt="Didi"
                width={30}
                height={30}
                className="rounded-lg ring-1 ring-black/5"
              />
              <span className="text-lg font-extrabold tracking-tight text-surface-900">
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
