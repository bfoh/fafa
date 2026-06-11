import Link from 'next/link';
import { Star, MapPin, Clock, Bike } from 'lucide-react';
import { formatGHS } from '@/lib/utils/currency';
import type { KitchenResult } from '@/components/marketplace/kitchen-card';

/**
 * Redesign-preview kitchen card. Theme-aware (dark | light) so both candidate
 * directions can be compared on the same data. Preview-only — does not touch the
 * live marketplace components.
 */
export default function KitchenCardV2({
  k,
  theme,
}: {
  k: KitchenResult;
  theme: 'dark' | 'light';
}) {
  const dishes = (k.items ?? []).slice(0, 3);
  const heroImg = k.cover_image_url || dishes.find((d) => d.image_url)?.image_url || null;
  const tags = k.cuisines.slice(0, 2);
  const rating = Number(k.rating_avg) || 0;
  const ratingCount = Number(k.rating_count) || 0;
  const dark = theme === 'dark';

  return (
    <Link
      href={`/${k.slug}`}
      className={[
        'group relative flex flex-col rounded-3xl overflow-hidden transition-all duration-300 active:scale-[0.99]',
        dark
          ? 'border border-white/10 bg-white/[0.05] backdrop-blur-2xl shadow-[0_12px_40px_-14px_rgba(0,0,0,0.6)] hover:-translate-y-1 hover:border-brand-400/40 hover:shadow-[0_24px_60px_-16px_rgba(234,88,12,0.34)]'
          : 'border border-stone-200 bg-white shadow-[0_8px_30px_-12px_rgba(15,23,42,0.12)] hover:-translate-y-1 hover:shadow-[0_20px_50px_-16px_rgba(234,88,12,0.28)] hover:border-orange-300',
      ].join(' ')}
    >
      <div className="relative h-44 overflow-hidden">
        {heroImg ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={heroImg}
            alt=""
            className="w-full h-full object-cover transition-transform duration-[600ms] ease-out group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-orange-400 to-orange-700" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/5 to-transparent" />

        <span
          className={[
            'absolute top-3 left-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold backdrop-blur',
            k.open_now ? 'bg-emerald-500/90 text-white' : 'bg-stone-700/80 text-white',
          ].join(' ')}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-white" />
          {k.open_now ? 'Open now' : 'Pre-order'}
        </span>

        {ratingCount > 0 && (
          <span className="absolute top-3 right-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-white/95 text-stone-900 shadow">
            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
            {rating.toFixed(1)}
          </span>
        )}

        <div className="absolute -bottom-6 left-4 w-12 h-12 rounded-2xl ring-2 ring-white overflow-hidden bg-orange-500 grid place-items-center text-white font-extrabold shadow-lg">
          {k.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={k.logo_url} alt="" className="w-full h-full object-cover" />
          ) : (
            k.name.charAt(0)
          )}
        </div>
      </div>

      <div className="pt-8 px-4 pb-4 flex flex-col flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3
            className={[
              'font-bold text-[15px] leading-tight truncate',
              dark ? 'text-white' : 'text-stone-900',
            ].join(' ')}
          >
            {k.name}
          </h3>
        </div>
        <p className={['text-xs mt-0.5 truncate', dark ? 'text-white/45' : 'text-stone-500'].join(' ')}>
          {k.tagline || 'Delicious local kitchen'}
        </p>

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {tags.map((t) => (
              <span
                key={t}
                className={[
                  'px-2 py-0.5 rounded-full text-[10px] font-semibold',
                  dark ? 'bg-white/8 text-white/60 border border-white/10' : 'bg-orange-50 text-orange-700 border border-orange-100',
                ].join(' ')}
              >
                {t}
              </span>
            ))}
          </div>
        )}

        {dishes.length > 0 && (
          <div className={['mt-3 pt-3 space-y-1.5 border-t', dark ? 'border-white/8' : 'border-stone-100'].join(' ')}>
            {dishes.map((d, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className={['truncate pr-3', dark ? 'text-white/70' : 'text-stone-600'].join(' ')}>{d.name}</span>
                <span className="font-bold text-orange-500 shrink-0">
                  {d.is_chop_bar && d.price === 0 ? 'Your way' : formatGHS(d.price)}
                </span>
              </div>
            ))}
          </div>
        )}

        <div
          className={[
            'mt-3.5 pt-3 flex items-center justify-between text-[11px] font-medium border-t',
            dark ? 'border-white/8 text-white/45' : 'border-stone-100 text-stone-500',
          ].join(' ')}
        >
          <span className="flex items-center gap-1">
            <MapPin className="w-3 h-3" /> {k.city || 'Accra'}
          </span>
          <span className="flex items-center gap-2">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" /> {k.open_now ? '30–45m' : 'Pre-order'}
            </span>
            <span className="flex items-center gap-1 font-bold text-orange-500">
              <Bike className="w-3 h-3" />
              {Number(k.delivery_fee) === 0 ? 'Free' : formatGHS(Number(k.delivery_fee))}
            </span>
          </span>
        </div>
      </div>
    </Link>
  );
}
