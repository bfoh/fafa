import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Didi native shell. The iOS/Android apps ARE the live platform: the WebView
 * loads https://ghdidi.com directly (server.url), so the apps always run the
 * real, fully-functional web app with zero UI divergence.
 *
 * This is a genuine native app — native iOS/Android projects, store-distributed
 * binaries, and native device APIs via Capacitor plugins (push, geolocation,
 * etc., invoked from the web app guarded by Capacitor.isNativePlatform()).
 *
 * A real origin (https://ghdidi.com) is also what makes routing/auth reliable:
 * the earlier offline-bundle attempt served over capacitor://localhost, whose
 * window.location.origin is "null", which broke Next.js App Router navigation.
 */
const config: CapacitorConfig = {
  appId: 'com.ghdidi.app',
  appName: 'Didi',
  webDir: 'out',
  server: {
    url: 'https://ghdidi.com',
    androidScheme: 'https',
    iosScheme: 'https',
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
