// lib/global-shims.js
(function () {
  if (typeof globalThis.methodIn === 'function') return;

  globalThis.methodIn = function methodIn(method = 'GET', body) {
    const m = String(method || 'GET').toUpperCase();

    if (m === 'GET') {
      return { method: 'GET', redirect: 'follow' };
    }

    // ใช้ text/plain + JSON ให้ GAS อ่านง่าย และเลี่ยง CORS preflight
    return {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      body: JSON.stringify(body || {}),
      redirect: 'follow',
    };
  };
})();
