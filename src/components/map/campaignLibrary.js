import { restoreCampaignStorage } from '@/components/map/campaignSession';

const state = { campaigns: [], active: '', snapshots: new Map() };
const pathOf = f => (f.webkitRelativePath || f.name).replace(/\\/g, '/').toLowerCase();
const globals = new Set(['descr_sm_factions.txt', 'descr_rebel_factions.txt', 'descr_religions.txt', 'descr_sm_resources.txt', 'descr_cultures.txt', 'descr_names.txt', 'export_descr_character_traits.txt', 'export_descr_ancillaries.txt', 'export_descr_unit.txt', 'descr_sounds_music_types.txt', 'names.txt.strings.bin']);
export const campaignLibrary = () => state;
export function indexCampaignLibrary(files, preferred) {
  const groups = new Map(), base = [], shared = [], names = [];
  for (const file of files) {
    const path = pathOf(file), name = file.name.toLowerCase();
    const match = path.match(/(?:^|\/)maps\/campaign\/((?:custom\/)?[^/]+)\//);
    if (match) {
      if (!groups.has(match[1])) groups.set(match[1], []);
      if (/\.(txt|tga|xml)$/i.test(name)) groups.get(match[1]).push(file);
    } else if (/(?:^|\/)maps\/base\//.test(path) && /\.(txt|tga|xml)$/i.test(name)) base.push(file);
    else if (/_regions_and_settlement_names\.(txt|txt\.strings\.bin|strings\.bin|bin)$/i.test(name)) names.push(file);
    else if (globals.has(name)) shared.push(file);
  }
  state.campaigns = [...groups].map(([id, own]) => {
    const name = id.split('/').pop();
    const resolved = new Map([...shared, ...base, ...own].map(f => [f.name.toLowerCase(), f]));
    for (const f of names) if (f.name.toLowerCase().startsWith(`${name}_regions_and_settlement_names.`)) resolved.set(f.name.toLowerCase(), f);
    return { id, name, files: [...resolved.values()] };
  }).sort((a, b) => a.id.localeCompare(b.id));
  state.active = state.campaigns.find(c => c.id === preferred)?.id || state.campaigns.find(c => c.name === preferred)?.id || state.campaigns[0]?.id || '';
  state.snapshots.clear();
  restoreCampaignStorage();
  window._m2tw_loaded_map_files = null;
  window._m2tw_map_files = state.campaigns.find(c => c.id === state.active)?.files || base;
  window.dispatchEvent(new Event('m2tw-campaign-library-updated'));
  return state;
}