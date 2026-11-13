import { getFile, setFile, removeFile } from '@/lib/bigFileStore';
import { canonicalFileKey, FILES_CHANGED_EVENT } from '@/lib/modFileRegistry';

export function subscribeSharedModFiles(keys, listener) {
  const watched = new Set(keys.map(canonicalFileKey));
  const changed = event => {
    if (!event.detail?.keys || event.detail.keys.some(key => watched.has(canonicalFileKey(key)))) listener();
  };
  window.addEventListener(FILES_CHANGED_EVENT, changed);
  return () => window.removeEventListener(FILES_CHANGED_EVENT, changed);
}

/** Read-only visits never reserialize files; only actual editor changes write. */
export function createSharedFileBinding(key, parse, serialize, empty = null) {
  let previous = Symbol('unread'), value;
  const listeners = new Set();
  const read = () => {
    const raw = getFile(key);
    if (raw !== previous) { value = raw === null ? empty : parse(raw); previous = raw; }
    return value;
  };
  return {
    read,
    subscribe(listener) {
      listeners.add(listener);
      const stop = subscribeSharedModFiles([key], listener);
      return () => { listeners.delete(listener); stop(); };
    },
    update(change) {
      const current = read(), next = typeof change === 'function' ? change(current) : change;
      if (next === current) return current;
      const raw = next === null ? null : serialize(next);
      previous = raw; value = next;
      if (raw === null) removeFile(key); else setFile(key, raw);
      listeners.forEach(listener => listener());
      return next;
    },
  };
}

export async function seedSharedModFile(file, key) {
  if (getFile(key) !== null) return;
  const raw = await file.text();
  if (getFile(key) === null) setFile(key, raw);
}