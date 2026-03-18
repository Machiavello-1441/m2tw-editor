/**
 * Parser and serializer for M2TW descr_strat.txt, descr_regions.txt,
 * *_regions_and_settlement_names.txt, and descr_sm_factions.txt
 */

export const SETTLEMENT_LEVELS = ['village', 'town', 'large_town', 'city', 'large_city', 'huge_city'];
export const SETTLEMENT_LEVEL_ICONS = {
  village: '🏘️', town: '🏚️', large_town: '🏠',
  city: '🏛️', large_city: '🏰', huge_city: '👑',
};

// ─── Utility ──────────────────────────────────────────────────────────────────
function cleanLine(l) { return l.replace(/;.*$/, '').trim(); }

// ─── Building block parser { type tree level } ────────────────────────────────
function parseBuildingBlock(lines, i) {
  // skip to opening brace
  while (i < lines.length && !cleanLine(lines[i]).includes('{')) i++;
  i++; // skip {
  const buildings = [];
  let depth = 1;
  while (i < lines.length && depth > 0) {
    const line = cleanLine(lines[i]);
    if (line === '{') { depth++; i++; continue; }
    if (line === '}') { depth--; if (depth === 0) break; i++; continue; }
    // "type core_building wooden_wall"
    const m = line.match(/^type\s+(.+)/);
    if (m) buildings.push(m[1].trim());
    i++;
  }
  return { buildings, endIndex: i };
}

// ─── Settlement block parser ───────────────────────────────────────────────────
// Called when we are at the line AFTER "settlement" or "settlement castle"
function parseSettlementBlock(lines, startI, lineStartOverride) {
  // skip to opening brace
  let i = startI;
  while (i < lines.length && !cleanLine(lines[i]).includes('{')) i++;
  const lineStart = lineStartOverride ?? (startI - 1);
  i++; // skip {

  const settlement = {
    level: 'village', region: '', population: 0,
    yearFounded: 0, planSet: 'default_set', factionCreator: '',
    buildings: [], upgrades: [], x: null, y: null,
    _lineStart: lineStart,
  };

  let depth = 1;
  while (i < lines.length && depth > 0) {
    const line = cleanLine(lines[i]);
    if (line === '{') { depth++; i++; continue; }
    if (line === '}') { depth--; if (depth === 0) break; i++; continue; }

    let m;
    if ((m = line.match(/^level\s+(\S+)/)))           settlement.level          = m[1];
    else if ((m = line.match(/^region\s+(\S+)/)))      settlement.region         = m[1];
    else if ((m = line.match(/^population\s+(\d+)/)))  settlement.population     = parseInt(m[1]);
    else if ((m = line.match(/^year_founded\s+(-?\d+)/))) settlement.yearFounded = parseInt(m[1]);
    else if ((m = line.match(/^plan_set\s+(\S+)/)))    settlement.planSet        = m[1];
    else if ((m = line.match(/^faction_creator\s+(\S+)/))) settlement.factionCreator = m[1];
    else if (line === 'building') {
      const { buildings: blds, endIndex } = parseBuildingBlock(lines, i + 1);
      settlement.buildings.push(...blds);
      i = endIndex + 1;
      continue;
    }
    else if (line === 'upgrades') {
      // legacy upgrades block
      let ui = i + 1;
      while (ui < lines.length && !cleanLine(lines[ui]).includes('{')) ui++;
      ui++; let ud = 1;
      while (ui < lines.length && ud > 0) {
        const ul = cleanLine(lines[ui]);
        if (ul === '{') { ud++; ui++; continue; }
        if (ul === '}') { ud--; if (ud === 0) break; ui++; continue; }
        if (ul) settlement.upgrades.push(ul);
        ui++;
      }
      i = ui + 1; continue;
    }
    i++;
  }

  settlement._lineEnd = i;
  return { settlement, endIndex: i };
}

// ─── Character / Agent inline parser ──────────────────────────────────────────
// Parses: "character Name, type, sex, [leader|heir], age N, x X, y Y"
// followed optionally by traits/ancillaries/army/character_record/relative lines
function parseCharacterLine(line, lineIndex) {
  // character  William, named character, male, leader, age 40, x 109, y 147
  const m = line.match(/^character\s+(.+?),\s*(named character|general|admiral|spy|merchant|diplomat|priest|assassin|princess|heretic|witch|inquisitor)\s*,?\s*(male|female)?,?\s*(leader|heir)?,?\s*age\s+(\d+),\s*x\s+(\d+),\s*y\s+(\d+)/i);
  if (!m) return null;
  return {
    name: m[1].trim(),
    charType: m[2].toLowerCase().trim(),
    sex: (m[3] || 'male').toLowerCase(),
    role: (m[4] || '').toLowerCase(), // 'leader', 'heir', or ''
    age: parseInt(m[5]),
    x: parseInt(m[6]),
    y: parseInt(m[7]),
    traits: [],
    ancillaries: [],
    army: [],
    _lineNum: lineIndex,
  };
}

// ─── descr_strat.txt ─────────────────────────────────────────────────────────
export function parseDescrStrat(text) {
  const lines = text.split('\n');
  const items = [];
  const factions = [];
  let itemId = 0;

  // Global campaign settings
  let campaignName = '';
  let playable = [];
  let unlockable = [];
  let nonplayable = [];
  let startDate = '', endDate = '', timescale = '';
  let scriptFile = 'campaign_script.txt';

  // Global flags (boolean or string value)
  const flags = {};

  // Diplomacy
  const factionStandings = []; // { faction, targets: [{name, value}] }
  const factionRelationships = []; // { faction, relation, targets }

  let i = 0;

  while (i < lines.length) {
    const raw = lines[i];
    const line = cleanLine(raw);
    if (!line) { i++; continue; }

    let m;

    // Campaign name
    if ((m = line.match(/^campaign\s+(\S+)/))) {
      campaignName = m[1]; i++; continue;
    }

    // Playable / unlockable / nonplayable blocks
    if (/^playable$/i.test(line)) {
      i++;
      while (i < lines.length) {
        const fl = cleanLine(lines[i]);
        if (/^end$/i.test(fl)) { i++; break; }
        if (fl) playable.push(fl);
        i++;
      }
      continue;
    }
    if (/^unlockable$/i.test(line)) {
      i++;
      while (i < lines.length) {
        const fl = cleanLine(lines[i]);
        if (/^end$/i.test(fl)) { i++; break; }
        if (fl) unlockable.push(fl);
        i++;
      }
      continue;
    }
    if (/^nonplayable$/i.test(line)) {
      i++;
      while (i < lines.length) {
        const fl = cleanLine(lines[i]);
        if (/^end$/i.test(fl)) { i++; break; }
        if (fl) nonplayable.push(fl);
        i++;
      }
      continue;
    }

    // Dates & timescale
    if ((m = line.match(/^start_date\s+(.+)/)))   { startDate = m[1].trim(); i++; continue; }
    if ((m = line.match(/^end_date\s+(.+)/)))      { endDate   = m[1].trim(); i++; continue; }
    if ((m = line.match(/^timescale\s+([\d.]+)/))) { timescale = m[1];        i++; continue; }

    // Script file
    if ((m = line.match(/^script$/i))) {
      const nextLine = cleanLine(lines[i + 1] || '');
      if (nextLine) { scriptFile = nextLine; i += 2; } else i++;
      continue;
    }

    // Flags (key value? or just key)
    if (/^(marian_reforms_(disabled|activated)|rebelling_characters_(active|inactive)|gladiator_uprising_(disabled)|night_battles_(enabled|disabled)|show_date_as_turns)$/i.test(line)) {
      flags[line] = true; i++; continue;
    }
    if ((m = line.match(/^(brigand_spawn_value|pirate_spawn_value)\s+(\d+)/))) {
      flags[m[1]] = parseInt(m[2]); i++; continue;
    }

    // Resources
    if ((m = line.match(/^resource\s+(\w+)\s*,\s*(\d+)\s*,\s*(\d+)/i))) {
      items.push({ id: itemId++, category: 'resource', type: m[1], x: parseInt(m[2]), y: parseInt(m[3]), _lineNum: i });
      i++; continue;
    }

    // Faction block
    if ((m = line.match(/^faction\s+(\w+)(?:\s*,\s*(\w+)\s+(\w+))?/))) {
      const faction = {
        name: m[1],
        economicAI: m[2] || '',
        militaryAI: m[3] || '',
        aiLabel: '',
        treasury: 0,
        kingsPurse: 0,
        settlements: [],
        characters: [],
        characterRecords: [],
        relatives: [],
      };
      i++;

      while (i < lines.length) {
        const fl = cleanLine(lines[i]);
        if (!fl) { i++; continue; }

        // End of faction: next top-level keyword
        if (
          /^faction\s+\w/i.test(fl) ||
          /^(faction_standings|action_relationships|faction_relationships)\b/i.test(fl) ||
          /^region\s+\S/i.test(fl) ||
          /^script\s*$/i.test(fl) ||
          /^(playable|unlockable|nonplayable|start_date|end_date|timescale|campaign)\b/i.test(fl)
        ) {
          break;
        }

        let fm;
        if ((fm = fl.match(/^ai_label\s+(\S+)/)))       { faction.aiLabel     = fm[1]; i++; continue; }
        if ((fm = fl.match(/^denari_kings_purse\s+(\d+)/))) { faction.kingsPurse = parseInt(fm[1]); i++; continue; }
        if ((fm = fl.match(/^denari\s+(\d+)/)))          { faction.treasury    = parseInt(fm[1]); i++; continue; }

        // Settlement block
        if (/^settlement(\s+castle)?$/i.test(fl)) {
          const isCastle = /castle/i.test(fl);
          const { settlement, endIndex } = parseSettlementBlock(lines, i + 1, i);
          settlement.id       = itemId++;
          settlement.faction  = faction.name;
          settlement.category = 'settlement';
          settlement.castle   = isCastle;
          faction.settlements.push(settlement);
          items.push(settlement);
          i = endIndex + 1;
          continue;
        }

        // Inline character line: character Name, type, sex, role, age N, x X, y Y
        if (/^character\s+/i.test(fl)) {
          const char = parseCharacterLine(fl, i);
          if (char) {
            char.id = itemId++;
            char.faction = faction.name;
            char.category = 'character';
            // Parse subsequent trait/ancillary/army lines
            i++;
            while (i < lines.length) {
              const cl = cleanLine(lines[i]);
              if (!cl) { i++; break; }
              // Stop if new character, settlement, character_record, relative, or next faction keyword
              if (/^(character|character_record|relative|settlement|faction|region|faction_standings|action_relationships|faction_relationships)\b/i.test(cl)) break;
              let tm;
              if ((tm = cl.match(/^traits\s+(.+)/i))) {
                // "traits TraitA N , TraitB N"
                const parts = tm[1].split(',').map(s => s.trim()).filter(Boolean);
                char.traits = parts.map(p => {
                  const pm = p.match(/(\S+)\s+(-?\d+)/);
                  return pm ? { name: pm[1], level: parseInt(pm[2]) } : { name: p, level: 1 };
                });
              } else if ((tm = cl.match(/^ancillaries\s+(.+)/i))) {
                char.ancillaries = tm[1].split(',').map(s => s.trim()).filter(Boolean);
              } else if (/^army$/i.test(cl)) {
                // parse units until next non-unit line
                i++;
                while (i < lines.length) {
                  const ul = cleanLine(lines[i]);
                  if (!ul) { i++; break; }
                  if (!/^unit\b/i.test(ul)) break;
                  // unit <name> exp N armour N weapon_lvl N
                  const um = ul.match(/^unit\s+(.+?)\s+exp\s+(\d+)\s+armour\s+(\d+)\s+weapon_lvl\s+(\d+)/i);
                  if (um) char.army.push({ unit: um[1].trim(), exp: parseInt(um[2]), armour: parseInt(um[3]), weaponLvl: parseInt(um[4]) });
                  i++;
                }
                continue;
              }
              i++;
            }
            faction.characters.push(char);
            items.push(char);
            continue;
          }
        }

        // character_record
        if ((fm = fl.match(/^character_record\s+(.+?),\s*(male|female)\s*,\s*age\s+(\d+)\s*,\s*(\w+)/i))) {
          faction.characterRecords.push({
            name: fm[1].trim(), sex: fm[2], age: parseInt(fm[3]), status: fm[4],
          });
          i++; continue;
        }

        // relative
        if (/^relative\s+/i.test(fl)) {
          // relative\tWilliam,\tMatilda,\t\tRufus,\t...end
          const parts = fl.replace(/^relative\s+/i, '').split(/[\t,]+/).map(s => s.trim()).filter(Boolean);
          const endIdx = parts.indexOf('end');
          const rel = endIdx >= 0 ? parts.slice(0, endIdx) : parts;
          faction.relatives.push(rel);
          i++; continue;
        }

        i++;
      }

      factions.push(faction);
      continue;
    }

    // Diplomacy: faction_standings
    if ((m = line.match(/^(faction_standings)\s+(\w+)\s*,\s*([-\d.]+)\s+([\w\s,]+)/i))) {
      const targets = m[4].split(',').map(s => s.trim()).filter(Boolean);
      factionStandings.push({ faction: m[2], value: parseFloat(m[3]), targets });
      i++; continue;
    }

    // Diplomacy: action_relationships / faction_relationships
    if ((m = line.match(/^(action_relationships|faction_relationships)\s+(\w+)\s*,\s*(\w+)\s+([\w\s,]+)/i))) {
      const targets = m[4].split(',').map(s => s.trim()).filter(Boolean);
      factionRelationships.push({ faction: m[2], relation: m[3], targets });
      i++; continue;
    }

    // Regions section (forts/watchtowers)
    if ((m = line.match(/^region\s+(\S+)/i))) {
      // just skip the region header, parse forts and watchtowers inside
      i++;
      while (i < lines.length) {
        const rl = cleanLine(lines[i]);
        if (!rl) { i++; continue; }
        if (/^region\s+/i.test(rl) || /^(faction_standings|faction_relationships|action_relationships|script)/i.test(rl)) break;

        let wm;
        if ((wm = rl.match(/^(watchtower)\s+(\d+)\s+(\d+)/i))) {
          items.push({ id: itemId++, category: 'fortification', type: 'watchtower', x: parseInt(wm[2]), y: parseInt(wm[3]), region: m[1], _lineNum: i });
        } else if ((wm = rl.match(/^(fort)\s+(\d+)\s+(\d+)(.*)/i))) {
          const rest = wm[4].trim();
          const fortTypem = rest.match(/(\S+_fort\S*)/i);
          const culturem = rest.match(/culture\s+(\S+)/i);
          items.push({
            id: itemId++, category: 'fortification', type: 'fort',
            x: parseInt(wm[2]), y: parseInt(wm[3]),
            fortType: fortTypem?.[1] || '',
            culture: culturem?.[1] || '',
            region: m[1], _lineNum: i,
          });
        }
        i++;
      }
      continue;
    }

    i++;
  }

  return {
    raw: text, items, factions, factionStandings, factionRelationships,
    campaignName, playable, unlockable, nonplayable,
    startDate, endDate, timescale, scriptFile, flags,
  };
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
      const idx = (py * width + px) * 4;
      if (data[idx] > 5 || data[idx+1] > 5 || data[idx+2] > 5) continue;
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

// ─── Serializer ───────────────────────────────────────────────────────────────
function generateSettlementBlock(s, indent = '\t') {
  const ind2 = indent + '\t';
  const ind3 = indent + '\t\t';
  const lines = [
    `${indent}${s.castle ? 'settlement castle' : 'settlement'}`,
    `${indent}{`,
    `${ind2}level ${s.level}`,
    `${ind2}region ${s.region}`,
    ``,
    `${ind2}year_founded ${s.yearFounded ?? 0}`,
    `${ind2}population ${s.population ?? 0}`,
    `${ind2}plan_set ${s.planSet || 'default_set'}`,
    `${ind2}faction_creator ${s.factionCreator || s.faction}`,
    ...(s.buildings || []).flatMap(b => [`${ind2}building`, `${ind2}{`, `${ind3}type ${b}`, `${ind2}}`]),
    `${indent}}`,
  ];
  return lines;
}

export function serializeDescrStrat(stratData, overlayItems, editedSettlements = {}) {
  if (!stratData?.raw) return '';
  const lines = stratData.raw.split('\n');
  const replacements = [];

  // ── Patch global campaign settings ──────────────────────────────────────
  const pl = (regex, newLine) => {
    const idx = lines.findIndex(l => regex.test(l.replace(/;.*$/, '').trim()));
    if (idx >= 0) lines[idx] = newLine;
  };
  if (stratData.campaignName) pl(/^campaign\b/i, `campaign\t\t${stratData.campaignName}`);
  if (stratData.startDate)    pl(/^start_date\b/i, `start_date\t${stratData.startDate}`);
  if (stratData.endDate)      pl(/^end_date\b/i, `end_date\t${stratData.endDate}`);
  if (stratData.timescale)    pl(/^timescale\b/i, `timescale\t${stratData.timescale}`);
  if (stratData.scriptFile) {
    const si = lines.findIndex(l => /^script\s*$/.test(l.replace(/;.*$/, '').trim()));
    if (si >= 0 && si + 1 < lines.length) lines[si + 1] = `\t${stratData.scriptFile}`;
  }
  // Boolean flags
  const BOOL_FLAGS = ['marian_reforms_disabled','marian_reforms_activated','rebelling_characters_active','rebelling_characters_inactive','gladiator_uprising_disabled','night_battles_enabled','night_battles_disabled','show_date_as_turns'];
  for (const key of BOOL_FLAGS) {
    const enabled = stratData.flags?.[key] === true;
    const idx = lines.findIndex(l => l.replace(/;.*$/, '').trim() === key);
    if (!enabled && idx >= 0) lines[idx] = `; ${key}`;
  }
  if (stratData.flags?.brigand_spawn_value !== undefined)
    pl(/^brigand_spawn_value\b/i, `brigand_spawn_value ${stratData.flags.brigand_spawn_value}`);
  if (stratData.flags?.pirate_spawn_value !== undefined)
    pl(/^pirate_spawn_value\b/i, `pirate_spawn_value ${stratData.flags.pirate_spawn_value}`);
  // Playable / unlockable / nonplayable blocks
  const repBlock = (keyword, values) => {
    if (!values) return;
    const si = lines.findIndex(l => l.replace(/;.*$/, '').trim().toLowerCase() === keyword);
    if (si < 0) return;
    const ei = lines.findIndex((l, i) => i > si && l.replace(/;.*$/, '').trim().toLowerCase() === 'end');
    if (ei < 0) return;
    lines.splice(si, ei - si + 1, keyword, ...values.map(v => `\t${v}`), 'end');
  };
  repBlock('playable', stratData.playable);
  repBlock('unlockable', stratData.unlockable);
  repBlock('nonplayable', stratData.nonplayable);

  // Patch moved characters/resources/forts
  for (const item of overlayItems) {
    const orig = stratData.items?.find(o => o.id === item.id);
    if (!orig || (orig.x === item.x && orig.y === item.y)) continue;

    if (item.category === 'character' && orig._lineNum !== undefined) {
      const old = lines[orig._lineNum];
      if (old) {
        lines[orig._lineNum] = old
          .replace(/,\s*x\s+\d+/, `, x ${item.x}`)
          .replace(/,\s*y\s+\d+/, `, y ${item.y}`);
      }
    }

    if (item.category === 'resource' && orig._lineNum !== undefined) {
      const old = lines[orig._lineNum];
      if (old) {
        // resource name, X, Y
        lines[orig._lineNum] = old
          .replace(/,\s*\d+\s*,\s*\d+/, `,\t${item.x},\t${item.y}`);
      }
    }

    if (item.category === 'fortification' && orig._lineNum !== undefined) {
      const old = lines[orig._lineNum];
      if (old) {
        lines[orig._lineNum] = old
          .replace(/^(\s*(?:fort|watchtower))\s+\d+\s+\d+/, `$1 ${item.x} ${item.y}`);
      }
    }
  }

  // Patch edited settlement blocks
  for (const [id, edits] of Object.entries(editedSettlements)) {
    const orig = stratData.items?.find(it => it.id == id && it.category === 'settlement');
    if (!orig || orig._lineStart === undefined) continue;
    const merged = { ...orig, ...edits };
    const indentMatch = (lines[orig._lineStart] || '').match(/^(\s*)/);
    const indent = indentMatch ? indentMatch[1] : '\t';
    const newBlock = generateSettlementBlock(merged, indent);
    replacements.push({ start: orig._lineStart, end: orig._lineEnd, newLines: newBlock });
  }

  replacements.sort((a, b) => b.start - a.start);
  const result = [...lines];
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
    const regionName    = lines[i++]; if (!regionName || !lines[i]) break;
    const settlementName= lines[i++];
    const factionCreator= lines[i++];
    const rebelFaction  = lines[i++];
    const rgbParts      = (lines[i++] || '').split(/\s+/);
    const r = parseInt(rgbParts[0]), g = parseInt(rgbParts[1]), b = parseInt(rgbParts[2]);
    const resourcesLine = lines[i++] || '';
    const resources     = resourcesLine.split(',').map(s => s.trim()).filter(Boolean);
    const val1          = parseInt(lines[i++]) || 0;
    const val2          = parseInt(lines[i++]) || 0;
    const relLine       = lines[i++] || '';
    const relMatch      = relLine.match(/religions\s*\{([^}]*)\}/);
    const religions     = {};
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

// ─── Regions serializer ───────────────────────────────────────────────────────
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

// ─── regions_and_settlement_names.txt ─────────────────────────────────────────
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