/**
 * Shared store for .strings.bin files.
 * Uses an in-memory store as primary (survives localStorage quota failures).
 * Also persists to localStorage when possible.
 * Shape: { [filename]: { entries: [{key, value}], magic1: number, magic2: number } }
 */

import { getFile, setFile } from '@/lib/bigFileStore';

const STORE_KEY = 'm2tw_strings_bin_files';

// In-memory store — always available regardless of localStorage limits
let _memoryStore = null;

function getMemoryStore() {
  if (_memoryStore === null) {
    // Try to hydrate from localStorage on first access
    try {
      const raw = getFile(STORE_KEY);
      _memoryStore = raw ? JSON.parse(raw) : {};
    } catch {
      _memoryStore = {};
    }
  }
  return _memoryStore;
}

export function getStringsBinStore() {
  return getMemoryStore();
}

export function setStringsBinStore(store) {
  _memoryStore = store;
  setFile(STORE_KEY, JSON.stringify(store));
}

export function updateStringsBinFile(name, fileData) {
  const store = getMemoryStore();
  store[name] = fileData;
  setStringsBinStore(store);
  window.dispatchEvent(new CustomEvent('strings-bin-updated', { detail: { name } }));
}

export function clearStringsBinStore() {
  _memoryStore = {};
  setFile(STORE_KEY, JSON.stringify({}));
}