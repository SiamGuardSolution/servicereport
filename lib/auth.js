// lib/auth.js
const KEY = 'auth';

export async function saveAuth({ staffId, token }) {
  localStorage.setItem(KEY, JSON.stringify({ staffId, token }));
}

export function getAuth() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
}
