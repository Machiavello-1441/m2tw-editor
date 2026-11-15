import clientStateRules from '@/components/map/clientStateRules';

/** Logical checks only: inspecting relations never changes campaign state. */
export default function diplomacyRelationRules(relationships = []) {
  const issues = clientStateRules(relationships).map(issue => ({ ...issue, id: `client-${issue.id}` }));
  const protectorates = new Map(), subjects = new Map();
  for (const row of relationships) {
    if (!row.faction || !['client_of', 'protectorate_of'].includes(row.relation)) continue;
    if (!subjects.has(row.faction)) subjects.set(row.faction, new Set());
    if (row.relation === 'protectorate_of' && !protectorates.has(row.faction)) protectorates.set(row.faction, new Set());
    for (const target of row.targets || []) {
      if (!target) continue;
      if (row.relation === 'protectorate_of') protectorates.get(row.faction).add(target);
      // Direct self-relations receive their own, more specific diagnostic.
      if (target !== row.faction) subjects.get(row.faction).add(target);
    }
  }
  for (const [faction, overlords] of protectorates) {
    if (overlords.size > 1) issues.push({
      id: JSON.stringify(['protectorate-overlords', faction]),
      message: `${faction} has multiple overlords (${[...overlords].sort().join(', ')}). A protectorate can have only one.`,
    });
  }
  const visited = new Set(), active = new Map(), path = [], reported = new Set();
  const visit = faction => {
    if (active.has(faction)) {
      const cycle = path.slice(active.get(faction));
      const id = JSON.stringify(['subject-cycle', ...cycle.slice().sort()]);
      if (!reported.has(id)) {
        reported.add(id);
        issues.push({ id, message: `Subject relationship cycle: ${[...cycle, faction].join(' → ')}. A faction cannot be its own overlord, directly or indirectly.` });
      }
      return;
    }
    if (visited.has(faction)) return;
    visited.add(faction);
    active.set(faction, path.length);
    path.push(faction);
    for (const target of subjects.get(faction) || []) visit(target);
    path.pop();
    active.delete(faction);
  };
  for (const faction of subjects.keys()) visit(faction);
  return issues;
}