import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@agenda-familia/types",
    "@agenda-familia/services",
  ],
  experimental: {
    serverComponentsExternalPackages: [
      "@prisma/client",
      "prisma",
      "@agenda-familia/database",
    ],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
    ],
  },
};

export default nextConfig;
