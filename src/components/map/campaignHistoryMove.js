import { restoreUndoLayers } from '@/components/map/campaignUndoLayers';
import { captureUndoStorage } from '@/components/map/campaignUndoStorage';

/** Exchange inverse patches instead of retaining two full copies of each action. */
export default async function campaignHistoryMove(state, entries) {
  const { layers: currentLayers, ...model } = state;
  const inverses = [], inverseLayers = [];
  let storage = captureUndoStorage();
  for (const entry of entries) {
    const before = Object.fromEntries(Object.keys(entry.before).map(key => [key, structuredClone(model[key])]));
    inverses.push({ ...entry, group: null, before, storage });
    Object.assign(model, structuredClone(entry.before));
    storage = entry.storage;
  }
  const layers = await restoreUndoLayers(currentLayers, entries, state.dirtyLayers, inverseLayers);
  inverses.forEach((entry, index) => { entry.layers = inverseLayers[index]; });
  return { restored: { ...model, layers, storage }, inverses };
}