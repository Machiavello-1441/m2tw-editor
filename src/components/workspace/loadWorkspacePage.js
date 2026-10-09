import { getWorkspace } from '@/components/workspace/localWorkspace';
import { filesForPage } from '@/components/workspace/workspacePageFiles';
import { setFile } from '@/lib/bigFileStore';
import { getStringsBinStore, setStringsBinStore } from '@/lib/stringsBinStore';
import { parseStringsBin } from '@/components/strings/stringsBinCodec';
import { indexCampaignLibrary } from '@/components/map/campaignLibrary';
import { loadSettlementMechanicsFile } from '@/components/map/settlementMechanics';
import { loadFamilyRulesFile, FAMILY_RULE_FILES } from '@/components/map/familyRules';

const keys = {
  'descr_sm_factions.txt': ['m2tw_factions_file', 'm2tw_factions_raw'],
  'descr_sm_resources.txt': ['m2tw_resources_file', 'm2tw_sm_resources_raw'],
  'export_descr_unit.txt': ['m2tw_units_file', 'm2tw_edu_raw'],
  'descr_cultures.txt': ['m2tw_cultures_file', 'm2tw_cultures_raw'],
  'descr_names.txt': ['m2tw_names_file', 'm2tw_descr_names_raw'],
  'descr_rebel_factions.txt': ['m2tw_rebel_factions_file', 'm2tw_rebel_factions_raw'],
  'descr_religions.txt': ['m2tw_religions_file', 'm2tw_religions_raw'],
  'export_descr_character_traits.txt': ['m2tw_traits_file', 'm2tw_traits_raw'],
  'export_descr_ancillaries.txt': ['m2tw_anc_file', 'm2tw_ancillaries_raw'],
  'export_units.txt': ['m2tw_export_units_file', 'm2tw_export_units_raw'],
  'battle_models.modeldb': ['m2tw_modeldb_file'],
  'descr_character.txt': ['m2tw_descr_character'],
  'descr_offmap_models.txt': ['m2tw_offmap_models'],
  'descr_model_strat.txt': ['m2tw_descr_model_strat'],
  'descr_models_strat.txt': ['m2tw_descr_model_strat'],
  'descr_banners_new.xml': ['m2tw_banners_file'],
};
export async function loadWorkspacePage(page, { edb, refs, traits, anc }) {
  const workspace = getWorkspace();
  const referenceLoaders = {
    'descr_sm_factions.txt': refs.loadFactionsFile, 'descr_sm_resources.txt': refs.loadResourcesFile,
    'export_descr_unit.txt': refs.loadUnitsFile, 'descr_events.txt': refs.loadEventsFile,
    'descr_skeleton.txt': refs.loadSkeletonFile, 'descr_mount.txt': refs.loadMountFile,
    'export_descr_guilds.txt': refs.loadGuildsFile,
  };
  for (const entry of filesForPage(page)) {
    if (workspace.loaded.has(entry.path)) continue;
    const file = await entry.handle.getFile();
    const name = file.name.toLowerCase();
    if (/\.lua$/i.test(name)) {
      const scripts = JSON.parse(localStorage.getItem('m2tw_lua_scripts') || '[]');
      scripts.push({ id: `loaded_${file.name}`, name: file.name, type: 'custom', code: await file.text() });
      localStorage.setItem('m2tw_lua_scripts', JSON.stringify(scripts));
    } else if (/\.strings\.bin$/i.test(name)) {
      const parsed = parseStringsBin(await file.arrayBuffer());
      if (!parsed) throw new Error(`Cannot read ${file.name}.`);
      setStringsBinStore({ ...getStringsBinStore(), [file.name]: parsed });
      const map = Object.fromEntries(parsed.entries.map(item => [item.key, item.value]));
      if (name.includes('export_buildings')) {
        edb.loadTextFile(parsed.entries.map(item => `{${item.key}}${item.value}`).join('\n'));
        localStorage.setItem('m2tw_edb_txt_bin_magic1', String(parsed.magic1 ?? 2));
        localStorage.setItem('m2tw_edb_txt_bin_magic2', String(parsed.magic2 ?? 2048));
      } else if (name.includes('vnv')) traits.loadTextFile(map, file.name, parsed);
      else if (name.includes('ancillar')) anc.loadTextFile(map, file.name, parsed);
      else if (name.includes('export_units')) setFile('m2tw_export_units_file', parsed.entries.map(item => `{${item.key}}${item.value}`).join('\n'));
    } else if (FAMILY_RULE_FILES.has(name)) await loadFamilyRulesFile(file);
    else if (name === 'descr_settlement_mechanics.xml') await loadSettlementMechanicsFile(file);
    else {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const text = new TextDecoder(bytes[0] === 255 && bytes[1] === 254 ? 'utf-16le' : bytes[0] === 254 && bytes[1] === 255 ? 'utf-16be' : 'utf-8').decode(buffer);
      const [localKey, sessionKey] = keys[name] || [];
      if (localKey) setFile(localKey, text);
      if (sessionKey) sessionStorage.setItem(sessionKey, text);
      referenceLoaders[name]?.(text);
      if (name === 'export_descr_buildings.txt') edb.loadEDB(text, file.name);
      else if (name === 'export_buildings.txt') edb.loadTextFile(text);
      else if (name === 'export_descr_character_traits.txt') traits.loadTraitsFile(text, file.name);
      else if (name === 'export_descr_ancillaries.txt') anc.loadAncFile(text, file.name);
      else if (name === 'export_vnvs.txt') traits.loadTextFile(text, file.name);
      else if (name === 'export_ancillaries.txt') anc.loadTextFile(text, file.name);
      if (name === 'descr_names.txt') window.dispatchEvent(new CustomEvent('load-character-names', { detail: { raw: text } }));
      if (/^(strategy|battle|shared|radar)\.sd\.xml$/i.test(name)) setFile(`m2tw_${name.split('.')[0]}_sd_xml`, text);
    }
    workspace.loaded.add(entry.path);
  }
  if (page === 'CampaignMap' && !workspace.loaded.has('@campaign-library')) {
    indexCampaignLibrary([...workspace.files.values()]);
    workspace.loaded.add('@campaign-library');
  }
  window.dispatchEvent(new Event('storage'));
}