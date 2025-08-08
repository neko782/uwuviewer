import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.yande.re',
      },
      {
        protocol: 'https',
        hostname: 'yande.re',
      },
      {
        protocol: 'https',
        hostname: '*.konachan.com',
      },
      {
        protocol: 'https',
        hostname: 'konachan.com',
      },
    ],
  },

};

export default nextConfig;
