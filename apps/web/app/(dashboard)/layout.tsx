import { Sidebar } from '@/components/layout/sidebar';
import { createServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

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

  // Fetch tenant info for sidebar
  const { data: member } = await supabase
    .from('tenant_members')
    .select('tenant_id, role, tenants(name, slug)')
    .eq('user_id', session.user.id)
    .single();

  const tenantName = (member?.tenants as unknown as { name: string })?.name;

  return (
    <div className="min-h-screen bg-surface-50">
      <Sidebar tenantName={tenantName} />

      {/* Main content area */}
      <main className="lg:pl-64 min-h-screen">
        <div className="p-4 lg:p-8 pt-16 lg:pt-8">
          {children}
        </div>
      </main>
    </div>
  );
}
