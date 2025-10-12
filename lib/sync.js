// lib/sync.js
import { peekQueue, removeFromQueue } from './db'; 
import { getAuth, bearerHeader } from './auth';
import {
  createServiceReport,
  appendChemicals,
  uploadPhotoBase64,
  saveSignature,
  finishService
} from './api';

// ปล่อยให้ปรับผ่าน env ได้; ถ้าไม่ตั้งไว้จะไม่ใช้ mock API
const ENDPOINT = process.env.NEXT_PUBLIC_SYNC_ENDPOINT || '/api/mock-upload';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function isOnline() { return typeof navigator === 'undefined' ? true : navigator.onLine !== false; }
function dataURLToBlob(dataURL) {
  const [header, b64] = String(dataURL).split(',');
  const mime = /data:(.*?);base64/.exec(header)?.[1] || 'application/octet-stream';
  const bin = atob(b64 || '');
  const len = bin.length;
  const u8 = new Uint8Array(len);
  for (let i = 0; i < len; i++) u8[i] = bin.charCodeAt(i);
  return new Blob([u8], { type: mime });
}

/** ตัดสินใจจาก payload ว่าควรวิ่งโหมดไหน */
function isGasReportPayload(p) {
  // โหมด GAS ถ้ามี payload.report และมี header อย่างน้อย contractNo|customerName|staff ฯลฯ
  return p && p.report && (p.report.header || p.report.photos || p.report.chemicals || p.report.signatureDataUrl);
}

/** ---- Mock/API mode ---- */
async function syncViaEndpoint(item, auth) {
  const { payload } = item;
  const fd = new FormData();

  // fields
  if (payload?.fields && typeof payload.fields === 'object') {
    for (const [k, v] of Object.entries(payload.fields)) {
      fd.append(k, v ?? '');
    }
  }
  // staff
  if (auth?.staffId) fd.append('staffId', auth.staffId);

  // photos: รองรับ File/Blob/dataURL
  for (const f of payload?.photos || []) {
    if (f instanceof File || f instanceof Blob) {
      fd.append('photos', f, (f.name || 'photo.jpg'));
    } else if (typeof f === 'string' && f.startsWith('data:')) {
      const blob = dataURLToBlob(f);
      fd.append('photos', blob, 'photo.jpg');
    }
  }

  // signature: รองรับ File/Blob/dataURL
  if (payload?.signature) {
    const s = payload.signature;
    if (s instanceof File || s instanceof Blob) {
      fd.append('signature', s, (s.name || 'sign.png'));
    } else if (typeof s === 'string' && s.startsWith('data:')) {
      fd.append('signature', dataURLToBlob(s), 'sign.png');
    }
  }

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { ...bearerHeader() }, // แนบ Bearer ถ้ามี
    body: fd,
    redirect: 'follow'
  });
  if (!res.ok) throw new Error(`upload failed ${res.status}`);
}

/** ---- GAS mode (ชุดรายงานเต็มขั้น) ----
 * payload.report = {
 *   header: { contractNo?, roundNo?, staff?, notes?, ... },
 *   chemicals: [{ zone, name, qty, link, remark }],
 *   photos: [{ dataUrl, zone, caption, takenAt }],
 *   signatureDataUrl: 'data:image/png;base64,...'
 * }
 */
async function syncViaGAS(item) {
  const { report } = item.payload;
  if (!report) throw new Error('missing report payload');

  // 1) create
  let serviceId = report.serviceId || '';
  if (!serviceId) {
    const createRes = await createServiceReport({
      ...(report.header || {})
      // รองรับ contractNo/roundNo/staff/notes ฯลฯ ตาม GAS ที่คุณทำไว้
    });
    serviceId = createRes.service_id;
    if (!serviceId) throw new Error('no service_id from createServiceReport');
  }

  // 2) append chemicals
  if (Array.isArray(report.chemicals) && report.chemicals.length) {
    await appendChemicals(serviceId, report.chemicals);
  }

  // 3) upload photos (dataUrl)
  for (const p of (report.photos || [])) {
    const dataUrl = p?.dataUrl || p?.base64 || '';
    if (!dataUrl) continue;
    await uploadPhotoBase64({
      service_id: serviceId,
      zone: p.zone || '',
      caption: p.caption || '',
      dataUrl,
      taken_at: p.takenAt || new Date().toISOString()
    });
  }

  // 4) signature
  if (report.signatureDataUrl) {
    await saveSignature({
      service_id: serviceId,
      signature_base64: report.signatureDataUrl
    });
  }

  // 5) finish
  await finishService({
    service_id: serviceId,
    notes: report.header?.notes || ''
  });
}

/** ---- ตัวหลัก: syncQueue ----
 * - retry ต่อรายการ (default 3 ครั้ง) ด้วย backoff 1s,2s,4s
 * - หยุดเมื่อเจอรายการที่พัง (เก็บไว้ก่อน)
 */
export async function syncQueue({ maxRetries = 3 } = {}) {
  if (!isOnline()) return; // ออฟไลน์ก็ยังไม่ซิงก์

  const q = await peekQueue();
  if (!q.length) return;

  const auth = getAuth(); // { staffId, token, ... }

  for (const item of q) {
    let attempt = 0;
    while (true) {
      try {
        if (isGasReportPayload(item.payload)) {
          await syncViaGAS(item);
        } else if (ENDPOINT) {
          await syncViaEndpoint(item, auth);
        } else {
          throw new Error('no sync target');
        }

        // สำเร็จ → ลบออกจากคิวแล้วข้ามไปตัวถัดไป
        await removeFromQueue(item.id);
        break;
      } catch (err) {
        attempt += 1;
        console.warn(`Sync item ${item.id} failed (attempt ${attempt}/${maxRetries}):`, err);
        if (attempt >= maxRetries) {
          // หมดสิทธิ์: คงไว้ในคิว และหยุดซิงก์ที่ item นี้
          return;
        }
        // backoff 2^(attempt-1) วินาที: 1s, 2s, 4s, ...
        const wait = Math.pow(2, attempt - 1) * 1000;
        await sleep(wait);
      }
    }
  }
}
