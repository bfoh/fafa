import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Shared storefront package ships raw TS/TSX — transpile it.
  transpilePackages: ['@fafa/storefront'],
};

export default nextConfig;
