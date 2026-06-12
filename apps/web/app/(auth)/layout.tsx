import { cookies, headers } from 'next/headers';
import Image from 'next/image';
import Link from 'next/link';
import { ClipboardList, CreditCard, Package, ArrowLeft } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';

const FEATURES = [
  {
    icon: ClipboardList,
    title: 'Share your menu',
    body: 'Customers scan your QR or tap your link',
  },
  {
    icon: CreditCard,
    title: 'Accept payments',
    body: 'Mobile Money, Card, or Cash on Delivery',
  },
  {
    icon: Package,
    title: 'Manage orders',
    body: 'Real-time dashboard with instant alerts',
  },
];

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const hdrs = await headers();
  const path = hdrs.get('x-pathname') || '';
  const isRegister = path.endsWith('/register');

  const cookieStore = await cookies();
  const lastTenantSlug = cookieStore.get('fafa_last_tenant_slug')?.value;

  // Register always wears the Didi brand. Login wears the returning tenant's
  // brand when we know who they are (set after their first dashboard visit).
  let tenant: {
    name: string;
    logo_url: string | null;
    tagline: string | null;
    primary_color: string | null;
  } | null = null;

  if (!isRegister && lastTenantSlug) {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from('tenants')
      .select('name, logo_url, tagline, primary_color')
      .eq('slug', lastTenantSlug)
      .eq('status', 'active')
      .single();
    if (data) tenant = data;
  }

  const accent = tenant?.primary_color || '#FF6B35';

  return (
    <div
      className="relative min-h-[100dvh] flex text-white"
      style={{
        backgroundColor: '#0b0910',
        backgroundImage: [
          `radial-gradient(60% 50% at 25% 0%, ${accent}38, transparent 70%)`,
          'radial-gradient(45% 40% at 100% 100%, rgba(255,150,90,0.12), transparent 70%)',
          'radial-gradient(50% 45% at 0% 80%, rgba(120,72,255,0.10), transparent 70%)',
        ].join(','),
      }}
    >
      {/* Grain */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.04] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      {/* Left — brand panel */}
      <div className="hidden lg:flex lg:w-1/2 relative">
        <div
          className="absolute -left-24 -top-24 w-[28rem] h-[28rem] rounded-full blur-3xl opacity-40"
          style={{ background: accent }}
        />
        <div className="relative z-10 flex flex-col justify-between p-14 w-full">
          {/* Brand mark */}
          {tenant ? (
            <div className="flex items-center gap-4">
              {tenant.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={tenant.logo_url}
                  alt={tenant.name}
                  className="w-16 h-16 rounded-2xl object-cover ring-1 ring-white/20 shadow-xl"
                />
              ) : (
                <div
                  className="w-16 h-16 rounded-2xl grid place-items-center text-white font-bold text-2xl shadow-xl"
                  style={{ backgroundColor: accent }}
                >
                  {tenant.name.charAt(0)}
                </div>
              )}
              <div>
                <h1
                  className="text-3xl font-extrabold tracking-tight"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {tenant.name}
                </h1>
                <p className="text-white/55 mt-1 text-sm">
                  {tenant.tagline || 'Food Ordering Made Simple'}
                </p>
              </div>
            </div>
          ) : (
            <Link href="/" aria-label="Back to Didi marketplace" className="flex items-center gap-3.5 group w-fit">
              <Image
                src="/images/didi_favicon.png"
                alt="Didi"
                width={56}
                height={56}
                className="rounded-2xl ring-1 ring-white/15 shadow-xl group-hover:ring-white/30 transition"
              />
              <div>
                <h1
                  className="text-4xl font-extrabold tracking-tight bg-gradient-to-br from-brand-300 to-brand-500 bg-clip-text text-transparent"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  Didi
                </h1>
                <p className="text-white/55 mt-0.5">Food Ordering Made Simple</p>
              </div>
            </Link>
          )}

          {/* Feature cards */}
          <div className="space-y-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.05] backdrop-blur-xl px-4 py-3.5"
              >
                <div className="w-11 h-11 rounded-xl grid place-items-center bg-white/8 border border-white/10">
                  <f.icon className="w-5 h-5 text-brand-300" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">{f.title}</h3>
                  <p className="text-sm text-white/55">{f.body}</p>
                </div>
              </div>
            ))}
          </div>

          <p className="text-sm text-white/45">
            {tenant ? (
              <>
                Powered by{' '}
                <span className="font-semibold text-white">Didi</span>
              </>
            ) : (
              'Trusted by kitchens across Ghana 🇬🇭'
            )}
          </p>
        </div>
      </div>

      {/* Right — form */}
      <div className="relative z-10 flex-1 flex flex-col overflow-y-auto px-6 lg:px-12 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <div className="w-full max-w-md mx-auto">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-white/55 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden />
            Back to marketplace
          </Link>
        </div>
        <div className="flex-1 flex items-center justify-center py-5">
          <div className="w-full max-w-md rounded-[28px] border border-white/10 bg-white/[0.05] backdrop-blur-2xl shadow-[0_24px_70px_-20px_rgba(0,0,0,0.7)] p-7 sm:p-9">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
