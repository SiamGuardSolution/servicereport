// lib/api.js

/** Resolve GAS exec base once (must be the full ".../exec") */
function resolveExecBase() {
  const base =
    process.env.NEXT_PUBLIC_GAS_EXEC_PRIMARY ||
    process.env.NEXT_PUBLIC_GAS_EXEC ||
    process.env.NEXT_PUBLIC_GAS_EXEC_BACKUP ||
    process.env.GAS_EXEC ||
    process.env.NEXT_PUBLIC_API_BASE || // fallback (must already be /exec)
    "";

  if (!base) throw new Error("GAS exec URL is empty");
  return String(base).replace(/\/+$/, ""); // keep .../exec without trailing slash
}

/** POST to GAS route with plain text body (Apps Script friendly) */
async function j(route, body) {
  const base = resolveExecBase();
  const res = await fetch(`${base}?route=${encodeURIComponent(route)}`, {
    method: "POST",
    headers: { "Content-Type": "text/plain; charset=utf-8" },
    body: JSON.stringify(body || {}),
    redirect: "follow",
  });

  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { ok: false, error: `HTTP ${res.status}: ${text.slice(0, 200)}` };
  }
}

/** =========================
 *  Public API
 *  ========================= */

/**
 * ดึง "งานของฉัน" จาก GAS
 * @param {Object} opts
 * @param {string} opts.date - yyyy-MM-dd
 * @param {number} [opts.range=0] - ขยายช่วงวัน ±range
 * @param {string} [opts.uid]
 * @param {string} [opts.name]
 * @param {string} [opts.phone]
 * @param {string} [opts.team] - ตัวกรองทีม เช่น 'A' | 'B' | 'C'
 * @param {boolean} [opts.includeUnassigned=true] - รวมงานที่ช่องผู้รับผิดชอบว่าง
 */
export async function fetchMyJobs({
  date,
  range = 0,
  uid,
  name,
  phone,
  team,
  includeUnassigned = true,
}) {
  const base = resolveExecBase();

  const qs = new URLSearchParams({
    route: "listmyjobs",
    date,
    range: String(range),
    includeUnassigned: includeUnassigned ? "1" : "0",
    ...(uid ? { uid } : {}),
    ...(name ? { name } : {}),
    ...(phone ? { phone } : {}),
    ...(team ? { team } : {}), // << เพิ่มทีม
  });

  const res = await fetch(`${base}?${qs.toString()}`, {
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`GAS ${res.status}`);
  return res.json();
}

/**
 * อัปโหลดรูปภาพเป็นไฟล์ Drive ผ่าน GAS
 * @param {{zone:string, caption:string, file:File}[]} filesWithZone
 */
export async function uploadImages(filesWithZone = []) {
  const out = [];
  for (const it of filesWithZone) {
    const b64 = await fileToBase64(it.file);
    const res = await j("upload", {
      zone: it.zone || "",
      caption: it.caption || "",
      base64: b64,
      name: it.file.name,
    });
    if (!res?.ok) throw new Error(res?.error || "upload failed");
    out.push({
      zone: it.zone || "",
      caption: it.caption || "",
      fileId: res.fileId,
      url: res.url,
    });
  }
  return out;
}

/** สร้างรายงาน Service */
export function createServiceReport(payload) {
  return j("report/create", payload);
}

/** เติมรายการเคมีลงรายงาน */
export function appendChemicals(serviceId, items) {
  // items: [{ zone, name, qty, remark, link }]
  return j("append-items", { service_id: serviceId, items });
}

/** Utils */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result).split(",")[1]);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}
