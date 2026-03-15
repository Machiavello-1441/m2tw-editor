// ModValidator.js — M2TW mod validation engine
// Returns: { errors: Issue[], warnings: Issue[] }
// Issue: { id, severity, category, title, detail, context? }

// ─── EDB Checks ─────────────────────────────────────────────────────────────

function checkDuplicateBuildingNames(buildings) {
  const issues = [];
  const seen = {};
  for (const b of buildings) {
    if (seen[b.name]) {
      issues.push({
        id: `dup_building_${b.name}`,
        severity: 'error',
        category: 'EDB',
        title: `Duplicate building name: "${b.name}"`,
        detail: 'Two buildings share the same identifier. M2TW will only load the first and silently ignore the second.',
      });
    }
    seen[b.name] = true;
  }
  return issues;
}

function checkDuplicateLevelNames(buildings) {
  const issues = [];
  const globalSeen = {};
  for (const b of buildings) {
    const localSeen = {};
    for (const l of b.levels) {
      if (localSeen[l.name]) {
        issues.push({
          id: `dup_level_${b.name}_${l.name}`,
          severity: 'error',
          category: 'EDB',
          title: `Duplicate level name "${l.name}" in building "${b.name}"`,
          detail: 'Duplicate level names within the same building cause parsing errors.',
        });
      }
      localSeen[l.name] = true;
      if (globalSeen[l.name] && globalSeen[l.name] !== b.name) {
        issues.push({
          id: `global_dup_level_${l.name}_${b.name}`,
          severity: 'warning',
          category: 'EDB',
          title: `Level name "${l.name}" used in multiple buildings`,
          detail: `Found in "${globalSeen[l.name]}" and "${b.name}". This can confuse building_present_min_level requirements.`,
        });
      }
      if (!globalSeen[l.name]) globalSeen[l.name] = b.name;
    }
  }
  return issues;
}

function checkEmptyBuildings(buildings) {
  return buildings
    .filter(b => b.levels.length === 0)
    .map(b => ({
      id: `empty_building_${b.name}`,
      severity: 'error',
      category: 'EDB',
      title: `Building "${b.name}" has no levels`,
      detail: 'A building with zero levels will cause a CTD when M2TW attempts to read the tech tree.',
    }));
}

function checkUnreachableLevels(buildings) {
  const issues = [];
  // Collect all level names across the mod
  const allLevelNames = new Set();
  for (const b of buildings) for (const l of b.levels) allLevelNames.add(l.name);

  for (const b of buildings) {
    for (let i = 1; i < b.levels.length; i++) {
      const level = b.levels[i];
      const prev = b.levels[i - 1];
      // Check if the previous level lists this level as an upgrade
      if (!prev.upgrades.includes(level.name)) {
        issues.push({
          id: `unreachable_${b.name}_${level.name}`,
          severity: 'error',
          category: 'EDB',
          title: `Level "${level.name}" is unreachable in building "${b.name}"`,
          detail: `"${prev.name}" does not list "${level.name}" in its upgrades block. Players can never build this tier.`,
          context: { building: b.name, level: level.name },
        });
      }
    }
  }
  return issues;
}

function checkBrokenUpgradeRefs(buildings) {
  const issues = [];
  const allLevelNames = new Set();
  for (const b of buildings) for (const l of b.levels) allLevelNames.add(l.name);

  for (const b of buildings) {
    for (const l of b.levels) {
      for (const up of (l.upgrades || [])) {
        const upName = typeof up === 'object' ? up?.name : up;
        if (!allLevelNames.has(upName)) {
          issues.push({
            id: `broken_upgrade_${b.name}_${l.name}_${upName}`,
            severity: 'error',
            category: 'EDB',
            title: `Broken upgrade reference "${upName}" in "${b.name} → ${l.name}"`,
            detail: `Level "${l.name}" lists "${upName}" as an upgrade but no level with that name exists anywhere in the EDB.`,
            context: { building: b.name, level: l.name },
          });
        }
      }
    }
  }
  return issues;
}

function checkBrokenConvertTo(buildings) {
  const issues = [];
  const allBuildingNames = new Set(buildings.map(b => b.name));

  for (const b of buildings) {
    if (b.convertTo && !allBuildingNames.has(b.convertTo)) {
      issues.push({
        id: `bad_convert_building_${b.name}`,
        severity: 'error',
        category: 'EDB',
        title: `Building "${b.name}" converts to unknown building "${b.convertTo}"`,
        detail: `convert_to references a building that does not exist in the EDB.`,
      });
    }
    for (const l of b.levels) {
      if (l.convertTo && !allBuildingNames.has(l.convertTo)) {
        issues.push({
          id: `bad_convert_level_${b.name}_${l.name}`,
          severity: 'error',
          category: 'EDB',
          title: `Level "${l.name}" in "${b.name}" converts to unknown building "${l.convertTo}"`,
          detail: `convert_to references a building that does not exist in the EDB.`,
        });
      }
    }
  }
  return issues;
}

function checkBuildingPresentRefs(buildings) {
  const issues = [];
  const allLevelNames = new Set();
  for (const b of buildings) for (const l of b.levels) allLevelNames.add(l.name);

  for (const b of buildings) {
    for (const l of b.levels) {
      for (const req of l.requirements || []) {
        if (req.type === 'building_present_min_level') {
          if (!allLevelNames.has(req.level)) {
            issues.push({
              id: `bad_bpml_${b.name}_${l.name}_${req.level}`,
              severity: 'error',
              category: 'EDB',
              title: `Unknown level "${req.level}" in building_present_min_level requirement`,
              detail: `In "${b.name} → ${l.name}": requires building_present_min_level ${req.building} ${req.level} — but "${req.level}" doesn't exist.`,
              context: { building: b.name, level: l.name },
            });
          }
        }
      }
    }
  }
  return issues;
}

function checkZeroCostLevels(buildings) {
  return buildings.flatMap(b =>
    b.levels
      .filter(l => l.cost === 0)
      .map(l => ({
        id: `zero_cost_${b.name}_${l.name}`,
        severity: 'warning',
        category: 'EDB',
        title: `Level "${l.name}" in "${b.name}" has cost 0`,
        detail: 'A zero-cost building can be placed for free by any faction, which is usually unintentional.',
        context: { building: b.name, level: l.name },
      }))
  );
}

function checkZeroConstructionTime(buildings) {
  return buildings.flatMap(b =>
    b.levels
      .filter(l => l.construction === 0)
      .map(l => ({
        id: `zero_construction_${b.name}_${l.name}`,
        severity: 'warning',
        category: 'EDB',
        title: `Level "${l.name}" in "${b.name}" has construction time 0`,
        detail: 'Zero construction time means the building appears instantly, which may be intentional (cheat) or a data error.',
        context: { building: b.name, level: l.name },
      }))
  );
}

function checkMissingFactionRequirements(buildings) {
  const issues = [];
  for (const b of buildings) {
    for (const l of b.levels) {
      const hasFaction = (l.requirements || []).some(r => r.type === 'factions');
      if (!hasFaction) {
        issues.push({
          id: `no_faction_req_${b.name}_${l.name}`,
          severity: 'warning',
          category: 'EDB',
          title: `Level "${l.name}" in "${b.name}" has no faction restriction`,
          detail: 'Without a factions requirement, all factions can build this level. This is sometimes intentional but often an oversight.',
          context: { building: b.name, level: l.name },
        });
      }
    }
  }
  return issues;
}

// ─── Main entry point ────────────────────────────────────────────────────────

export function validateMod(edbData) {
  const errors = [];
  const warnings = [];

  if (edbData) {
    const { buildings } = edbData;
    const allIssues = [
      ...checkDuplicateBuildingNames(buildings),
      ...checkDuplicateLevelNames(buildings),
      ...checkEmptyBuildings(buildings),
      ...checkUnreachableLevels(buildings),
      ...checkBrokenUpgradeRefs(buildings),
      ...checkBrokenConvertTo(buildings),
      ...checkBuildingPresentRefs(buildings),
      ...checkZeroCostLevels(buildings),
      ...checkZeroConstructionTime(buildings),
      ...checkMissingFactionRequirements(buildings),
    ];
    for (const issue of allIssues) {
      if (issue.severity === 'error') errors.push(issue);
      else warnings.push(issue);
    }
  }

  return { errors, warnings };
}