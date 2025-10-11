// lib/api.js

/** ---------- Base URLs ---------- */
function resolveExecBases() {
  const bases = [
    process.env.NEXT_PUBLIC_GAS_EXEC_PRIMARY,
    process.env.NEXT_PUBLIC_GAS_EXEC,          // main
    process.env.NEXT_PUBLIC_GAS_EXEC_BACKUP,   // backup
    process.env.GAS_EXEC,
    process.env.NEXT_PUBLIC_API_BASE,          // ต้องเป็น .../exec แล้วเท่านั้น
  ]
    .filter(Boolean)
    .map((s) => String(s).replace(/\/+$/, '')); // ตัด / ท้าย

  if (bases.length === 0) throw new Error('GAS exec URL is empty');
  return [...new Set(bases)]; // unique
}

/** ---------- Fetch helpers ---------- */
function withTimeout(promise, ms = 20000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
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

/** ลองยิงทุก base × ทุก route จนสำเร็จ */
async function tryAcrossBasesAndRoutes({ method, bases, routes, body, qs }) {
  const errors = [];
  for (const base of bases) {
    for (const route of routes) {
      try {
        const url =
          method === 'GET'
            ? `${base}?route=${encodeURIComponent(route)}${
                qs ? `&${new URLSearchParams(qs).toString()}` : ''
              }`
            : `${base}?route=${encodeURIComponent(route)}`;

        const init =
          method === 'GET'
            ? { method: 'GET', redirect: 'follow' }
            : {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain; charset=utf-8' }, // GAS friendly
                body: JSON.stringify(body || {}),
                redirect: 'follow',
              };

        const res = await withTimeout(fetch(url, init));
        const { json, raw } = await parseMaybeJSON(res);

        // สำเร็จเมื่อได้ JSON และไม่ได้บอกว่า unknown route / หรือ res.ok && ไม่มีข้อความ unknown
        const unknown =
          !res.ok ||
          (json && json.ok === false && /unknown route/i.test(json.error || '')) ||
          (!json && /unknown route/i.test(String(raw || '')));

        if (!unknown) {
          // ถ้า JSON ไม่มี ok ให้ถือว่าโอเค (หลาย GAS ไม่ใส่ ok)
          return json ?? { ok: true, raw };
        }

        errors.push({ base, route, status: res.status, error: json?.error || raw?.slice(0, 120) });
      } catch (e) {
        errors.push({ base, route, status: 'ERR', error: String(e) });
      }
    }
  }
  const msg = errors.map((e) => `${e.route}@${e.base} [${e.status}:${e.error}]`).join(', ');
  throw new Error(`unknown route: ${msg}`);
}

/** ---------- Public API ---------- */

/**
 * ดึง "งานของฉัน"
 * GET กับหลายชื่อ route เพื่อรองรับ GAS หลายเวอร์ชัน
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
  const bases = resolveExecBases();
  const routes = ['listmyjobs', 'my-jobs', 'jobs.list', 'myJobs', 'listJobs'];

  const qs = {
    date,
    range: String(range),
    includeUnassigned: includeUnassigned ? '1' : '0',
    ...(uid ? { uid } : {}),
    ...(name ? { name } : {}),
    ...(phone ? { phone } : {}),
    ...(team ? { team } : {}),
  };

  const data = await tryAcrossBasesAndRoutes({
    method: 'GET',
    bases,
    routes,
    qs,
  });

  if (data?.ok === false) throw new Error(data.error || 'GAS error');
  return data;
}

/**
 * อัปโหลดรูปภาพเป็นไฟล์ Drive ผ่าน GAS (POST)
 * ส่งเป็น text/plain + JSON (Apps Script อ่านง่าย)
 */
export async function uploadImages(filesWithZone = []) {
  const out = [];
  for (const it of filesWithZone) {
    const b64 = await fileToBase64(it.file);
    const data = await tryAcrossBasesAndRoutes({
      method: 'POST',
      bases: resolveExecBases(),
      routes: ['upload', 'file.upload', 'uploadFile', 'upload_image'],
      body: {
        zone: it.zone || '',
        caption: it.caption || '',
        base64: b64,
        name: it.file?.name || 'image.jpg',
      },
    });
    if (data?.ok === false) throw new Error(data.error || 'upload failed');
    out.push({
      zone: it.zone || '',
      caption: it.caption || '',
      fileId: data.fileId,
      url: data.url,
    });
  }
  return out;
}

/** สร้างรายงาน Service (POST) – รองรับหลายชื่อ route */
export async function createServiceReport(payload) {
  const data = await tryAcrossBasesAndRoutes({
    method: 'POST',
    bases: resolveExecBases(),
    routes: ['report/create', 'createServiceReport', 'service.create', 'create_report', 'createReport'],
    body: payload,
  });
  if (data?.ok === false) throw new Error(data.error || 'create report failed');
  return data;
}

/** เติมรายการเคมีลงรายงาน (POST) – รองรับหลายชื่อ route */
export async function appendChemicals(serviceId, items) {
  const data = await tryAcrossBasesAndRoutes({
    method: 'POST',
    bases: resolveExecBases(),
    routes: ['append-items', 'chem.append', 'appendChemicals', 'append_chems', 'appendChemicalsV1', 'chemicals/append'],
    body: { service_id: serviceId, items },
  });
  if (data?.ok === false) throw new Error(data.error || 'append chemicals failed');
  return data;
}

/** ---------- Utils ---------- */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result).split(',')[1]);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}
