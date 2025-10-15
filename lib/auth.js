// lib/auth.js
const KEY = 'sg.auth.v1';              // ตั้ง namespace + เวอร์ชันคีย์
const LEGACY_KEY = 'auth';             // เผื่อย้ายข้อมูลจากคีย์เก่า
let mem = null;                        // fallback สำหรับ SSR หรือกรณี localStorage ใช้ไม่ได้

function isBrowser() {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

function migrateLegacy() {
  if (!isBrowser()) return;
  try {
    const oldRaw = localStorage.getItem(LEGACY_KEY);
    if (oldRaw && !localStorage.getItem(KEY)) {
      localStorage.setItem(KEY, oldRaw);
      localStorage.removeItem(LEGACY_KEY);
    }
  } catch {}
}

export function getAuth() {
  if (isBrowser()) {
    migrateLegacy();
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) mem = JSON.parse(raw);
    } catch {}
  }
  return mem || {};
}

export async function saveAuth({ staffId, token, expiresAt } = {}) {
  const data = { staffId: staffId || '', token: token || '', expiresAt: expiresAt || 0 };
  mem = data;
  if (isBrowser()) {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch {}
  }
  return data;
}

export function clearAuth() {
  mem = null;
  if (isBrowser()) {
    try { localStorage.removeItem(KEY); } catch {}
  }
}

export function isAuthenticated() {
  const { token, expiresAt } = getAuth();
  if (!token) return false;
  if (expiresAt && Date.now() > Number(expiresAt)) return false;
  return true;
}

export function bearerHeader() {
  const { token } = getAuth();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
