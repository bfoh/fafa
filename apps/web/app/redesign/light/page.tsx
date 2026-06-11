import Link from 'next/link';
import Image from 'next/image';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { Search, ShieldCheck, Bike, UtensilsCrossed, ArrowRight, MapPin } from 'lucide-react';
import { loadKitchens } from '@/lib/marketplace/load-kitchens';
import { CUISINES } from '@/lib/marketplace/cuisines';
import KitchenCardV2 from '@/components/marketplace/preview/kitchen-card-v2';

const display = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-display-light',
});

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Didi — Redesign preview (Light)' };

export default async function RedesignLight({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; cuisine?: string; near?: string }>;
}) {
  const sp = await searchParams;
  const kitchens = await loadKitchens(sp);
  const activeCuisine = sp.cuisine || 'all';

  return (
    <div
      className={`${display.variable} relative min-h-[100dvh] antialiased text-stone-900`}
      style={{ backgroundColor: '#FFF7ED' }}
    >
      {/* soft color blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -left-16 w-96 h-96 rounded-full blur-3xl" style={{ background: 'rgba(249,115,22,0.18)' }} />
        <div className="absolute top-10 -right-20 w-96 h-96 rounded-full blur-3xl" style={{ background: 'rgba(37,99,235,0.12)' }} />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <header className="sticky top-0 z-30 border-b border-stone-200/70 bg-[#FFF7ED]/80 backdrop-blur-xl">
          <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
            <Link href="/redesign" className="flex items-center gap-2.5">
              <Image src="/images/didi_favicon.png" alt="Didi" width={34} height={34} className="rounded-xl ring-1 ring-stone-200" />
              <span className="text-2xl font-extrabold text-orange-600" style={{ fontFamily: 'var(--font-display-light)' }}>
                Didi
              </span>
            </Link>
            <nav className="flex items-center gap-2.5 text-sm">
              <Link href="/register" className="px-4 py-2 rounded-full bg-orange-600 text-white font-bold text-xs shadow-[0_8px_20px_-8px_rgba(234,88,12,0.7)] hover:bg-orange-700 transition">
                List your kitchen
              </Link>
              <Link href="/login" className="px-4 py-2 rounded-full border border-stone-300 text-stone-700 font-semibold text-xs hover:bg-stone-100 transition">
                Sign in
              </Link>
            </nav>
          </div>
        </header>

        {/* Hero */}
        <section className="px-4 pt-12 sm:pt-16 pb-6 text-center">
          <p className="inline-flex items-center gap-2 text-xs font-bold tracking-wide uppercase text-orange-600 bg-orange-100/70 border border-orange-200 px-3 py-1.5 rounded-full mb-5">
            🇬🇭 Ghana&apos;s kitchens, delivered
          </p>
          <h1 className="text-[clamp(2.4rem,9vw,4.25rem)] font-extrabold leading-[1.02] tracking-tight text-stone-900" style={{ fontFamily: 'var(--font-display-light)' }}>
            What do you want to{' '}
            <span className="text-orange-600">eat?</span>
          </h1>
          <p className="text-base text-stone-500 mt-4 mb-7 max-w-md mx-auto">
            Order from the best local kitchens near you — pay with Mobile Money or card.
          </p>

          {/* Search */}
          <form className="max-w-xl mx-auto flex items-center gap-1.5 p-1.5 bg-white border border-stone-200 rounded-full shadow-[0_14px_40px_-14px_rgba(15,23,42,0.18)]">
            <div className="flex items-center flex-1 min-w-0 pl-4">
              <Search className="w-4 h-4 text-stone-400 shrink-0" />
              <input
                name="q"
                defaultValue={sp.q || ''}
                placeholder="Search jollof, waakye, pizza…"
                className="flex-1 min-w-0 px-3 py-2.5 text-sm bg-transparent text-stone-900 placeholder:text-stone-400 outline-none"
              />
            </div>
            <button type="submit" className="grid place-items-center h-11 px-5 rounded-full bg-orange-600 text-white font-bold text-sm shadow-[0_8px_20px_-8px_rgba(234,88,12,0.8)] hover:bg-orange-700 transition">
              Search
            </button>
          </form>

          {/* Cuisine chips */}
          <div className="mt-5 flex gap-2 overflow-x-auto no-scrollbar px-4 -mx-4 sm:flex-wrap sm:justify-center sm:mx-0 sm:px-0">
            <Link href="/redesign/light" className={`shrink-0 px-4 py-2 rounded-full text-xs font-bold border transition ${activeCuisine === 'all' ? 'bg-orange-600 text-white border-transparent' : 'bg-white text-stone-600 border-stone-200 hover:border-orange-300'}`}>
              All
            </Link>
            {CUISINES.map((c) => (
              <Link key={c.slug} href={`/redesign/light?cuisine=${c.slug}`} className={`shrink-0 px-4 py-2 rounded-full text-xs font-bold border transition ${activeCuisine === c.slug ? 'bg-orange-600 text-white border-transparent' : 'bg-white text-stone-600 border-stone-200 hover:border-orange-300'}`}>
                {c.label}
              </Link>
            ))}
          </div>
        </section>

        {/* Trust strip */}
        <section className="max-w-4xl mx-auto px-4 py-4">
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: ShieldCheck, label: 'MoMo & Card', sub: 'Secure checkout', tone: 'text-blue-600 bg-blue-50' },
              { icon: Bike, label: 'Live tracking', sub: 'Rider on a map', tone: 'text-orange-600 bg-orange-50' },
              { icon: UtensilsCrossed, label: `${kitchens.length} kitchens`, sub: 'Open near you', tone: 'text-emerald-600 bg-emerald-50' },
            ].map((t) => (
              <div key={t.label} className="flex items-center gap-2.5 rounded-2xl border border-stone-200 bg-white px-3.5 py-3 shadow-sm">
                <span className={`w-9 h-9 rounded-xl grid place-items-center shrink-0 ${t.tone}`}>
                  <t.icon className="w-5 h-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-bold truncate text-stone-900">{t.label}</p>
                  <p className="text-[10px] text-stone-400 truncate">{t.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Results */}
        <section className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex items-baseline justify-between mb-6">
            <h2 className="text-2xl font-extrabold text-stone-900" style={{ fontFamily: 'var(--font-display-light)' }}>All kitchens</h2>
            <span className="text-xs font-semibold text-stone-400">{kitchens.length} found</span>
          </div>
          {kitchens.length === 0 ? (
            <div className="py-20 text-center rounded-3xl border border-stone-200 bg-white">
              <p className="font-semibold text-stone-800">No kitchens found</p>
              <p className="text-sm text-stone-400 mt-1">Try a different dish or cuisine.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {kitchens.map((k) => (
                <KitchenCardV2 key={k.id} k={k} theme="light" />
              ))}
            </div>
          )}
        </section>

        {/* Vendor CTA */}
        <section className="max-w-6xl mx-auto px-4 pb-16 pt-4">
          <div className="relative overflow-hidden rounded-[28px] px-7 py-9 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 text-white" style={{ backgroundImage: 'linear-gradient(135deg, #F97316, #EA580C)' }}>
            <div className="pointer-events-none absolute -right-12 -bottom-16 w-72 h-72 rounded-full blur-3xl bg-white/20" />
            <div className="relative">
              <h3 className="text-2xl font-extrabold" style={{ fontFamily: 'var(--font-display-light)' }}>Run a kitchen?</h3>
              <p className="text-sm text-white/85 mt-1.5 max-w-md">Get your own storefront, QR menu, and live orders. Start taking orders in 5 minutes.</p>
            </div>
            <Link href="/register" className="relative inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-white text-orange-700 font-bold text-sm shadow-lg hover:bg-orange-50 transition shrink-0">
              List your kitchen <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>

        <footer className="border-t border-stone-200 bg-white/50">
          <div className="max-w-6xl mx-auto px-4 py-8 flex items-center justify-between text-xs text-stone-500">
            <span className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5" /> Accra, Ghana 🇬🇭</span>
            <span>© {new Date().getFullYear()} Didi</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
