/**
 * Parser and serializer for M2TW descr_strat.txt, descr_regions.txt,
 * *_regions_and_settlement_names.txt, and descr_sm_factions.txt
 *
 * Corrected format understanding:
 * - Faction blocks are NOT brace-delimited; they end at the next faction/diplomacy keyword
 * - Characters use inline x/y: "character Name, type, sex, age N, x X, y Y"
 * - Resources: "resource name, X, Y"
 * - Forts: "fort X Y [fort_type [culture name]]"
 * - Settlements ARE brace-delimited, contain building{} sub-blocks
 */

export const SETTLEMENT_LEVELS = ['village', 'town', 'large_town', 'city', 'large_city', 'huge_city'];
export const SETTLEMENT_LEVEL_ICONS = {
  village: '🏘️', town: '🏚️', large_town: '🏠',
  city: '🏛️', large_city: '🏰', huge_city: '👑',
};

const cleanLine = (l) => l.replace(/;.*$/, '').trim();

function skipToBrace(lines, i) {
  while (i < lines.length && !lines[i].includes('{')) i++;
  return i;
}

// ─── Settlement block parser (brace-delimited) ────────────────────────────────
function parseSettlementBlock(lines, startI) {
  let i = skipToBrace(lines, startI) + 1;
  const settlement = {
    level: 'village', region: '', population: 0,
    yearFounded: 0, planSet: 'default_set', factionCreator: '',
    buildings: [], castle: false,
  };
  let depth = 1;
  while (i < lines.length && depth > 0) {
    const line = cleanLine(lines[i]);
    if (line === '{') { depth++; i++; continue; }
    if (line === '}') { depth--; if (depth === 0) break; i++; continue; }
    let m;
    if ((m = line.match(/^level\s+(\S+)/)))         settlement.level         = m[1];
    else if ((m = line.match(/^region\s+(\S+)/)))   settlement.region        = m[1];
    else if ((m = line.match(/^population\s+(\d+)/))) settlement.population  = parseInt(m[1]);
    else if ((m = line.match(/^year_founded\s+(-?\d+)/))) settlement.yearFounded = parseInt(m[1]);
    else if ((m = line.match(/^plan_set\s+(\S+)/))) settlement.planSet       = m[1];
    else if ((m = line.match(/^faction_creator\s+(\S+)/))) settlement.factionCreator = m[1];
    else if (line === 'building') {
      let bi = skipToBrace(lines, i + 1) + 1;
      let bd = 1;
      while (bi < lines.length && bd > 0) {
        const bl = cleanLine(lines[bi]);
        if (bl === '{') { bd++; bi++; continue; }
        if (bl === '}') { bd--; if (bd === 0) break; bi++; continue; }
        const tm = bl.match(/^type\s+(.+)/);
        if (tm) settlement.buildings.push(tm[1].trim());
        bi++;
      }
      i = bi;
    }
    i++;
  }
  settlement._lineEnd = i;
  return { settlement, endIndex: i };
}

// ─── Character line parser ─────────────────────────────────────────────────────
// Format: character Name, type, sex[, leader|heir], age N, x X, y Y
function parseCharacterLine(line) {
  const m = line.match(/^character\s+(.+)/);
  if (!m) return null;
  const rest = m[1];

  const parts = rest.split(',').map(s => s.trim());
  const name = parts[0];

  const xm = rest.match(/\bx\s+(\d+)/);
  const ym = rest.match(/\by\s+(\d+)/);
  const x = xm ? parseInt(xm[1]) : null;
  const y = ym ? parseInt(ym[1]) : null;

  const typeMatch = rest.match(/\b(named character|general|admiral|spy|merchant|diplomat|priest|assassin|princess|heretic|witch|inquisitor)\b/i);
  const charType = typeMatch ? typeMatch[1].toLowerCase() : 'general';

  const isLeader = /\bleader\b/i.test(rest);
  const isHeir   = /\bheir\b/i.test(rest);
  const ageM     = rest.match(/\bage\s+(\d+)/);
  const age      = ageM ? parseInt(ageM[1]) : 30;
  const sex      = /\bfemale\b/i.test(rest) ? 'female' : 'male';

  return { name, charType, isLeader, isHeir, age, x, y, sex };
}

const FLAG_NAMES = new Set([
  'marian_reforms_disabled', 'marian_reforms_activated',
  'rebelling_characters_active', 'rebelling_characters_inactive',
  'gladiator_uprising_disabled', 'night_battles_enabled',
  'night_battles_disabled', 'show_date_as_turns',
  'free_upkeep_enabled', 'free_upkeep_disabled',
]);

// Detect end of a faction block
function isFactionBlockEnd(line) {
  return (
    line.match(/^faction\s+\w/) ||
    line.match(/^faction_standings/) ||
    line.match(/^faction_relationships/) ||
    line.match(/^action_relationships/) ||
    line === 'script'
  );
}

// ─── descr_strat.txt ──────────────────────────────────────────────────────────
export function parseDescrStrat(text) {
  const lines = text.split('\n');
  const items = [];
  const factions = [];
  let itemId = 0;
  let campaignName = '';
  let playable = [], unlockable = [], nonplayable = [];
  let startDate = '', endDate = '', timescale = '';
  let flags = {};
  let brigandSpawn = 0, pirateSpawn = 0;
  let scriptFile = '';
  let i = 0;

  while (i < lines.length) {
    const line = cleanLine(lines[i]);
    if (!line) { i++; continue; }

    let m;

    // Campaign name
    if ((m = line.match(/^campaign\s+(\S+)/))) { campaignName = m[1]; i++; continue; }

    // Playability lists (terminated by 'end')
    if (line === 'playable' || line === 'unlockable' || line === 'nonplayable') {
      const arr = line === 'playable' ? playable : line === 'unlockable' ? unlockable : nonplayable;
      i++;
      while (i < lines.length) {
        const fl = cleanLine(lines[i]);
        if (fl === 'end') { i++; break; }
        if (fl) arr.push(fl);
        i++;
      }
      continue;
    }

    // Dates and timescale
    if ((m = line.match(/^start_date\s+(\d+)\s+(\w+)/)))  { startDate = `${m[1]} ${m[2]}`; i++; continue; }
    if ((m = line.match(/^end_date\s+(\d+)\s+(\w+)/)))    { endDate   = `${m[1]} ${m[2]}`; i++; continue; }
    if ((m = line.match(/^timescale\s+([\d.]+)/)))         { timescale = m[1];              i++; continue; }
    if ((m = line.match(/^brigand_spawn_value\s+(\d+)/)))  { brigandSpawn = parseInt(m[1]); i++; continue; }
    if ((m = line.match(/^pirate_spawn_value\s+(\d+)/)))   { pirateSpawn  = parseInt(m[1]); i++; continue; }
    if (FLAG_NAMES.has(line))                               { flags[line] = true;            i++; continue; }

    // Resources: "resource coal, 69, 107"
    if ((m = line.match(/^resource\s+(\w+)\s*,\s*(\d+)\s*,\s*(\d+)/i))) {
      items.push({ id: itemId++, category: 'resource', type: m[1], x: parseInt(m[2]), y: parseInt(m[3]), _lineNum: i });
      i++; continue;
    }

    // ── Faction block (NOT brace-delimited) ───────────────────────────────────
    if ((m = line.match(/^faction\s+(\w+)(?:\s*,\s*(\w+)(?:\s+(\w+))?)?/))) {
      const faction = {
        name: m[1], economicAi: m[2] || '', militaryAi: m[3] || '',
        aiLabel: '', treasury: 0, kingsPromise: 0,
        settlements: [], characters: [], characterRecords: [], relatives: [],
        _lineStart: i,
      };
      i++;

      while (i < lines.length) {
        const fl = cleanLine(lines[i]);
        if (!fl) { i++; continue; }
        if (isFactionBlockEnd(fl)) break;

        // ai_label, money
        if ((m = fl.match(/^ai_label\s+(\S+)/)))           { faction.aiLabel    = m[1];            i++; continue; }
        if ((m = fl.match(/^denari\s+(\d+)$/)))            { faction.treasury   = parseInt(m[1]);  i++; continue; }
        if ((m = fl.match(/^denari_kings_purse\s+(\d+)/))) { faction.kingsPromise = parseInt(m[1]); i++; continue; }

        // Settlement block (brace-delimited)
        if (fl === 'settlement' || fl === 'settlement castle') {
          const iscastle = fl.includes('castle');
          const { settlement, endIndex } = parseSettlementBlock(lines, i + 1);
          settlement._lineStart = i; // the 'settlement' keyword line
          settlement.id       = itemId++;
          settlement.faction  = faction.name;
          settlement.category = 'settlement';
          settlement.castle   = iscastle;
          faction.settlements.push(settlement);
          items.push(settlement);
          i = endIndex + 1;
          continue;
        }

        // Character on map: x and y are on the character line itself
        if (fl.match(/^character\s+/)) {
          const charData = parseCharacterLine(fl);
          if (charData && charData.x !== null) {
            const item = { ...charData, id: itemId++, category: 'character', faction: faction.name, _lineNum: i, traits: [], ancillaries: [] };
            i++;
            // Consume trailing lines: traits, ancillaries, army/units
            while (i < lines.length) {
              const nl = cleanLine(lines[i]);
              if (!nl) { i++; continue; }
              if (nl.match(/^character\s+/) || nl.match(/^character_record/) ||
                  nl.match(/^relative\s+/) || nl === 'settlement' || nl === 'settlement castle' ||
                  isFactionBlockEnd(nl)) break;
              if ((m = nl.match(/^traits\s+(.*)/)))      item.traits      = m[1].split(/\s*,\s*/).map(t => t.trim()).filter(Boolean);
              if ((m = nl.match(/^ancillaries\s+(.*)/))) item.ancillaries = m[1].split(/\s*,\s*/).map(a => a.trim()).filter(Boolean);
              i++;
            }
            faction.characters.push(item);
            items.push(item);
            continue;
          }
          i++;
          continue;
        }

        if (fl.match(/^character_record\s+/)) { faction.characterRecords.push(fl); i++; continue; }
        if (fl.match(/^relative\s+/))         { faction.relatives.push(fl);         i++; continue; }

        i++;
      }

      factions.push(faction);
      continue;
    }

    // ── Fort / watchtower in regions section ─────────────────────────────────
    // Format: "fort X Y [fort_type [culture culture_name]]"
    //         "watchtower X Y"
    if ((m = line.match(/^(fort|watchtower)\s+(\d+)\s+(\d+)(.*)/i))) {
      const extra = m[4].trim();
      const fortTypeM = extra.match(/^(\S+)/);
      const cultureM  = extra.match(/culture\s+(\S+)/);
      items.push({
        id: itemId++, category: 'fortification', type: m[1].toLowerCase(),
        x: parseInt(m[2]), y: parseInt(m[3]),
        fortType: fortTypeM ? fortTypeM[1] : '',
        culture: cultureM ? cultureM[1] : '',
        _lineNum: i,
      });
      i++; continue;
    }

    // Script file (line after 'script' keyword)
    if (line === 'script') {
      i++;
      while (i < lines.length) {
        const sl = cleanLine(lines[i]);
        if (sl) { scriptFile = sl; break; }
        i++;
      }
      i++; continue;
    }

    i++;
  }

  return { raw: text, items, factions, playable, unlockable, nonplayable, campaignName, startDate, endDate, timescale, flags, brigandSpawn, pirateSpawn, scriptFile };
}

// ─── Settlement position computation ─────────────────────────────────────────
export function computeSettlementPositions(settlements, regionsData, regionsLayer) {
  if (!settlements?.length || !regionsData?.length || !regionsLayer?.data) return settlements;
  const { data, width, height } = regionsLayer;

  const colorMap = {};
  for (const reg of regionsData) {
    if (reg.regionName) colorMap[reg.regionName.toLowerCase()] = { r: reg.r, g: reg.g, b: reg.b };
  }

  const cityPx = {};
  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      const i = (py * width + px) * 4;
      if (data[i] > 5 || data[i+1] > 5 || data[i+2] > 5) continue;
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nx = px + dx, ny = py + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const ni = (ny * width + nx) * 4;
        const nr = data[ni], ng = data[ni+1], nb = data[ni+2];
        if (nr < 5 && ng < 5 && nb < 5) continue;
        if (nr > 245 && ng > 245 && nb > 245) continue;
        const key = `${nr},${ng},${nb}`;
        if (!cityPx[key]) cityPx[key] = { x: px, y: height - 1 - py };
        break;
      }
    }
  }

  return settlements.map(s => {
    const color = colorMap[s.region?.toLowerCase()];
    if (!color) return s;
    const pos = cityPx[`${color.r},${color.g},${color.b}`];
    return pos ? { ...s, x: pos.x, y: pos.y } : s;
  });
}

// ─── Settlement block generator ───────────────────────────────────────────────
function generateSettlementBlock(s, indent = '') {
  const ind4 = indent + '    ';
  const ind8 = indent + '        ';
  const lines = [
    `${indent}settlement${s.castle ? ' castle' : ''}`,
    `${indent}{`,
    `${ind4}level ${s.level}`,
    `${ind4}region ${s.region}`,
    ``,
    `${ind4}year_founded ${s.yearFounded ?? 0}`,
    `${ind4}population ${s.population ?? 0}`,
    `${ind4}plan_set ${s.planSet || 'default_set'}`,
    `${ind4}faction_creator ${s.factionCreator || s.faction}`,
  ];
  for (const bld of (s.buildings || [])) {
    lines.push(`${ind4}building`);
    lines.push(`${ind4}{`);
    lines.push(`${ind8}type ${bld}`);
    lines.push(`${ind4}}`);
  }
  lines.push(`${indent}}`);
  return lines;
}

// ─── descr_strat.txt serializer ───────────────────────────────────────────────
export function serializeDescrStrat(stratData, overlayItems, editedSettlements = {}) {
  if (!stratData?.raw) return '';
  const lineArr = stratData.raw.split('\n');

  // Patch moved items
  for (const item of overlayItems) {
    const orig = stratData.items?.find(o => o.id === item.id);
    if (!orig || (orig.x === item.x && orig.y === item.y)) continue;

    if (item.category === 'character' && orig._lineNum !== undefined) {
      const old = lineArr[orig._lineNum];
      if (old) {
        lineArr[orig._lineNum] = old
          .replace(/\bx\s+\d+/, `x ${item.x}`)
          .replace(/\by\s+\d+/, `y ${item.y}`);
      }
    }

    if (item.category === 'resource' && orig._lineNum !== undefined) {
      const old = lineArr[orig._lineNum];
      if (old) {
        lineArr[orig._lineNum] = old.replace(/,\s*\d+\s*,\s*\d+/, `,\t${item.x},\t${item.y}`);
      }
    }

    if (item.category === 'fortification' && orig._lineNum !== undefined) {
      const old = lineArr[orig._lineNum];
      if (old) {
        lineArr[orig._lineNum] = old.replace(/^(\s*(?:fort|watchtower)\s+)\d+\s+\d+/i, `$1${item.x} ${item.y}`);
      }
    }
  }

  // Patch edited settlement blocks
  const replacements = [];
  for (const [id, edits] of Object.entries(editedSettlements)) {
    const orig = stratData.items?.find(it => it.id == id && it.category === 'settlement');
    if (!orig || orig._lineStart === undefined) continue;
    const merged = { ...orig, ...edits };
    const indentMatch = (lineArr[orig._lineStart] || '').match(/^(\s*)/);
    const indent = indentMatch ? indentMatch[1] : '    ';
    const newBlock = generateSettlementBlock(merged, indent);
    replacements.push({ start: orig._lineStart, end: orig._lineEnd, newLines: newBlock });
  }

  replacements.sort((a, b) => b.start - a.start);
  const result = [...lineArr];
  for (const { start, end, newLines } of replacements) {
    result.splice(start, end - start + 1, ...newLines);
  }

  return result.join('\n');
}

// ─── descr_regions.txt ────────────────────────────────────────────────────────
export function parseDescrRegions(text) {
  const regions = [];
  const lines = text.split('\n').map(l => l.replace(/;.*$/, '').trim()).filter(Boolean);
  let i = 0;
  while (i < lines.length) {
    const regionName     = lines[i++]; if (!regionName || !lines[i]) break;
    const settlementName = lines[i++];
    const factionCreator = lines[i++];
    const rebelFaction   = lines[i++];
    const rgbParts       = (lines[i++] || '').split(/\s+/);
    const r = parseInt(rgbParts[0]), g = parseInt(rgbParts[1]), b = parseInt(rgbParts[2]);
    const resourcesLine  = lines[i++] || '';
    const resources      = resourcesLine.split(',').map(s => s.trim()).filter(Boolean);
    const val1           = parseInt(lines[i++]) || 0;
    const val2           = parseInt(lines[i++]) || 0;
    const relLine        = lines[i++] || '';
    const relMatch       = relLine.match(/religions\s*\{([^}]*)\}/);
    const religions      = {};
    if (relMatch) {
      const parts = relMatch[1].trim().split(/\s+/);
      for (let j = 0; j < parts.length; j += 2) {
        if (parts[j] && parts[j+1] !== undefined) religions[parts[j]] = parseInt(parts[j+1]);
      }
    }
    regions.push({ regionName, settlementName, factionCreator, rebelFaction, r, g, b, resources, val1, val2, religions });
  }
  return regions;
}

export function serializeDescrRegions(regions) {
  return regions.map(reg => {
    const relEntries = Object.entries(reg.religions || {}).map(([k, v]) => `${k} ${v}`).join(' ');
    return [
      reg.regionName,
      reg.settlementName,
      reg.factionCreator,
      reg.rebelFaction,
      `${reg.r} ${reg.g} ${reg.b}`,
      (reg.resources || []).join(', '),
      String(reg.val1 ?? 0),
      String(reg.val2 ?? 0),
      relEntries ? `religions { ${relEntries} }` : 'religions {  }',
    ].join('\n');
  }).join('\n\n');
}

// ─── regions_and_settlement_names.txt ────────────────────────────────────────
export function parseSettlementNames(text) {
  const names = {};
  const regex = /\{([^}]+)\}([^\n{]+)/g;
  let m;
  while ((m = regex.exec(text)) !== null) names[m[1].trim()] = m[2].trim();
  return names;
}

// ─── descr_sm_factions.txt ───────────────────────────────────────────────────
export function parseDescrSmFactions(text) {
  const factions = {};
  let currentFaction = null;
  for (const raw of text.split('\n')) {
    const line = raw.replace(/;.*$/, '').trim();
    if (!line) continue;
    let m;
    if ((m = line.match(/^faction\s+(\w+)/))) { currentFaction = m[1]; factions[currentFaction] = {}; continue; }
    if (!currentFaction) continue;
    if ((m = line.match(/^primary_colour\s+red\s+(\d+),?\s*green\s+(\d+),?\s*blue\s+(\d+)/))) {
      factions[currentFaction].primaryColor = { r: parseInt(m[1]), g: parseInt(m[2]), b: parseInt(m[3]) };
    }
    if ((m = line.match(/^secondary_colour\s+red\s+(\d+),?\s*green\s+(\d+),?\s*blue\s+(\d+)/))) {
      factions[currentFaction].secondaryColor = { r: parseInt(m[1]), g: parseInt(m[2]), b: parseInt(m[3]) };
    }
    if ((m = line.match(/^logo_filename\s+(.+)/))) {
      factions[currentFaction].logo = m[1].trim();
    }
  }
  return factions;
}