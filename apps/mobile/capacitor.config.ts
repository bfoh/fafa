import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Ships the static `out/` bundle inside the binary and serves it over Capacitor's
 * embedded localhost scheme (NOT raw file://, NOT a remote server.url). This is
 * what keeps the app offline-first and store-compliant (Apple 4.2).
 *
 *   iOS     → https://localhost
 *   Android → https://localhost   (secure context: needed for SW, geo, push)
 *
 * iOS uses `https` (NOT the default `capacitor`) on purpose: a `capacitor://`
 * origin is a non-special URL scheme, so window.location.origin === "null".
 * Next.js App Router builds nav URLs with new URL(path, location.origin), which
 * throws on a "null" base → a malformed top-level nav that Capacitor cancels →
 * WebKit error 102 ("This page couldn't load") right after the first screen.
 * `https://localhost` is a special scheme with a real origin, so routing works.
 * Session lives in Capacitor Preferences (native), so it survives the origin change.
 */
const config: CapacitorConfig = {
  appId: 'com.ghdidi.app',
  appName: 'Didi',
  webDir: 'out',
  server: {
    androidScheme: 'https',
    iosScheme: 'https',
    // No `url` — never load the live site into the WebView.
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
