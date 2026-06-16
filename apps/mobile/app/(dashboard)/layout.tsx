'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { createMobileSupabaseClient } from '../lib/supabase';
import { MobileNav } from '@/components/layout/mobile-nav';
import { getResolvedTenantIdClient } from '@/lib/admin/impersonate';

const TENANT_RESOLVE_TIMED_OUT = Symbol('tenant-timeout');

/**
 * Native dashboard shell for the Capacitor app. Guards the session, resolves the
 * tenant, and renders the `MobileNav` chrome. Every child route is a thin wrapper
 * around the web dashboard's already-client pages (cross-aliased).
 *
 * Cold-load robustness: we reach here via a hard navigation (window.location)
 * because the capacitor:// origin is "null" and the Next router can't navigate
 * across route groups (it builds URLs from location.origin → WebKit 102). A hard
 * nav tears down the in-memory Supabase client, so the fresh client must read the
 * session back from Capacitor Preferences (async). getSession() can momentarily
 * return null before that read settles — so we wait briefly for an auth event
 * instead of bouncing a signed-in owner straight to /login (the post-login
 * "lands on the marketplace/login" flicker).
 */
export default function MobileDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [ready, setReady] = useState(false);
  const [tenant, setTenant] = useState<{
    name?: string;
    slug?: string;
    logoUrl?: string;
    primaryColor?: string;
  }>({});
  const router = useRouter();

  useEffect(() => {
    let active = true;
    async function boot() {
      const supabase = createMobileSupabaseClient();

      let {
        data: { session },
      } = await supabase.auth.getSession();

      // Grace window: tolerate slow Preferences hydration on cold load.
      if (!session) {
        session = await new Promise<Session | null>((resolve) => {
          let settled = false;
          const finish = (s: Session | null) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            sub.data.subscription.unsubscribe();
            resolve(s);
          };
          const timer = setTimeout(() => finish(null), 2500);
          const sub = supabase.auth.onAuthStateChange((_e, s) => {
            if (s) finish(s);
          });
        });
      }

      if (!active) return;
      if (!session) {
        router.push('/login');
        return;
      }

      // Fast path: tenant_id straight from the JWT claims (zero network, works
      // offline). Slow path (DB lookup) only for impersonation / un-backfilled
      // accounts — and it must NOT bounce a real owner to /register on a network
      // timeout, so we time it out and tolerate the timeout.
      let tenantId: string | null =
        (session.user.app_metadata?.tenant_id as string | undefined) ||
        (session.user.user_metadata?.tenant_id as string | undefined) ||
        null;

      let tenantResolveTimedOut = false;
      if (!tenantId) {
        const res = await Promise.race<string | null | typeof TENANT_RESOLVE_TIMED_OUT>([
          getResolvedTenantIdClient(supabase, session).catch(() => null),
          new Promise<typeof TENANT_RESOLVE_TIMED_OUT>((resolve) =>
            setTimeout(() => resolve(TENANT_RESOLVE_TIMED_OUT), 6000)
          ),
        ]);
        if (res === TENANT_RESOLVE_TIMED_OUT) {
          tenantResolveTimedOut = true;
        } else {
          tenantId = res;
        }
      }

      if (!active) return;
      // Only send to setup when we DEFINITIVELY know there is no tenant.
      if (!tenantId && !tenantResolveTimedOut) {
        router.push('/register');
        return;
      }

      let data:
        | { name?: string; slug?: string; logo_url?: string | null; primary_color?: string | null }
        | null = null;
      if (tenantId) {
        const tenantRes = await supabase
          .from('tenants')
          .select('name, slug, logo_url, primary_color')
          .eq('id', tenantId)
          .single();
        data = tenantRes.data;
      }

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
