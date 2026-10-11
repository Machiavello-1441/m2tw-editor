/**
 * Get/set large text values. Memory is the read source; every write is also
 * persisted to IndexedDB (no practical size limit) and, when it fits, to
 * localStorage for legacy readers. hydrateBigFiles() restores IndexedDB into
 * memory before the app renders, so files loaded on Home survive reloads.
 */
import { canonicalFileKey } from '@/lib/modFileRegistry';

const mem = () => (window.__m2twBigFileStore = window.__m2twBigFileStore || {});
const DB_NAME = 'm2tw_big_files';
const STORE = 'files';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
const dbPromise = typeof indexedDB !== 'undefined' ? openDb().catch(() => null) : Promise.resolve(null);

async function persist(key, value) {
  const db = await dbPromise;
  if (!db) return;
  const tx = db.transaction(STORE, 'readwrite');
  if (value == null) tx.objectStore(STORE).delete(key);
  else tx.objectStore(STORE).put(value, key);
}

export async function hydrateBigFiles() {
  const db = await dbPromise;
  if (!db) return;
  await new Promise((resolve) => {
    const req = db.transaction(STORE).objectStore(STORE).openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) return resolve();
      if (mem()[cursor.key] === undefined) mem()[cursor.key] = cursor.value;
      cursor.continue();
    };
    req.onerror = () => resolve();
  });
}

export function setFile(key, value) {
  key = canonicalFileKey(key);
  mem()[key] = value;
  persist(key, value);
  try {
    localStorage.setItem(key, value);
  } catch {
    // Quota exceeded — drop any stale persisted copy so reads never return old data
    try { localStorage.removeItem(key); } catch {}
  }
}

export function getFile(key) {
  key = canonicalFileKey(key);
  const m = mem();
  if (m[key] !== undefined) return m[key];
  try { return localStorage.getItem(key); } catch { return null; }
}