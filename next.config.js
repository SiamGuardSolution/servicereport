/** @type {import('next').NextConfig} */
const IS_PROD = process.env.VERCEL_ENV === 'production';

const nextConfig = {
  reactStrictMode: true,
  trailingSlash: false,
  images: { remotePatterns: [{ protocol: "https", hostname: "**" }] },
  async redirects() {
    if (!IS_PROD) return []; // ปิด redirect บน preview/dev
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.siamguards.com" }],
        destination: "https://siamguards.com/:path*",
        permanent: true,
      },
    ];
  },
};
module.exports = nextConfig;
