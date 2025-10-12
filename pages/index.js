// pages/index.js
import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function Home() {
  // Fallback ฝั่ง client (กรณีกด Back, ปิด JS ตอนแรก ฯลฯ)
  const router = useRouter();
  useEffect(() => {
    // รองรับ basePath ถ้ามี
    const to = `${router.basePath || ''}/tech/jobs`;
    // ใช้ replace เพื่อลดประวัติ stack
    router.replace(to);
  }, [router]);

  // เผื่อ JS ถูกปิด
  return (
    <noscript>
      <meta httpEquiv="refresh" content="0; url=/tech/jobs" />
      <a href="/tech/jobs">ไปที่ /tech/jobs</a>
    </noscript>
  );
}

// Redirect ฝั่งเซิร์ฟเวอร์ (แนะนำสุด)
export async function getServerSideProps() {
  return {
    redirect: {
      destination: '/tech/jobs',
      permanent: false, // 302 (อย่าใช้ 308/301 ถ้ายังไม่แน่ใจ)
    },
  };
}
