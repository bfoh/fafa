import type { NextConfig } from 'next';

/**
 * Static export for the Capacitor shell. Contains ONLY the customer storefront
 * routes; all data comes from apps/web's deployed API (NEXT_PUBLIC_API_BASE) and
 * Supabase. No /api, no middleware, no SSR — this bundle ships inside the binary.
 */
const config: NextConfig = {
  output: 'export',
  distDir: 'out', // Capacitor webDir
  trailingSlash: true, // export → folder/index.html routing
  images: { unoptimized: true }, // no image optimizer in export; storefront uses <img>
  transpilePackages: ['@fafa/storefront'], // shared package ships raw TS/TSX
  env: {
    NEXT_PUBLIC_API_BASE: process.env.NEXT_PUBLIC_API_BASE,
    // Cross-aliased dashboard pages call getBaseUrl() for store/share links; in
    // the Capacitor shell window.location is capacitor://localhost, so pin the
    // real web origin here. Falls back to the production domain.
    NEXT_PUBLIC_URL: process.env.NEXT_PUBLIC_URL || process.env.NEXT_PUBLIC_API_BASE || 'https://ghdidi.com',
  },
};

export default config;
