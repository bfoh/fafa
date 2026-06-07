import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Shared storefront package ships raw TS/TSX — transpile it.
  transpilePackages: ['@fafa/storefront'],
  // Apple requires the AASA file served as application/json (it has no extension).
  async headers() {
    return [
      {
        source: '/.well-known/apple-app-site-association',
        headers: [{ key: 'Content-Type', value: 'application/json' }],
      },
    ];
  },
};

export default nextConfig;
