import { getFile, setFile } from '@/lib/bigFileStore';
import { getStringsBinStore, updateStringsBinFile } from '@/lib/stringsBinStore';
import { normalizedFileName, STRINGS_STORE_KEY } from '@/lib/modFileRegistry';
import { subscribeSharedModFiles } from '@/lib/sharedModFiles';

const baseName = name => normalizedFileName(name).replace(/(?:\.strings)?\.bin$/i, '');
export const getSharedDictionaryFile = name => Object.entries(getStringsBinStore()).find(([key]) => baseName(key) === baseName(name));

/** All dictionary editors share the same entries and preserve binary metadata. */
export function createSharedDictionaryBinding(name, legacyKey, parseText, serializeText, empty = {}) {
  let signature, value;
  const listeners = new Set();
  const sources = () => [JSON.stringify(getSharedDictionaryFile(name) || null), getFile(legacyKey)];
  const read = () => {
    const next = sources();
    if (!signature || next.some((source, index) => source !== signature[index])) {
      const file = JSON.parse(next[0])?.[1];
      value = file ? Object.fromEntries(file.entries.map(entry => [entry.key, entry.value])) : next[1] === null ? empty : parseText(next[1]);
      signature = next;
    }
    return value;
  };
  return {
    read,
    subscribe(listener) {
      listeners.add(listener);
      const stop = subscribeSharedModFiles([legacyKey, STRINGS_STORE_KEY], listener);
      return () => { listeners.delete(listener); stop(); };
    },
    update(change) {
      const current = read(), next = typeof change === 'function' ? change(current) : change;
      if (next === current) return current;
      const stored = getSharedDictionaryFile(name), meta = stored?.[1];
      if (meta?.readOnly || meta?.magic1 === 1) throw new Error('This dictionary is not an editable keyed strings file.');
      const entries = Object.entries(next || {}).map(([key, text]) => ({ key, value: String(text ?? '') }));
      setFile(legacyKey, serializeText(next || {}));
      updateStringsBinFile(stored?.[0] || name, { ...meta, entries, magic1: meta?.magic1 ?? 2, magic2: meta?.magic2 ?? 2048 });
      signature = sources(); value = next;
      listeners.forEach(listener => listener());
      return next;
    },
  };
}