import { Sidebar } from '@/components/layout/sidebar';
import { MobileNav } from '@/components/layout/mobile-nav';
import { createServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getResolvedTenantId } from '@/lib/admin/guard';
import ImpersonationBanner from '@/components/admin/impersonation-banner';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect('/login');
  }

  const { tenantId, isImpersonating, isPlatformAdmin } = await getResolvedTenantId();

  if (!tenantId) {
    if (isPlatformAdmin) {
      redirect('/admin');
    } else {
      redirect('/register');
    }
  }

  // Fetch tenant details directly
  const { data: tenant } = await supabase
    .from('tenants')
    .select('name, slug, logo_url, primary_color')
    .eq('id', tenantId)
    .single();

  const tenantName = tenant?.name;
  const logoUrl = tenant?.logo_url || undefined;
  const primaryColor = tenant?.primary_color || undefined;
  const tenantSlug = tenant?.slug || undefined;

  return (
    <div className="min-h-screen bg-surface-50">
      {/* Desktop sidebar */}
      <Sidebar
        tenantName={tenantName}
        logoUrl={logoUrl}
        primaryColor={primaryColor}
        tenantSlug={tenantSlug}
      />

      {/* Mobile top bar + bottom tab navigation */}
      <MobileNav
        tenantName={tenantName}
        logoUrl={logoUrl}
        primaryColor={primaryColor}
        tenantSlug={tenantSlug}
      />

      {/* Main content area */}
      <main className="lg:pl-64 min-h-screen flex flex-col">
        {isImpersonating && tenantName && (
          <ImpersonationBanner tenantName={tenantName} />
        )}
        {/* Top padding clears the mobile app bar (h-14 + notch); bottom padding clears the tab bar (h-16 + home indicator). */}
        <div className="px-4 lg:px-8 pt-[calc(3.5rem+env(safe-area-inset-top))] lg:pt-8 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-8 flex-1">
          {children}
        </div>
      </main>
    </div>
  );
}
