import { createAdminClient } from '@/lib/supabase/admin';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

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
    .select('name, description, tagline')
    .eq('slug', slug)
    .eq('status', 'active')
    .single();

  if (!tenant) return { title: 'Not Found' };

  return {
    title: `${tenant.name} — Order on Fafa`,
    description:
      tenant.description || tenant.tagline || `Order food from ${tenant.name}`,
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
      className="storefront-root min-h-screen bg-surface-50"
      style={
        {
          '--brand-primary': primaryColor,
          '--brand-secondary': secondaryColor,
          '--brand-primary-light': adjustLightness(primaryColor, 0.85),
          '--brand-primary-dark': adjustLightness(primaryColor, -0.2),
        } as React.CSSProperties
      }
    >
      {/* Minimal header */}
      <header
        className="sticky top-0 z-30 glass border-b border-white/20"
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
          <div>
            <h1 className="font-semibold text-white text-sm">
              {tenant.name}
            </h1>
            {tenant.tagline && (
              <p className="text-[11px] text-white/60">{tenant.tagline}</p>
            )}
          </div>
        </div>
      </header>

      {children}

      {/* Footer */}
      <footer className="py-6 text-center">
        <p className="text-xs text-surface-400">
          Powered by{' '}
          <a
            href="/"
            className="font-semibold"
            style={{ color: primaryColor }}
          >
            Fafa
          </a>
        </p>
      </footer>
    </div>
  );
}
