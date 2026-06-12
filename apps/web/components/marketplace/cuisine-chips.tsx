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
        className={`snap-start-item shrink-0 px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-300 ease-out active:scale-[0.96] disabled:opacity-60 ${
          on
            ? 'bg-brand-500 text-white shadow-cta'
            : 'bg-white text-surface-600 border border-hairline shadow-sm hover:text-surface-900 hover:shadow-card'
        }`}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar snap-rail px-4 -mx-4 sm:flex-wrap sm:justify-center sm:overflow-visible sm:mx-0 sm:px-0">
      {chip('all', 'All')}
      {CUISINES.map((c) => chip(c.slug, `${c.emoji} ${c.label}`))}
    </div>
  );
}
