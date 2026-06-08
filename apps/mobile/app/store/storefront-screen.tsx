'use client';

import { MessageCircle, Star, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_BASE ?? 'https://ghdidi.com';
import {
  BrandingCache,
  AdepaWidget,
  StorefrontMenu,
  waLink,
  formatGHS,
} from '@fafa/storefront';
import { useStorefront } from '@/app/hooks/use-storefront';

function adjustLightness(hex: string, factor: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const adjust = (c: number) => Math.min(255, Math.round(c + (255 - c) * factor));
  return `rgb(${adjust(r)}, ${adjust(g)}, ${adjust(b)})`;
}

/** Full storefront screen: chrome + hero + menu. Merges the former web
 *  layout + page into one client screen (no nested dynamic route in export). */
export function StorefrontScreen({ slug }: { slug: string }) {
  const { data, isLoading, isError, error } = useStorefront(slug);
  const tenant = data?.tenant as Record<string, any> | undefined;
  const primaryColor = (tenant?.primary_color as string) || '#FF6B35';
  const secondaryColor = (tenant?.secondary_color as string) || '#1A1A2E';

  return (
    <div
      className="storefront-root min-h-[100dvh] bg-canvas"
      style={
        {
          '--brand-primary': primaryColor,
          '--brand-secondary': secondaryColor,
          '--brand-primary-light': adjustLightness(primaryColor, 0.85),
          '--brand-primary-dark': adjustLightness(primaryColor, -0.2),
        } as React.CSSProperties
      }
    >
      {tenant && (
        <BrandingCache
          slug={slug}
          name={tenant.name}
          logoUrl={tenant.logo_url || undefined}
          primaryColor={primaryColor}
        />
      )}

      {/* Sticky glass header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-hairline pt-safe">
        <div className="max-w-lg mx-auto px-4 py-2.5 flex items-center gap-3">
          <Link
            href="/"
            className="w-8 h-8 rounded-full hover:bg-black/5 flex items-center justify-center text-surface-600 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          {tenant?.logo_url ? (
            <img
              src={tenant.logo_url}
              alt={tenant.name}
              className="w-9 h-9 rounded-xl object-cover ring-1 ring-black/5"
            />
          ) : (
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm ring-1 ring-black/5"
              style={{ background: primaryColor }}
            >
              {(tenant?.name as string)?.charAt(0) ?? '·'}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="font-bold text-surface-900 text-sm truncate leading-tight">
              {tenant?.name ?? 'Loading…'}
            </h1>
            <div className="flex items-center gap-1.5">
              {Number(tenant?.rating_count) > 0 && (
                <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-amber-500">
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                  {Number(tenant?.rating_avg).toFixed(1)}
                  <span className="text-surface-400 font-normal">
                    ({tenant?.rating_count})
                  </span>
                </span>
              )}
              {tenant?.tagline && (
                <p className="text-[11px] text-surface-400 truncate">{tenant.tagline}</p>
              )}
            </div>
          </div>

          {tenant?.whatsapp && (
            <a
              href={waLink(tenant.whatsapp, `Hi ${tenant.name}! 👋`)}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto shrink-0 inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-[#25D366] text-white text-xs font-bold press shadow-sm"
              aria-label="Chat on WhatsApp"
            >
              <MessageCircle className="w-4 h-4" />
              WhatsApp
            </a>
          )}
        </div>
      </header>

      {/* Body */}
      {isLoading && !data ? (
        <div className="max-w-lg mx-auto p-4 space-y-3">
          <div className="h-24 rounded-2xl bg-surface-100 animate-pulse" />
          <div className="h-16 rounded-xl bg-surface-100 animate-pulse" />
          <div className="h-16 rounded-xl bg-surface-100 animate-pulse" />
        </div>
      ) : isError || !data || !tenant ? (
        <div className="max-w-lg mx-auto p-8 text-center text-surface-500">
          {(error as Error)?.message === 'not_found'
            ? 'Restaurant not found.'
            : 'Could not load the menu. Check your connection.'}
        </div>
      ) : (
        <div className="max-w-lg mx-auto">
          {/* Hero */}
          <div className="relative">
            {tenant.cover_image_url ? (
              <div className="h-52 relative overflow-hidden">
                <img
                  src={tenant.cover_image_url}
                  alt={tenant.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />
              </div>
            ) : (
              <div
                className="h-36"
                style={{
                  background: `linear-gradient(135deg, ${primaryColor}26, ${primaryColor}08)`,
                }}
              />
            )}

            <div className="px-4">
              <div className="-mt-10 relative bg-white rounded-3xl border border-hairline shadow-card p-5 animate-fade-in">
                <h1
                  className="text-[22px] font-extrabold text-surface-900 tracking-tight leading-tight"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {tenant.name}
                </h1>
                {tenant.description && (
                  <p className="text-sm text-surface-500 mt-1.5 line-clamp-2 leading-snug">
                    {tenant.description}
                  </p>
                )}

                {/* Meta row: rating · location */}
                <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-3 text-[13px] font-semibold">
                  {Number(tenant.rating_count) > 0 && (
                    <span className="inline-flex items-center gap-1 text-surface-900">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      {Number(tenant.rating_avg).toFixed(1)}
                      <span className="text-surface-400 font-normal">
                        ({tenant.rating_count})
                      </span>
                    </span>
                  )}
                  {Number(tenant.rating_count) > 0 && tenant.city && (
                    <span className="text-surface-200">•</span>
                  )}
                  {tenant.city && (
                    <span className="inline-flex items-center gap-1 text-surface-500">
                      📍 {tenant.city}
                    </span>
                  )}
                </div>

                {/* Service pills */}
                <div className="flex flex-wrap items-center gap-2 mt-3.5">
                  {tenant.accepts_delivery && (
                    <span
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold"
                      style={{ background: `${primaryColor}14`, color: primaryColor }}
                    >
                      🚗 Delivery{' '}
                      {Number(tenant.delivery_fee) > 0
                        ? `from ${formatGHS(Number(tenant.delivery_fee))}`
                        : 'available'}
                    </span>
                  )}
                  {tenant.accepts_pickup && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-surface-100 text-surface-600">
                      🏪 Pickup
                    </span>
                  )}
                  {Number(tenant.min_order_amount) > 0 && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-surface-100 text-surface-600">
                      Min {formatGHS(Number(tenant.min_order_amount))}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Menu — reused verbatim from apps/web via cross-alias */}
          <StorefrontMenu
            categories={data.menuCategories as any}
            tenant={{
              id: tenant.id,
              slug: tenant.slug,
              name: tenant.name,
              delivery_fee: Number(tenant.delivery_fee),
              min_order_amount: Number(tenant.min_order_amount),
              accepts_delivery: tenant.accepts_delivery,
              accepts_pickup: tenant.accepts_pickup,
              accepts_pay_online: tenant.accepts_pay_online,
              accepts_pay_on_delivery: tenant.accepts_pay_on_delivery,
              primary_color: primaryColor,
            }}
            deliveryZones={(data.deliveryZones as any) || []}
          />
        </div>
      )}

      <footer className="py-8 text-center space-y-1.5">
        <p className="text-xs text-surface-400">
          Powered by{' '}
          <span className="font-semibold" style={{ color: primaryColor }}>
            Didi
          </span>
          <span className="mx-1.5 text-surface-300">·</span>
          <span className="text-surface-400">ghdidi.com</span>
        </p>
      </footer>

      {/* AI concierge — self-hides until configured */}
      <AdepaWidget tenantSlug={slug} apiBase={API} />
    </div>
  );
}
