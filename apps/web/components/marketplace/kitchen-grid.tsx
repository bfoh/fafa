import { Search } from 'lucide-react';
import KitchenCard, { type KitchenResult } from './kitchen-card';

export default function KitchenGrid({
  kitchens,
}: {
  kitchens: KitchenResult[];
}) {
  if (kitchens.length === 0) {
    return (
      <div className="py-20 text-center rounded-[26px] border border-white/10 bg-white/[0.04] backdrop-blur-xl">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
          <Search className="w-7 h-7 text-white/40" />
        </div>
        <p className="font-semibold text-white/90">No kitchens found</p>
        <p className="text-sm text-white/40 mt-1">
          Try a different dish, cuisine, or clear your filters.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {kitchens.map((k) => (
        <KitchenCard key={k.id} k={k} />
      ))}
    </div>
  );
}
