// components/NetBadge.jsx
import React, { useEffect, useState } from 'react';

export default function NetBadge(){
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const s = () => setOnline(navigator.onLine);
    window.addEventListener('online', s);
    window.addEventListener('offline', s);
    s();
    return () => {
      window.removeEventListener('online', s);
      window.removeEventListener('offline', s);
    };
  }, []);

  return (
    <span className={`inline-flex items-center gap-2 text-xs px-2 py-1 rounded-full ${online? 'bg-emerald-700/30 text-emerald-300':'bg-rose-700/30 text-rose-300'}`}>
      <span className={`w-2 h-2 rounded-full ${online? 'bg-emerald-400':'bg-rose-400'}`}/>
      {online? 'ออนไลน์':'ออฟไลน์'}
    </span>
  );
}
