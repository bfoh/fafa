'use client';

import { createMobileSupabaseClient } from './supabase';

/**
 * Native override for the cross-aliased web dashboard pages.
 *
 * Those pages import `createBrowserClient` from '@/lib/supabase/client', which
 * on the web is the @supabase/ssr cookie client. Under the capacitor:// origin
 * that cookie store is empty — the mobile login writes the session to Capacitor
 * Preferences — so the pages saw no session and failed to load their data.
 *
 * apps/mobile/tsconfig.json remaps '@/lib/supabase/client' to this file so the
 * web dashboard pages, when bundled into the native shell, use the same
 * Preferences-backed client as the rest of the app and share its session.
 */
export function createBrowserClient() {
  return createMobileSupabaseClient();
}
