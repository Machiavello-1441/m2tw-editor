import { getFile } from '@/lib/bigFileStore';

export const CAMPAIGN_SAVE_INDEX = 'm2tw_saved_campaign_library';
export const savedCampaignKey = id => `m2tw_saved_campaign:${id}`;
export const recoveryCampaignKey = id => `m2tw_campaign_recovery:${id}`;
export const recoveryPixelsKey = (id, layer) => `m2tw_campaign_pixels:${id}:${layer}`;
export const isCampaignPayload = key => /^(m2tw_saved_campaign:|m2tw_campaign_recovery:|m2tw_campaign_pixels:)/.test(String(key));

export function campaignIndexEntry(library, id, snapshot) {
  const source = library.campaigns.find(c => c.id === id);
  const entry = { id, name: source?.name || snapshot.stratData?.campaignName || id,
    files: (source?.files || []).map(file => ({ name: file.name, webkitRelativePath: file.webkitRelativePath || '' })) };
  const previous = getFile(CAMPAIGN_SAVE_INDEX);
  return { entry, index: { active: id, campaigns: [...(previous?.campaigns || []).filter(c => c.id !== id), entry].sort((a, b) => a.id.localeCompare(b.id)) } };
}
export function rememberCampaignEntry(library, entry) {
  if (!library.campaigns.some(c => c.id === entry.id)) library.campaigns.push(entry);
  library.active = entry.id;
}

/** Strip GPU resources and the obsolete duplicate checkpoint before storing. */
export function campaignDiskSnapshot(snapshot) {
  const { savedSnapshot, ...model } = snapshot;
  return { ...model, layers: Object.fromEntries(Object.entries(snapshot.layers).map(([id, layer]) => [id, {
    visible: layer.visible, opacity: layer.opacity, width: layer.width, height: layer.height,
    ...(layer.data ? { data: layer.data } : {}),
  }])) };
}