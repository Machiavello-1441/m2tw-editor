import { getWorkspace, findWorkspaceFile } from '@/components/workspace/localWorkspace';
import { getFile } from '@/lib/bigFileStore';
import { serializeEDU } from '@/components/units/EDUParser';
import { campaignLibrary } from '@/components/map/campaignLibrary';
import { getStringsBinStore } from '@/lib/stringsBinStore';
import { encodeStringsBin } from '@/components/strings/stringsBinCodec';

export function hasWorkspaceExports() {
  if (!getWorkspace()?.authorized) return false;
  return ['m2tw_edu_units', 'm2tw_factions_file', 'm2tw_cultures_file', 'm2tw_religions_file', 'm2tw_rebel_factions_file', 'm2tw_names_file', 'm2tw_resources_file', 'm2tw_descr_character', 'm2tw_offmap_models', 'm2tw_descr_model_strat', 'm2tw_banners_file'].some(key => !!getFile(key)) || !!sessionStorage.getItem('m2tw_strat_raw');
}
export default function appendWorkspaceEdits(zip, modName) {
  const source = getWorkspace();
  if (!source?.authorized) return;
  const write = (path, content) => { if (content) zip.file(`${modName}/data/${path}`, content); };
  const units = localStorage.getItem('m2tw_edu_units');
  if (units) write('export_descr_unit.txt', serializeEDU(JSON.parse(units)).replace(/\r?\n/g, '\r\n'));
  const rawFiles = {
    'descr_sm_factions.txt': 'm2tw_factions_file', 'descr_cultures.txt': 'm2tw_cultures_file',
    'descr_religions.txt': 'm2tw_religions_file', 'descr_rebel_factions.txt': 'm2tw_rebel_factions_file',
    'descr_names.txt': 'm2tw_names_file', 'descr_sm_resources.txt': 'm2tw_resources_file',
    'descr_character.txt': 'm2tw_descr_character', 'descr_offmap_models.txt': 'm2tw_offmap_models',
    'descr_model_strat.txt': 'm2tw_descr_model_strat', 'descr_banners_new.xml': 'm2tw_banners_file',
  };
  for (const [path, key] of Object.entries(rawFiles)) {
    if (findWorkspaceFile(path)) write(path, getFile(key));
  }
  const descriptions = getFile('m2tw_local_export_units');
  if (descriptions) {
    const entries = Object.entries(JSON.parse(descriptions)).flatMap(([key, value]) => [
      { key, value: value.name || '' }, { key: `${key}_descr`, value: value.long || '' }, { key: `${key}_descr_short`, value: value.short || '' },
    ]);
    const original = getStringsBinStore()['export_units.txt.strings.bin'];
    const sourceBin = findWorkspaceFile('text/export_units.txt.strings.bin');
    if (sourceBin) write(sourceBin.path.replace(/^data\//i, ''), new Uint8Array(encodeStringsBin(entries, original?.magic1 ?? 2, original?.magic2 ?? 2048)));
    else write('text/export_units.txt', entries.map(entry => `{${entry.key}}${entry.value}`).join('\n'));
  }
  for (const [name, bin] of Object.entries(getStringsBinStore())) {
    const descriptor = findWorkspaceFile(`text/${name}`);
    if (!descriptor) continue;
    const target = `${modName}/data/${descriptor.path.replace(/^data\//i, '')}`;
    if (!zip.file(target)) zip.file(target, new Uint8Array(encodeStringsBin(bin.entries, bin.magic1, bin.magic2)));
  }
  const library = campaignLibrary();
  const campaignFiles = {
    'descr_strat.txt': 'm2tw_strat_raw', 'descr_regions.txt': 'm2tw_regions_raw',
    'campaign_script.txt': 'm2tw_script_raw', 'descr_win_conditions.txt': 'm2tw_win_conditions_raw',
    'descr_faction_movies.xml': 'm2tw_faction_movies_raw', 'descr_disasters.txt': 'm2tw_disasters_raw',
    'description.txt': 'm2tw_campaign_description', 'descr_event.txt': 'm2tw_campaign_events_raw',
    'descr_mercenaries.txt': 'm2tw_mercenaries_raw',
  };
  for (const [filename, key] of Object.entries(campaignFiles)) {
    const current = sessionStorage.getItem(key);
    const descriptor = library.campaigns.find(campaign => campaign.id === library.active)?.files.find(file => file.name.toLowerCase() === filename);
    if (current && descriptor) {
      const path = descriptor.path.replace(/^data\//i, '');
      write(path, current);
    }
  }
}