import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Bumped one level so the file:-linked `@print-room-studio/pricing` package
  // (resolved via `../print-room-studio/packages/pricing`) is inside Turbopack's
  // module-resolution root. Designer-port Phase 1 (2026-04-30).
  turbopack: {
    root: path.resolve(process.cwd(), ".."),
  },
  // file:-linked workspace packages need explicit transpile so Turbopack walks
  // their source instead of treating them as opaque node_modules.
  transpilePackages: ["@print-room-studio/pricing"],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'replicate.delivery',
      },
      {
        protocol: 'https',
        hostname: '**.replicate.delivery',
      },
    ],
  },
};

export default nextConfig;
