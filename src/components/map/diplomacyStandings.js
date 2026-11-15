const pairKey = (first, second) => JSON.stringify([first, second].sort());
const directedKey = (first, second) => JSON.stringify([first, second]);
export const clampStanding = value => Math.max(-1, Math.min(1, Number(value)));

/** All declared, ordered faction pairs; absent attributes contribute zero, not a match. */
export default function diplomacyStandings({ factionNames, standings = [], relationships = [], metadata = {}, mode = 'recalculate' }) {
  const names = [...new Set(factionNames.filter(Boolean))];
  const known = new Set(names), previous = new Map(), states = new Map();
  const preserved = [];
  for (const row of standings) {
    for (const target of row.targets || []) previous.set(directedKey(row.faction, target), Number(row.value));
    const targets = (row.targets || []).filter(target => !known.has(row.faction) || !known.has(target) || target === row.faction);
    if (targets.length || !row.targets?.length) preserved.push({ ...row, targets });
  }
  for (const row of relationships) {
    if (!['allied_to', 'at_war_with'].includes(row.relation)) continue;
    for (const target of row.targets || []) {
      const key = pairKey(row.faction, target);
      if (!states.has(key)) states.set(key, new Set());
      states.get(key).add(row.relation);
    }
  }
  const result = [];
  for (const faction of names) {
    const groups = new Map(), source = metadata[faction] || {};
    for (const target of names) {
      if (target === faction) continue;
      const destination = metadata[target] || {};
      let points = 0;
      if (source.religion && destination.religion) points += source.religion === destination.religion ? 15 : -15;
      if (source.culture && destination.culture) points += source.culture === destination.culture ? 10 : -10;
      const relations = states.get(pairKey(faction, target));
      if (relations?.has('allied_to')) points += 20;
      if (relations?.has('at_war_with')) points -= 50;
      const existing = previous.get(directedKey(faction, target));
      const base = mode === 'add' && Number.isFinite(existing) ? existing : 0;
      const value = clampStanding(Number((base + points / 100).toFixed(10)));
      if (!groups.has(value)) groups.set(value, []);
      groups.get(value).push(target);
    }
    for (const [value, targets] of groups) result.push({ faction, value, valueStr: String(value), targets });
  }
  return [...result, ...preserved];
}