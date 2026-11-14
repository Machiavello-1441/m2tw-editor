/** Match the settlement editor: a faction's first settlement is its capital. */
export default function autoVictoryConditions({ winConditions, factionNames = [], settlements = [], longMultiplier = 5, shortMultiplier = 3 }) {
  const ownership = new Map();
  for (const settlement of settlements) {
    if (!settlement.faction) continue;
    const owned = ownership.get(settlement.faction);
    if (owned) owned.count++;
    else ownership.set(settlement.faction, { count: 1, capital: settlement.region });
  }
  const updated = { ...winConditions };
  const factions = new Set([...factionNames, ...Object.keys(updated), ...ownership.keys()]);
  for (const faction of factions) {
    const current = updated[faction] || {};
    const { count = 0, capital } = ownership.get(faction) || {};
    updated[faction] = {
      ...current,
      takeRegions: count * longMultiplier,
      holdRegions: capital ? [capital] : [],
      outlive: current.outlive || [],
      short: {
        ...current.short,
        takeRegions: count * shortMultiplier,
        holdRegions: capital ? [capital] : [],
        outlive: current.short?.outlive || [],
      },
    };
  }
  return updated;
}