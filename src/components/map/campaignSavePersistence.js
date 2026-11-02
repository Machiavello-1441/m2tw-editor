import { getFile, setStoredFiles } from '@/lib/bigFileStore';

export const CAMPAIGN_SAVE_INDEX = 'm2tw_saved_campaign_library';
const snapshotKey = id => `m2tw_saved_campaign:${id}`;

export function restoreSavedCampaignLibrary(library) {
  const saved = getFile(CAMPAIGN_SAVE_INDEX);
  if (!saved || typeof saved !== 'object') return;
  library.campaigns = saved.campaigns;
  library.active = saved.active;
  for (const campaign of saved.campaigns) {
    const snapshot = getFile(snapshotKey(campaign.id));
    if (snapshot) library.snapshots.set(campaign.id, snapshot);
  }
}

export async function persistSavedCampaign(library, id, snapshot) {
  const campaign = library.campaigns.find(c => c.id === id);
  const entry = { id, name: campaign?.name || snapshot.stratData?.campaignName || id,
    files: (campaign?.files || []).map(f => ({ name: f.name, webkitRelativePath: f.webkitRelativePath || '' })) };
  const previous = getFile(CAMPAIGN_SAVE_INDEX);
  const campaigns = [...(previous?.campaigns || []).filter(c => c.id !== id), entry].sort((a, b) => a.id.localeCompare(b.id));
  // One transaction commits both the index and binary pixel buffers. No ImageBitmap is stored.
  await setStoredFiles([[CAMPAIGN_SAVE_INDEX, { campaigns, active: id }], [snapshotKey(id), snapshot]]);
  if (!campaign) library.campaigns.push(entry);
}

export async function reviveCampaignSnapshot(snapshot) {
  const entries = await Promise.all(Object.entries(snapshot.layers).map(async ([id, layer]) => {
    if (!layer.data) return [id, { ...layer }];
    const data = new Uint8ClampedArray(layer.data);
    const bitmap = await createImageBitmap(new ImageData(data, layer.width, layer.height));
    return [id, { ...layer, data, bitmap }];
  }));
  return { ...snapshot, layers: Object.fromEntries(entries) };
}