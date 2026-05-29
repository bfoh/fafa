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
      className="group relative rounded-[26px] overflow-hidden border border-white/10 bg-white/[0.055] backdrop-blur-2xl shadow-[0_10px_40px_-12px_rgba(0,0,0,0.6)] transition-all duration-300 hover:-translate-y-1 hover:border-brand-400/40 hover:bg-white/[0.08] hover:shadow-[0_22px_50px_-12px_rgba(255,107,53,0.28)]"
    >
      {/* Cover */}
      <div className="relative h-32 overflow-hidden">
        {k.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={k.cover_image_url}
            alt=""
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-brand-500 via-[#d6552a] to-[#7a2f17]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/10" />

        <span className="absolute top-3 left-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide bg-black/35 backdrop-blur-md border border-white/15 text-white">
          <span className={k.open_now ? 'text-emerald-400' : 'text-rose-400'}>●</span>
          {k.open_now ? 'Open' : 'Closed'}
        </span>

        <div className="absolute -bottom-6 left-4 w-14 h-14 rounded-2xl border-2 border-white/25 bg-brand-500 overflow-hidden flex items-center justify-center text-white font-extrabold text-lg shadow-lg">
          {k.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={k.logo_url} alt="" className="w-full h-full object-cover" />
          ) : (
            k.name.charAt(0)
          )}
        </div>
      </div>

      {/* Body */}
      <div className="pt-9 px-5 pb-5">
        <h3 className="font-bold text-[15px] text-white truncate group-hover:text-brand-300 transition-colors">
          {k.name}
        </h3>
        <p className="text-xs text-white/45 mt-1 truncate">{cuisineLine}</p>

        <div className="flex items-center gap-3 text-[11px] text-white/55 mt-4 pt-3.5 border-t border-white/10">
          {distance && (
            <span className="font-semibold text-white">{distance}</span>
          )}
          <span>{k.item_count} items</span>
          <span className="ml-auto text-brand-300 font-semibold">
            {formatGHS(Number(k.delivery_fee || 0))} delivery
          </span>
        </div>
      </div>
    </Link>
  );
}
