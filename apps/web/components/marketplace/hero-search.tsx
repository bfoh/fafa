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
      className="flex max-w-xl mx-auto bg-white border border-surface-200 rounded-full shadow-lg overflow-hidden"
    >
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search jollof, waakye, pizza, a kitchen…"
        className="flex-1 px-5 py-3.5 text-sm outline-none bg-transparent text-surface-900 placeholder:text-surface-400"
      />
      <button
        type="button"
        onClick={useMyLocation}
        className={`flex items-center gap-1.5 px-4 text-xs font-bold border-l border-surface-100 ${
          nearActive ? 'text-success-600' : 'text-brand-500'
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
        className="bg-brand-500 hover:bg-brand-600 text-white px-5 flex items-center font-bold text-sm disabled:opacity-60"
      >
        {isPending ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Search className="w-4 h-4" />
        )}
      </button>
    </form>
  );
}
