import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Didi native shell. The app loads its UI from the static export bundled inside
 * the binary (webDir: 'out') — NOT from a remote URL. This is required to pass
 * App Store Guideline 4.2 (a remote-URL WebView reads as a repackaged website)
 * and gives instant, offline-capable first render. All data still comes from the
 * deployed API (NEXT_PUBLIC_API_BASE) and Supabase over HTTPS; native device
 * APIs come via Capacitor plugins (push, geolocation) guarded by
 * Capacitor.isNativePlatform().
 *
 * iOS serves the bundle over the default capacitor://localhost scheme (iOS
 * WKWebView cannot serve content over the reserved https scheme, so iosScheme
 * must NOT be 'https'). Android uses https://localhost. Both are in the API's
 * CORS allowlist (apps/web/lib/http/cors.ts).
 *
 * IMPORTANT — owner dashboard is NOT served from this bundle. capacitor://
 * yields window.location.origin === "null", which prevents the Next App Router
 * from navigating into the (dashboard) route group (soft nav fails; a hard
 * window.location nav falls back to the root marketplace page). So the bundled
 * app ships the CUSTOMER experience (marketplace, storefront, checkout) and
 * routes restaurant owners to the live site (NEXT_PUBLIC_API_BASE) for login,
 * sign-up, and the dashboard — which authenticate server-side and work fully.
 * next.config.ts pins NEXT_PUBLIC_URL so store/share links resolve to the real
 * web origin.
 */
const config: CapacitorConfig = {
  appId: 'com.ghdidi.app',
  appName: 'Didi',
  webDir: 'out',
  server: {
    androidScheme: 'https',
    iosScheme: 'capacitor',
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
