import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.r2.cloudflarestorage.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "**.r2.dev",
        pathname: "/**",
      },
    ],
    minimumCacheTTL: 2678400, // 31 days — reduces Image Optimization re-processing
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
