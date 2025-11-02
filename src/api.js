// src/api.js
const LS_BASE_KEY = 'gas_base';
const RAW_BASE = (
  localStorage.getItem(LS_BASE_KEY) ||
  process.env.REACT_APP_GAS_BASE ||
  ''
).replace(/\/+$/, '');
const EXEC_BASE = /\/exec$/.test(RAW_BASE) ? RAW_BASE : `${RAW_BASE}/exec`;

// เปิด viewer ภายในแอป
export function getInternalViewerUrlBySid(serviceId) {
  return serviceId ? `/service-report/${encodeURIComponent(serviceId)}` : '';
}

// พยายาม resolve serviceId จากข้อมูลการ์ด (ถ้ายังไม่มี)
async function resolveServiceIdForCard(card, auth) {
  const payload = {
    route: 'report/resolve',
    // auth
    phone: auth?.phone || auth?.auth_phone,
    userId: auth?.userId || auth?.auth_userId,
    auth_phone: auth?.phone || auth?.auth_phone,
    auth_userId: auth?.userId || auth?.auth_userId,
    // job hints
    date: card.date || card.serviceDate,
    time: card.time || card.timeHint,
    team: card.team || card.teamName,
    technician: card.technician || card.technicianName,
    customer: card.customer || card.customerName,
    address: card.address,
    contact: card.contact || card.phoneCustomer,
  };

  // ถ้าเป็น script.google.com ให้ยิงแบบ GET (เลี่ยง 302 ทิ้ง body)
  const isScriptGoogle = /\/\/script\.google\.com\//.test(EXEC_BASE);
  if (isScriptGoogle) {
    const qs = new URLSearchParams(Object.entries(payload).filter(([,v]) => v != null && v !== ''));
    const r = await fetch(`${EXEC_BASE}?${qs.toString()}`);
    const t = await r.text();
    try { return JSON.parse(t); } catch { return { ok:false, error:t }; }
  } else {
    const r = await fetch(EXEC_BASE, {
      method:'POST',
      headers:{'Content-Type':'text/plain;charset=utf-8'},
      body: JSON.stringify(payload),
    });
    const t = await r.text();
    try { return JSON.parse(t); } catch { return { ok:false, error:t }; }
  }
}

// เปิดรายงานจากการ์ด: มี sid → ไปเลย, ไม่มี → resolve แล้วไป
export async function openReportForCard(record, navigate, auth) {
  // 1) มี sid ติดมากับการ์ด
  const sid =
    record?.serviceId ||
    record?.service_id ||
    record?.reportHeader?.serviceId ||
    record?.header?.serviceId;

  if (sid) {
    navigate(getInternalViewerUrlBySid(sid));
    return true;
  }

  // 2) ไม่มี sid → ลอง resolve จาก GAS
  const out = await resolveServiceIdForCard(record, auth);
  if (out?.ok && out.serviceId) {
    navigate(getInternalViewerUrlBySid(out.serviceId));
    return true;
  }

  return false; // ให้ผู้เรียก alert เอง
}
