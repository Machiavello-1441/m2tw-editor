import { getFile } from '@/lib/bigFileStore';
import { campaignLibrary } from '@/components/map/campaignLibrary';
import { readCampaignSnapshot } from '@/components/map/campaignRecoveryStore';
import { CAMPAIGN_SAVE_INDEX } from '@/components/map/campaignStorageRecords';
import { serializeDescrStrat, serializeDescrRegions, serializeWinConditions } from '@/components/map/stratParser';
import { serializeFactionMovies } from '@/components/map/factionMoviesParser';
import { serializeDisasters } from '@/components/map/disastersParser';
import { serializeCampaignEvents } from '@/components/map/campaignEventsParser';

let draft = null, source = null;
export function rememberCampaignExportDraft(snapshot) {
  draft = snapshot;
  source = getFile('m2tw_campaign_strat');
}
export const getCampaignExportDraft = () => getFile('m2tw_campaign_strat') === source ? draft : null;

/** Navigation exports use the latest draft, not just the original raw import. */
export async function prepareCampaignExportDraft() {
  if (getCampaignExportDraft()) return;
  const library = campaignLibrary();
  if (!library.active) return;
  const hasSavedCopy = getFile(CAMPAIGN_SAVE_INDEX)?.campaigns?.some(campaign => campaign.id === library.active);
  const snapshot = library.snapshots.get(library.active) || (hasSavedCopy ? await readCampaignSnapshot(library.active) : null);
  const current = (getFile('m2tw_campaign_strat') || '').match(/^[\t ]*campaign[\t ]+([^\s;]+)/im)?.[1];
  const original = snapshot?.stratData?.raw?.match(/^[\t ]*campaign[\t ]+([^\s;]+)/im)?.[1];
  if (snapshot && current && [snapshot.stratData?.campaignName, original].includes(current)) rememberCampaignExportDraft(snapshot);
}

export function campaignDraftFile(key, fallback) {
  const live = getCampaignExportDraft();
  if (!live) return fallback;
  if (key === 'm2tw_campaign_strat' && live.stratData?.raw) return serializeDescrStrat({ ...live.stratData, _regionsLookup: live.regionsData, _regionsLayer: live.layers?.regions }, live.overlayItems || live.stratData.items || [], live.editedSettlements || {});
  if (key === 'm2tw_regions_raw' && live.regionsData) return serializeDescrRegions(live.regionsData, live.religionList);
  const definitions = {
    m2tw_campaign_win_conditions: ['winConditions', serializeWinConditions],
    m2tw_campaign_faction_movies: ['factionMovies', serializeFactionMovies],
    m2tw_campaign_disasters: ['disasters', serializeDisasters],
    m2tw_campaign_events: ['campaignEvents', serializeCampaignEvents],
    m2tw_campaign_description: ['campaignDescription', value => value],
  };
  const definition = definitions[key];
  const value = definition && live.campaignDetails?.[definition[0]];
  return value != null ? definition[1](value) : fallback;
}