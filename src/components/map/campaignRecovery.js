import { workspaceSetting } from '@/components/workspace/workspaceStorage';

let recoveredMod = '';
const cleanLayers = layers => Object.fromEntries(Object.entries(layers || {}).map(([id, layer]) => [id, {
  data: layer.data, width: layer.width, height: layer.height, visible: layer.visible, opacity: layer.opacity,
}]));
export async function readCampaignRecovery(modName) {
  const key = modName ? `campaign-recovery:${modName}` : await workspaceSetting('campaign-recovery-latest');
  if (!key) return null;
  const record = await workspaceSetting(key);
  if (record) recoveredMod = record.modName;
  return record || null;
}
export async function writeCampaignRecovery(snapshot, storage, modName, active) {
  const owner = modName || recoveredMod || 'Manual campaign';
  const record = { version: 1, modName: owner, active, savedAt: Date.now(), storage,
    snapshot: { ...snapshot, layers: cleanLayers(snapshot.layers) } };
  const key = `campaign-recovery:${owner}`;
  await workspaceSetting(key, record);
  await workspaceSetting('campaign-recovery-latest', key);
  return record.savedAt;
}
export async function rebuildRecoveryLayers(snapshot) {
  const layers = Object.fromEntries(await Promise.all(Object.entries(snapshot.layers || {}).map(async ([id, layer]) => {
    if (!layer.data) return [id, layer];
    const data = new Uint8ClampedArray(layer.data);
    const bitmap = await createImageBitmap(new ImageData(data, layer.width, layer.height));
    return [id, { ...layer, data, bitmap }];
  })));
  return { ...snapshot, layers };
}
export function campaignStorageChanged(current, previous) {
  if (!previous) return true;
  return ['session', 'local'].some(group => Object.entries(current[group]).some(([key, value]) => value !== previous[group]?.[key]));
}