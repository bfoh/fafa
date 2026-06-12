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
  // Dish photos still back up a missing cover image — they just no longer
  // render as a list inside the card.
  const heroImg = k.cover_image_url || dishes.find((d) => d.image_url)?.image_url || null;
  const tags = k.cuisines.slice(0, 3);
  const extraTags = k.cuisines.length - tags.length;
  const place = [k.city, k.region].filter(Boolean).join(', ');

  return (
    <Link
      href={`/${k.slug}`}
      className="group relative flex flex-col rounded-3xl overflow-hidden bg-white border border-hairline shadow-card transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-card-hover active:scale-[0.98]"
    >
      {/* Cover — full-bleed image across the card top */}
      <div className="relative">
        <div className="relative aspect-[16/9] overflow-hidden">
          {heroImg ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={heroImg}
              alt=""
              className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.06]"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-brand-100 via-brand-200 to-brand-300" />
          )}

          {/* Status badges — translucent glass over the photo */}
          <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide bg-white/70 backdrop-blur-md text-surface-900 shadow-sm">
            <span className={k.open_now ? 'text-success-600' : 'text-error-500'}>●</span>
            {k.open_now ? 'Open now' : 'Closed'}
          </span>
          {distance && (
            <span className="absolute top-3 right-3 inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-white/70 backdrop-blur-md text-surface-900 shadow-sm">
              {distance}
            </span>
          )}
        </div>

        {/* Logo — straddling the photo/body seam */}
        <div className="absolute -bottom-6 left-5 z-10 w-12 h-12 rounded-2xl ring-2 ring-white bg-brand-500 overflow-hidden flex items-center justify-center text-white font-extrabold text-base shadow-card">
          {k.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={k.logo_url} alt="" className="w-full h-full object-cover" />
          ) : (
            k.name.charAt(0)
          )}
        </div>
      </div>

      {/* Body — name, rating, place, tags. Whitespace does the talking. */}
      <div className="flex flex-col flex-1 pt-9 px-5 pb-5">
        <h3 className="font-bold text-[16px] text-surface-900 truncate group-hover:text-brand-600 transition-colors duration-300">
          {k.name}
        </h3>
        <div className="flex items-center gap-2 mt-1">
          {(k.rating_count ?? 0) > 0 && (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-500">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              {Number(k.rating_avg).toFixed(1)}
              <span className="text-surface-400 font-normal">({k.rating_count})</span>
            </span>
          )}
          <p className="text-xs text-surface-400 truncate">{place || 'Kitchen'}</p>
        </div>

        {/* Cuisine tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {tags.map((t) => (
              <span
                key={t}
                className="px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wide bg-surface-100 text-surface-600"
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

        {/* Footer */}
        <div className="mt-auto pt-4">
          <div className="flex items-center justify-between text-[11px] text-surface-400 pt-3.5 border-t border-hairline">
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
