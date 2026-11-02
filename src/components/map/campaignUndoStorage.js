import { captureCampaignStorage, restoreCampaignStorage } from '@/components/map/campaignSession';
import { editorSessionStorage } from '@/lib/editorStorage';
import { getFile, setFile, removeFile } from '@/lib/bigFileStore';
import { canonicalFileKey } from '@/lib/modFileRegistry';

const extraKeys = ['m2tw_names_file', 'm2tw_char_names_display'];
const derived = new Set(['m2tw_strat_raw', 'm2tw_campaign_strat', 'm2tw_overlay_items_json', 'm2tw_regions_data_json', 'm2tw_names_raw']);
export function captureUndoStorage() {
  return { ...captureCampaignStorage(), extra: Object.fromEntries(extraKeys.map(key => [key, getFile(key)])) };
}
export function comparableUndoStorage(storage) {
  return Object.fromEntries(Object.entries(storage).map(([scope, values]) => [scope,
    Object.fromEntries(Object.entries(values).filter(([key]) => !derived.has(key))),
  ]));
}
export function isUndoStorageEvent(event) {
  const storage = captureUndoStorage();
  const keys = new Set(Object.values(storage).flatMap(values => Object.keys(values).map(canonicalFileKey)));
  return !event.detail?.keys || event.detail.keys.some(key => keys.has(key));
}
export function restoreUndoStorage(storage, model, clearLayers = false) {
  restoreCampaignStorage(storage, clearLayers);
  for (const [key, value] of Object.entries(storage.extra)) {
    if (value == null) removeFile(key); else setFile(key, value);
  }
  // Drafts retain original line coordinates and negative IDs; never reparse or save here.
  if (model.stratData?.raw) editorSessionStorage.setItem('m2tw_strat_raw', model.stratData.raw);
  else editorSessionStorage.removeItem('m2tw_strat_raw');
  editorSessionStorage.setItem('m2tw_overlay_items_json', JSON.stringify(model.overlayItems));
  if (model.regionsData) editorSessionStorage.setItem('m2tw_regions_data_json', JSON.stringify(model.regionsData));
  else editorSessionStorage.removeItem('m2tw_regions_data_json');
}