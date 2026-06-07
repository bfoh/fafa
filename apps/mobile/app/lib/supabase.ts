'use client';

import { createClient } from '@supabase/supabase-js';
import { Preferences } from '@capacitor/preferences';

/**
 * Mobile Supabase client. Auth session is persisted via Capacitor Preferences
 * (app-sandboxed) instead of localStorage, so the token survives app restarts
 * and lives outside the WebView's clearable storage.
 *
 * HARDENING TODO (Phase 2.1): swap Preferences for an encrypted secure-storage
 * plugin (Keychain / EncryptedSharedPreferences). The async storage adapter
 * shape below is identical, so it's a one-file change.
 */
const capacitorAuthStorage = {
  getItem: async (key: string): Promise<string | null> => {
    const { value } = await Preferences.get({ key });
    return value;
  },
  setItem: async (key: string, value: string): Promise<void> => {
    await Preferences.set({ key, value });
  },
  removeItem: async (key: string): Promise<void> => {
    await Preferences.remove({ key });
  },
};

export function createMobileSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder',
    {
      auth: {
        storage: capacitorAuthStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false, // no SSR redirect flow in a packaged app
      },
    }
  );
}
