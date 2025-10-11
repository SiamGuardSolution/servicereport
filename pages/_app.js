import '@/styles/globals.css';
import { useEffect } from 'react';
import { syncQueue } from '../lib/sync';

export default function App({ Component, pageProps }) {
  useEffect(() => {
    syncQueue();                      // เรียกตอนเปิดแอป
    const onOnline = () => syncQueue();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, []);
  return <Component {...pageProps} />;
}