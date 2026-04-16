/**
 * Module-level in-memory store for M2TW map layer pixel data.
 * Survives React component unmount/remount (navigation between pages).
 * Cleared automatically when the browser tab/window is closed.
 */

const _store = {
  layers: {},       // { [layerId]: { data: Uint8ClampedArray, width, height, bitmap } }
  texts: {},        // { [key]: string } — raw text file content
};

// Clear everything when the tab closes (not on page navigation)
window.addEventListener('beforeunload', () => {
  _store.layers = {};
  _store.texts = {};
  // Also clear sessionStorage campaign data
  const SESSION_KEYS = [
    'm2tw_strat_raw', 'm2tw_regions_raw', 'm2tw_regions_data_json',
    'm2tw_names_raw', 'm2tw_factions_raw', 'm2tw_overlay_items_json',
    'm2tw_rebel_factions_raw', 'm2tw_religions_raw', 'm2tw_sm_resources_raw',
    'm2tw_mercenaries_raw', 'm2tw_music_types_raw', 'm2tw_cultures_raw',
    'm2tw_descr_names_raw', 'm2tw_traits_raw', 'm2tw_ancillaries_raw',
    'm2tw_edu_raw', 'm2tw_char_names_display', 'm2tw_script_raw',
    'm2tw_events_raw', 'm2tw_terrain_raw', 'm2tw_win_conditions_raw',
    'm2tw_mercenaries_raw', 'm2tw_music_types_raw',
  ];
  SESSION_KEYS.forEach(k => { try { sessionStorage.removeItem(k); } catch {} });
  // Also clear localStorage campaign keys to avoid ghost data on next session
  const LOCAL_KEYS = [
    'm2tw_campaign_strat', 'm2tw_factions_file', 'm2tw_religions_file',
    'm2tw_rebel_factions_file', 'm2tw_resources_file', 'm2tw_campaign_mercenaries',
    'm2tw_names_file', 'm2tw_traits_file', 'm2tw_anc_file', 'm2tw_units_file',
    'm2tw_campaign_script', 'm2tw_names_bin_entries', 'm2tw_names_bin_meta',
  ];
  LOCAL_KEYS.forEach(k => { try { localStorage.removeItem(k); } catch {} });
});

export function setLayer(layerId, layerData) {
  _store.layers[layerId] = layerData;
}

export function getLayer(layerId) {
  return _store.layers[layerId] || null;
}

export function getAllLayers() {
  return _store.layers;
}

export function clearLayer(layerId) {
  delete _store.layers[layerId];
}

export function clearAllLayers() {
  _store.layers = {};
}

export function hasAnyLayer() {
  return Object.keys(_store.layers).some(k => _store.layers[k]?.data);
}