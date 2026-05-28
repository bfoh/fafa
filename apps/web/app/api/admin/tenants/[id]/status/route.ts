import { NextResponse } from 'next/server';
import { getPlatformAdmin } from '@/lib/admin/guard';
import { createAdminClient } from '@/lib/supabase/admin';

const ALLOWED = ['onboarding', 'active', 'suspended', 'deactivated'] as const;
type TenantStatus = (typeof ALLOWED)[number];

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Re-verify the caller is a platform admin before touching the service role.
  const { isAdmin } = await getPlatformAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let status: unknown;
  try {
    ({ status } = await req.json());
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  if (typeof status !== 'string' || !ALLOWED.includes(status as TenantStatus)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('tenants')
    .update({ status })
    .eq('id', id)
    .select('id, status')
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message || 'Tenant not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({ tenant: data });
}
