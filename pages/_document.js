// pages/_document.js
import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="th" translate="no" data-theme="dark">
      <Head>
        {/* PWA / Mobile-friendly meta (ไม่กระทบ SSR) */}
        <meta name="theme-color" content="#111827" />
        <meta
          name="format-detection"
          content="telephone=no,date=no,address=no,email=no,url=no"
        />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />

        {/* ไอคอน / manifest (ถ้ายังไม่มีไฟล์ สามารถเพิ่มภายหลังได้) */}
        <link rel="icon" href="/favicon.ico" />
        <link rel="manifest" href="/manifest.webmanifest" />
      </Head>

      {/* suppressHydrationWarning กัน class เปลี่ยนตอน hydrate (เช่นธีม) */}
      <body className="antialiased bg-neutral-900 text-white" suppressHydrationWarning>
        <Main />
        <NextScript />

        {/* แจ้งผู้ใช้ถ้าปิด JS (เน้นแอปเราต้องใช้ JS) */}
        <noscript>
          <div
            style={{
              margin: "1rem",
              padding: "0.75rem 1rem",
              background: "#7f1d1d",
              color: "white",
              borderRadius: "0.5rem",
              fontSize: "0.9rem",
            }}
          >
            จำเป็นต้องเปิดใช้งาน JavaScript เพื่อใช้งานระบบรายงานหน้างาน
          </div>
        </noscript>
      </body>
    </Html>
  );
}
