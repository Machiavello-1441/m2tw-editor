import { populationSettlementLevel } from '@/components/map/settlementMechanics';
import { normalizeSettlement } from '@/components/map/settlementBuildings';

export const settlementValidationKey = settlement => JSON.stringify([settlement.id, settlement.region, settlement.faction]);
export const settlementCoreBuildings = buildings => (buildings || []).filter(value => /^(core_building|core_castle_building)\s/.test(value.trim()));

export function inspectSettlement(settlement, mechanics, edbData, hasEDB) {
  const report = { settlement, key: settlementValidationKey(settlement), currentCore: settlementCoreBuildings(settlement.buildings) };
  if (settlement.population == null || settlement.population === '' || !Number.isInteger(Number(settlement.population)) || Number(settlement.population) < 0) return { ...report, error: 'Population must be a non-negative whole number.' };
  const expectedLevel = populationSettlementLevel(settlement.population, settlement.castle, mechanics);
  if (!expectedLevel) return { ...report, waiting: 'Load settlement mechanics XML.' };
  if (!hasEDB) return { ...report, expectedLevel, waiting: 'Load EDB to verify the required core building.' };
  try {
    const normalized = normalizeSettlement({ ...settlement, level: expectedLevel }, edbData);
    const expectedCore = settlementCoreBuildings(normalized.buildings);
    // Validation corrects only levels and core buildings; unrelated buildings stay untouched.
    const buildings = [...expectedCore, ...(settlement.buildings || []).filter(value => !/^(core_building|core_castle_building)\s/.test(value.trim()))];
    const coreChanged = JSON.stringify(report.currentCore) !== JSON.stringify(expectedCore);
    const changed = settlement.level !== expectedLevel || coreChanged;
    return { ...report, expectedLevel, expectedCore, changed, edits: { level: expectedLevel, buildings: coreChanged ? buildings : settlement.buildings || [] } };
  } catch (error) {
    return { ...report, expectedLevel, error: error.message };
  }
}