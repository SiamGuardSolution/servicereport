// components/AppShell.jsx
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import Head from 'next/head';
import { useRouter } from 'next/router';

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'Siam Guard Field App';
const ENV_NAME = process.env.NEXT_PUBLIC_ENV_NAME || ''; // e.g. 'PREVIEW' | 'DEV' | ''

function NavItem({ href, children, active }) {
  const base =
    'text-sm transition-opacity hover:opacity-100';
  const cls = active ? 'opacity-100 underline' : 'opacity-70';
  return (
    <Link href={href} className={`${base} ${cls}`}>
      {children}
    </Link>
  );
}

export default function AppShell({
  title,
  children,
  backHref,
  actions,     // <ReactNode> ปุ่มเสริมฝั่งขวา
  hideNav,     // true เพื่อซ่อนเมนู
}) {
  const router = useRouter();
  const [online, setOnline] = useState(true);

  useEffect(() => {
    if (typeof navigator !== 'undefined') {
      setOnline(navigator.onLine !== false);
      const on = () => setOnline(true);
      const off = () => setOnline(false);
      window.addEventListener('online', on);
      window.addEventListener('offline', off);
      return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
    }
  }, []);

  const isJobs = useMemo(() => router.pathname?.startsWith('/tech/jobs'), [router.pathname]);
  const isSettings = useMemo(() => router.pathname?.startsWith('/tech/settings'), [router.pathname]);

  const pageTitle = title ? `${title} – ${APP_NAME}` : APP_NAME;

  return (
    <div className="min-h-screen max-w-xl mx-auto p-4">
      <Head>
        <title>{pageTitle}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <header className="sticky top-0 z-20 bg-neutral-900/80 backdrop-blur supports-[backdrop-filter]:bg-neutral-900/60 rounded-xl px-3 py-3 mb-4 border border-neutral-800">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {backHref ? (
              <Link
                href={backHref}
                className="px-2 py-1 rounded-lg bg-neutral-800 border border-neutral-700 text-sm"
              >
                ← กลับ
              </Link>
            ) : null}
            <h1 className="text-lg font-semibold">{title || APP_NAME}</h1>
            {ENV_NAME ? (
              <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full border border-amber-400/40 text-amber-300">
                {ENV_NAME}
              </span>
            ) : null}
          </div>

          <nav className="flex items-center gap-4">
            {!hideNav && (
              <>
                <NavItem href="/tech/jobs" active={isJobs}>งานของฉัน</NavItem>
                <NavItem href="/tech/settings" active={isSettings}>ตั้งค่า</NavItem>
              </>
            )}
            {actions || null}
          </nav>
        </div>

        {/* สถานะเครือข่าย */}
        {!online && (
          <div className="mt-2 text-xs text-amber-300">
            ออฟไลน์อยู่ — ข้อมูลจะถูกบันทึกแบบออฟไลน์และซิงก์อัตโนมัติเมื่อกลับมาออนไลน์
          </div>
        )}
      </header>

      <main className="space-y-4">
        {children}
      </main>

      <footer className="mt-10 text-center text-xs opacity-60">
        {APP_NAME}
      </footer>
    </div>
  );
}
