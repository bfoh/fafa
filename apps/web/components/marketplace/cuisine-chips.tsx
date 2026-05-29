'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { CUISINES } from '@/lib/marketplace/cuisines';

export default function CuisineChips() {
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const active = params.get('cuisine') || 'all';

  function select(slug: string) {
    const next = new URLSearchParams(params.toString());
    if (slug === 'all') next.delete('cuisine');
    else next.set('cuisine', slug);
    startTransition(() =>
      router.replace(`/?${next.toString()}`, { scroll: false })
    );
  }

  const chip = (slug: string, label: string) => {
    const on = active === slug;
    return (
      <button
        key={slug}
        onClick={() => select(slug)}
        disabled={isPending}
        className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors disabled:opacity-60 ${
          on
            ? 'bg-surface-900 text-white border-surface-900'
            : 'bg-white text-surface-600 border-surface-200 hover:border-surface-300'
        }`}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="flex flex-wrap gap-2 justify-center">
      {chip('all', 'All')}
      {CUISINES.map((c) => chip(c.slug, `${c.emoji} ${c.label}`))}
    </div>
  );
}
