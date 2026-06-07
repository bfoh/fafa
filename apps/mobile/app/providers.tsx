'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { createMobileSupabaseClient } from './lib/supabase'; // Capacitor-persisted session
import { queryClient } from './query-client';

// Note: CartProvider is intentionally NOT here. It is per-tenant (keyed by slug)
// and `StorefrontMenu` mounts its own internally — matching apps/web.

type SupabaseClient = ReturnType<typeof createMobileSupabaseClient>;
const SupabaseCtx = createContext<SupabaseClient | null>(null);

export function useSupabase(): SupabaseClient {
  const ctx = useContext(SupabaseCtx);
  if (!ctx) throw new Error('Supabase client unavailable (called during prerender?)');
  return ctx;
}

export function Providers({ children }: { children: ReactNode }) {
  // Browser-only: instantiating supabase-js during the static-export prerender
  // starts its auto-refresh timer, which touches `window`. The shipped bundle
  // always runs in a WebView (window present), so guard creation to the client.
  const [supabase] = useState<SupabaseClient | null>(() =>
    typeof window === 'undefined' ? null : createMobileSupabaseClient()
  );

  useEffect(() => {
    // Persist the query cache so a cold, offline launch still paints the last
    // menu/order. Phase 0 uses localStorage (works in the WebView); Phase 1
    // swaps this for a Capacitor Preferences/SQLite persister.
    if (typeof window === 'undefined') return;
    const persister = createSyncStoragePersister({ storage: window.localStorage });
    persistQueryClient({
      queryClient,
      persister,
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <SupabaseCtx.Provider value={supabase}>{children}</SupabaseCtx.Provider>
    </QueryClientProvider>
  );
}
