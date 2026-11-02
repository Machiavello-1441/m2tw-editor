import { LAYER_DEFS } from '@/components/map/mapLayerConstants';
import { parseDescrStrat } from '@/components/map/stratParser';
import { reviveCampaignSnapshot } from '@/components/map/campaignSavePersistence';

export default async function restoreCampaignCheckpoint(snapshot) {
  const defaults = Object.fromEntries(LAYER_DEFS.map(layer => [layer.id, {
    visible: layer.defaultVisible, opacity: layer.defaultOpacity,
  }]));
  // Rebuild everything before changing the editor; saved pixel buffers stay immutable.
  const { layers } = await reviveCampaignSnapshot({ layers: { ...defaults, ...snapshot.layers } });
  const overlayItems = structuredClone(snapshot.overlayItems);
  const stratData = snapshot.stratRaw
    ? { ...parseDescrStrat(snapshot.stratRaw), items: overlayItems }
    : null;
  return {
    layers, overlayItems, stratData,
    regionsData: structuredClone(snapshot.regionsData ?? null),
    settlementNames: structuredClone(snapshot.settlementNames ?? null),
  };
}