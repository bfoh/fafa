import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Resolve the authenticated user from an `Authorization: Bearer <jwt>` header.
 * Used by the rider endpoints (the mobile app sends its Supabase access token).
 * Returns null when missing/invalid.
 */
export async function userFromBearer(
  req: Request
): Promise<{ id: string } | null> {
  const header = req.headers.get('authorization');
  const token = header?.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;

  const { data, error } = await createAdminClient().auth.getUser(token);
  if (error || !data.user) return null;
  return { id: data.user.id };
}
