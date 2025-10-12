/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,


  async redirects() {
    return [
      // เผื่อผู้ใช้เก่าที่เข้าพาธเดิม
      { source: '/servicereport', destination: '/', permanent: false },
      { source: '/servicereport/:path*', destination: '/:path*', permanent: false },
      // ให้ /tech/jobs (ไม่มีสแลช) ใช้ได้
      { source: '/tech/jobs', destination: '/tech/jobs/', permanent: false },
    ];
  },
};
export default nextConfig;
