import { getFile } from '@/lib/bigFileStore';
import { getAllLayers, LAYER_DEFS } from '@/lib/mapLayerStore';
import { getCampaignExportPaths } from '@/components/map/campaignSourcePaths';
import { exportTGA } from '@/components/map/tgaExporter';
import { writeLatestZipFile } from '@/components/export/zipFilePrecedence';

const files = [
  ['m2tw_campaign_strat', 'descr_strat.txt'], ['m2tw_regions_raw', 'descr_regions.txt'],
  ['m2tw_campaign_script', 'campaign_script.txt'], ['m2tw_campaign_mercenaries', 'descr_mercenaries.txt'],
  ['m2tw_campaign_win_conditions', 'descr_win_conditions.txt'], ['m2tw_campaign_faction_movies', 'descr_faction_movies.xml'],
  ['m2tw_campaign_events', 'descr_events.txt'], ['m2tw_campaign_disasters', 'descr_disasters.txt'],
  ['m2tw_terrain_raw', 'descr_terrain.txt'], ['m2tw_campaign_description', 'description.txt'],
];
export const currentCampaignExportKeys = [...files.map(([key]) => key), 'm2tw_campaign_source_paths'];
function activeCampaignName() {
  const raw = getFile('m2tw_campaign_strat');
  return raw?.match(/^[\t ]*campaign[\t ]+([^\s;]+)/im)?.[1] || JSON.parse(getFile('m2tw_campaign_source_paths') || '{}').campaignName;
}
export function getCurrentCampaignExportCount() {
  return activeCampaignName() ? files.filter(([key]) => getFile(key) !== null).length + Object.values(getAllLayers()).filter(layer => layer?.data).length : 0;
}

/** Campaign-owned edits stay in their own source directories, never another campaign. */
export function addCurrentCampaignFilesToZip(modFolder) {
  const campaign = activeCampaignName();
  if (!campaign) return;
  const paths = getCampaignExportPaths(campaign, undefined, true);
  const rawStrat = getFile('m2tw_campaign_strat') || '';
  const scriptName = rawStrat.match(/^[\t ]*script[\t ]*\r?\n[\t ]*([^\r\n;]+)/im)?.[1]?.trim() || 'campaign_script.txt';
  for (const [key, name] of files) {
    const raw = getFile(key);
    if (raw !== null) writeLatestZipFile(modFolder, paths.resolve(`${paths.directory}/${name === 'campaign_script.txt' ? scriptName : name}`), raw);
  }
  for (const def of LAYER_DEFS) {
    const layer = getAllLayers()[def.id];
    if (layer?.data) writeLatestZipFile(modFolder, paths.resolve(`${paths.directory}/${def.filename}`), exportTGA(layer.data, layer.width, layer.height));
  }
}