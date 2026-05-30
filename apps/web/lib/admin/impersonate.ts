import { SupabaseClient } from '@supabase/supabase-js';

export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : null;
}

/**
 * Resolves the active tenant ID on the client side, taking admin impersonation
 * cookies into account. Securely validates that the current user is a verified
 * platform admin before respecting any impersonation cookie.
 */
export async function getResolvedTenantIdClient(
  supabase: SupabaseClient,
  session: any
): Promise<string | null> {
  if (!session) return null;

  // 1. Verify platform admin privileges securely via database check
  const { data: adminRecord } = await supabase
    .from('platform_admins')
    .select('user_id')
    .eq('user_id', session.user.id)
    .maybeSingle();

  if (adminRecord) {
    const impersonatedId = getCookie('didi_impersonate_tenant_id');
    if (impersonatedId) {
      return impersonatedId;
    }
  }

  // 2. Fallback to JWT user metadata / claims
  const metadataId = session.user.app_metadata?.tenant_id || 
                     session.user.user_metadata?.tenant_id;
  if (metadataId) return metadataId;

  // 3. Fallback to tenant_members table lookup
  const { data: member } = await supabase
    .from('tenant_members')
    .select('tenant_id')
    .eq('user_id', session.user.id)
    .single();

  return member?.tenant_id || null;
}
