import { getFile, setStoredFiles } from '@/lib/bigFileStore';
import { CAMPAIGN_SAVE_INDEX, savedCampaignKey, recoveryCampaignKey, recoveryPixelsKey, isCampaignPayload, campaignIndexEntry, rememberCampaignEntry, campaignDiskSnapshot } from '@/components/map/campaignStorageRecords';
export { CAMPAIGN_SAVE_INDEX } from '@/components/map/campaignStorageRecords';

export function restoreSavedCampaignLibrary(library) {
  const saved = getFile(CAMPAIGN_SAVE_INDEX);
  if (!saved || typeof saved !== 'object') return;
  library.campaigns = saved.campaigns;
  library.active = saved.active;
  // Keep only the lightweight index in memory. Pixels load for the selected campaign.
}

export async function persistSavedCampaign(library, id, snapshot) {
  const { entry, index } = campaignIndexEntry(library, id, snapshot);
  const obsoletePixels = Object.keys(snapshot.layers).map(layer => [recoveryPixelsKey(id, layer), null]);
  await setStoredFiles([
    [CAMPAIGN_SAVE_INDEX, index], [savedCampaignKey(id), campaignDiskSnapshot(snapshot)],
    [recoveryCampaignKey(id), null], ...obsoletePixels,
  ], { cache: key => !isCampaignPayload(key) });
  rememberCampaignEntry(library, entry);
}

export async function reviveCampaignSnapshot(snapshot) {
  const entries = [];
  for (const [id, layer] of Object.entries(snapshot.layers)) {
    if (!layer.data) { entries.push([id, { ...layer }]); continue; }
    const data = layer.data instanceof Uint8ClampedArray ? layer.data : new Uint8ClampedArray(layer.data);
    const bitmap = await createImageBitmap(new ImageData(data, layer.width, layer.height));
    entries.push([id, { ...layer, data, bitmap }]);
  }
  const { savedSnapshot, ...model } = snapshot;
  return { ...model, layers: Object.fromEntries(entries) };
}