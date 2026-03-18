import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {},
  webpack: (config) => {
    // Configure aliases for ed25519_tss_wasm
    config.resolve.alias['ed25519_tss_wasm'] = path.resolve(__dirname, 'wasm/pkg');
    config.resolve.alias['../ed25519_tss_wasm'] = path.resolve(__dirname, 'wasm/pkg');
    
    // Add alias for /wasm/pkg path to resolve from public folder
    config.resolve.alias['/wasm/pkg/ed25519_tss_wasm.js'] = path.resolve(__dirname, 'public/wasm/pkg/ed25519_tss_wasm.js');
    
    // Enable importing .wasm files
    config.resolve.extensions.push('.wasm', '.js');
    
    // Handle WASM files
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'asset/resource',
    });
    
    return config;
  },
};

export default nextConfig;
