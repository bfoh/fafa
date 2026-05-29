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
      className="flex max-w-xl mx-auto items-center gap-1.5 p-1.5 bg-white/[0.07] border border-white/15 rounded-full backdrop-blur-2xl shadow-[0_12px_40px_-10px_rgba(0,0,0,0.6)]"
    >
      <div className="flex items-center flex-1 pl-4">
        <Search className="w-4 h-4 text-white/40 shrink-0" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search jollof, waakye, pizza, a kitchen…"
          className="flex-1 px-3 py-2.5 text-sm outline-none bg-transparent text-white placeholder:text-white/40"
        />
      </div>
      <button
        type="button"
        onClick={useMyLocation}
        className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-full text-xs font-bold transition-colors ${
          nearActive
            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/30'
            : 'text-white/80 hover:bg-white/10'
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
        className="grid place-items-center w-11 h-11 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-white shrink-0 shadow-[0_6px_20px_-6px_rgba(255,107,53,0.8)] hover:brightness-110 disabled:opacity-60 transition-all"
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
