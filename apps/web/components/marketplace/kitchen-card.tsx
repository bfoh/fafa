import Link from 'next/link';
import { CUISINE_LABEL } from '@/lib/marketplace/cuisines';
import { formatDistance } from '@/lib/marketplace/geo';
import { formatGHS } from '@/lib/utils/currency';

export interface MenuPreview {
  name: string;
  price: number;
  image_url: string | null;
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
      className="group relative flex flex-col rounded-[26px] overflow-hidden border border-white/10 bg-white/[0.055] backdrop-blur-2xl shadow-[0_10px_40px_-12px_rgba(0,0,0,0.6)] transition-all duration-300 hover:-translate-y-1.5 hover:border-brand-400/40 hover:bg-white/[0.08] hover:shadow-[0_24px_60px_-14px_rgba(255,107,53,0.34)]"
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
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-black/30" />

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
        <div className="absolute -bottom-7 left-5 z-10 w-14 h-14 rounded-2xl border-2 border-white/30 bg-brand-500 overflow-hidden flex items-center justify-center text-white font-extrabold text-lg shadow-[0_8px_24px_-6px_rgba(0,0,0,0.7)]">
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
        <h3 className="font-bold text-[16px] text-white truncate group-hover:text-brand-300 transition-colors">
          {k.name}
        </h3>
        <p className="text-xs text-white/45 mt-0.5 truncate">
          {k.city || 'Kitchen'}
        </p>

        {/* Cuisine tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {tags.map((t) => (
              <span
                key={t}
                className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-white/8 border border-white/12 text-white/75"
              >
                {CUISINE_LABEL[t] || t}
              </span>
            ))}
            {extraTags > 0 && (
              <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-white/8 border border-white/12 text-white/75">
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
                <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 bg-white/5 border border-white/10">
                  {d.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={d.image_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-brand-500/60 to-[#5e2412]/60" />
                  )}
                </div>
                <span className="flex-1 text-[13px] text-white/85 truncate">
                  {d.name}
                </span>
                <span className="text-[13px] font-bold text-brand-300 shrink-0">
                  {formatGHS(d.price)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="mt-auto pt-4">
          <div className="flex items-center justify-between text-[11px] text-white/55 pt-3.5 border-t border-white/10">
            <span>{k.item_count} dishes</span>
            <span className="font-semibold text-white/70">
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
