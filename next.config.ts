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
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
