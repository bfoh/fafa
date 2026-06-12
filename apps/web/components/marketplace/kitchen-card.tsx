import Link from 'next/link';
import { Star } from 'lucide-react';
import { CUISINE_LABEL } from '@/lib/marketplace/cuisines';
import { formatDistance } from '@/lib/marketplace/geo';
import { formatGHS } from '@/lib/utils/currency';

export interface MenuPreview {
  name: string;
  price: number;
  image_url: string | null;
  is_chop_bar?: boolean;
}

export interface KitchenResult {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
  city: string | null;
  region: string | null;
  cuisines: string[];
  delivery_fee: number | null;
  min_order_amount: number | null;
  item_count: number;
  open_now: boolean;
  distance_km: number | null;
  rating_avg?: number | null;
  rating_count?: number | null;
  items?: MenuPreview[];
}

export default function KitchenCard({ k }: { k: KitchenResult }) {
  const distance = formatDistance(k.distance_km);
  const dishes = k.items ?? [];
  const heroImg = k.cover_image_url || dishes.find((d) => d.image_url)?.image_url || null;
  const tags = k.cuisines.slice(0, 2);
  const extraTags = k.cuisines.length - tags.length;

  return (
    <Link
      href={`/${k.slug}`}
      className="group relative flex flex-col h-full rounded-[26px] overflow-hidden border border-hairline bg-white shadow-card transition-all duration-300 hover:-translate-y-1.5 hover:border-brand-400/40 hover:shadow-[0_24px_60px_-14px_rgba(255,107,53,0.25)] active:scale-[0.985] active:border-brand-400/40"
    >
      {/* Hero (image clipped) + logo straddling the seam (not clipped) */}
      <div className="relative">
        <div className="relative h-44 overflow-hidden rounded-t-[26px]">
          {heroImg ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={heroImg}
              alt=""
              className="w-full h-full object-cover transition-transform duration-[600ms] ease-out group-hover:scale-110"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-brand-500 via-[#d6552a] to-[#5e2412]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/5 to-black/15" />

          {/* Open / closed */}
          <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide bg-black/45 backdrop-blur-md border border-white/15 text-white">
            <span className={k.open_now ? 'text-emerald-400' : 'text-rose-400'}>●</span>
            {k.open_now ? 'Open now' : 'Closed'}
          </span>

          {/* Distance */}
          {distance && (
            <span className="absolute top-3 right-3 inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-black/45 backdrop-blur-md border border-white/15 text-white">
              {distance}
            </span>
          )}
        </div>

        {/* Logo — half over the photo, half over the body */}
        <div className="absolute -bottom-7 left-5 z-10 w-14 h-14 rounded-2xl border-2 border-white bg-brand-500 overflow-hidden flex items-center justify-center text-white font-extrabold text-lg shadow-[0_8px_24px_-6px_rgba(0,0,0,0.35)]">
          {k.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={k.logo_url} alt="" className="w-full h-full object-cover" />
          ) : (
            k.name.charAt(0)
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-col flex-1 pt-10 px-5 pb-5">
        <h3 className="font-bold text-[16px] text-surface-900 truncate group-hover:text-brand-600 transition-colors">
          {k.name}
        </h3>
        <div className="flex items-center gap-2 mt-0.5">
          {(k.rating_count ?? 0) > 0 && (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-500">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              {Number(k.rating_avg).toFixed(1)}
              <span className="text-surface-400 font-normal">({k.rating_count})</span>
            </span>
          )}
          <p className="text-xs text-surface-400 truncate">{k.city || 'Kitchen'}</p>
        </div>

        {/* Cuisine tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {tags.map((t) => (
              <span
                key={t}
                className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-surface-100 text-surface-600"
              >
                {CUISINE_LABEL[t] || t}
              </span>
            ))}
            {extraTags > 0 && (
              <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-surface-100 text-surface-600">
                +{extraTags}
              </span>
            )}
          </div>
        )}

        {/* Dish preview */}
        {dishes.length > 0 && (
          <div className="mt-4 space-y-2">
            {dishes.map((d, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 bg-surface-100 ring-1 ring-black/5">
                  {d.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={d.image_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-brand-200 to-brand-100" />
                  )}
                </div>
                <span className="flex-1 text-[13px] text-surface-700 truncate">
                  {d.name}
                </span>
                {d.is_chop_bar ? (
                  <span className="text-[11px] font-bold text-brand-600 shrink-0">
                    {d.price > 0 ? `from ${formatGHS(d.price)}` : 'Order your way'}
                  </span>
                ) : (
                  <span className="text-[13px] font-bold text-brand-600 shrink-0 tabular-nums">
                    {formatGHS(d.price)}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="mt-auto pt-4">
          <div className="flex items-center justify-between text-[11px] text-surface-400 pt-3.5 border-t border-surface-100">
            <span>{k.item_count} dishes</span>
            <span className="font-semibold text-surface-600">
              {Number(k.delivery_fee || 0) === 0
                ? 'Free delivery'
                : `${formatGHS(Number(k.delivery_fee))} delivery`}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
