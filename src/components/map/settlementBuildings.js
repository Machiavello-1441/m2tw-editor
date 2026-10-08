import { SETTLEMENT_LEVELS } from '@/components/map/stratParser';
import { extractBuildingLevelsFromEDB } from '@/components/map/additionalParsers';

const CITY_CORES = ['wooden_pallisade', 'wooden_wall', 'stone_wall', 'large_stone_wall', 'huge_stone_wall'];
const CASTLE_CORES = ['motte_and_bailey', 'wooden_castle', 'castle', 'fortress', 'citadel'];
export function settlementLevelLabel(level, castle) {
  const index = SETTLEMENT_LEVELS.indexOf(level);
  return castle && index > 0 ? `${CASTLE_CORES[index - 1].replaceAll('_', ' ')} (${level})` : level.replaceAll('_', ' ');
}
export function buildingAllowed(building, settlement, ignoreTier = false) {
  const type = settlement.castle ? 'castle' : 'city';
  if (building.settlementType && building.settlementType !== type) return false;
  if (building.building === (settlement.castle ? 'core_building' : 'core_castle_building')) return false;
  return ignoreTier || SETTLEMENT_LEVELS.indexOf(building.settlementMin) <= SETTLEMENT_LEVELS.indexOf(settlement.level || 'village');
}
export function availableSettlementBuildings(edbData, settlement, ignoreTier = false) {
  return extractBuildingLevelsFromEDB(edbData).filter(b => buildingAllowed(b, settlement, ignoreTier));
}
export function replaceSettlementBuilding(buildings, value) {
  const tree = value.split(/\s+/)[0];
  return [...(buildings || []).filter(b => b.split(/\s+/)[0] !== tree), value];
}
export function normalizeSettlement(settlement, edbData, prune = false) {
  const next = { ...settlement, castle: !!settlement.castle, level: settlement.level || 'village' };
  const all = extractBuildingLevelsFromEDB(edbData);
  let buildings = (next.buildings || []).filter(value => {
    const [tree, name] = value.split(/\s+/);
    if (tree === 'core_building' || tree === 'core_castle_building') return false;
    const definition = all.find(b => b.building === tree && b.name === name);
    return !definition || buildingAllowed(definition, next, !prune);
  });
  const tier = SETTLEMENT_LEVELS.indexOf(next.level);
  if (tier > 0) {
    const tree = next.castle ? 'core_castle_building' : 'core_building';
    const candidates = all.filter(b => b.building === tree && buildingAllowed(b, next));
    candidates.sort((a, b) => SETTLEMENT_LEVELS.indexOf(b.settlementMin) - SETTLEMENT_LEVELS.indexOf(a.settlementMin));
    const core = candidates[0]?.name || (!all.length ? (next.castle ? CASTLE_CORES : CITY_CORES)[tier - 1] : null);
    if (!core) throw new Error(`No ${tree} is available for ${next.level} in the loaded EDB.`);
    buildings = [`${tree} ${core}`, ...buildings];
  }
  return { ...next, buildings };
}