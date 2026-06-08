'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { createBrowserClient } from '@fafa/storefront';
import { MobileNav } from '@/components/layout/mobile-nav';
import { getResolvedTenantIdClient } from '@/lib/admin/impersonate';

/**
 * Native dashboard shell for the Capacitor app. Mirrors the web `(dashboard)`
 * layout but runs fully client-side: it guards the session, resolves the
 * tenant, and renders the same `MobileNav` chrome. Every child route is a thin
 * wrapper around the web dashboard's already-client pages (cross-aliased), so
 * the app and the web app stay in lockstep.
 */
export default function MobileDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [tenant, setTenant] = useState<{
    name?: string;
    slug?: string;
    logoUrl?: string;
    primaryColor?: string;
  }>({});

  useEffect(() => {
    let active = true;
    async function boot() {
      const supabase = createBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace('/login/');
        return;
      }

      const tenantId = await getResolvedTenantIdClient(supabase, session);
      if (!tenantId) {
        // No kitchen yet → send them to register.
        router.replace('/register/');
        return;
      }

      const { data } = await supabase
        .from('tenants')
        .select('name, slug, logo_url, primary_color')
        .eq('id', tenantId)
        .single();

      if (!active) return;
      setTenant({
        name: data?.name,
        slug: data?.slug,
        logoUrl: data?.logo_url || undefined,
        primaryColor: data?.primary_color || undefined,
      });
      setReady(true);
    }
    boot();
    return () => {
      active = false;
    };
  }, [router]);

  if (!ready) {
    return (
      <div className="min-h-[100dvh] bg-canvas grid place-items-center">
        <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-canvas">
      <MobileNav
        tenantName={tenant.name}
        logoUrl={tenant.logoUrl}
        primaryColor={tenant.primaryColor}
        tenantSlug={tenant.slug}
      />
      <main className="min-h-[100dvh] flex flex-col">
        <div className="px-4 pt-[calc(3.5rem+env(safe-area-inset-top))] pb-[calc(5rem+env(safe-area-inset-bottom))] flex-1">
          {children}
        </div>
      </main>
    </div>
  );
}
