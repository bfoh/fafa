import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Ships the static `out/` bundle inside the binary and serves it over Capacitor's
 * embedded localhost scheme (NOT raw file://, NOT a remote server.url). This is
 * what keeps the app offline-first and store-compliant (Apple 4.2).
 *
 *   iOS     → capacitor://localhost
 *   Android → https://localhost   (secure context: needed later for SW, geo, push)
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
};

export default config;
