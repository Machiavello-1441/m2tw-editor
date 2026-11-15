const reciprocal = relation => relation === 'at_war_with' || relation === 'allied_to';
const keyOf = (faction, relation) => JSON.stringify([faction, relation]);

/** Complete only missing war/alliance reverses, retaining grouped targets and row order. */
export default function synchronizeDiplomacyRelationships(relationships = []) {
  const result = relationships.map(row => ({ ...row, targets: [...(row.targets || [])] }));
  const groups = new Map();
  let changed = false;
  result.forEach((row, index) => {
    if (!reciprocal(row.relation)) return;
    const key = keyOf(row.faction, row.relation);
    if (!groups.has(key)) groups.set(key, { index, targets: new Set() });
    for (const target of row.targets) groups.get(key).targets.add(target);
  });
  for (const row of relationships) {
    if (!reciprocal(row.relation) || !row.faction) continue;
    for (const target of row.targets || []) {
      if (!target || target === row.faction) continue;
      const key = keyOf(target, row.relation);
      if (!groups.has(key)) {
        groups.set(key, { index: result.length, targets: new Set() });
        result.push({ faction: target, relation: row.relation, targets: [] });
      }
      const reverse = groups.get(key);
      if (reverse.targets.has(row.faction)) continue;
      result[reverse.index].targets.push(row.faction);
      reverse.targets.add(row.faction);
      changed = true;
    }
  }
  return changed ? result : relationships;
}

/** Editing/removing either direction also removes superseded reverse edges. */
export function editDiplomacyRelationship(relationships, index, replacement) {
  const previous = relationships[index];
  const removed = new Set(reciprocal(previous?.relation) ? (previous.targets || []).filter(target =>
    !replacement || previous.faction !== replacement.faction || previous.relation !== replacement.relation || !replacement.targets.includes(target)
  ) : []);
  const updated = relationships.flatMap((row, rowIndex) => {
    if (rowIndex === index) return replacement ? [replacement] : [];
    if (!removed.size || row.relation !== previous.relation) return [row];
    const targets = (row.targets || []).filter(target => !(
      (row.faction === previous.faction && removed.has(target)) ||
      (removed.has(row.faction) && target === previous.faction)
    ));
    if (targets.length === (row.targets || []).length) return [row];
    return targets.length ? [{ ...row, targets }] : [];
  });
  if (replacement && index === relationships.length) updated.push(replacement);
  return synchronizeDiplomacyRelationships(updated);
}