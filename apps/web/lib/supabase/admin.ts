import { createClient } from '@supabase/supabase-js';

/**
 * Admin client that bypasses RLS.
 * Only use in API routes and server actions, never on the client.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
