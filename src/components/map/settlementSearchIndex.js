const normalize = value => String(value ?? '').trim().toLowerCase();
const EMPTY = Object.freeze([]);
const append = (map, key, id) => {
  const posting = map.get(key);
  if (posting) posting.push(id); else map.set(key, [id]);
};

/** Build once per campaign-data revision. Postings contain sorted numeric row IDs. */
export default function settlementSearchIndex(items, regionsByName = new Map(), names = {}) {
  const index = { items, entries: [], grams: new Map(), factions: new Map(), resources: new Map(), capitals: new Map(), byId: new Map() };
  items.forEach((item, id) => {
    const region = regionsByName.get(item.region);
    const texts = [...new Set([
      item.region, item.faction, region?.settlementName,
      names?.[item.region], names?.[region?.settlementName], names?.[item.faction],
    ].filter(Boolean).map(normalize))];
    const resources = new Set(region?.resources || []);
    index.entries.push({ item, texts, faction: item.faction, resources });
    index.byId.set(item.id, item);
    if (!index.capitals.has(item.faction)) index.capitals.set(item.faction, item.id);
    append(index.factions, item.faction, id);
    resources.forEach(resource => append(index.resources, resource, id));
    const grams = new Set();
    for (const text of texts) {
      for (let size = 1; size <= 3; size++) {
        for (let offset = 0; offset <= text.length - size; offset++) grams.add(text.slice(offset, offset + size));
      }
    }
    grams.forEach(gram => append(index.grams, gram, id));
  });
  return index;
}

/** Start at the narrowest posting, never scan every settlement for a location lookup. */
export function searchSettlements(index, { search = '', faction = '', resource = '' } = {}) {
  const text = normalize(search);
  if (!text && !faction && !resource) return index.items;
  let candidates = null;
  const narrow = posting => {
    if (!posting) return false;
    if (!candidates || posting.length < candidates.length) candidates = posting;
    return true;
  };
  if (faction && !narrow(index.factions.get(faction))) return EMPTY;
  if (resource && !narrow(index.resources.get(resource))) return EMPTY;
  if (text) {
    const size = Math.min(3, text.length), visited = new Set();
    for (let offset = 0; offset <= text.length - size; offset++) {
      const gram = text.slice(offset, offset + size);
      if (visited.has(gram)) continue;
      visited.add(gram);
      if (!narrow(index.grams.get(gram))) return EMPTY;
    }
  }
  const matches = [];
  for (const id of candidates || EMPTY) {
    const entry = index.entries[id];
    if (faction && entry.faction !== faction || resource && !entry.resources.has(resource)) continue;
    // Verify the complete substring in one field; grams can occur out of order or in different aliases.
    if (text && !entry.texts.some(value => value.includes(text))) continue;
    matches.push(entry.item);
  }
  return matches;
}

export function groupSettlementMatches(items) {
  const groups = new Map();
  for (const item of items) {
    if (!groups.has(item.faction)) groups.set(item.faction, []);
    groups.get(item.faction).push(item);
  }
  return [...groups].sort(([a], [b]) => String(a).localeCompare(String(b)));
}