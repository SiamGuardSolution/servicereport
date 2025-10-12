// lib/db.js
// คิวงานบันทึกหน้างาน (offline-first)

let idb;
try {
  // idb-keyval ใช้เฉพาะบนเบราว์เซอร์เท่านั้น
  if (typeof window !== 'undefined') {
    // require แบบ lazy กัน SSR แตก
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    idb = require('idb-keyval');
  }
} catch (_) {
  idb = null;
}

const KEY = 'queue:visits';
const MAX_QUEUE = 200;           // กันโตเกินไป
let memStore = [];               // fallback เมื่อ IndexedDB ใช้ไม่ได้

function hasIDB() {
  return !!(idb && typeof indexedDB !== 'undefined');
}

function uuid() {
  // ครอบกรณีไม่มี crypto.randomUUID (บางเบราว์เซอร์เก่า/โหมดจำกัด)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  const rnd = () => Math.random().toString(16).slice(2, 10);
  return `vq_${Date.now().toString(36)}_${rnd()}${rnd()}`;
}

async function loadAll() {
  if (!hasIDB()) return memStore.slice();
  try {
    return (await idb.get(KEY)) || [];
  } catch {
    // ถ้ามีปัญหา permission / quota → ตกกลับเป็น mem
    return memStore.slice();
  }
}

async function saveAll(arr) {
  // ตัดให้ไม่เกิน MAX_QUEUE (เก็บรายการใหม่ ๆ ท้ายคิว)
  const trimmed = Array.isArray(arr) && arr.length > MAX_QUEUE
    ? arr.slice(-MAX_QUEUE)
    : (arr || []);
  memStore = trimmed.slice();
  if (!hasIDB()) return;
  try {
    await idb.set(KEY, trimmed);
  } catch {
    // ถ้าเขียนไม่ได้ก็เก็บใน mem ต่อไป
  }
}

/** เพิ่มรายการเข้าคิว (คืน id) */
export async function enqueueVisit(payload) {
  const q = await loadAll();
  const item = { id: uuid(), ts: Date.now(), payload };
  q.push(item);
  await saveAll(q);
  return item.id;
}

/** อ่านคิวทั้งหมด (ไม่ลบ) */
export async function peekQueue() {
  return await loadAll();
}

/** เอารายการแรกออกจากคิว (FIFO) และคืนรายการนั้น หรือ null ถ้าว่าง */
export async function dequeueNext() {
  const q = await loadAll();
  if (q.length === 0) return null;
  const item = q.shift();
  await saveAll(q);
  return item;
}

/** ลบรายการตาม id */
export async function removeFromQueue(id) {
  const q = await loadAll();
  await saveAll(q.filter(i => i.id !== id));
}

/** ลบคิวทั้งหมด */
export async function clearQueue() {
  memStore = [];
  if (hasIDB()) {
    try { await idb.del(KEY); } catch {}
  }
}

/** ขนาดคิว (ตัวช่วยเล็ก ๆ) */
export async function queueSize() {
  const q = await loadAll();
  return q.length;
}
