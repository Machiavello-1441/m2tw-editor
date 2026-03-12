import { SETTLEMENT_TYPES, MATERIALS, SETTLEMENT_LEVELS } from './EDBParser';

export function validateEDB(edbData) {
  if (!edbData) return [];
  const issues = [];
  const buildingNames = new Set(edbData.buildings.map(b => b.name));
  const seen = new Set();

  for (const building of edbData.buildings) {
    const bn = building.name;

    if (seen.has(bn)) {
      issues.push({ severity: 'error', building: bn, message: 'Duplicate building name' });
    }
    seen.add(bn);

    if (building.levels.length === 0) {
      issues.push({ severity: 'error', building: bn, message: 'No levels defined' });
      continue;
    }

    if (bn.startsWith('guild_') && building.levels.length > 3) {
      issues.push({ severity: 'warning', building: bn, message: `Guild has ${building.levels.length} levels (vanilla max is 3)` });
    }

    if (building.convertTo && !buildingNames.has(building.convertTo)) {
      issues.push({ severity: 'warning', building: bn, message: `convert_to "${building.convertTo}" not found in EDB` });
    }

    const levelNames = new Set(building.levels.map(l => l.name));

    for (const level of building.levels) {
      const ln = level.name;
      if (!SETTLEMENT_TYPES.includes(level.settlementType)) {
        issues.push({ severity: 'error', building: bn, level: ln, message: `Invalid settlement type: "${level.settlementType}"` });
      }
      if (!MATERIALS.includes(level.material)) {
        issues.push({ severity: 'warning', building: bn, level: ln, message: `Unknown material: "${level.material}"` });
      }
      if (!SETTLEMENT_LEVELS.includes(level.settlementMin)) {
        issues.push({ severity: 'warning', building: bn, level: ln, message: `Unknown settlement_min: "${level.settlementMin}"` });
      }
      for (const up of (level.upgrades || [])) {
        if (!levelNames.has(up)) {
          issues.push({ severity: 'error', building: bn, level: ln, message: `Upgrade "${up}" not found in this building` });
        }
      }
    }
  }

  return issues;
}