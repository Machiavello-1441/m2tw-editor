/**
 * Get/set large text values. Memory is the read source; every write is also
 * persisted to IndexedDB and, when it fits, to
 * localStorage for legacy readers. hydrateBigFiles() restores IndexedDB into
 * memory before the app renders, so files loaded on Home survive reloads.
 */
import { canonicalFileKey, fileKeyAliases, STRING_FILE_KEYS, STRINGS_STORE_KEY, normalizedFileName, FILES_CHANGED_EVENT, FILE_STORAGE_WARNING_EVENT } from '@/lib/modFileRegistry';

const mem = () => (window.__m2twBigFileStore = window.__m2twBigFileStore || {});
const DB_NAME = 'm2tw_big_files';
const STORE = 'files';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('File storage is blocked by another editor tab'));
  });
}
const dbPromise = typeof indexedDB !== 'undefined' ? openDb().catch(() => null) : Promise.resolve(null);

async function persist(key, value) {
  const db = await dbPromise;
  if (!db) throw new Error('Persistent file storage is unavailable');
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = tx.onabort = () => reject(tx.error || new Error('File storage write failed'));
    if (value == null) tx.objectStore(STORE).delete(key);
    else tx.objectStore(STORE).put(value, key);
  });
}

const pendingWrites = new Set();
let storageWarning = '';
export const getFileStorageWarning = () => storageWarning;
function savePersistent(key, value) {
  const promise = persist(key, value).catch(error => {
    storageWarning = `Files are available in this tab, but could not be saved for reload: ${error.message}. Export your changes before closing this tab.`;
    window.dispatchEvent(new CustomEvent(FILE_STORAGE_WARNING_EVENT, { detail: { message: storageWarning } }));
  }).finally(() => pendingWrites.delete(promise));
  pendingWrites.add(promise);
}
export async function flushBigFiles() {
  while (pendingWrites.size) await Promise.all([...pendingWrites]);
  return { warning: storageWarning };
}
const changedKeys = new Set();
let changeQueued = false;
function notifyChange(key) {
  changedKeys.add(key);
  if (key === STRINGS_STORE_KEY) Object.keys(STRING_FILE_KEYS).forEach(k => changedKeys.add(k));
  if (changeQueued) return;
  changeQueued = true;
  queueMicrotask(() => {
    const keys = [...changedKeys]; changedKeys.clear(); changeQueued = false;
    window.dispatchEvent(new CustomEvent(FILES_CHANGED_EVENT, { detail: { keys } }));
  });
}

export async function hydrateBigFiles() {
  const db = await dbPromise;
  if (db) {
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
  // Upgrade previously loaded files, including session-only and large in-memory
  // copies. Never assume that every editor used the same historic key.
  const legacy = {};
  for (const storageName of ['sessionStorage', 'localStorage']) {
    try {
      const storage = window[storageName];
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key?.startsWith('m2tw_')) legacy[key] = storage.getItem(key);
      }
    } catch { /* Storage can be disabled independently of IndexedDB. */ }
  }
  const candidates = { ...legacy, ...mem() };
  for (const [key, value] of Object.entries(candidates)) {
    if (STRING_FILE_KEYS[key]) continue;
    const canonical = canonicalFileKey(key);
    if (mem()[canonical] === undefined && value !== null) {
      mem()[canonical] = candidates[canonical] ?? value;
      savePersistent(canonical, mem()[canonical]);
    }
  }
  const marker = 'm2tw_shared_file_migration_v2';
  if (!getFile(marker)) {
    let strings;
    try { strings = JSON.parse(getFile(STRINGS_STORE_KEY) || '{}'); } catch { strings = {}; }
    for (const [key, name] of Object.entries(STRING_FILE_KEYS)) {
      try {
        const data = JSON.parse(candidates[key] || 'null');
        if (Array.isArray(data?.entries)) strings[name] = data;
      } catch { /* A broken legacy alias must not block other files. */ }
    }
    if (Object.keys(strings).length) setFile(STRINGS_STORE_KEY, JSON.stringify(strings));
    setFile(marker, '1');
  }
  await flushBigFiles();
}

export function setFile(key, value) {
  if (STRING_FILE_KEYS[key]) {
    const data = JSON.parse(value);
    if (!Array.isArray(data?.entries)) throw new Error('Invalid strings file: missing entries array');
    const store = JSON.parse(getFile(STRINGS_STORE_KEY) || '{}');
    for (const name of Object.keys(store)) if (normalizedFileName(name) === STRING_FILE_KEYS[key]) delete store[name];
    store[STRING_FILE_KEYS[key]] = data;
    return setFile(STRINGS_STORE_KEY, JSON.stringify(store));
  }
  key = canonicalFileKey(key);
  if (mem()[key] === value) return;
  mem()[key] = value;
  savePersistent(key, value);
  notifyChange(key);
  try {
    // Large files belong in IndexedDB; avoid filling localStorage with copies.
    if (String(value).length <= 131072) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    // Quota exceeded — drop any stale persisted copy so reads never return old data
    try { localStorage.removeItem(key); } catch {}
  }
}

export function getFile(key) {
  if (STRING_FILE_KEYS[key]) {
    const raw = getFile(STRINGS_STORE_KEY);
    if (raw != null) {
      const store = JSON.parse(raw || '{}');
      const name = Object.keys(store).find(n => normalizedFileName(n) === STRING_FILE_KEYS[key]);
      return name ? JSON.stringify(store[name]) : null;
    }
  }
  key = canonicalFileKey(key);
  const m = mem();
  if (m[key] !== undefined) return m[key];
  for (const alias of fileKeyAliases(key)) {
    if (m[alias] !== undefined) return m[alias];
    for (const name of ['localStorage', 'sessionStorage']) {
      try { const value = window[name].getItem(alias); if (value !== null) return value; } catch { /* Try another legacy source. */ }
    }
  }
  return null;
}

export function removeFile(key) {
  if (STRING_FILE_KEYS[key]) {
    const store = JSON.parse(getFile(STRINGS_STORE_KEY) || '{}');
    for (const name of Object.keys(store)) if (normalizedFileName(name) === STRING_FILE_KEYS[key]) delete store[name];
    setFile(STRINGS_STORE_KEY, JSON.stringify(store));
    return;
  }
  key = canonicalFileKey(key);
  mem()[key] = null;
  for (const alias of fileKeyAliases(key)) {
    if (alias !== key) delete mem()[alias];
    for (const name of ['localStorage', 'sessionStorage']) {
      try { window[name].removeItem(alias); } catch { /* Native storage may be disabled. */ }
    }
  }
  for (const alias of fileKeyAliases(key)) savePersistent(alias, null);
  notifyChange(key);
}

/** Used only by the explicit Clear Memory / Clear Cache actions. */
export async function clearBigFiles() {
  await flushBigFiles();
  const db = await dbPromise;
  if (db) await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = tx.onabort = () => reject(tx.error || new Error('Could not clear file storage'));
    tx.objectStore(STORE).clear();
  });
  window.__m2twBigFileStore = {};
  window.__m2twEditorSession = {};
  for (const name of ['localStorage', 'sessionStorage']) {
    try {
      const storage = window[name];
      const keys = Array.from({ length: storage.length }, (_, i) => storage.key(i));
      for (const key of keys) if (key?.startsWith('m2tw_')) storage.removeItem(key);
    } catch { /* Storage can be disabled. */ }
  }
  storageWarning = '';
  window.dispatchEvent(new CustomEvent(FILES_CHANGED_EVENT));
}