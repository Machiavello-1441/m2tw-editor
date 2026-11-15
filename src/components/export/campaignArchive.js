import JSZip from 'jszip';
import { getFile } from '@/lib/bigFileStore';
import { editorSessionStorage } from '@/lib/editorStorage';
import { serializeDescrStrat, serializeDescrRegions, serializeWinConditions } from '@/components/map/stratParser';
import { serializeFactionMovies } from '@/components/map/factionMoviesParser';
import { serializeDisasters } from '@/components/map/disastersParser';
import { serializeCampaignEvents } from '@/components/map/campaignEventsParser';
import { exportTGA } from '@/components/map/tgaExporter';
import { getCampaignExportPaths, rememberCampaignSourceFiles } from '@/components/map/campaignSourcePaths';
import { addSharedEditedFilesToZip } from '@/components/export/sharedEditedFilesExport';
import { addCampaignNamesToZip } from '@/components/export/campaignNamesExport';
import { removeUnchangedCampaignFiles } from '@/components/export/exportOriginals';
import { entriesToTextBytes } from '@/lib/stringsTxtFile';
import { encodeStringsBin } from '@/components/strings/stringsBinCodec';
import { writeLatestZipFile } from '@/components/export/zipFilePrecedence';

const crlf = text => text.replace(/\r\n?|\n/g, '\r\n');

/** One export snapshot: current editor data wins; exporting never saves or clears it. */
export default async function campaignArchive({ stratData, regionsData, settlementNames, layers = {}, regionsLayer, overlayItems = [], editedSettlements = {}, religionList, campaignDetails = {} }) {
  const zip = new JSZip(), campaignName = stratData?.campaignName || 'imperial_campaign';
  const sources = window._m2tw_loaded_map_files || window._m2tw_map_files || [];
  rememberCampaignSourceFiles(sources, campaignName);
  const paths = getCampaignExportPaths(campaignName, undefined, true), directory = paths.directory;
  const write = (path, content) => writeLatestZipFile(zip, paths.resolve(path), content);
  const read = (session, key) => editorSessionStorage.getItem(session) ?? getFile(key);
  const knownFiles = new Set([...sources.map(file => file.name.toLowerCase()), ...Object.keys(JSON.parse(getFile('m2tw_campaign_source_paths') || '{}').paths || {})]);
  if (stratData?.raw) write(`${directory}/descr_strat.txt`, crlf(serializeDescrStrat({ ...stratData, _regionsLookup: regionsData, _regionsLayer: regionsLayer }, overlayItems, editedSettlements)));
  if (regionsData) write(`${directory}/descr_regions.txt`, crlf(serializeDescrRegions(regionsData, religionList)));
  const rawFiles = [
    ['m2tw_script_raw', 'm2tw_campaign_script', stratData?.scriptFile || 'campaign_script.txt'],
    ['m2tw_mercenaries_raw', 'm2tw_campaign_mercenaries', 'descr_mercenaries.txt'],
    ['m2tw_terrain_raw', 'm2tw_terrain_raw', 'descr_terrain.txt'],
  ];
  for (const [session, key, name] of rawFiles) {
    const raw = read(session, key);
    if (raw != null && (raw !== '' || knownFiles.has(name.toLowerCase()))) write(`${directory}/${name}`, crlf(raw));
  }
  for (const [field, session, key, name, serialize] of [
    ['winConditions', 'm2tw_win_conditions_raw', 'm2tw_campaign_win_conditions', 'descr_win_conditions.txt', serializeWinConditions],
    ['factionMovies', 'm2tw_faction_movies_raw', 'm2tw_campaign_faction_movies', 'descr_faction_movies.xml', serializeFactionMovies],
    ['disasters', 'm2tw_disasters_raw', 'm2tw_campaign_disasters', 'descr_disasters.txt', serializeDisasters],
    ['campaignEvents', 'm2tw_campaign_events_raw', 'm2tw_campaign_events', 'descr_events.txt', serializeCampaignEvents],
    ['campaignDescription', 'm2tw_campaign_description', 'm2tw_campaign_description', 'description.txt', value => value],
  ]) {
    const value = campaignDetails[field];
    const raw = value != null ? serialize(value) : read(session, key);
    const explicitEmpty = value != null && field !== 'campaignDescription';
    if (raw != null && (raw !== '' || knownFiles.has(name.toLowerCase()) || explicitEmpty)) write(`${directory}/${name}`, crlf(raw));
  }
  for (const [id, filename] of Object.entries({ heights: 'map_heights.tga', ground: 'map_ground_types.tga', climates: 'map_climates.tga', regions: 'map_regions.tga', features: 'map_features.tga', fog: 'map_fog.tga' })) {
    const layer = layers[id];
    if (layer?.data) write(`${directory}/${filename}`, exportTGA(layer.data, layer.width, layer.height).arrayBuffer());
  }
  const descriptions = read('m2tw_campaign_desc_strings', 'm2tw_campaign_desc_strings');
  if (descriptions) {
    const entries = Object.entries(JSON.parse(descriptions)).map(([key, value]) => ({ key, value }));
    write('data/text/campaign_descriptions.txt.strings.bin', encodeStringsBin(entries));
    write('data/text/campaign_descriptions.txt', entriesToTextBytes(entries));
  }
  addSharedEditedFilesToZip(zip.folder('data'), { campaignNames: false });
  for (const path of Object.keys(zip.files)) {
    if (/^data\/text\/[^/]+_regions_and_settlement_names\.(?:txt|(?:txt\.)?strings\.bin|bin)$/i.test(path)) zip.remove(path);
  }
  // This must be last: global strings can still contain the original imported names.
  addCampaignNamesToZip(zip.folder('data'), campaignName, settlementNames);
  zip.exportUnverifiedFiles = await removeUnchangedCampaignFiles(zip);
  return zip;
}