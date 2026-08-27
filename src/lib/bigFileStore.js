/**
 * Get/set large text values with localStorage persistence and a window-scoped
 * in-memory fallback for values that exceed the localStorage quota
 * (e.g. descr_banners_new.xml, expanded.txt.strings.bin JSON).
 * Memory always wins on read since it holds the most recent write.
 */
const mem = () => (window.__m2twBigFileStore = window.__m2twBigFileStore || {});

export function setFile(key, value) {
  mem()[key] = value;
  try {
    localStorage.setItem(key, value);
  } catch {
    // Quota exceeded — drop any stale persisted copy so reads never return old data
    try { localStorage.removeItem(key); } catch {}
  }
}

export function getFile(key) {
  const m = mem();
  if (m[key] !== undefined) return m[key];
  try { return localStorage.getItem(key); } catch { return null; }
}