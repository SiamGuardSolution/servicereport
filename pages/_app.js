// pages/_app.js
import '@/styles/globals.css';
import { useEffect, useRef } from 'react';
import { syncQueue } from '../lib/sync';

export default function App({ Component, pageProps }) {
  useEffect(() => {
    // SSR guard
    if (typeof window === 'undefined') return;

    // กันเรียกซ้อน
    let isRunning = false;
    const runSync = async () => {
      if (isRunning) return;
      isRunning = true;
      try {
        await syncQueue();
      } catch (e) {
        // เงียบไว้พอ, sync จะลองใหม่รอบถัดไปเอง
        // console.warn('syncQueue failed:', e);
      } finally {
        isRunning = false;
      }
    };

    // 1) ครั้งแรกที่เปิด
    runSync();

    // 2) กลับมาออนไลน์
    const onOnline = () => runSync();
    window.addEventListener('online', onOnline, { passive: true });

    // 3) แท็บถูกโฟกัส / กลับมาหน้าแอป
    const onVis = () => {
      if (document.visibilityState === 'visible') runSync();
    };
    document.addEventListener('visibilitychange', onVis, { passive: true });

    // 4) interval background (เช่น ทุก 60 วินาที)
    const INTERVAL_MS = 60_000;
    const timer = window.setInterval(() => {
      if (navigator.onLine !== false) runSync();
    }, INTERVAL_MS);

    return () => {
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVis);
      window.clearInterval(timer);
    };
  }, []);

  return <Component {...pageProps} />;
}
