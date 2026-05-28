import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';

function adjustLightness(hex: string, factor: number): string {
  // Simple brightness adjustment
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  const adjust = (c: number) =>
    Math.min(255, Math.round(c + (255 - c) * factor));

  return `rgb(${adjust(r)}, ${adjust(g)}, ${adjust(b)})`;
}

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const lastTenantSlug = cookieStore.get('fafa_last_tenant_slug')?.value;

  let tenant = null;
  if (lastTenantSlug) {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from('tenants')
      .select('name, logo_url, tagline, primary_color, secondary_color')
      .eq('slug', lastTenantSlug)
      .eq('status', 'active')
      .single();
    if (data) {
      tenant = data;
    }
  }

  const primaryColor = tenant?.primary_color || '#FF6B35';
  const tenantName = tenant?.name;
  const logoUrl = tenant?.logo_url;
  const tagline = tenant?.tagline || 'Food Ordering Made Simple';

  return (
    <div className="min-h-screen flex">
      {/* Left panel — branding */}
      <div
        className="hidden lg:flex lg:w-1/2 relative overflow-hidden"
        style={{
          background: tenant
            ? `linear-gradient(135deg, ${primaryColor}, ${adjustLightness(primaryColor, -0.2)}, ${adjustLightness(primaryColor, -0.4)})`
            : undefined,
        }}
      >
        {!tenant && (
          <div className="absolute inset-0 bg-gradient-to-br from-brand-500 via-brand-600 to-brand-800" />
        )}
        <div className="absolute inset-0 bg-[url('/images/pattern.svg')] opacity-10" />
        <div className="relative z-10 flex flex-col justify-between p-12 text-white w-full">
          {tenant ? (
            <div className="flex items-center gap-4 animate-fade-in">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={tenantName}
                  className="w-16 h-16 rounded-2xl object-cover shadow-md"
                />
              ) : (
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-2xl shadow-md"
                  style={{ backgroundColor: primaryColor }}
                >
                  {tenantName.charAt(0)}
                </div>
              )}
              <div>
                <h1 className="text-3xl font-bold tracking-tight leading-tight">
                  {tenantName}
                </h1>
                <p className="text-white/80 mt-1 text-sm">{tagline}</p>
              </div>
            </div>
          ) : (
            <div>
              <h1 className="text-4xl font-bold tracking-tight">Didi</h1>
              <p className="text-brand-100 mt-1 text-lg">
                Food Ordering Made Simple
              </p>
            </div>
          )}

          <div className="space-y-8">
            <div className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-xl">
                  📋
                </div>
                <div>
                  <h3 className="font-semibold">Share Your Menu</h3>
                  <p className="text-sm text-white/80">
                    Customers scan your QR code or click your link
                  </p>
                </div>
              </div>
            </div>

            <div className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-xl">
                  💳
                </div>
                <div>
                  <h3 className="font-semibold">Accept Payments</h3>
                  <p className="text-sm text-white/80">
                    Mobile Money, Card, or Cash on Delivery
                  </p>
                </div>
              </div>
            </div>

            <div className="animate-fade-in" style={{ animationDelay: '0.3s' }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-xl">
                  📦
                </div>
                <div>
                  <h3 className="font-semibold">Manage Orders</h3>
                  <p className="text-sm text-white/80">
                    Real-time dashboard with instant notifications
                  </p>
                </div>
              </div>
            </div>
          </div>

          <p className="text-sm text-white/60">
            {tenant ? (
              <>
                Powered by <span className="font-semibold text-white">Didi</span>
              </>
            ) : (
              'Trusted by restaurants across Ghana 🇬🇭'
            )}
          </p>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 bg-surface-50">
        <div className="w-full max-w-md animate-fade-in">{children}</div>
      </div>
    </div>
  );
}
