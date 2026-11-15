import { findFactionBlocks } from '@/components/map/factionBlockOps';

const isDiplomacy = line => /^(faction_standings|faction_relationships|action_relationships)\b/i.test(line.replace(/;.*$/, '').trim());

/** Write relationships independently of standings, including M2EX protectorates. */
export default function patchStratDiplomacy(lines, stratData) {
  if (!Array.isArray(stratData.factionStandings) && !Array.isArray(stratData.factionRelationships)) return;
  const updated = (stratData.factionStandings || []).map(standing => {
    const value = standing.valueStr ?? String(standing.value);
    return `faction_standings\t${standing.faction},\t\t${value}\t${standing.targets.join(', ')}`;
  });
  for (const relationship of (stratData.factionRelationships || [])) {
    updated.push(`faction_relationships \t${relationship.faction}, ${relationship.relation}\t${relationship.targets.join(', ')}`);
  }
  const existing = [];
  lines.forEach((line, index) => { if (isDiplomacy(line)) existing.push(index); });
  if (existing.length) {
    // Remove only the statements, preserving comments and surrounding sections.
    for (let i = existing.length - 1; i >= 0; i--) lines.splice(existing[i], 1);
    lines.splice(existing[0], 0, ...updated);
    return;
  }
  if (!updated.length) return;
  const blocks = findFactionBlocks(lines);
  const scriptIndex = lines.findIndex(line => /^script\s*$/i.test(line.replace(/;.*$/, '').trim()));
  const insertIndex = blocks[blocks.length - 1]?.end ?? (scriptIndex < 0 ? lines.length : scriptIndex);
  lines.splice(insertIndex, 0, '', ...updated, '');
}