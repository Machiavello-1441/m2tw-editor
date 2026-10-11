/**
 * Shared store for .strings.bin files.
 * Uses an in-memory store as primary (survives localStorage quota failures).
 * Also persists to localStorage when possible.
 * Shape: { [filename]: { entries: [{key, value}], magic1: number, magic2: number } }
 */

import { getFile, setFile } from '@/lib/bigFileStore';
import { normalizedFileName } from '@/lib/modFileRegistry';

const STORE_KEY = 'm2tw_strings_bin_files';

// In-memory store — always available regardless of localStorage limits
let _memoryStore = null;
let _cachedRaw;

function getMemoryStore() {
  const raw = getFile(STORE_KEY);
  // Faction descriptions and the Strings editor edit the same underlying data.
  if (_memoryStore === null || raw !== _cachedRaw) {
    _cachedRaw = raw;
    try { _memoryStore = raw ? JSON.parse(raw) : {}; }
    catch { _memoryStore = {}; }
  }
  return _memoryStore;
}

export function getStringsBinStore() {
  return getMemoryStore();
}

export function setStringsBinStore(store) {
  _memoryStore = Object.fromEntries(Object.entries(store).map(([name, data]) => [normalizedFileName(name), data]));
  _cachedRaw = JSON.stringify(_memoryStore);
  setFile(STORE_KEY, _cachedRaw);
}

export function updateStringsBinFile(name, fileData) {
  const store = getMemoryStore();
  store[normalizedFileName(name)] = fileData;
  setStringsBinStore(store);
  window.dispatchEvent(new CustomEvent('strings-bin-updated', { detail: { name } }));
}

export function clearStringsBinStore() {
  setStringsBinStore({});
}