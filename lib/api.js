// lib/api.js

/** ---------- Base URLs ---------- */
function resolveExecBases() {
  const bases = [
    process.env.NEXT_PUBLIC_GAS_EXEC_PRIMARY,
    process.env.NEXT_PUBLIC_GAS_EXEC,          // main
    process.env.NEXT_PUBLIC_GAS_EXEC_BACKUP,   // backup
    process.env.GAS_EXEC,                      // SSR
    process.env.NEXT_PUBLIC_API_BASE           // ต้องเป็น .../exec
  ].filter(Boolean).map(s => String(s).replace(/\/+$/, ''));
  if (bases.length === 0) throw new Error('GAS exec URL is empty');
  return [...new Set(bases)];
}

/** ---------- Fetch helpers ---------- */
function withTimeout(promise, ms = 20000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(v => { clearTimeout(t); resolve(v); },
                 e => { clearTimeout(t); reject(e); });
  });
}

async function parseMaybeJSON(res) {
  const text = await res.text();
  try {
    return { ok: true, json: JSON.parse(text), raw: text };
  } catch {
    return { ok: true, json: null, raw: text };
  }
}

/** ยิงทุก base × route จนสำเร็จ */
async function tryAcrossBasesAndRoutes({ method, bases, routes, body, qs }) {
  const errors = [];
  for (const base of bases) {
    for (const route of routes) {
      try {
        const url =
          method === 'GET'
            ? `${base}?route=${encodeURIComponent(route)}${qs ? `&${new URLSearchParams(qs).toString()}` : ''}`
            : `${base}?route=${encodeURIComponent(route)}`;

        const init =
          method === 'GET'
            ? { method: 'GET', redirect: 'follow', cache: 'no-store' }
            : {
                method: 'POST',
                // Apps Script ชอบ text/plain มากกว่า application/json (เลี่ยง preflight)
                headers: { 'Content-Type': 'text/plain; charset=utf-8' },
                body: JSON.stringify(body || {}),
                redirect: 'follow'
              };

        const res = await withTimeout(fetch(url, init));
        const { json, raw } = await parseMaybeJSON(res);

        const unknown =
          !res.ok ||
          (json && json.ok === false && /unknown route|not found/i.test(json.error || '')) ||
          (!json && /unknown route|not found/i.test(String(raw || '')));

        if (!unknown) {
          return json ?? { ok: true, raw };
        }
        errors.push({ base, route, status: res.status, error: json?.error || raw?.slice(0, 120) });
      } catch (e) {
        errors.push({ base, route, status: 'ERR', error: String(e) });
      }
    }
  }
  const msg = errors.map(e => `${e.route}@${e.base} [${e.status}:${e.error}]`).join(', ');
  throw new Error(`unknown route: ${msg}`);
}

/** ---------- Utils ---------- */
// คืนค่า **dataURL เต็ม ๆ** (เช่น "data:image/jpeg;base64,....")
function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result || ''));
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}

/** ---------- Typed API ---------- */

/** Jobs: ดึง “งานของฉัน” (GET) */
export async function fetchMyJobs({ date, range = 0, uid, name, phone, team, includeUnassigned = true }) {
  const qs = {
    date,
    range: String(range),
    includeUnassigned: includeUnassigned ? '1' : '0',
    ...(uid ? { uid } : {}),
    ...(name ? { name } : {}),
    ...(phone ? { phone } : {}),
    ...(team ? { team } : {})
  };
  const data = await tryAcrossBasesAndRoutes({
    method: 'GET',
    bases: resolveExecBases(),
    routes: ['listmyjobs', 'my-jobs', 'jobs.list', 'myJobs', 'listJobs'],
    qs
  });
  if (data?.ok === false) throw new Error(data.error || 'GAS error');
  return data;
}

export const teamsList   = () => tryAcrossBasesAndRoutes({ method: 'GET',  bases: resolveExecBases(), routes: ['teams.list'], qs: {} });
export const staffUpsert = (payload) => tryAcrossBasesAndRoutes({ method: 'POST', bases: resolveExecBases(), routes: ['staff.upsert'], body: payload });

/** Report lifecycle */
export async function createServiceReport(payload) {
  const data = await tryAcrossBasesAndRoutes({
    method: 'POST',
    bases: resolveExecBases(),
    routes: ['report/create', 'createServiceReport', 'service.create', 'create_report', 'createReport'],
    body: payload
  });
  if (data?.ok === false) throw new Error(data.error || 'create report failed');
  return data;
}

export async function appendChemicals(serviceId, items) {
  const data = await tryAcrossBasesAndRoutes({
    method: 'POST',
    bases: resolveExecBases(),
    routes: ['append-items', 'chem.append', 'appendChemicals', 'append_chems', 'appendChemicalsV1', 'chemicals/append'],
    body: { service_id: serviceId, items }
  });
  if (data?.ok === false) throw new Error(data.error || 'append chemicals failed');
  return data;
}

/** อัปโหลดรูป (array ของ {file, zone, caption, takenAt}) → คืน [{zone, url, fileId, caption}] */
export async function uploadImages(filesWithZone = []) {
  const out = [];
  for (const it of filesWithZone) {
    const dataUrl = await fileToDataURL(it.file); // ต้องส่ง dataURL เต็ม ๆ ให้ GAS
    const data = await tryAcrossBasesAndRoutes({
      method: 'POST',
      bases: resolveExecBases(),
      routes: ['upload', 'file.upload', 'uploadFile', 'upload_image'],
      body: {
        zone: it.zone || '',
        caption: it.caption || '',
        base64: dataUrl,
        name: it.file?.name || 'image.jpg',
        taken_at: it.takenAt || new Date().toISOString()
      }
    });
    if (data?.ok === false) throw new Error(data.error || 'upload failed');
    out.push({ zone: it.zone || '', caption: it.caption || '', fileId: data.fileId, url: data.url });
  }
  return out;
}

/** อัปโหลดรูปจาก dataURL โดยตรง */
export async function uploadPhotoBase64({ service_id, zone = '', caption = '', dataUrl, taken_at }) {
  const data = await tryAcrossBasesAndRoutes({
    method: 'POST',
    bases: resolveExecBases(),
    routes: ['upload-photo', 'photo.upload', 'uploadPhoto', 'upload_photo'],
    body: { service_id, base64: String(dataUrl || ''), zone, caption, taken_at: taken_at || new Date().toISOString() }
  });
  if (data?.ok === false) throw new Error(data.error || 'upload photo failed');
  return data;
}

/** บันทึกลายเซ็น (dataURL PNG/JPG เต็ม ๆ) */
export async function saveSignature({ service_id, signature_base64 }) {
  const data = await tryAcrossBasesAndRoutes({
    method: 'POST',
    bases: resolveExecBases(),
    routes: ['sign', 'saveSignature', 'signature.save', 'save_signature'],
    body: { service_id, signature_base64 }
  });
  if (data?.ok === false) throw new Error(data.error || 'save signature failed');
  return data;
}

/** ปิดงาน */
export async function finishService({ service_id, notes = '' }) {
  const data = await tryAcrossBasesAndRoutes({
    method: 'POST',
    bases: resolveExecBases(),
    routes: ['finish-service', 'service.finish', 'finishService'],
    body: { service_id, notes }
  });
  if (data?.ok === false) throw new Error(data.error || 'finish service failed');
  return data;
}

/** อ่านรายงานเพื่อแสดงผลหน้า /report/[serviceId] */
export const fetchReportById = (service_id) =>
  tryAcrossBasesAndRoutes({
    method: 'GET',
    bases: resolveExecBases(),
    routes: ['report-by-id', 'reportById', 'report'],
    qs: { service_id }
  });

/** ดึงไฟล์เป็น dataURL จาก Drive id/url */
export const fetchFile64 = (idOrSrc) =>
  tryAcrossBasesAndRoutes({
    method: 'GET',
    bases: resolveExecBases(),
    routes: ['file64'],
    qs: { id: idOrSrc }
  });

/** ping */
export const ping = () =>
  tryAcrossBasesAndRoutes({ method: 'GET', bases: resolveExecBases(), routes: ['ping'], qs: {} });
