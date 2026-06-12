import { Search } from 'lucide-react';
import KitchenCard, { type KitchenResult } from './kitchen-card';

export default function KitchenGrid({
  kitchens,
}: {
  kitchens: KitchenResult[];
}) {
  if (kitchens.length === 0) {
    return (
      <div className="py-20 text-center rounded-3xl border border-hairline bg-white shadow-card">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-surface-50 border border-hairline flex items-center justify-center mb-4">
          <Search className="w-7 h-7 text-surface-300" />
        </div>
        <p className="font-bold text-surface-900">No kitchens found</p>
        <p className="text-sm text-surface-400 mt-1">
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
