import type { NextConfig } from "next";

// Local dev: Node.js can't verify Supabase's TLS cert without system CA bundle
if (process.env.LOCAL_DEV === "true") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typescript: { ignoreBuildErrors: true },
  productionBrowserSourceMaps: false,
  serverExternalPackages: ["@resvg/resvg-js", "sharp"],
};

export default nextConfig;
