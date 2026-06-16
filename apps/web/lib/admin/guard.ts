import { createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Verify the current session belongs to a platform admin.
 *
 * Reads the session via the RLS-bound server client and checks the
 * `platform_admins` table (its SELECT policy allows a user to see their own
 * row). Callers that pass this check may then use the service-role admin
 * client to operate across all tenants.
 */
export async function getPlatformAdmin() {
  const supabase = await createServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) return { session: null, isAdmin: false as const };

  const { data: adminRecord } = await supabase
    .from('platform_admins')
    .select('user_id')
    .eq('user_id', session.user.id)
    .maybeSingle();

  return { session, isAdmin: !!adminRecord };
}

/**
 * Resolves the active tenant ID server-side.
 *
 * Web requests authenticate via the cookie session (and honour admin
 * impersonation cookies). The native mobile app has no cookies — its session
 * lives in Capacitor Preferences — so it sends `Authorization: Bearer <token>`.
 * Pass the request to enable that path; without it, behaviour is unchanged.
 */
export async function getResolvedTenantId(req?: Request) {
  // ── Native (mobile) path: Bearer access token ──
  const authHeader = req?.headers.get('authorization') ?? null;
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    const token = authHeader.slice(7).trim();
    const admin = createAdminClient();
    const {
      data: { user },
    } = await admin.auth.getUser(token);
    if (!user) {
      return { tenantId: null, isImpersonating: false, isPlatformAdmin: false, userId: null };
    }
    const { data: member } = await admin
      .from('tenant_members')
      .select('tenant_id')
      .eq('user_id', user.id)
      .single();
    return {
      tenantId: member?.tenant_id ?? null,
      isImpersonating: false,
      isPlatformAdmin: false,
      userId: user.id,
    };
  }

  const supabase = await createServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) return { tenantId: null, isImpersonating: false, isPlatformAdmin: false, userId: null };

  // Check if they are platform admin
  const { data: adminRecord } = await supabase
    .from('platform_admins')
    .select('user_id')
    .eq('user_id', session.user.id)
    .maybeSingle();
  const isPlatformAdmin = !!adminRecord;

  if (isPlatformAdmin) {
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    const impersonatedId = cookieStore.get('didi_impersonate_tenant_id')?.value;
    if (impersonatedId) {
      return { tenantId: impersonatedId, isImpersonating: true, isPlatformAdmin, userId: session.user.id };
    }
  }

  // Fallback to their own tenant membership
  const { data: member } = await supabase
    .from('tenant_members')
    .select('tenant_id')
    .eq('user_id', session.user.id)
    .single();

  return { tenantId: member?.tenant_id || null, isImpersonating: false, isPlatformAdmin, userId: session.user.id };
}
