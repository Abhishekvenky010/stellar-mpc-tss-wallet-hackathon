import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {},
  webpack: (config) => {
    config.resolve.alias['ed25519_tss_wasm'] = path.resolve(__dirname, 'wasm/pkg');
    return config;
  },
};

export default nextConfig;
