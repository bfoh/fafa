import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Ships the static `out/` bundle inside the binary and serves it over Capacitor's
 * embedded localhost scheme (NOT raw file://, NOT a remote server.url) — keeps the
 * app offline-first, store-compliant (Apple 4.2), and shows the custom mobile UI.
 *
 *   iOS     → capacitor://localhost
 *   Android → https://localhost
 *
 * GOTCHA — `window.location.origin` is the string "null" here (capacitor:// is a
 * non-special URL scheme, and iosScheme can't be 'https': WebKit reserves it so
 * Capacitor reverts to 'capacitor'). That means Next.js App Router client
 * navigation (which builds URLs with `new URL(path, location.origin)`) breaks with
 * WebKit error 102 on any cross-route-group hop. RULE: navigate in-app with hard
 * `window.location.assign('/path/')` (resolves against the document base URL, not
 * origin → a valid capacitor://localhost/path/ that Capacitor allows), NOT the
 * Next router. Session is stored in Capacitor Preferences, so after a hard nav the
 * destination guard must tolerate the async read (session-grace) before bouncing.
 */
const config: CapacitorConfig = {
  appId: 'com.ghdidi.app',
  appName: 'Didi',
  webDir: 'out',
  server: {
    androidScheme: 'https',
    iosScheme: 'capacitor',
    // No `url` — never load the live site into the WebView.
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
