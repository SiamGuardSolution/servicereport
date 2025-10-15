/** @type {import('next').NextConfig} */
const IS_PROD = process.env.VERCEL_ENV === 'production';

const nextConfig = {
  reactStrictMode: true,
  trailingSlash: false,
  images: { remotePatterns: [{ protocol: "https", hostname: "**" }] },

  // Redirect เฉพาะ Production: apex -> www
  async redirects() {
    if (!IS_PROD) return []; // กันไม่ให้ preview โดน
    return [
      {
        // มาจาก apex (siamguards.com) → ไป www.siamguards.com
        source: "/:path*",
        has: [{ type: "host", value: "siamguards.com" }],
        destination: "https://www.siamguards.com/:path*",
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;
