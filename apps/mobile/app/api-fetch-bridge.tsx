'use client';

import { Capacitor } from '@capacitor/core';
import { createMobileSupabaseClient } from './lib/supabase';

const API = process.env.NEXT_PUBLIC_API_BASE ?? 'https://ghdidi.com';

/**
 * Native fetch bridge.
 *
 * The cross-aliased web dashboard pages call the backend with RELATIVE URLs
 * (e.g. fetch('/api/orders/123', { method: 'PATCH' })). On the web that's
 * same-origin and authenticated by cookies. In the native shell the app runs
 * from capacitor://localhost, so those requests never reach the backend and
 * carry no auth (the session lives in Capacitor Preferences, not cookies) — which
 * is why owner actions like "Confirm Order" failed.
 *
 * This patches window.fetch once, on native only, to:
 *   1. rewrite same-app `/api/...` requests to the live backend (NEXT_PUBLIC_API_BASE)
 *   2. attach the Preferences session as `Authorization: Bearer <token>`
 *
 * Already-absolute URLs (Supabase, the customer order-create call, login) are
 * left untouched. Installed at module load so it's active before any page fetch.
 */
function installBridge() {
  if (typeof window === 'undefined') return;
  const w = window as typeof window & { __didiFetchPatched?: boolean };
  if (w.__didiFetchPatched) return;
  if (!Capacitor.isNativePlatform()) return;
  w.__didiFetchPatched = true;

  const orig = window.fetch.bind(window);
  let client: ReturnType<typeof createMobileSupabaseClient> | null = null;

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const rawUrl =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : input instanceof Request
              ? input.url
              : '';

      // Same-app API call: relative '/api/...' or a localhost-resolved one.
      let apiIdx = -1;
      if (rawUrl.startsWith('/api/')) apiIdx = 0;
      else if (/\/\/localhost\/api\//.test(rawUrl)) apiIdx = rawUrl.indexOf('/api/');

      if (apiIdx >= 0) {
        const target = `${API}${rawUrl.slice(apiIdx)}`;

        const headers = new Headers(
          init?.headers ?? (input instanceof Request ? input.headers : undefined)
        );
        if (!headers.has('authorization')) {
          client = client ?? createMobileSupabaseClient();
          const {
            data: { session },
          } = await client.auth.getSession();
          if (session?.access_token) {
            headers.set('Authorization', `Bearer ${session.access_token}`);
          }
        }

        if (input instanceof Request) {
          return orig(new Request(target, input), { ...init, headers });
        }
        return orig(target, { ...init, headers });
      }
    } catch {
      // fall through to the original fetch on any issue
    }
    return orig(input, init);
  };
}

installBridge();

/** Mounting this (in the root layout) guarantees the module — and its
 *  module-load fetch patch above — is included in the bundle. */
export function ApiFetchBridge() {
  return null;
}
