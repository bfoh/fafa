import type { CapacitorConfig } from '@capacitor/cli';

/**
 * The iOS/Android WebView loads the live web app at https://ghdidi.com directly
 * (server.url), NOT the local static `out/` bundle.
 *
 * Why: serving the bundle over the embedded scheme made the WebView origin
 * `capacitor://localhost`, whose `window.location.origin` is the string "null"
 * (capacitor:// is a non-special URL scheme). That broke Next.js App Router
 * navigation (new URL(path, location.origin) throws → WebKit 102) AND forced a
 * fragile CORS proxy + Capacitor-Preferences session adapter that raced on every
 * hard navigation. Loading the real origin (https://ghdidi.com) fixes all of it:
 * real origin → routing works, real cookies → normal Supabase web session, same
 * origin → no CORS. The app behaves exactly like the responsive website.
 *
 * Trade-offs (accepted): online-only (no offline bundle), and the native plugin
 * hooks (push, rider background-geolocation) live in apps/mobile and won't run
 * against the loaded apps/web pages until they're added to the web app. The
 * static `out/` bundle still ships as a fallback (webDir) but isn't loaded.
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
