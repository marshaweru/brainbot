import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // IMPORTANT: do NOT set output: 'export' for dynamic pages/APIs
  output: "standalone",
};

export default nextConfig;
