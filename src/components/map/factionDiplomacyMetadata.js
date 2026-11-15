/** Read faction attributes from the same shared definitions used by the faction editor. */
export default function factionDiplomacyMetadata(text = '') {
  const factions = {};
  let current = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/;.*$/, '').trim();
    const faction = line.match(/^faction\s+([^,\s]+)/i);
    if (faction) { current = factions[faction[1]] = {}; continue; }
    const field = line.match(/^(religion|culture)\s+(\S+)/i);
    if (current && field) current[field[1].toLowerCase()] = field[2];
  }
  return factions;
}