import Link from 'next/link';
import { Bricolage_Grotesque } from 'next/font/google';
import { createAdminClient } from '@/lib/supabase/admin';
import HeroSearch from '@/components/marketplace/hero-search';
import CuisineChips from '@/components/marketplace/cuisine-chips';
import KitchenGrid from '@/components/marketplace/kitchen-grid';
import type { KitchenResult } from '@/components/marketplace/kitchen-card';

const display = Bricolage_Grotesque({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-display',
});

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
    <div
      className={`${display.variable} relative min-h-screen text-white antialiased overflow-x-hidden`}
      style={{
        backgroundColor: '#0b0910',
        backgroundImage: [
          'radial-gradient(70% 55% at 50% -5%, rgba(255,107,53,0.28), transparent 70%)',
          'radial-gradient(45% 35% at 88% 8%, rgba(255,150,90,0.16), transparent 70%)',
          'radial-gradient(55% 45% at 8% 22%, rgba(120,72,255,0.10), transparent 70%)',
        ].join(','),
      }}
    >
      {/* Grain / texture overlay */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.04] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      <div className="relative z-10">
        {/* Header */}
        <header className="sticky top-0 z-30 border-b border-white/10 bg-black/20 backdrop-blur-2xl">
          <div className="max-w-6xl mx-auto px-4 py-3.5 flex items-center justify-between">
            <span
              className="text-2xl font-extrabold bg-gradient-to-br from-brand-300 to-brand-500 bg-clip-text text-transparent"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Didi
            </span>
            <nav className="flex items-center gap-3 text-sm">
              <Link
                href="/for-restaurants"
                className="px-4 py-2 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-white font-bold text-xs shadow-[0_6px_20px_-6px_rgba(255,107,53,0.7)] hover:brightness-110 transition-all"
              >
                List your kitchen ▸
              </Link>
              <Link
                href="/login"
                className="px-3 py-2 rounded-full text-white/70 font-medium hover:text-white hover:bg-white/10 transition-colors"
              >
                Sign in
              </Link>
            </nav>
          </div>
        </header>

        {/* Hero */}
        <section className="px-4 pt-14 pb-8 text-center">
          <p className="text-xs font-semibold tracking-[0.25em] uppercase text-brand-300/80 mb-4">
            Ghana&apos;s kitchens, delivered
          </p>
          <h1
            className="text-4xl sm:text-6xl font-extrabold leading-[1.05] tracking-tight"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            What do you want
            <br />
            to{' '}
            <span className="bg-gradient-to-br from-brand-300 via-brand-400 to-brand-600 bg-clip-text text-transparent">
              eat?
            </span>
          </h1>
          <p className="text-white/50 mt-4 mb-8 max-w-md mx-auto">
            Order from the best local kitchens near you — pay with Mobile Money
            or card.
          </p>
          <HeroSearch />
          <div className="mt-6">
            <CuisineChips />
          </div>
        </section>

        {/* Results */}
        <section className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex items-baseline justify-between mb-6">
            <h2
              className="text-xl font-bold"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {nearActive ? 'Kitchens near you' : 'All kitchens'}
            </h2>
            <span className="text-xs text-white/40">{kitchens.length} found</span>
          </div>
          <KitchenGrid kitchens={kitchens} />
        </section>

        {/* Vendor strip */}
        <section className="max-w-6xl mx-auto px-4 pb-16 pt-4">
          <div className="relative overflow-hidden rounded-[26px] border border-white/10 bg-white/[0.05] backdrop-blur-2xl px-7 py-7 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
            <div
              className="pointer-events-none absolute -right-10 -top-16 w-64 h-64 rounded-full blur-3xl"
              style={{ background: 'rgba(255,107,53,0.25)' }}
            />
            <div className="relative">
              <h3
                className="text-xl font-bold"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Run a kitchen?
              </h3>
              <p className="text-sm text-white/55 mt-1">
                Get your own storefront and start taking orders in 5 minutes.
              </p>
            </div>
            <Link
              href="/for-restaurants"
              className="relative px-6 py-3 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 font-bold text-sm shadow-[0_8px_28px_-8px_rgba(255,107,53,0.8)] hover:brightness-110 transition-all"
            >
              List your kitchen →
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
