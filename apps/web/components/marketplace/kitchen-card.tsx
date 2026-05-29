import Link from 'next/link';
import { CUISINE_LABEL } from '@/lib/marketplace/cuisines';
import { formatDistance } from '@/lib/marketplace/geo';
import { formatGHS } from '@/lib/utils/currency';

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
}

export default function KitchenCard({ k }: { k: KitchenResult }) {
  const distance = formatDistance(k.distance_km);
  const cuisineLine = k.cuisines.length
    ? k.cuisines.map((c) => CUISINE_LABEL[c] || c).slice(0, 3).join(' · ')
    : k.city || 'Kitchen';

  return (
    <Link
      href={`/${k.slug}`}
      className="group bg-white rounded-2xl border border-surface-100 overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all"
    >
      <div className="relative h-28 bg-surface-100">
        {k.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={k.cover_image_url}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-brand-400 to-brand-600" />
        )}
        <span
          className={`absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
            k.open_now
              ? 'bg-white/95 text-success-700'
              : 'bg-white/95 text-error-700'
          }`}
        >
          ● {k.open_now ? 'Open' : 'Closed'}
        </span>
        <div className="absolute -bottom-5 left-4 w-12 h-12 rounded-xl border-[3px] border-white bg-brand-500 overflow-hidden flex items-center justify-center text-white font-bold">
          {k.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={k.logo_url} alt="" className="w-full h-full object-cover" />
          ) : (
            k.name.charAt(0)
          )}
        </div>
      </div>

      <div className="pt-7 px-4 pb-4">
        <h3 className="font-bold text-surface-900 group-hover:text-brand-600 transition-colors truncate">
          {k.name}
        </h3>
        <p className="text-xs text-surface-400 mt-0.5 truncate">{cuisineLine}</p>
        <div className="flex items-center gap-3 text-[11px] text-surface-500 mt-3 pt-3 border-t border-surface-100">
          {distance && (
            <span className="font-semibold text-surface-800">{distance}</span>
          )}
          <span>{k.item_count} items</span>
          <span>{formatGHS(Number(k.delivery_fee || 0))} delivery</span>
        </div>
      </div>
    </Link>
  );
}
