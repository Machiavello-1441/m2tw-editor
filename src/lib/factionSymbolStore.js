/**
 * Window-scoped store for faction symbol TGA files (uploaded or generated).
 * Keyed by zip path (e.g. "data/menu/symbols/fe_buttons_24/symbol24_milan.tga").
 * Kept in memory (too large for localStorage) until a bulk download.
 */
const store = () => (window.__m2twFactionSymbols = window.__m2twFactionSymbols || {});

export function setSymbol(path, dataUrl, buffer) {
  store()[path] = { dataUrl, buffer };
}

export function getSymbol(path) {
  return store()[path] || null;
}

export function getAllSymbols() {
  return store();
}