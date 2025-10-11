// lib/sync.js
import { peekQueue, removeFromQueue } from './db';
import { getAuth } from './auth';

const ENDPOINT = '/api/mock-upload';

export async function syncQueue() {
  const q = await peekQueue();
  const { staffId, token } = getAuth();

  for (const item of q) {
    try {
      const fd = new FormData();
      for (const [k, v] of Object.entries(item.payload.fields)) fd.append(k, v);
      if (staffId) fd.append('staffId', staffId);
      for (const f of item.payload.photos || []) fd.append('photos', f, f.name);
      if (item.payload.signature) fd.append('signature', item.payload.signature);

      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd
      });
      if (!res.ok) throw new Error('upload failed ' + res.status);
      await removeFromQueue(item.id);
    } catch (e) {
      console.warn('Sync failed; keep in queue', e);
      break;
    }
  }
}
