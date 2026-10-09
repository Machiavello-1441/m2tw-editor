import { findWorkspaceFile, getWorkspace } from '@/components/workspace/localWorkspace';

const references = ['descr_sm_factions.txt', 'descr_sm_resources.txt', 'export_descr_unit.txt', 'descr_events.txt'];
const triggers = [...references, 'export_descr_character_traits.txt', 'export_descr_ancillaries.txt'];
const pageFiles = {
  EDBEditor: [...triggers, 'export_descr_buildings.txt', 'export_descr_guilds.txt', 'text/export_buildings.txt.strings.bin', 'text/export_buildings.txt'],
  TraitsEditor: [...triggers, 'text/export_VnVs.txt.strings.bin', 'text/export_VnVs.txt'],
  AncillariesEditor: [...triggers, 'text/export_ancillaries.txt.strings.bin', 'text/export_ancillaries.txt'],
  UnitEditor: [...references, 'descr_skeleton.txt', 'descr_mount.txt', 'battle_models.modeldb', 'text/export_units.txt.strings.bin', 'text/export_units.txt'],
  FactionsEditor: ['descr_sm_factions.txt', 'descr_cultures.txt', 'descr_religions.txt', 'export_descr_unit.txt'],
  CulturesEditor: ['descr_cultures.txt'],
  MinorFiles: ['descr_names.txt', 'descr_rebel_factions.txt', 'descr_religions.txt', 'descr_sm_resources.txt', 'descr_character.txt', 'descr_offmap_models.txt', 'descr_model_strat.txt', 'descr_models_strat.txt', 'descr_banners_new.xml', 'descr_settlement_mechanics.xml', 'descr_campaign_db.xml', 'strategy.sd.xml', 'battle.sd.xml', 'shared.sd.xml', 'radar.sd.xml'],
  CampaignMap: [...triggers, 'export_descr_buildings.txt', 'descr_cultures.txt', 'descr_names.txt', 'descr_rebel_factions.txt', 'descr_religions.txt', 'descr_settlement_mechanics.xml', 'descr_campaign_db.xml'],
  CampaignSettings: ['descr_settlement_mechanics.xml', 'descr_campaign_db.xml'],
};
export function filesForPage(page) {
  const files = (pageFiles[page] || []).map(findWorkspaceFile).filter(Boolean);
  // Prefer the binary strings file where both twins exist.
  const binaries = new Set(files.filter(file => /\.strings\.bin$/i.test(file.name)).map(file => file.name.toLowerCase().replace(/\.strings\.bin$/, '')));
  if (page === 'StringsBinEditor') files.push(...[...getWorkspace().files.values()].filter(file => /\.strings\.bin$/i.test(file.name)));
  if (page === 'LuaScripts') files.push(...[...getWorkspace().files.values()].filter(file => /(?:^|\/)eopscripts\/[^/]+\.lua$/i.test(file.path)));
  return files.filter(file => !binaries.has(file.name.toLowerCase()));
}
export const workspaceReferenceFiles = pageFiles;