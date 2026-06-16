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
 * androidScheme/iosScheme serve the bundle over https://localhost /
 * capacitor://localhost, which yields a real window.location.origin. A previous
 * attempt loaded over file:// (origin "null") and broke Next.js App Router
 * navigation; the custom scheme avoids that. next.config.ts pins
 * NEXT_PUBLIC_URL so store/share links resolve to the real web origin.
 *
 * Build the export and re-sync before testing: `npm run mobile:sync`.
 * VERIFY on a real device before tagging a release — App Router navigation,
 * Supabase auth/session, and deep links must all work from the bundled origin.
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
