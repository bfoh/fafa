'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Search, Star, MapPin, Compass, Clock, Sparkles } from 'lucide-react';
import { AdepaWidget } from '@fafa/storefront';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCuisine, setSelectedCuisine] = useState('all');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['marketplace', searchQuery, selectedCuisine],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.set('q', searchQuery);
      if (selectedCuisine && selectedCuisine !== 'all') {
        params.set('cuisine', selectedCuisine);
      }
      const res = await fetch(`${API}/api/marketplace?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch marketplace');
      return res.json() as Promise<{ kitchens: KitchenResult[] }>;
    },
  });

  const kitchens = data?.kitchens ?? [];

  const formatGHS = (value: number) => {
    return `GH₵${value.toFixed(2)}`;
  };

  return (
    <main
      className="min-h-screen text-white antialiased overflow-y-auto pb-safe-bottom"
      style={{
        backgroundColor: '#0b0910',
        backgroundImage: [
          'radial-gradient(70% 40% at 50% -5%, rgba(255,107,53,0.2), transparent 70%)',
          'radial-gradient(40% 30% at 90% 15%, rgba(255,150,90,0.1), transparent 70%)',
          'radial-gradient(50% 35% at 10% 40%, rgba(120,72,255,0.06), transparent 70%)',
        ].join(','),
      }}
    >
      {/* Texture overlay */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.03] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      <div className="relative z-10 px-4 pt-safe pb-20 max-w-lg mx-auto">
        {/* Top Header */}
        <header className="flex items-center justify-between py-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl border border-white/15 bg-white/5 flex items-center justify-center shadow-inner overflow-hidden">
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
                className="text-2xl font-extrabold bg-gradient-to-br from-brand-300 to-brand-500 bg-clip-text text-transparent block leading-none"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Didi
              </span>
              <span className="text-[10px] text-white/35 font-medium tracking-wide uppercase">
                Ghana&apos;s kitchens
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/for-restaurants"
              className="px-3 py-1.5 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-white font-bold text-[10px] shadow-[0_4px_12px_-4px_rgba(255,107,53,0.6)] hover:brightness-110 transition-all whitespace-nowrap"
            >
              List kitchen ▸
            </Link>
            <Link
              href="/rider"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-[10px] font-semibold text-white/85 whitespace-nowrap"
            >
              🏍️ Rider Portal
            </Link>
          </div>
        </header>

        {/* Hero title */}
        <section className="py-4">
          <h1
            className="text-3xl font-extrabold leading-tight tracking-tight"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            What do you want
            <br />
            to <span className="bg-gradient-to-br from-brand-300 via-brand-400 to-brand-600 bg-clip-text text-transparent">eat?</span>
          </h1>
          <p className="text-xs text-white/50 mt-1.5">
            Order from local kitchens near you — pay with MoMo or card.
          </p>
        </section>

        {/* Search input */}
        <section className="my-5 relative">
          <div className="relative flex items-center rounded-2xl border border-white/12 bg-white/5 backdrop-blur-xl focus-within:border-brand-500/50 focus-within:bg-white/8 transition-all duration-300">
            <Search className="w-5 h-5 text-white/40 absolute left-4 pointer-events-none" />
            <input
              type="text"
              placeholder="Search dishes or kitchens..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-12 pl-12 pr-4 bg-transparent border-none text-white text-sm placeholder-white/40 focus:outline-none focus:ring-0"
            />
          </div>
        </section>

        {/* Cuisine horizontal scroll */}
        <section className="mb-6">
          <div className="flex gap-2 overflow-x-auto no-scrollbar scroll-smooth -mx-4 px-4 pb-1">
            <button
              onClick={() => setSelectedCuisine('all')}
              className={`px-4 py-2 rounded-full text-xs font-semibold border whitespace-nowrap transition-all duration-200 active:scale-95 shrink-0 ${
                selectedCuisine === 'all'
                  ? 'bg-gradient-to-br from-brand-400 to-brand-600 text-white border-transparent shadow-[0_6px_20px_-6px_rgba(255,107,53,0.7)]'
                  : 'bg-white/5 text-white/70 border-white/10 backdrop-blur-md hover:bg-white/10 hover:text-white'
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
                    ? 'bg-gradient-to-br from-brand-400 to-brand-600 text-white border-transparent shadow-[0_6px_20px_-6px_rgba(255,107,53,0.7)]'
                    : 'bg-white/5 text-white/70 border-white/10 backdrop-blur-md hover:bg-white/10 hover:text-white'
                }`}
              >
                {c.emoji} {c.label}
              </button>
            ))}
          </div>
        </section>

        {/* Results grid */}
        <section className="space-y-5">
          <div className="flex items-center justify-between text-xs text-white/40 px-1">
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
                  className="rounded-[26px] border border-white/10 bg-white/5 h-64 animate-pulse flex flex-col p-5 space-y-4"
                >
                  <div className="h-32 bg-white/5 rounded-2xl w-full" />
                  <div className="h-6 bg-white/5 rounded-md w-3/4" />
                  <div className="h-4 bg-white/5 rounded-md w-1/2" />
                </div>
              ))}
            </div>
          ) : isError ? (
            <div className="py-16 text-center rounded-[26px] border border-white/10 bg-white/5 backdrop-blur-xl">
              <p className="font-semibold text-white/90">Could not load kitchens</p>
              <p className="text-xs text-white/40 mt-1">Please check your internet connection.</p>
              <button
                onClick={() => refetch()}
                className="mt-4 px-4 py-2 rounded-xl bg-brand-500 text-white text-xs font-bold"
              >
                Retry
              </button>
            </div>
          ) : kitchens.length === 0 ? (
            <div className="py-16 text-center rounded-[26px] border border-white/10 bg-white/4 backdrop-blur-xl">
              <div className="w-12 h-12 mx-auto rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-3">
                <Compass className="w-5 h-5 text-white/40" />
              </div>
              <p className="font-semibold text-white/90 text-sm">No kitchens found</p>
              <p className="text-xs text-white/40 mt-1">Try another search or select a different category.</p>
            </div>
          ) : (
            // Real kitchens list
            <div className="space-y-5">
              {kitchens.map((k) => {
                const dishes = k.items ?? [];
                const heroImg = k.cover_image_url || dishes.find((d) => d.image_url)?.image_url || null;
                const tags = k.cuisines.slice(0, 2);

                return (
                  <Link
                    href={`/store/?slug=${k.slug}`}
                    key={k.id}
                    className="group flex flex-col rounded-[26px] overflow-hidden border border-white/10 bg-white/[0.055] backdrop-blur-2xl transition-all duration-300 hover:border-brand-400/30 hover:bg-white/[0.07] active:scale-[0.99]"
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
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/10" />

                      {/* Open status tag */}
                      <span className="absolute top-3 left-3 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-black/50 border border-white/10 text-white">
                        <span className={k.open_now ? 'text-emerald-400' : 'text-rose-400'}>●</span>
                        {k.open_now ? 'Open' : 'Closed'}
                      </span>

                      {/* Logo badge */}
                      <div className="absolute -bottom-5 left-5 z-10 w-11 h-11 rounded-xl border border-white/20 bg-brand-500 overflow-hidden flex items-center justify-center text-white font-extrabold text-sm shadow-md">
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
                          <h3 className="font-bold text-[15px] text-white truncate leading-tight group-hover:text-brand-300 transition-colors">
                            {k.name}
                          </h3>
                          <p className="text-[11px] text-white/45 truncate mt-0.5">
                            {k.tagline || 'Delicious local kitchen'}
                          </p>
                        </div>
                        {(k.rating_count ?? 0) > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-xs font-bold text-amber-300">
                            <Star className="w-3 h-3 fill-amber-300 text-amber-300" />
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
                              className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-white/5 border border-white/10 text-white/60"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Dishes Previews */}
                      {dishes.length > 0 && (
                        <div className="mt-3.5 pt-3 border-t border-white/5 space-y-1.5">
                          {dishes.map((d, i) => (
                            <div key={i} className="flex items-center justify-between text-xs text-white/70">
                              <span className="truncate pr-4">{d.name}</span>
                              <span className="font-bold text-brand-300 shrink-0">
                                {d.is_chop_bar && d.price === 0 ? 'Order your way' : formatGHS(d.price)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Delivery Stats Row */}
                      <div className="mt-3.5 pt-3.5 border-t border-white/5 flex items-center justify-between text-[10px] text-white/45 font-medium">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-white/30" />
                          {k.city || 'Accra'}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="flex items-center gap-0.5">
                            <Clock className="w-3 h-3 text-white/30" />
                            {k.open_now ? '30-45m' : 'Pre-order'}
                          </span>
                          <span>•</span>
                          <span className="font-bold text-white/60">
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
