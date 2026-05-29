import { Search } from 'lucide-react';
import KitchenCard, { type KitchenResult } from './kitchen-card';

export default function KitchenGrid({
  kitchens,
}: {
  kitchens: KitchenResult[];
}) {
  if (kitchens.length === 0) {
    return (
      <div className="py-16 text-center">
        <div className="w-14 h-14 mx-auto rounded-full bg-surface-100 flex items-center justify-center mb-4">
          <Search className="w-6 h-6 text-surface-400" />
        </div>
        <p className="font-semibold text-surface-700">No kitchens found</p>
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
