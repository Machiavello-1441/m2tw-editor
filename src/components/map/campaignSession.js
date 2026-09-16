import { setFile } from '@/lib/bigFileStore';
import { clearAllLayers } from '@/lib/mapLayerStore';

const sessionKeys = ['m2tw_strat_raw', 'm2tw_regions_raw', 'm2tw_regions_data_json', 'm2tw_overlay_items_json', 'm2tw_names_raw', 'm2tw_names_bin_meta', 'm2tw_script_raw', 'm2tw_events_raw', 'm2tw_campaign_events_raw', 'm2tw_terrain_raw', 'm2tw_win_conditions_raw', 'm2tw_mercenaries_raw', 'm2tw_music_types_raw', 'm2tw_faction_movies_raw', 'm2tw_disasters_raw', 'm2tw_campaign_description'];
const localKeys = ['m2tw_campaign_strat', 'm2tw_campaign_script', 'm2tw_campaign_events', 'm2tw_campaign_win_conditions', 'm2tw_campaign_mercenaries', 'm2tw_campaign_faction_movies', 'm2tw_campaign_disasters', 'm2tw_campaign_description'];
export function captureCampaignStorage() {
  return { session: Object.fromEntries(sessionKeys.map(k => [k, sessionStorage.getItem(k)])), local: Object.fromEntries(localKeys.map(k => [k, localStorage.getItem(k)])) };
}
export function restoreCampaignStorage(saved) {
  clearAllLayers();
  for (const [storage, keys, values] of [[sessionStorage, sessionKeys, saved?.session], [localStorage, localKeys, saved?.local]]) {
    for (const k of keys) { storage.removeItem(k); if (values?.[k] != null) storage.setItem(k, values[k]); }
  }
  setFile('m2tw_names_raw', saved?.session?.m2tw_names_raw || '');
}