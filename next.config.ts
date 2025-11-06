import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  // Disable browser source maps in production (Sentry handles source maps separately)
  productionBrowserSourceMaps: false,
};

export default nextConfig;
