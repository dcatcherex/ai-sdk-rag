import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Serve the well-known provider manifest from /.well-known/
  async rewrites() {
    return [
      {
        source: '/.well-known/vaja-tool-provider.json',
        destination: '/api/well-known/provider-manifest',
      },
    ];
  },
};

export default nextConfig;
