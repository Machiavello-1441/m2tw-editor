import { parseDescrStrat, serializeDescrStrat, serializeDescrRegions, computeSettlementPositions } from '@/components/map/stratParser';
import { captureCampaignStorage } from '@/components/map/campaignSession';
import { namesToText } from '@/components/map/settlementNamesIO';

export default function campaignCheckpoint({ layers, stratData, regionsData, settlementNames, overlayItems, editedSettlements, religionList }) {
  const layerSnap = Object.fromEntries(Object.entries(layers).map(([id, layer]) => [id, {
    visible: layer.visible, opacity: layer.opacity, width: layer.width, height: layer.height,
    ...(layer.data ? { data: new Uint8ClampedArray(layer.data) } : {}),
  }]));
  let savedStrat = stratData, savedItems = overlayItems;
  if (stratData?.raw) {
    const raw = serializeDescrStrat({ ...stratData, _regionsLookup: regionsData, _regionsLayer: layerSnap.regions }, overlayItems, editedSettlements);
    const parsed = parseDescrStrat(raw);
    const owners = new Map(parsed.items.filter(i => i.category === 'settlement').map(i => [i.region, i.faction]));
    for (const item of overlayItems.filter(i => i.category === 'settlement')) {
      const expected = { ...item, ...editedSettlements[item.id] };
      if (owners.get(expected.region) !== expected.faction) throw new Error(`Ownership for ${expected.region} could not be saved. Your edits have been kept.`);
    }
    const positions = new Map(computeSettlementPositions(parsed.items.filter(i => i.category === 'settlement'), regionsData, layerSnap.regions).map(i => [i.id, i]));
    savedItems = parsed.items.map(i => positions.get(i.id) || i);
    savedStrat = { ...parsed, items: savedItems };
  }
  const storage = captureCampaignStorage();
  if (savedStrat?.raw) {
    storage.session.m2tw_strat_raw = savedStrat.raw;
    storage.local.m2tw_campaign_strat = savedStrat.raw;
  }
  if (regionsData) {
    storage.session.m2tw_regions_raw = serializeDescrRegions(regionsData, religionList);
    storage.session.m2tw_regions_data_json = JSON.stringify(regionsData);
  }
  if (settlementNames) storage.session.m2tw_names_raw = namesToText(settlementNames);
  storage.session.m2tw_overlay_items_json = JSON.stringify(savedItems);
  const savedSnapshot = {
    layers: Object.fromEntries(Object.entries(layerSnap).filter(([, layer]) => layer.data)),
    overlayItems: structuredClone(savedItems), stratRaw: savedStrat?.raw || null,
    regionsData: structuredClone(regionsData), settlementNames: structuredClone(settlementNames), storage,
  };
  return { layers: layerSnap, stratData: savedStrat, overlayItems: savedItems, editedSettlements: {}, dirtyLayers: new Set(), overlayDirty: false, storage, savedSnapshot };
}