import { PHASE_DEVELOPMENT_SERVER } from 'next/constants.js';

/** @type {(phase: string) => import('next').NextConfig} */
export default function nextConfig(phase) {
  return {
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? '.next-dev' : '.next',
    output: 'standalone',
    images: {
      qualities: [75, 90],
      remotePatterns: [{ protocol: 'https', hostname: 'images.unsplash.com' }],
    },
    async redirects() {
      return [{ source: '/', destination: '/es/', permanent: false }];
    },
  };
}
