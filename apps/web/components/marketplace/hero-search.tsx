'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import { MapPin, Search, Loader2 } from 'lucide-react';

export default function HeroSearch() {
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [q, setQ] = useState(params.get('q') || '');
  const [locating, setLocating] = useState(false);
  const nearActive = !!params.get('near');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const next = new URLSearchParams(params.toString());
    if (q.trim()) next.set('q', q.trim());
    else next.delete('q');
    startTransition(() =>
      router.replace(`/?${next.toString()}`, { scroll: false })
    );
  }

  function useMyLocation() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = new URLSearchParams(params.toString());
        next.set('near', `${pos.coords.latitude},${pos.coords.longitude}`);
        setLocating(false);
        startTransition(() =>
          router.replace(`/?${next.toString()}`, { scroll: false })
        );
      },
      () => setLocating(false), // denied/unavailable: silently keep default sort
      { timeout: 8000 }
    );
  }

  return (
    <form
      onSubmit={submit}
      className="max-w-xl mx-auto flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-1.5 sm:p-1.5 sm:bg-white sm:rounded-full sm:shadow-float"
    >
      {/* Search field — full-width pill on mobile, inline on sm+ */}
      <div className="flex items-center flex-1 min-w-0 px-4 h-12 bg-white rounded-full shadow-float sm:h-auto sm:px-0 sm:pl-4 sm:shadow-none">
        <Search className="w-4 h-4 text-surface-400 shrink-0" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search jollof, waakye, pizza…"
          className="flex-1 min-w-0 px-3 py-2.5 text-sm outline-none bg-transparent text-surface-900 placeholder:text-surface-400"
        />
      </div>
      {/* Actions — second row on mobile so the submit button is never clipped */}
      <div className="flex items-center gap-2 sm:gap-1.5">
        <button
          type="button"
          onClick={useMyLocation}
          className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 h-11 rounded-full text-xs font-bold transition-all duration-300 ease-out active:scale-[0.98] ${
            nearActive
              ? 'bg-success-500/10 text-success-600'
              : 'bg-white shadow-float text-surface-600 hover:text-surface-900 sm:bg-transparent sm:shadow-none'
          }`}
        >
          {locating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <MapPin className="w-4 h-4" />
          )}
          {nearActive ? 'Near you' : 'Near me'}
        </button>
        <button
          type="submit"
          disabled={isPending}
          aria-label="Search"
          className="grid place-items-center w-11 h-11 shrink-0 rounded-full bg-brand-500 text-white shadow-cta hover:bg-brand-600 disabled:opacity-60 transition-all duration-300 ease-out active:scale-[0.98]"
        >
          {isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Search className="w-4 h-4" />
          )}
        </button>
      </div>
    </form>
  );
}
