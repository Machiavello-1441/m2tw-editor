/**
 * Additional M2TW file parsers for Campaign Map region editing
 */

// descr_rebel_factions.txt → array of faction name strings
// Supports rebel_type (correct M2TW keyword), rebel_faction and faction (legacy)
export function parseDescrRebelFactions(text) {
  const factions = [];
  for (const raw of text.split('\n')) {
    const line = raw.replace(/;.*$/, '').trim();
    const m = line.match(/^rebel_type\s+(\S+)/i) || line.match(/^rebel_faction\s+(\S+)/i) || line.match(/^faction\s+(\S+)/i);
    if (m) factions.push(m[1]);
  }
  return [...new Set(factions)];
}

// descr_religions.txt → array of religion name strings
export function parseDescrReligions(text) {
  const religions = [];
  for (const raw of text.split('\n')) {
    const line = raw.replace(/;.*$/, '').trim();
    const m = line.match(/^religion\s+(\S+)/i);
    if (m) religions.push(m[1]);
  }
  return [...new Set(religions)];
}

// descr_sm_resources.txt → array of resource name strings
export function parseDescrSmResources(text) {
  const resources = [];
  for (const raw of text.split('\n')) {
    const line = raw.replace(/;.*$/, '').trim();
    const m = line.match(/^resource\s+(\S+)/i);
    if (m) resources.push(m[1]);
  }
  return [...new Set(resources)];
}

// descr_mercenaries.txt → array of pool name strings
export function parseDescrMercenaries(text) {
  const pools = [];
  for (const raw of text.split('\n')) {
    const line = raw.replace(/;.*$/, '').trim();
    const m = line.match(/^mercenary_pool\s+(\S+)/i) || line.match(/^pool\s+(\S+)/i);
    if (m) pools.push(m[1]);
  }
  return [...new Set(pools)];
}

// descr_cultures.txt → array of culture name strings
export function parseDescrCultures(text) {
  const cultures = [];
  for (const raw of text.split('\n')) {
    const line = raw.replace(/;.*$/, '').trim();
    const m = line.match(/^culture\s+(\S+)/i);
    if (m) cultures.push(m[1]);
  }
  return [...new Set(cultures)];
}

// descr_names.txt → { male: { factionName: [names] }, female: { factionName: [names] }, _surnames: { factionName: [names] } }
// M2TW format:
//   faction <name>
//     characters  (male first names)
//       Name1
//       Name2
//     surnames
//       Surname1
//     women       (female first names)
//       Name1
//     end
export function parseDescrNames(text) {
  const result = { male: {}, female: {}, _surnames: {} };
  let currentFaction = null;
  let currentSection = null; // 'male', 'female', 'surname'
  for (const raw of text.split('\n')) {
    const line = raw.replace(/;.*$/, '').trim();
    if (!line) continue;
    // "faction <name>" — starts a new faction block
    const fm = line.match(/^faction:?\s+(\S+)/i);
    if (fm) { currentFaction = fm[1].toLowerCase(); currentSection = null; continue; }
    if (!currentFaction) continue;
    // Section headers
    if (/^characters$/i.test(line) || /^male$/i.test(line)) { currentSection = 'male'; continue; }
    if (/^women$/i.test(line) || /^females?$/i.test(line) || /^female$/i.test(line)) { currentSection = 'female'; continue; }
    if (/^surnames?$/i.test(line)) { currentSection = 'surname'; continue; }
    if (/^end$/i.test(line)) { currentFaction = null; currentSection = null; continue; }
    // Name entries (single word, no spaces)
    if (currentSection && /^\S+$/.test(line)) {
      if (currentSection === 'surname') {
        if (!result._surnames[currentFaction]) result._surnames[currentFaction] = [];
        result._surnames[currentFaction].push(line);
      } else {
        if (!result[currentSection][currentFaction]) result[currentSection][currentFaction] = [];
        result[currentSection][currentFaction].push(line);
      }
    }
  }
  return result;
}

// export_descr_character_traits.txt → sorted array of trait names
export function parseExportDescrTraits(text) {
  const traits = new Set();
  for (const raw of text.split('\n')) {
    const line = raw.replace(/;.*$/, '').trim();
    const m = line.match(/^Trait\s+(\S+)/i);
    if (m) traits.add(m[1]);
  }
  return [...traits].sort();
}

// export_descr_ancillaries.txt → sorted array of ancillary names
export function parseExportDescrAncillaries(text) {
  const ancs = new Set();
  for (const raw of text.split('\n')) {
    const line = raw.replace(/;.*$/, '').trim();
    const m = line.match(/^Ancillary\s+(\S+)/i);
    if (m) ancs.add(m[1]);
  }
  return [...ancs].sort();
}

// descr_sounds_music_types.txt → array of music type name strings
export function parseDescrSoundsMusicTypes(text) {
  const types = [];
  for (const raw of text.split('\n')) {
    const line = raw.replace(/;.*$/, '').trim();
    const m = line.match(/^music_type\s+(\S+)/i) || line.match(/^type\s+(\S+)/i);
    if (m) types.push(m[1]);
  }
  return [...new Set(types)];
}

// Extract hidden_resource names from EDB data
// Primary source: edbData.hiddenResources (the "hidden_resources ..." top line in the EDB)
// Secondary source: walk capabilities for hinterland_hidden_resource entries
export function extractHiddenResourcesFromEDB(edbData) {
  if (!edbData) return [];
  const resources = new Set();

  // Primary: the top-level hidden_resources list parsed from the EDB header
  if (Array.isArray(edbData.hiddenResources)) {
    for (const r of edbData.hiddenResources) if (r) resources.add(r);
  }

  // Secondary: walk capability blocks for hinterland_hidden_resource entries
  const walkCap = (cap) => {
    if (!cap || typeof cap !== 'object') return;
    // Stored as { type:'bonus', identifier:'hinterland_hidden_resource', value: N }
    if (cap.identifier === 'hinterland_hidden_resource' && cap.value !== undefined) {
      // value is a number here (the bonus amount), not a name — skip
      return;
    }
    // Some parsers store as { type:'hinterland_hidden_resource', value: 'name' }
    if (cap.type === 'hinterland_hidden_resource' && cap.value) resources.add(cap.value);
    if (cap.name === 'hinterland_hidden_resource' && cap.arg) resources.add(cap.arg);
    // Raw string format
    if (typeof cap === 'string') {
      const m = cap.match(/hinterland_hidden_resource\s+(\S+)/i);
      if (m) resources.add(m[1]);
    }
  };

  const walk = (obj) => {
    if (!obj || typeof obj !== 'object') return;
    if (Array.isArray(obj.capabilities)) obj.capabilities.forEach(walkCap);
    if (Array.isArray(obj.factionCapability)) obj.factionCapability.forEach(walkCap);
    if (Array.isArray(obj.levels)) obj.levels.forEach(walk);
    if (Array.isArray(obj.buildings)) obj.buildings.forEach(walk);
  };
  if (Array.isArray(edbData.buildings)) edbData.buildings.forEach(walk);

  return [...resources].sort();
}

// Extract all building level names from EDB data (for upgrades list)
// Accepts either a parsed edbData object { buildings: [...] } or a raw buildings array
export function extractBuildingLevelsFromEDB(edbDataOrArray) {
  const buildingsArr = Array.isArray(edbDataOrArray)
    ? edbDataOrArray
    : edbDataOrArray?.buildings;
  if (!Array.isArray(buildingsArr)) return [];
  const levels = [];
  const walk = (building) => {
    if (Array.isArray(building.levels)) {
      for (const lvl of building.levels) {
        if (lvl.name) levels.push({ name: lvl.name, building: building.name || '' });
        if (Array.isArray(lvl.upgrades)) lvl.upgrades.forEach(u => {
          const name = typeof u === 'string' ? u : u?.name;
          if (name) levels.push({ name, building: building.name || '' });
        });
      }
    }
  };
  buildingsArr.forEach(walk);
  return levels;
}