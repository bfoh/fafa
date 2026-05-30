import { NextResponse } from 'next/server';
import { getPlatformAdmin } from '@/lib/admin/guard';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: Request) {
  try {
    const { isAdmin, session } = await getPlatformAdmin();
    if (!isAdmin || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { tenantId } = await req.json();

    const admin = createAdminClient();

    // Update the super admin's impersonating_tenant_id row in platform_admins
    const { error } = await admin
      .from('platform_admins')
      .update({ impersonating_tenant_id: tenantId || null })
      .eq('user_id', session.user.id);

    if (error) {
      console.error('Database update error during impersonation:', error);
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Impersonation API error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Impersonation failed' },
      { status: 500 }
    );
  }
}
