import diplomacyRelationRules from '@/components/map/diplomacyRelationRules';

const keyOf = (...parts) => JSON.stringify(parts);
const pairKey = (a, b) => keyOf(...[a, b].sort());

/** Read-only diagnostics across both tabs, independent of the current search. */
export default function validateCampaignDiplomacy({ standings = [], relationships = [], factionNames = [], metadata = {} }) {
  const issues = new Map(), known = new Set(factionNames), standingPairs = new Map(), relationPairs = new Set(), states = new Map();
  const add = (id, severity, message) => {
    if (!issues.has(id) || (severity === 'error' && issues.get(id).severity !== 'error')) issues.set(id, { id, severity, message });
  };
  const checkRow = (row, kind, index) => {
    const label = `${kind} row ${index + 1}`;
    if (!row.faction) add(`${kind}-source-${index}`, 'error', `${label}: select a source faction.`);
    else if (!known.has(row.faction)) add(`unknown-${row.faction}`, 'warning', `${row.faction} is not declared in this campaign.`);
    if (!row.targets?.length) add(`${kind}-targets-${index}`, 'error', `${label}: select at least one target faction.`);
    for (const target of row.targets || []) {
      if (!target) add(`${kind}-blank-${index}`, 'error', `${label}: a target faction is empty.`);
      else if (!known.has(target)) add(`unknown-${target}`, 'warning', `${target} is not declared in this campaign.`);
      if (target && target === row.faction && row.relation !== 'client_of') {
        const problem = { at_war_with: 'cannot be at war with itself', allied_to: 'cannot be allied to itself', protectorate_of: 'cannot be its own overlord' }[row.relation] || 'cannot target itself';
        add(`${kind}-self-${index}`, 'error', `${label}: ${target} ${problem}.`);
      }
    }
  };
  standings.forEach((row, index) => {
    checkRow(row, 'Standing', index);
    const value = row.value === '' || row.value == null ? NaN : Number(row.value);
    if (!Number.isFinite(value) || value < -1 || value > 1) add(`standing-range-${index}`, 'error', `Standing row ${index + 1}: the value must be between −1 and +1.`);
    for (const target of row.targets || []) {
      const key = keyOf(row.faction, target);
      if (standingPairs.has(key)) {
        const conflict = standingPairs.get(key) !== value;
        add(`standing-duplicate-${key}`, conflict ? 'error' : 'warning', `${row.faction} → ${target}: ${conflict ? 'conflicting' : 'duplicate'} standing entries.`);
      }
      standingPairs.set(key, value);
    }
  });
  relationships.forEach((row, index) => {
    checkRow(row, 'Relationship', index);
    if (!row.relation) add(`relation-empty-${index}`, 'error', `Relationship row ${index + 1}: select a relationship type.`);
    for (const target of row.targets || []) {
      const directed = keyOf(row.faction, row.relation, target);
      if (relationPairs.has(directed)) add(`relation-duplicate-${directed}`, 'warning', `${row.faction} → ${target}: duplicate ${row.relation} declaration.`);
      relationPairs.add(directed);
      if (!['allied_to', 'at_war_with'].includes(row.relation)) continue;
      const pair = pairKey(row.faction, target);
      if (!states.has(pair)) states.set(pair, { names: [row.faction, target], types: new Set() });
      states.get(pair).types.add(row.relation);
    }
  });
  for (const [key, state] of states) {
    if (state.types.size > 1) add(`war-alliance-${key}`, 'error', `${state.names.join(' and ')} are declared both allied and at war.`);
  }
  for (const row of relationships) {
    for (const target of row.targets || []) {
      if (['allied_to', 'at_war_with'].includes(row.relation) && !relationPairs.has(keyOf(target, row.relation, row.faction))) {
        add(`reverse-${keyOf(row.faction, row.relation, target)}`, 'warning', `${row.faction} → ${target}: missing reverse ${row.relation} declaration.`);
      }
      if (['client_of', 'protectorate_of'].includes(row.relation) && states.get(pairKey(row.faction, target))?.types.has('at_war_with')) {
        add(`overlord-war-${keyOf(row.faction, target)}`, 'error', `${row.faction} is ${row.relation} ${target}, but the two factions are also at war.`);
      }
    }
  }
  for (const issue of diplomacyRelationRules(relationships)) add(issue.id, 'error', issue.message);
  for (const name of known) {
    const missing = ['religion', 'culture'].filter(field => !metadata[name]?.[field]);
    if (missing.length) add(`metadata-${name}`, 'warning', `${name}: missing ${missing.join(' and ')}; those standings modifiers will be skipped.`);
  }
  return [...issues.values()].sort((a, b) => (a.severity === 'error' ? 0 : 1) - (b.severity === 'error' ? 0 : 1));
}