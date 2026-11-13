import { DATA_FILE_DEFINITIONS, canonicalFileKey } from '@/lib/modFileRegistry';
import { getFile } from '@/lib/bigFileStore';
import { getStringsBinStore } from '@/lib/stringsBinStore';
import { getFolderIndex } from '@/lib/modFolderStore';
import { getCurrentCampaignExportCount } from '@/components/export/currentCampaignFilesExport';

const textNames = new Set(['export_buildings.txt', 'export_units.txt', 'export_vnvs.txt', 'export_ancillaries.txt']);
const defaults = { 'battle_models.modeldb': 'unit_models/battle_models.modeldb', ...Object.fromEntries(['strategy', 'battle', 'shared', 'radar'].map(name => [`${name}.sd.xml`, `ui/${name}.sd.xml`])) };
const sources = new Map();
for (const [name, [, key]] of Object.entries(DATA_FILE_DEFINITIONS)) {
  if (key && !sources.has(canonicalFileKey(key))) sources.set(canonicalFileKey(key), name);
}
sources.set('m2tw_music_types_raw', 'descr_sounds_music_types.txt');
sources.set('m2tw_settlement_mechanics', 'descr_settlement_mechanics.xml');
export const SHARED_EXPORT_SOURCES = [...sources].map(([key, name]) => ({ key, name }));
export const sharedExportKeys = SHARED_EXPORT_SOURCES.map(source => source.key);

export function sharedExportPath(name, key) {
  const index = getFolderIndex();
  const variants = Object.entries(DATA_FILE_DEFINITIONS).filter(([, [, candidate]]) => candidate && canonicalFileKey(candidate) === key).map(([variant]) => variant);
  for (const variant of variants.length ? variants : [name]) {
    for (const { file } of index?.byName.get(variant) || []) {
      const path = (file.webkitRelativePath || '').replace(/\\/g, '/');
      const match = path.match(/(?:^|\/)data\/(.+)$/i);
      if (match) return match[1];
    }
  }
  return defaults[name] || (textNames.has(name) ? `text/${name}` : name);
}
export function getSharedExportFileCount() {
  return SHARED_EXPORT_SOURCES.filter(({ key }) => getFile(key) !== null).length + Object.keys(getStringsBinStore()).length + getCurrentCampaignExportCount();
}