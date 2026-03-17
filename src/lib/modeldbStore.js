/**
 * In-memory store for the parsed battle_models.modeldb.
 * Uses a custom event to notify components when the data changes.
 */
let _data = null;

export const modeldbStore = {
  get: () => _data,
  set: (data) => {
    _data = data;
    window.dispatchEvent(new CustomEvent('modeldb-loaded', { detail: data }));
  },
  update: (updatedParsed) => {
    _data = updatedParsed;
    // Don't broadcast a full reload — consumers watch via modeldb state directly
  },
  clear: () => {
    _data = null;
    window.dispatchEvent(new CustomEvent('modeldb-loaded', { detail: null }));
  },
};