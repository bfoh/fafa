import { createAdminClient } from '@/lib/supabase/admin';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { MessageCircle, Star } from 'lucide-react';
import { BrandingCache } from '@/components/storefront/branding-cache';
import { waLink } from '@/lib/utils/whatsapp';

function adjustLightness(hex: string, factor: number): string {
  // Simple brightness adjustment
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  const adjust = (c: number) =>
    Math.min(255, Math.round(c + (255 - c) * factor));

  return `rgb(${adjust(r)}, ${adjust(g)}, ${adjust(b)})`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const supabase = createAdminClient();
  const { data: tenant } = await supabase
    .from('tenants')
    .select('name, description, tagline, logo_url')
    .eq('slug', slug)
    .eq('status', 'active')
    .single();

  if (!tenant) return { title: 'Not Found' };

  return {
    title: `${tenant.name} — Order on Didi`,
    description:
      tenant.description || tenant.tagline || `Order food from ${tenant.name}`,
    icons: {
      icon: tenant.logo_url || '/images/didi_favicon.png',
      apple: tenant.logo_url || '/images/didi_apple.png',
    },
  };
}

export default async function StorefrontLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = createAdminClient();

  const { data: tenant } = await supabase
    .from('tenants')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'active')
    .single();

  if (!tenant) notFound();

  const primaryColor = tenant.primary_color || '#FF6B35';
  const secondaryColor = tenant.secondary_color || '#1A1A2E';

  return (
    <div
      className="storefront-root min-h-[100dvh] bg-surface-50"
      style={
        {
          '--brand-primary': primaryColor,
          '--brand-secondary': secondaryColor,
          '--brand-primary-light': adjustLightness(primaryColor, 0.85),
          '--brand-primary-dark': adjustLightness(primaryColor, -0.2),
        } as React.CSSProperties
      }
    >
      <BrandingCache
        slug={slug}
        name={tenant.name}
        logoUrl={tenant.logo_url || undefined}
        primaryColor={primaryColor}
      />

      {/* Minimal header */}
      <header
        className="sticky top-0 z-30 glass border-b border-white/20 pt-safe"
        style={{ background: `${secondaryColor}ee` }}
      >
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          {tenant.logo_url ? (
            <img
              src={tenant.logo_url}
              alt={tenant.name}
              className="w-9 h-9 rounded-xl object-cover"
            />
          ) : (
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm"
              style={{ background: primaryColor }}
            >
              {tenant.name.charAt(0)}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="font-semibold text-white text-sm truncate">
              {tenant.name}
            </h1>
            <div className="flex items-center gap-1.5">
              {Number(tenant.rating_count) > 0 && (
                <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-amber-300">
                  <Star className="w-3 h-3 fill-amber-300" />
                  {Number(tenant.rating_avg).toFixed(1)}
                  <span className="text-white/45 font-normal">({tenant.rating_count})</span>
                </span>
              )}
              {tenant.tagline && (
                <p className="text-[11px] text-white/60 truncate">{tenant.tagline}</p>
              )}
            </div>
          </div>

          {tenant.whatsapp && (
            <a
              href={waLink(tenant.whatsapp, `Hi ${tenant.name}! 👋`)}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto shrink-0 inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-[#25D366] text-white text-xs font-bold active:scale-95 transition-transform"
              aria-label="Chat on WhatsApp"
            >
              <MessageCircle className="w-4 h-4" />
              WhatsApp
            </a>
          )}
        </div>
      </header>

      {children}

      {/* Footer */}
      <footer className="py-6 text-center space-y-2">
        <p className="text-xs text-surface-400">
          Powered by{' '}
          <Link
            href="/"
            className="font-semibold"
            style={{ color: primaryColor }}
          >
            Didi
          </Link>
        </p>
        <div>
          <Link
            href={`/login?tenant=${slug}`}
            className="text-[10px] text-surface-400 hover:underline transition-colors hover:text-surface-600"
          >
            Merchant Login
          </Link>
        </div>
      </footer>
    </div>
  );
}
