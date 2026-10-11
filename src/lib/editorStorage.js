/** Explicit compatibility adapters for legacy editor modules. No global patching. */
import { getFile, setFile, removeFile } from './bigFileStore';
import { canonicalFileKey } from './modFileRegistry';

export const editorStorage = { getItem: getFile, setItem: setFile, removeItem: removeFile };
const sharedSessionKeys = new Set([
  'm2tw_names_raw', 'm2tw_regions_raw', 'm2tw_music_types_raw', 'm2tw_names_bin_meta',
  'm2tw_char_names_display', 'm2tw_campaign_desc_strings', 'm2tw_campaign_description',
]);
const shared = key => canonicalFileKey(key) !== key || sharedSessionKeys.has(key);
const memory = () => (window.__m2twEditorSession ||= {});
export const editorSessionStorage = {
  getItem(key) {
    if (shared(key)) {
      const value = getFile(key);
      if (value !== null) return value;
      // Restore an old session-only file the first time its editor opens.
      try { const old = window.sessionStorage.getItem(key); if (old !== null) { setFile(key, old); return old; } } catch { /* Disabled session storage. */ }
      return null;
    }
    if (memory()[key] !== undefined) return memory()[key];
    try { return window.sessionStorage.getItem(key); } catch { return null; }
  },
  setItem(key, value) {
    if (shared(key)) return setFile(key, String(value));
    memory()[key] = String(value);
    try { window.sessionStorage.setItem(key, value); } catch { /* Transient data remains readable in this tab. */ }
  },
  removeItem(key) {
    if (shared(key)) removeFile(key);
    memory()[key] = null;
    try { window.sessionStorage.removeItem(key); } catch { /* Native storage may be disabled. */ }
  },
};
