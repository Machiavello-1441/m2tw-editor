/** Shared file names and legacy keys used by Home and every editor. */
export const FILES_CHANGED_EVENT = 'm2tw-files-updated';
export const FILE_STORAGE_WARNING_EVENT = 'm2tw-file-storage-warning';
export const STRINGS_STORE_KEY = 'm2tw_strings_bin_files';

// These are aliases for the SAME raw file, not copies to synchronise later.
// Parsed lists (e.g. m2tw_sm_factions) deliberately are not raw-file aliases.
export const FILE_KEY_GROUPS = [
  ['m2tw_banners_file', 'm2tw_banners_xml_global', 'm2tw_banners_raw'],
  ['m2tw_descr_character', 'm2tw_descr_character_raw'],
  ['m2tw_descr_model_strat', 'm2tw_descr_model_strat_raw'],
  ['m2tw_names_file', 'm2tw_descr_names_raw'],
  ['m2tw_factions_file', 'm2tw_factions_raw'],
  ['m2tw_cultures_file', 'm2tw_cultures_raw'],
  ['m2tw_religions_file', 'm2tw_religions_raw'],
  ['m2tw_rebel_factions_file', 'm2tw_rebel_factions_raw'],
  ['m2tw_resources_file', 'm2tw_sm_resources_raw'],
  ['m2tw_units_file', 'm2tw_edu_raw'],
  ['m2tw_traits_file', 'm2tw_traits_raw'],
  ['m2tw_anc_file', 'm2tw_ancillaries_raw'],
  ['m2tw_events_file', 'm2tw_events_raw'],
  ['m2tw_campaign_strat', 'm2tw_strat_raw'],
  ['m2tw_campaign_script', 'm2tw_script_raw'],
  ['m2tw_campaign_mercenaries', 'm2tw_mercenaries_raw'],
  ['m2tw_campaign_win_conditions', 'm2tw_win_conditions_raw'],
  ['m2tw_campaign_faction_movies', 'm2tw_faction_movies_raw'],
  ['m2tw_campaign_events', 'm2tw_campaign_events_raw'],
  ['m2tw_campaign_disasters', 'm2tw_disasters_raw'],
];
const aliases = Object.fromEntries(FILE_KEY_GROUPS.flatMap(group => group.map(key => [key, group[0]])));
export const canonicalFileKey = key => aliases[key] || key;
export const fileKeyAliases = key => FILE_KEY_GROUPS.find(group => group[0] === canonicalFileKey(key)) || [key];

export const STRING_FILE_KEYS = {
  m2tw_strings_bin_global: 'expanded.txt.strings.bin',
  m2tw_menu_strings_bin: 'menu_english.txt.strings.bin',
};
export function normalizedFileName(name) {
  return String(name || '').replace(/\\/g, '/').split('/').pop().toLowerCase();
}

// [Home status id, shared raw-file key]. Referenced by both picker and loader.
export const DATA_FILE_DEFINITIONS = {
  'descr_aerial_map_ground_types.txt': ['aerial_ground_types', 'm2tw_aerial_ground_types_raw'],
  'descr_climates.txt': ['climates', 'm2tw_descr_climates'],
  'export_descr_buildings.txt': ['edb', 'm2tw_edb_file'],
  'descr_sm_factions.txt': ['fac', 'm2tw_factions_file'],
  'descr_sm_resources.txt': ['res', 'm2tw_resources_file'],
  'export_descr_unit.txt': ['unit', 'm2tw_units_file'],
  'descr_events.txt': ['ev', 'm2tw_events_file'],
  'export_buildings.txt.strings.bin': ['txt_bin', null],
  'export_buildings.txt': ['txt', 'm2tw_edb_txt_file'],
  'export_descr_character_traits.txt': ['traits', 'm2tw_traits_file'],
  'export_descr_ancillaries.txt': ['anc', 'm2tw_anc_file'],
  'export_units.txt': ['expunits', 'm2tw_export_units_file'],
  'export_vnvs.txt': ['vnvs', 'm2tw_vnvs_file'],
  'export_ancillaries.txt': ['anctxt', 'm2tw_anctxt_file'],
  'descr_cultures.txt': ['cultures', 'm2tw_cultures_file'],
  'descr_names.txt': ['names', 'm2tw_names_file'],
  'descr_rebel_factions.txt': ['rebel_fac', 'm2tw_rebel_factions_file'],
  'descr_religions.txt': ['religions', 'm2tw_religions_file'],
  'battle_models.modeldb': ['modeldb', 'm2tw_modeldb_file'],
  'descr_skeleton.txt': ['skeleton', 'm2tw_skeleton_file'],
  'descr_mount.txt': ['mount', 'm2tw_mount_file'],
  'export_descr_guilds.txt': ['guilds', 'm2tw_guilds_file'],
  'descr_character.txt': ['char', 'm2tw_descr_character'],
  'descr_offmap_models.txt': ['offmap', 'm2tw_offmap_models'],
  'descr_model_strat.txt': ['strat_model', 'm2tw_descr_model_strat'],
  'descr_models_strat.txt': ['strat_model', 'm2tw_descr_model_strat'],
  'descr_banners_new.xml': ['banners', 'm2tw_banners_file'],
  'strategy.sd.xml': ['sd_strategy', 'm2tw_strategy_sd_xml'],
  'battle.sd.xml': ['sd_battle', 'm2tw_battle_sd_xml'],
  'shared.sd.xml': ['sd_shared', 'm2tw_shared_sd_xml'],
  'radar.sd.xml': ['sd_radar', 'm2tw_radar_sd_xml'],
};
export const DATA_FILE_MAP = Object.fromEntries(Object.entries(DATA_FILE_DEFINITIONS).map(([name, [id]]) => [name, id]));
export const EXTRA_TEXT_FILES = new Set([
  'descr_strat.txt', 'descr_regions.txt', 'descr_mercenaries.txt',
  'descr_win_conditions.txt', 'campaign_script.txt', 'descr_event.txt',
  'descr_terrain.txt', 'descr_disasters.txt', 'description.txt', 'descr_faction_movies.xml',
  'descr_settlement_mechanics.xml', 'descr_campaign_db.xml',
]);
export const FACTION_DEPENDENCIES = [
  ['descr_sm_factions.txt', 'm2tw_factions_file'],
  ['descr_cultures.txt', 'm2tw_cultures_file'],
  ['descr_religions.txt', 'm2tw_religions_file'],
  ['descr_banners_new.xml', 'm2tw_banners_file'],
  ['expanded.txt.strings.bin', 'm2tw_strings_bin_global'],
  ['menu_english.txt.strings.bin', 'm2tw_menu_strings_bin'],
  ['descr_character.txt', 'm2tw_descr_character'],
  ['descr_model_strat.txt', 'm2tw_descr_model_strat'],
  ['descr_names.txt', 'm2tw_names_file'],
  ['export_descr_unit.txt', 'm2tw_units_file'],
  ['descr_offmap_models.txt', 'm2tw_offmap_models'],
];
