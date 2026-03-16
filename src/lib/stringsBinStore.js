/**
 * Shared store for .strings.bin files.
 * All editors read/write through here so changes are immediately visible everywhere.
 * Storage: localStorage key 'm2tw_strings_bin_files'
 * Shape: { [filename]: { entries: [{key, value}], magic1: number, magic2: number } }
 */

const STORE_KEY = 'm2tw_strings_bin_files';

export function getStringsBinStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function setStringsBinStore(store) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch (e) {
    console.warn('[StringsBinStore] localStorage write failed:', e);
  }
}

export function updateStringsBinFile(name, fileData) {
  const store = getStringsBinStore();
  store[name] = fileData;
  setStringsBinStore(store);
  window.dispatchEvent(new CustomEvent('strings-bin-updated', { detail: { name } }));
}

export function clearStringsBinStore() {
  try { localStorage.removeItem(STORE_KEY); } catch {}
}