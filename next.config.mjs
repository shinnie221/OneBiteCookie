/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {},
  serverExternalPackages: ['sql.js'],
  images: {
    // Product photos are uploaded to ImgBB; let next/image resize and cache them
    remotePatterns: [new URL('https://i.ibb.co/**')],
  },
};

export default nextConfig;
