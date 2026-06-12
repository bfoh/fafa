'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Search, Star, MapPin, Compass, Clock, Sparkles, ArrowRight, Bike } from 'lucide-react';
import { AdepaWidget } from '@fafa/storefront';
import { Geolocation } from '@capacitor/geolocation';

const API = process.env.NEXT_PUBLIC_API_BASE ?? 'https://ghdidi.com';

interface MenuPreview {
  name: string;
  price: number;
  image_url: string | null;
  is_chop_bar?: boolean;
}

interface KitchenResult {
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
  rating_avg?: number | null;
  rating_count?: number | null;
  items?: MenuPreview[];
}

const CUISINES = [
  { slug: 'local', label: 'Local', emoji: '🍛' },
  { slug: 'continental', label: 'Continental', emoji: '🍽️' },
  { slug: 'fast-food', label: 'Fast Food', emoji: '🍔' },
  { slug: 'grills', label: 'Grills', emoji: '🍗' },
  { slug: 'pizza', label: 'Pizza', emoji: '🍕' },
  { slug: 'chinese', label: 'Chinese', emoji: '🥡' },
  { slug: 'pastries', label: 'Pastries', emoji: '🥐' },
  { slug: 'drinks', label: 'Drinks', emoji: '🥤' },
  { slug: 'healthy', label: 'Healthy', emoji: '🥗' },
  { slug: 'breakfast', label: 'Breakfast', emoji: '🍳' },
];

export default function MobileMarketplaceHome() {
  const [q, setQ] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCuisine, setSelectedCuisine] = useState('all');
  const [near, setNear] = useState('');
  const [locating, setLocating] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['marketplace', searchQuery, selectedCuisine, near],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.set('q', searchQuery);
      if (selectedCuisine && selectedCuisine !== 'all') {
        params.set('cuisine', selectedCuisine);
      }
      if (near) params.set('near', near);
      const res = await fetch(`${API}/api/marketplace?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch marketplace');
      return res.json() as Promise<{ kitchens: KitchenResult[] }>;
    },
  });

  const kitchens = data?.kitchens ?? [];

  const formatGHS = (value: number) => {
    return `GH₵${value.toFixed(2)}`;
  };

  const handleSearchSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    setSearchQuery(q);
  };

  const toggleLocation = async () => {
    if (near) {
      setNear('');
      return;
    }
    setLocating(true);
    try {
      const coordinates = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 8000,
      });
      setNear(`${coordinates.coords.latitude},${coordinates.coords.longitude}`);
    } catch (err) {
      console.warn('Native geolocation failed:', err);
    } finally {
      setLocating(false);
    }
  };

  return (
    <main
      className="min-h-screen text-surface-900 antialiased overflow-y-auto pb-safe-bottom"
      style={{
        backgroundColor: '#FCFBFA',
        backgroundImage: [
          'radial-gradient(70% 40% at 50% -5%, rgba(255,107,53,0.10), transparent 70%)',
          'radial-gradient(40% 30% at 90% 15%, rgba(255,150,90,0.06), transparent 70%)',
        ].join(','),
      }}
    >
      <div className="relative z-10 px-4 pt-safe pb-20 max-w-lg mx-auto">
        {/* Top Header */}
        <header className="flex items-center justify-between py-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl ring-1 ring-black/5 bg-white flex items-center justify-center shadow-sm overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/didi_favicon.png"
                alt="Didi"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>
            <div>
              <span
                className="text-2xl font-extrabold bg-gradient-to-br from-brand-400 to-brand-600 bg-clip-text text-transparent block leading-none"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Didi
              </span>
              <span className="text-[10px] text-surface-400 font-medium tracking-wide uppercase">
                Ghana&apos;s kitchens
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/for-restaurants"
              className="px-3 py-1.5 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-white font-bold text-[10px] shadow-[0_4px_12px_-4px_rgba(255,107,53,0.6)] hover:brightness-110 transition-all whitespace-nowrap"
            >
              <span className="inline-flex items-center gap-0.5">
                List kitchen
                <ArrowRight className="w-3 h-3" />
              </span>
            </Link>
            <Link
              href="/rider"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-white border border-hairline shadow-sm hover:bg-surface-50 transition-colors text-[10px] font-semibold text-surface-600 whitespace-nowrap"
            >
              <Bike className="w-3 h-3" />
              Rider Portal
            </Link>
          </div>
        </header>

        {/* Hero title */}
        <section className="py-4">
          <h1
            className="text-3xl font-extrabold leading-tight tracking-tight text-surface-900"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            What do you want
            <br />
            to <span className="bg-gradient-to-br from-brand-400 via-brand-500 to-brand-600 bg-clip-text text-transparent">eat?</span>
          </h1>
          <p className="text-xs text-surface-500 mt-1.5">
            Order from local kitchens near you — pay with MoMo or card.
          </p>
        </section>

        {/* Search input & geolocation actions */}
        <section className="my-5">
          <form onSubmit={handleSearchSubmit} className="space-y-3">
            <div className="relative flex items-center rounded-full border border-hairline bg-white shadow-card focus-within:border-brand-500/50 transition-all duration-300">
              <Search className="w-5 h-5 text-surface-400 absolute left-4 pointer-events-none" />
              <input
                type="text"
                placeholder="Search jollof, waakye, pizza..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="w-full h-12 pl-12 pr-4 bg-transparent border-none text-surface-900 text-sm placeholder:text-surface-400 focus:outline-none focus:ring-0"
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={toggleLocation}
                className={`flex-1 h-12 rounded-full border flex items-center justify-center gap-2 text-sm font-semibold transition-all active:scale-[0.98] ${
                  near
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700'
                    : 'bg-white border-hairline text-surface-600 shadow-sm hover:bg-surface-50'
                }`}
              >
                {locating ? (
                  <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                ) : (
                  <MapPin className="w-4 h-4" />
                )}
                {near ? 'Near you' : 'Near me'}
              </button>

              <button
                type="submit"
                className="w-12 h-12 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-white flex items-center justify-center shadow-[0_4px_15px_rgba(232,85,32,0.45)] hover:brightness-110 transition-all active:scale-[0.95]"
                aria-label="Search"
              >
                <Search className="w-5 h-5" />
              </button>
            </div>
          </form>
        </section>

        {/* Cuisine horizontal scroll */}
        <section className="mb-6">
          <div className="flex gap-2 overflow-x-auto no-scrollbar scroll-smooth -mx-4 px-4 pb-1">
            <button
              onClick={() => setSelectedCuisine('all')}
              className={`px-4 py-2 rounded-full text-xs font-semibold border whitespace-nowrap transition-all duration-200 active:scale-95 shrink-0 ${
                selectedCuisine === 'all'
                  ? 'bg-gradient-to-br from-brand-400 to-brand-600 text-white border-transparent shadow-[0_6px_20px_-6px_rgba(255,107,53,0.5)]'
                  : 'bg-white text-surface-600 border-hairline shadow-sm hover:bg-surface-50 hover:text-surface-900'
              }`}
            >
              All
            </button>
            {CUISINES.map((c) => (
              <button
                key={c.slug}
                onClick={() => setSelectedCuisine(c.slug)}
                className={`px-4 py-2 rounded-full text-xs font-semibold border whitespace-nowrap transition-all duration-200 active:scale-95 shrink-0 ${
                  selectedCuisine === c.slug
                    ? 'bg-gradient-to-br from-brand-400 to-brand-600 text-white border-transparent shadow-[0_6px_20px_-6px_rgba(255,107,53,0.5)]'
                    : 'bg-white text-surface-600 border-hairline shadow-sm hover:bg-surface-50 hover:text-surface-900'
                }`}
              >
                {c.emoji} {c.label}
              </button>
            ))}
          </div>
        </section>

        {/* Results grid */}
        <section className="space-y-5">
          <div className="flex items-center justify-between text-xs text-surface-400 px-1">
            <span className="font-semibold uppercase tracking-wider">
              {selectedCuisine !== 'all'
                ? `${CUISINES.find((c) => c.slug === selectedCuisine)?.label} Kitchens`
                : 'All Kitchens'}
            </span>
            <span>{kitchens.length} found</span>
          </div>

          {isLoading ? (
            // Skeleton loader cards
            <div className="space-y-5">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="rounded-[26px] border border-hairline bg-white h-64 flex flex-col p-5 space-y-4 shadow-card"
                >
                  <div className="h-32 skeleton rounded-2xl w-full" />
                  <div className="h-6 skeleton rounded-md w-3/4" />
                  <div className="h-4 skeleton rounded-md w-1/2" />
                </div>
              ))}
            </div>
          ) : isError ? (
            <div className="py-16 text-center rounded-[26px] border border-hairline bg-white shadow-card">
              <p className="font-semibold text-surface-900">Could not load kitchens</p>
              <p className="text-xs text-surface-400 mt-1">Please check your internet connection.</p>
              <button
                onClick={() => refetch()}
                className="mt-4 px-4 py-2 rounded-xl bg-brand-500 text-white text-xs font-bold"
              >
                Retry
              </button>
            </div>
          ) : kitchens.length === 0 ? (
            <div className="py-16 text-center rounded-[26px] border border-hairline bg-white shadow-card">
              <div className="w-12 h-12 mx-auto rounded-xl bg-surface-100 flex items-center justify-center mb-3">
                <Compass className="w-5 h-5 text-surface-400" />
              </div>
              <p className="font-semibold text-surface-900 text-sm">No kitchens found</p>
              <p className="text-xs text-surface-400 mt-1">Try another search or select a different category.</p>
            </div>
          ) : (
            // Real kitchens list
            <div className="space-y-5">
              {kitchens.map((k, kitchenIdx) => {
                const dishes = k.items ?? [];
                const heroImg = k.cover_image_url || dishes.find((d) => d.image_url)?.image_url || null;
                const tags = k.cuisines.slice(0, 2);

                return (
                  <Link
                    href={`/store/?slug=${k.slug}`}
                    key={k.id}
                    style={{ '--stagger-i': kitchenIdx } as React.CSSProperties}
                    className="group flex flex-col rounded-[26px] overflow-hidden border border-hairline bg-white shadow-card transition-all duration-300 hover:border-brand-400/40 hover:shadow-card-hover active:scale-[0.99] stagger-item"
                  >
                    {/* Cover Photo */}
                    <div className="relative h-40 w-full">
                      {heroImg ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={heroImg}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-brand-500/80 to-brand-800/80" />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-black/5" />

                      {/* Open status tag */}
                      <span className="absolute top-3 left-3 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-black/45 backdrop-blur-md border border-white/15 text-white">
                        <span className={k.open_now ? 'text-emerald-400' : 'text-rose-400'}>●</span>
                        {k.open_now ? 'Open' : 'Closed'}
                      </span>

                      {/* Logo badge */}
                      <div className="absolute -bottom-5 left-5 z-10 w-11 h-11 rounded-xl border-2 border-white bg-brand-500 overflow-hidden flex items-center justify-center text-white font-extrabold text-sm shadow-md">
                        {k.logo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={k.logo_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          k.name.charAt(0)
                        )}
                      </div>
                    </div>

                    {/* Card Info Body */}
                    <div className="pt-8 px-4 pb-4 flex flex-col flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-bold text-[15px] text-surface-900 truncate leading-tight group-hover:text-brand-600 transition-colors">
                            {k.name}
                          </h3>
                          <p className="text-[11px] text-surface-400 truncate mt-0.5">
                            {k.tagline || 'Delicious local kitchen'}
                          </p>
                        </div>
                        {(k.rating_count ?? 0) > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-xs font-bold text-amber-500">
                            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                            {Number(k.rating_avg).toFixed(1)}
                          </span>
                        )}
                      </div>

                      {/* Cuisine Tags */}
                      {tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2.5">
                          {tags.map((t) => (
                            <span
                              key={t}
                              className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-surface-100 text-surface-600"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Dishes Previews */}
                      {dishes.length > 0 && (
                        <div className="mt-3.5 pt-3 border-t border-surface-100 space-y-1.5">
                          {dishes.map((d, i) => (
                            <div key={i} className="flex items-center justify-between text-xs text-surface-700">
                              <span className="truncate pr-4">{d.name}</span>
                              <span className="font-bold text-brand-600 shrink-0 tabular-nums">
                                {d.is_chop_bar && d.price === 0 ? 'Order your way' : formatGHS(d.price)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Delivery Stats Row */}
                      <div className="mt-3.5 pt-3.5 border-t border-surface-100 flex items-center justify-between text-[10px] text-surface-400 font-medium">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-surface-300" />
                          {k.city || 'Accra'}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="flex items-center gap-0.5">
                            <Clock className="w-3 h-3 text-surface-300" />
                            {k.open_now ? '30-45m' : 'Pre-order'}
                          </span>
                          <span>•</span>
                          <span className="font-bold text-surface-600">
                            {Number(k.delivery_fee) === 0 ? 'Free delivery' : `${formatGHS(Number(k.delivery_fee))} delivery`}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
      <AdepaWidget apiBase={API} />
    </main>
  );
}
