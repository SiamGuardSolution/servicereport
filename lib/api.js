// lib/api.js

/* =========================
   BASE RESOLUTION
========================= */
export function resolveExecBases() {
  const bases = [
    process.env.NEXT_PUBLIC_GAS_EXEC_PRIMARY,
    process.env.NEXT_PUBLIC_GAS_EXEC,          // main
    process.env.NEXT_PUBLIC_GAS_EXEC_BACKUP,   // backup
    process.env.GAS_EXEC,                      // SSR
    process.env.NEXT_PUBLIC_API_BASE           // ต้องเป็น .../exec
  ]
    .filter(Boolean)
    .map(s => String(s).replace(/\/+$/, ''));

  if (bases.length === 0) {
    throw new Error(
      'GAS exec URL is empty (set one of: NEXT_PUBLIC_GAS_EXEC_PRIMARY / NEXT_PUBLIC_GAS_EXEC / NEXT_PUBLIC_GAS_EXEC_BACKUP / GAS_EXEC / NEXT_PUBLIC_API_BASE)'
    );
  }
  // unique
  return [...new Set(bases)];
}

/* =========================
   HELPERS
========================= */
function withTimeout(promise, ms = 20000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      v => { clearTimeout(t); resolve(v); },
      e => { clearTimeout(t); reject(e); }
    );
  });
}

async function parseMaybeJSON(res) {
  const text = await res.text();
  try { return { json: JSON.parse(text), raw: text, status: res.status }; }
  catch { return { json: null, raw: text, status: res.status }; }
}

// --- lib/api.js (แทนที่ฟังก์ชัน tryAcrossBases เดิมทั้งก้อน) ---
async function tryAcrossBases({ method, bases, keys, body, qs }) {
  const errors = [];
  const isGET = String(method).toUpperCase() === 'GET';

  // เดิม GET ใช้แค่ 'route' -> ให้ลองทั้งสองอย่างเลย
  const paramVariants = isGET ? ['route', 'path'] : ['path', 'route'];

  const makeQuery = (obj = {}) =>
    Object.entries(obj)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');

  for (const baseRaw of bases) {
    const base = String(baseRaw).replace(/\/+$/, '');
    for (const key of keys) {
      for (const paramKey of paramVariants) {
        try {
          const qUser = isGET ? makeQuery(qs) : '';
          const url = isGET
            ? `${base}?${paramKey}=${encodeURIComponent(key)}${qUser ? `&${qUser}` : ''}`
            : `${base}?${paramKey}=${encodeURIComponent(key)}`;

          // GET: ไม่มี headers, เพิ่ม mode/credentials/cache เท่านั้น
          const init = isGET
            ? { method: 'GET', mode: 'cors', credentials: 'omit', cache: 'no-store' }
            : { method: 'POST', headers: { 'Content-Type': 'text/plain; charset=utf-8' }, body: JSON.stringify(body || {}) };

          const res = await withTimeout(fetch(url, init));
          const { json, raw } = await parseMaybeJSON(res);

          const unknown =
            !res.ok ||
            (json && json.ok === false && /unknown (route|path)|not found/i.test(json.error || '')) ||
            (!json && /unknown (route|path)|not found/i.test(String(raw || '')));

          if (!unknown) {
            const out = json ?? { ok: true, raw };
            return Object.assign(out, { __used: { base, key, paramKey, method: isGET ? 'GET' : 'POST' } });
          }
          errors.push({ base, key, paramKey, status: res.status, error: json?.error || String(raw || '').slice(0, 160) });
        } catch (e) {
          errors.push({ base, key, paramKey, status: 'ERR', error: String(e) });
        }
      }
    }
  }
  const msg = errors.map(e => `${e.key}@${e.base}?${e.paramKey}= [${e.status}:${e.error}]`).join(', ');
  throw new Error(`unknown route/path: ${msg}`);
}

// คืนค่า **dataURL เต็ม ๆ** (เช่น "data:image/jpeg;base64,....")
function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result || ''));
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}

/* =========================
   READ (GET via ?route=)
========================= */
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
  const data = await tryAcrossBases({
    method: 'GET',
    bases: resolveExecBases(),
    keys: ['listmyjobs', 'my-jobs', 'jobs.list', 'myJobs', 'listJobs'],
    qs
  });
  if (data?.ok === false) throw new Error(data.error || 'GAS error');
  return data;
}

export const teamsList = () =>
  tryAcrossBases({ method: 'GET', bases: resolveExecBases(), keys: ['teams.list'], qs: {} });

export const fetchReportById = (service_id) =>
  tryAcrossBases({ method: 'GET', bases: resolveExecBases(), keys: ['report-by-id', 'reportById', 'report'], qs: { service_id } });

export const fetchFile64 = (idOrSrc) =>
  tryAcrossBases({ method: 'GET', bases: resolveExecBases(), keys: ['file64'], qs: { id: idOrSrc } });

export const ping = () =>
  tryAcrossBases({ method: 'GET', bases: resolveExecBases(), keys: ['ping'], qs: {} });

/* =========================
   WRITE (POST via ?path=)
========================= */
export const staffUpsert = (payload) =>
  tryAcrossBases({ method: 'POST', bases: resolveExecBases(), keys: ['staff.upsert'], body: payload });

export async function createServiceReport(payload) {
  const data = await tryAcrossBases({
    method: 'POST',
    bases: resolveExecBases(),
    // โฟกัส path ที่ GAS รองรับจริง (เวอร์ชันใหม่ใช้ 'submit')
    keys: ['submit', 'report/create', 'service.create', 'createServiceReport', 'create_report', 'createReport'],
    body: payload
  });
  if (data?.ok === false) throw new Error(data.error || 'create report failed');
  return data;
}

export async function appendChemicals(service_id, items) {
  const data = await tryAcrossBases({
    method: 'POST',
    bases: resolveExecBases(),
    // เวอร์ชันใหม่: 'append-chemicals'
    keys: ['append-chemicals', 'append-items', 'chem.append', 'appendChemicals', 'append_chems', 'appendChemicalsV1', 'chemicals/append'],
    body: { service_id, items }
  });
  if (data?.ok === false) throw new Error(data.error || 'append chemicals failed');
  return data;
}

export async function uploadImages(filesWithZone = []) {
  const out = [];
  for (const it of filesWithZone) {
    const dataUrl = await fileToDataURL(it.file);
    const data = await tryAcrossBases({
      method: 'POST',
      bases: resolveExecBases(),
      // เวอร์ชันใหม่: 'upload-images'
      keys: ['upload-images', 'upload', 'file.upload', 'uploadFile', 'upload_image'],
      body: {
        zone: it.zone || '',
        caption: it.caption || '',
        base64: dataUrl, // GAS ฝั่งคุณรองรับ dataURL เต็ม ๆ
        name: it.file?.name || 'image.jpg',
        taken_at: it.takenAt || new Date().toISOString()
      }
    });
    if (data?.ok === false) throw new Error(data.error || 'upload failed');
    out.push({ zone: it.zone || '', caption: it.caption || '', fileId: data.fileId, url: data.url });
  }
  return out;
}

export async function uploadPhotoBase64({ service_id, zone = '', caption = '', dataUrl, taken_at }) {
  const data = await tryAcrossBases({
    method: 'POST',
    bases: resolveExecBases(),
    keys: ['upload-photo', 'photo.upload', 'uploadPhoto', 'upload_photo'],
    body: {
      service_id,
      base64: String(dataUrl || ''),
      zone,
      caption,
      taken_at: taken_at || new Date().toISOString()
    }
  });
  if (data?.ok === false) throw new Error(data.error || 'upload photo failed');
  return data;
}

export async function saveSignature({ service_id, signature_base64 }) {
  const data = await tryAcrossBases({
    method: 'POST',
    bases: resolveExecBases(),
    keys: ['sign', 'saveSignature', 'signature.save', 'save_signature'],
    body: { service_id, signature_base64 }
  });
  if (data?.ok === false) throw new Error(data.error || 'save signature failed');
  return data;
}

export async function finishService({ service_id, notes = '' }) {
  const data = await tryAcrossBases({
    method: 'POST',
    bases: resolveExecBases(),
    keys: ['finish-service', 'service.finish', 'finishService'],
    body: { service_id, notes }
  });
  if (data?.ok === false) throw new Error(data.error || 'finish service failed');
  return data;
}
