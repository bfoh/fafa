import Link from 'next/link';
import Image from 'next/image';
import { Bricolage_Grotesque } from 'next/font/google';
import { Search, MapPin, ShieldCheck, Bike, UtensilsCrossed, ArrowRight } from 'lucide-react';
import { loadKitchens } from '@/lib/marketplace/load-kitchens';
import { CUISINES } from '@/lib/marketplace/cuisines';
import KitchenCardV2 from '@/components/marketplace/preview/kitchen-card-v2';

const display = Bricolage_Grotesque({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-display',
});

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Didi — Redesign preview (Dark)' };

export default async function RedesignDark({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; cuisine?: string; near?: string }>;
}) {
  const sp = await searchParams;
  const kitchens = await loadKitchens(sp);
  const activeCuisine = sp.cuisine || 'all';

  return (
    <div
      className={`${display.variable} relative min-h-[100dvh] text-white antialiased overflow-x-hidden`}
      style={{
        backgroundColor: '#0b0910',
        backgroundImage: [
          'radial-gradient(70% 55% at 50% -5%, rgba(234,88,12,0.30), transparent 70%)',
          'radial-gradient(45% 35% at 88% 8%, rgba(255,150,90,0.16), transparent 70%)',
          'radial-gradient(55% 45% at 8% 24%, rgba(37,99,235,0.10), transparent 70%)',
        ].join(','),
      }}
    >
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.04] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      <div className="relative z-10">
        {/* Header */}
        <header className="sticky top-0 z-30 border-b border-white/10 bg-black/30 backdrop-blur-2xl">
          <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
            <Link href="/redesign" className="flex items-center gap-2.5">
              <Image src="/images/didi_favicon.png" alt="Didi" width={34} height={34} className="rounded-xl ring-1 ring-white/15" />
              <span className="text-2xl font-extrabold bg-gradient-to-br from-orange-300 to-orange-600 bg-clip-text text-transparent" style={{ fontFamily: 'var(--font-display)' }}>
                Didi
              </span>
            </Link>
            <nav className="flex items-center gap-2.5 text-sm">
              <Link href="/register" className="px-4 py-2 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 text-white font-bold text-xs shadow-[0_6px_20px_-6px_rgba(234,88,12,0.7)] hover:brightness-110 transition">
                List your kitchen
              </Link>
              <Link href="/login" className="px-4 py-2 rounded-full border border-white/15 bg-white/[0.04] text-white/85 font-semibold text-xs hover:bg-white/10 transition">
                Sign in
              </Link>
            </nav>
          </div>
        </header>

        {/* Hero */}
        <section className="px-4 pt-12 sm:pt-16 pb-6 text-center">
          <p className="text-[11px] sm:text-xs font-semibold tracking-[0.25em] uppercase text-orange-300/80 mb-3">
            Ghana&apos;s kitchens, delivered
          </p>
          <h1 className="text-[clamp(2.3rem,9vw,4rem)] font-extrabold leading-[1.03] tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
            What do you want
            <br />
            to{' '}
            <span className="bg-gradient-to-br from-orange-300 via-orange-400 to-orange-600 bg-clip-text text-transparent">eat?</span>
          </h1>
          <p className="text-sm sm:text-base text-white/50 mt-3.5 mb-7 max-w-md mx-auto">
            Order from the best local kitchens near you — pay with Mobile Money or card.
          </p>

          {/* Search */}
          <form className="max-w-xl mx-auto flex items-center gap-1.5 p-1.5 bg-white/[0.07] border border-white/15 rounded-full backdrop-blur-2xl shadow-[0_12px_40px_-10px_rgba(0,0,0,0.6)]">
            <div className="flex items-center flex-1 min-w-0 pl-4">
              <Search className="w-4 h-4 text-white/40 shrink-0" />
              <input
                name="q"
                defaultValue={sp.q || ''}
                placeholder="Search jollof, waakye, pizza…"
                className="flex-1 min-w-0 px-3 py-2.5 text-sm bg-transparent text-white placeholder:text-white/40 outline-none"
              />
            </div>
            <button type="submit" className="grid place-items-center h-11 px-5 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 text-white font-bold text-sm shadow-[0_6px_20px_-6px_rgba(234,88,12,0.8)] hover:brightness-110 transition">
              Search
            </button>
          </form>

          {/* Cuisine chips */}
          <div className="mt-5 flex gap-2 overflow-x-auto no-scrollbar px-4 -mx-4 sm:flex-wrap sm:justify-center sm:mx-0 sm:px-0">
            <Link href="/redesign/dark" className={`shrink-0 px-4 py-2 rounded-full text-xs font-semibold border transition ${activeCuisine === 'all' ? 'bg-gradient-to-br from-orange-400 to-orange-600 text-white border-transparent' : 'bg-white/5 text-white/70 border-white/10 hover:bg-white/10'}`}>
              All
            </Link>
            {CUISINES.map((c) => (
              <Link key={c.slug} href={`/redesign/dark?cuisine=${c.slug}`} className={`shrink-0 px-4 py-2 rounded-full text-xs font-semibold border transition ${activeCuisine === c.slug ? 'bg-gradient-to-br from-orange-400 to-orange-600 text-white border-transparent' : 'bg-white/5 text-white/70 border-white/10 hover:bg-white/10'}`}>
                {c.label}
              </Link>
            ))}
          </div>
        </section>

        {/* Trust strip */}
        <section className="max-w-4xl mx-auto px-4 py-4">
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: ShieldCheck, label: 'MoMo & Card', sub: 'Secure checkout' },
              { icon: Bike, label: 'Live tracking', sub: 'Rider on a map' },
              { icon: UtensilsCrossed, label: `${kitchens.length} kitchens`, sub: 'Open near you' },
            ].map((t) => (
              <div key={t.label} className="flex items-center gap-2.5 rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-3">
                <t.icon className="w-5 h-5 text-orange-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-bold truncate">{t.label}</p>
                  <p className="text-[10px] text-white/45 truncate">{t.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Results */}
        <section className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex items-baseline justify-between mb-6">
            <h2 className="text-xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>All kitchens</h2>
            <span className="text-xs text-white/40">{kitchens.length} found</span>
          </div>
          {kitchens.length === 0 ? (
            <div className="py-20 text-center rounded-3xl border border-white/10 bg-white/[0.04]">
              <p className="font-semibold text-white/90">No kitchens found</p>
              <p className="text-sm text-white/40 mt-1">Try a different dish or cuisine.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {kitchens.map((k) => (
                <KitchenCardV2 key={k.id} k={k} theme="dark" />
              ))}
            </div>
          )}
        </section>

        {/* Vendor CTA */}
        <section className="max-w-6xl mx-auto px-4 pb-16 pt-4">
          <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.02] px-7 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
            <div className="pointer-events-none absolute -right-10 -top-16 w-64 h-64 rounded-full blur-3xl" style={{ background: 'rgba(234,88,12,0.28)' }} />
            <div className="relative">
              <h3 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>Run a kitchen?</h3>
              <p className="text-sm text-white/55 mt-1.5 max-w-md">Get your own storefront, QR menu, and live orders. Start taking orders in 5 minutes.</p>
            </div>
            <Link href="/register" className="relative inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 font-bold text-sm shadow-[0_8px_28px_-8px_rgba(234,88,12,0.8)] hover:brightness-110 transition shrink-0">
              List your kitchen <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>

        <footer className="border-t border-white/10 bg-black/20">
          <div className="max-w-6xl mx-auto px-4 py-8 flex items-center justify-between text-xs text-white/45">
            <span className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5" /> Accra, Ghana 🇬🇭</span>
            <span>© {new Date().getFullYear()} Didi</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
