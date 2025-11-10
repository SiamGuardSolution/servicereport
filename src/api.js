// src/api.js
const LS_BASE_KEY = 'gas_base';
const RAW_BASE = (
  localStorage.getItem(LS_BASE_KEY) ||
  process.env.REACT_APP_GAS_BASE ||
  ''
).replace(/\/+$/, '');

const EXEC_BASE = RAW_BASE
  ? (/\/exec$/.test(RAW_BASE) ? RAW_BASE : `${RAW_BASE}/exec`)
  : '';

function ensureExecBase() {
  if (!EXEC_BASE) {
    throw new Error('EXEC_BASE is empty. Set REACT_APP_GAS_BASE or gas_base in localStorage');
  }
}

// -------------------------------------------------------------------------------------------------
// เส้นทางภายในแอป (ให้ตรงกับ Router จริง)
// -------------------------------------------------------------------------------------------------
export function getInternalViewerUrlBySid(serviceId) {
  if (!serviceId) return '';
  // viewer อ่านอย่างเดียวของลูกค้า
  return `/report-view/${encodeURIComponent(serviceId)}?public=1`;
  // ถ้าจะเปิดหน้าแก้ไขของช่าง ให้ใช้:
  // return `/report/${encodeURIComponent(serviceId)}`;
}

// -------------------------------------------------------------------------------------------------
// fetch helper
// -------------------------------------------------------------------------------------------------
async function fetchJSON(url, options) {
  const res = await fetch(url, options);
  const text = await res.text();
  try { return JSON.parse(text); }
  catch { return { ok:false, error:`Invalid JSON: ${text.slice(0,200)}` }; }
}

// -------------------------------------------------------------------------------------------------
// Router helper: เลือก GET เฉพาะ route ที่อ่านข้อมูลเท่านั้น, ที่เหลือ POST เสมอ
// -------------------------------------------------------------------------------------------------
const SAFE_GET_ROUTES = new Set(['ping', 'jobs.list', 'report/resolve', 'report-by-id']);

export async function callRoute(route, payload = {}) {
  ensureExecBase();
  const body = { ...payload, route };
  const isScriptGoogle = /\/\/script\.google\.com\//.test(EXEC_BASE);

  // อนุญาตให้ GET เฉพาะตอนเป็น script.google.com และ route อยู่ใน SAFE_GET_ROUTES
  if (isScriptGoogle && SAFE_GET_ROUTES.has(route)) {
    const qs = new URLSearchParams(
      Object.entries(body).filter(([, v]) => (v === 0) || (v !== undefined && v !== null && v !== ''))
    );
    return fetchJSON(`${EXEC_BASE}?${qs.toString()}`);
  }

  // นอกนั้น POST เสมอ (กัน 302 ทิ้ง body และป้องกันการเรียก create/update แบบ GET)
  return fetchJSON(EXEC_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body),
  });
}

// ถ้าต้องการใช้จากหน้าอื่น: ตัวช่วยสร้างรายงานโดยตรง
export async function createReport(payload) {
  return callRoute('report/create', payload);
}

// -------------------------------------------------------------------------------------------------
// พยายาม resolve serviceId จากการ์ด (ถ้ายังไม่มี)
// -------------------------------------------------------------------------------------------------
async function resolveServiceIdForCard(card, auth) {
  const payload = {
    // auth
    phone: auth?.phone || auth?.auth_phone,
    userId: auth?.userId || auth?.auth_userId,
    auth_phone: auth?.phone || auth?.auth_phone,
    auth_userId: auth?.userId || auth?.auth_userId,
    // job hints
    date: card?.date || card?.serviceDate,
    serviceDate: card?.serviceDate || card?.date,
    time: card?.time || card?.timeHint,
    team: card?.team || card?.teamName,
    teamName: card?.teamName || card?.team,
    technician: card?.technician || card?.technicianName,
    technicianName: card?.technicianName || card?.technician,
    customer: card?.customer || card?.customerName,
    customerName: card?.customerName || card?.customer,
    address: card?.address,
    contact: card?.contact || card?.phoneCustomer,
    phoneCustomer: card?.phoneCustomer || card?.contact,
    rowIndex: card?.rowIndex,

    // คีย์ผสมที่ฝั่ง GAS มักใช้ประกอบเป็น serviceId
    serviceKey: [card?.date || card?.serviceDate, card?.rowIndex, card?.time, card?.customer || card?.customerName]
      .filter(Boolean).join('|'),
  };
  // ใช้ callRoute เพื่อจัดการ GET/POST ให้เหมาะสมอัตโนมัติ
  return callRoute('report/resolve', payload);
}

// -------------------------------------------------------------------------------------------------
// เปิดรายงานจากการ์ด: มี sid → ไปเลย, ไม่มี → resolve แล้วไป
// -------------------------------------------------------------------------------------------------
export async function openReportForCard(record, navigate, auth) {
  const sid =
    record?.serviceId ||
    record?.service_id ||
    record?.reportHeader?.serviceId ||
    record?.header?.serviceId;

  if (sid) {
    navigate(getInternalViewerUrlBySid(sid));
    return true;
  }

  const out = await resolveServiceIdForCard(record, auth);
  console.log('[openReportForCard] resolve result =', out);
  if (out?.ok && out.serviceId) {
    navigate(getInternalViewerUrlBySid(out.serviceId));
    return true;
  }
  return false; // ให้ผู้เรียก alert เอง
}
