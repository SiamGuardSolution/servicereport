/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // กัน redirect/rewrite ที่เผลอประกาศไว้ที่ไหนสักแห่ง
  async redirects() {
    return [];
  },
  async rewrites() {
    return [];
  },
};

module.exports = nextConfig;
