// components/NetBadge.jsx
import React, { useEffect, useRef, useState } from 'react';

export default function NetBadge({
  pingUrl,
  intervalMs = 15000,
  timeoutMs = 3000,
  className = '',
  onChange,
  labels = { online: 'ออนไลน์', offline: 'ออฟไลน์' },
}) {
  const [online, setOnline] = useState(true);          // สถานะรวม (os + ping)
  const [osOnline, setOsOnline] = useState(true);      // จาก navigator.onLine
  const [pingOk, setPingOk] = useState(true);          // จากการ ping จริง
  const mounted = useRef(false);
  const timerRef = useRef(null);

  // helper: SSR-safe check
  const isBrowser = () => typeof window !== 'undefined' && typeof navigator !== 'undefined';

  // helper: fetch with timeout (HEAD/GET)
  async function fetchWithTimeout(url, { method = 'HEAD' } = {}) {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { method, cache: 'no-store', redirect: 'follow', signal: ctrl.signal });
      return res.ok;
    } catch {
      return false;
    } finally {
      clearTimeout(id);
    }
  }

  // sync composed state + fire onChange
  useEffect(() => {
    const next = osOnline && (pingUrl ? pingOk : true);
    setOnline(next);
    if (mounted.current && typeof onChange === 'function') onChange(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [osOnline, pingOk, pingUrl]);

  // lifecycle
  useEffect(() => {
    mounted.current = true;
    if (!isBrowser()) return () => { mounted.current = false; };

    // initial OS state
    const initOnline = navigator.onLine !== false;
    setOsOnline(initOnline);

    // event listeners
    const on = () => setOsOnline(true);
    const off = () => setOsOnline(false);
    window.addEventListener('online', on, { passive: true });
    window.addEventListener('offline', off, { passive: true });

    // ping loop (optional)
    const startPing = async () => {
      if (!pingUrl) return;
      // run once immediately
      setPingOk(await fetchWithTimeout(pingUrl));
      // then schedule
      timerRef.current = setInterval(async () => {
        if (navigator.onLine === false) { setPingOk(false); return; }
        setPingOk(await fetchWithTimeout(pingUrl));
      }, Math.max(3000, intervalMs));
    };
    startPing();

    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
      if (timerRef.current) clearInterval(timerRef.current);
      mounted.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pingUrl, intervalMs, timeoutMs]);

  const badgeOnline = online;
  const text = badgeOnline ? (labels.online || 'ออนไลน์') : (labels.offline || 'ออฟไลน์');

  return (
    <span
      className={`inline-flex items-center gap-2 text-xs px-2 py-1 rounded-full ${
        badgeOnline ? 'bg-emerald-700/30 text-emerald-300' : 'bg-rose-700/30 text-rose-300'
      } ${className}`}
      title={pingUrl ? `OS:${osOnline ? 'on' : 'off'} • PING:${pingOk ? 'ok' : 'fail'}` : undefined}
    >
      <span className={`w-2 h-2 rounded-full ${badgeOnline ? 'bg-emerald-400' : 'bg-rose-400'}`} />
      {text}
    </span>
  );
}
