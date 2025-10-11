import { get, set, del } from 'idb-keyval';

const KEY = 'queue:visits';

export async function enqueueVisit(payload) {
  const q = (await get(KEY)) || [];
  const item = { id: crypto.randomUUID(), ts: Date.now(), payload };
  q.push(item);
  await set(KEY, q);
  return item.id;
}
export async function peekQueue() { return (await get(KEY)) || []; }
export async function removeFromQueue(id) {
  const q = (await get(KEY)) || [];
  await set(KEY, q.filter(i => i.id !== id));
}
export async function clearQueue() { await del(KEY); }
