import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';
import HeroSearch from '@/components/marketplace/hero-search';
import CuisineChips from '@/components/marketplace/cuisine-chips';
import KitchenGrid from '@/components/marketplace/kitchen-grid';
import type { KitchenResult } from '@/components/marketplace/kitchen-card';

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

  const nearActive = lat != null && lng != null;

  return (
    <div className="min-h-screen bg-surface-50">
      {/* Header */}
      <header className="bg-white border-b border-surface-100">
        <div className="max-w-6xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <span className="text-xl font-extrabold text-brand-500">Didi</span>
          <nav className="flex items-center gap-4 text-sm">
            <Link
              href="/for-restaurants"
              className="px-3.5 py-2 rounded-full bg-brand-500 text-white font-bold text-xs hover:bg-brand-600 transition-colors"
            >
              List your kitchen ▸
            </Link>
            <Link
              href="/login"
              className="text-surface-600 font-medium hover:text-surface-900"
            >
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-b from-white to-surface-50 px-4 pt-10 pb-6 text-center">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-surface-900">
          What do you want to eat?
        </h1>
        <p className="text-surface-500 mt-2 mb-6">
          Order from the best local kitchens near you
        </p>
        <HeroSearch />
        <div className="mt-5">
          <CuisineChips />
        </div>
      </section>

      {/* Results */}
      <section className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-baseline justify-between mb-5">
          <h2 className="text-lg font-bold text-surface-900">
            {nearActive ? 'Kitchens near you' : 'All kitchens'}
          </h2>
          <span className="text-xs text-surface-400">
            {kitchens.length} found
          </span>
        </div>
        <KitchenGrid kitchens={kitchens} />
      </section>

      {/* Vendor strip */}
      <section className="max-w-6xl mx-auto px-4 pb-12">
        <div className="rounded-2xl bg-gradient-to-r from-surface-900 to-[#2a2a4a] text-white px-6 py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold">Run a kitchen?</h3>
            <p className="text-sm text-white/70 mt-0.5">
              Get your own storefront and start taking orders in 5 minutes.
            </p>
          </div>
          <Link
            href="/for-restaurants"
            className="px-5 py-2.5 rounded-full bg-brand-500 hover:bg-brand-600 font-bold text-sm transition-colors"
          >
            List your kitchen →
          </Link>
        </div>
      </section>
    </div>
  );
}
