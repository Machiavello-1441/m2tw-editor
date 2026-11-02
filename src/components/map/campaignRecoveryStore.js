import { getFile, readStoredFile, setStoredFiles } from '@/lib/bigFileStore';
import { captureUndoStorage } from '@/components/map/campaignUndoStorage';
import { CAMPAIGN_SAVE_INDEX, savedCampaignKey, recoveryCampaignKey, recoveryPixelsKey, isCampaignPayload, campaignIndexEntry, rememberCampaignEntry, campaignDiskSnapshot } from '@/components/map/campaignStorageRecords';

/** Metadata and changed pixels commit together; the last manual Save remains separate. */
export async function persistCampaignRecovery(library, id, snapshot, previous) {
  const disk = campaignDiskSnapshot(snapshot), entries = [];
  const sameCampaign = previous?.id === id;
  for (const [layerId, layer] of Object.entries(disk.layers)) {
    if (!layer.data) continue;
    const original = snapshot.layers[layerId];
    const changed = !sameCampaign || previous.layers[layerId]?.data !== original.data ||
      (previous.dirtyLayers !== snapshot.dirtyLayers && snapshot.dirtyLayers.has(layerId));
    layer.pixelKey = recoveryPixelsKey(id, layerId);
    if (changed) entries.push([layer.pixelKey, layer.data]);
    delete layer.data;
  }
  const recoveryAt = Date.now();
  const { entry, index } = campaignIndexEntry(library, id, snapshot);
  entries.push([recoveryCampaignKey(id), { ...disk, storage: captureUndoStorage(), recoveryAt }], [CAMPAIGN_SAVE_INDEX, index]);
  await setStoredFiles(entries, { cache: key => !isCampaignPayload(key) });
  rememberCampaignEntry(library, entry);
  return { id, layers: Object.fromEntries(Object.entries(snapshot.layers).map(([key, layer]) => [key, { data: layer.data }])), dirtyLayers: snapshot.dirtyLayers, recoveryAt };
}

export async function readCampaignSnapshot(id) {
  if (!getFile(CAMPAIGN_SAVE_INDEX)?.campaigns?.some(c => c.id === id)) return null;
  const draft = await readStoredFile(recoveryCampaignKey(id));
  const snapshot = draft || await readStoredFile(savedCampaignKey(id));
  if (!snapshot) throw new Error('The saved campaign could not be found. No stored data has been cleared.');
  for (const layer of Object.values(snapshot.layers)) if (layer.pixelKey) {
    layer.data = await readStoredFile(layer.pixelKey);
    if (!layer.data) throw new Error('A saved map layer could not be restored. The saved campaign has been kept.');
  }
  return snapshot;
}