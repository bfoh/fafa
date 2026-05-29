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
        className={`px-4 py-2 rounded-full text-xs font-semibold border whitespace-nowrap transition-all duration-200 disabled:opacity-60 ${
          on
            ? 'bg-gradient-to-br from-brand-400 to-brand-600 text-white border-transparent shadow-[0_6px_20px_-6px_rgba(255,107,53,0.7)]'
            : 'bg-white/5 text-white/70 border-white/10 backdrop-blur-md hover:bg-white/10 hover:text-white'
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
