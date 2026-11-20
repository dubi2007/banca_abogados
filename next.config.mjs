/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: { remotePatterns: [{ protocol: 'https', hostname: 'images.unsplash.com' }] },
  async redirects() {
    return [{ source: '/', destination: '/es/', permanent: false }];
  },
};
export default nextConfig;
