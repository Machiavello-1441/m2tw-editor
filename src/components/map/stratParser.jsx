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

// Skip forward until we find a line containing '{'
function skipToBrace(lines, i) {
  while (i < lines.length && !lines[i].includes('{')) i++;
  return i;
}

// ─── Settlement block parser ───────────────────────────────────────────────────
function parseSettlementBlock(lines, startI) {
  let i = skipToBrace(lines, startI) + 1; // skip past {
  const lineStart = startI - 1; // 'settlement' keyword line

  const settlement = {
    level: 'village', region: '', population: 0,
    yearFounded: 0, planSet: 'default', factionCreator: '',
    upgrades: [], x: null, y: null,
    _lineStart: lineStart,
  };

  let depth = 1;
  while (i < lines.length && depth > 0) {
    const line = cleanLine(lines[i]);
    if (line === '{') { depth++; i++; continue; }
    if (line === '}') { depth--; if (depth === 0) break; i++; continue; }

    const m = {
      level: line.match(/^level\s+(\S+)/),
      region: line.match(/^region\s+(\S+)/),
      pop: line.match(/^population\s+(\d+)/),
      yf: line.match(/^year_founded\s+(-?\d+)/),
      ps: line.match(/^plan_set\s+(\S+)/),
      fc: line.match(/^faction_creator\s+(\S+)/),
    };
    if (m.level)  settlement.level         = m.level[1];
    if (m.region) settlement.region        = m.region[1];
    if (m.pop)    settlement.population    = parseInt(m.pop[1]);
    if (m.yf)     settlement.yearFounded   = parseInt(m.yf[1]);
    if (m.ps)     settlement.planSet       = m.ps[1];
    if (m.fc)     settlement.factionCreator = m.fc[1];

    if (line === 'upgrades') {
      i = skipToBrace(lines, i + 1) + 1;
      let ud = 1;
      while (i < lines.length && ud > 0) {
        const ul = cleanLine(lines[i]);
        if (ul === '{') { ud++; i++; continue; }
        if (ul === '}') { ud--; if (ud === 0) break; i++; continue; }
        if (ul) settlement.upgrades.push(ul);
        i++;
      }
      i++; continue;
    }
    i++;
  }

  settlement._lineEnd = i;
  return { settlement, endIndex: i };
}

// ─── Character / Agent block parser ───────────────────────────────────────────
function parseCharBlock(lines, startI) {
  let i = skipToBrace(lines, startI) + 1;
  let x = null, y = null;
  let depth = 1;
  const lineStart = startI - 1;

  while (i < lines.length && depth > 0) {
    const line = cleanLine(lines[i]);
    if (line === '{') { depth++; i++; continue; }
    if (line === '}') { depth--; if (depth === 0) break; i++; continue; }
    const cm = line.match(/^coordinates\s+(\d+)[,\s]+(\d+)/);
    if (cm) { x = parseInt(cm[1]); y = parseInt(cm[2]); }
    i++;
  }
  return { x, y, endIndex: i, _lineStart: lineStart, _lineEnd: i };
}

// ─── descr_strat.txt ─────────────────────────────────────────────────────────
export function parseDescrStrat(text) {
  const lines = text.split('\n');
  const items = [];
  const factions = [];
  let itemId = 0;
  let startDate = '', endDate = '', timescale = '';
  let i = 0;

  while (i < lines.length) {
    const line = cleanLine(lines[i]);
    if (!line) { i++; continue; }

    // Campaign metadata
    let m;
    if ((m = line.match(/^start_date\s+(.+)/)))   { startDate = m[1].trim(); i++; continue; }
    if ((m = line.match(/^end_date\s+(.+)/)))      { endDate   = m[1].trim(); i++; continue; }
    if ((m = line.match(/^timescale\s+([\d.]+)/))) { timescale = m[1];        i++; continue; }

    // Faction block
    if ((m = line.match(/^faction\s+(\w+)(?:,\s*(\w+))?/))) {
      const faction = { name: m[1], type: m[2] || 'human', treasury: 0, settlements: [], characters: [] };
      i = skipToBrace(lines, i + 1) + 1;
      let depth = 1;

      while (i < lines.length && depth > 0) {
        const fl = cleanLine(lines[i]);
        if (fl === '{') { depth++; i++; continue; }
        if (fl === '}') { depth--; if (depth === 0) break; i++; continue; }

        if ((m = fl.match(/^denari\s+(\d+)/))) { faction.treasury = parseInt(m[1]); i++; continue; }

        if (fl === 'settlement') {
          const { settlement, endIndex } = parseSettlementBlock(lines, i + 1);
          settlement.id       = itemId++;
          settlement.faction  = faction.name;
          settlement.category = 'settlement';
          faction.settlements.push(settlement);
          items.push(settlement);
          i = endIndex + 1;
          continue;
        }

        if ((m = fl.match(/^character\s+(.+?),\s*(general|admiral|spy|merchant|diplomat|priest|assassin|princess|heretic|witch|inquisitor|named character)/i))) {
          const { x, y, endIndex, _lineStart, _lineEnd } = parseCharBlock(lines, i + 1);
          if (x !== null) {
            const item = { id: itemId++, category: 'character', charType: m[2].toLowerCase(), name: m[1].trim(), faction: faction.name, x, y, _lineStart, _lineEnd };
            faction.characters.push(item);
            items.push(item);
          }
          i = endIndex + 1;
          continue;
        }

        if ((m = fl.match(/^agent\s+(.+),\s*(\w+)/i))) {
          const { x, y, endIndex } = parseCharBlock(lines, i + 1);
          if (x !== null) {
            items.push({ id: itemId++, category: 'character', charType: m[2].toLowerCase(), name: m[1].trim(), faction: faction.name, x, y });
          }
          i = endIndex + 1;
          continue;
        }

        i++;
      }
      i++;
      factions.push(faction);
      continue;
    }

    // Global resources
    if ((m = line.match(/^resource\s+(\w+)[\s,]+x[\s,]*(\d+)[\s,]+y[\s,]*(\d+)/i))) {
      items.push({ id: itemId++, category: 'resource', type: m[1], x: parseInt(m[2]), y: parseInt(m[3]), _lineNum: i });
      i++; continue;
    }
    if ((m = line.match(/^resource\s+(\w+)$/i))) {
      let rx = null, ry = null;
      for (let j = i + 1; j < Math.min(i + 8, lines.length); j++) {
        const cl = cleanLine(lines[j]);
        const xm = cl.match(/^x[\s,]*(\d+)/i), ym = cl.match(/^y[\s,]*(\d+)/i);
        if (xm) rx = parseInt(xm[1]);
        if (ym) ry = parseInt(ym[1]);
        if (rx !== null && ry !== null) break;
      }
      if (rx !== null && ry !== null)
        items.push({ id: itemId++, category: 'resource', type: m[1], x: rx, y: ry, _lineNum: i });
      i++; continue;
    }

    // Forts / watchtowers
    if ((m = line.match(/^(fort|watchtower)\s+x[\s,]*(\d+)[\s,]+y[\s,]*(\d+)/i))) {
      items.push({ id: itemId++, category: 'fortification', type: m[1], x: parseInt(m[2]), y: parseInt(m[3]), _lineNum: i });
      i++; continue;
    }
    if ((m = line.match(/^(fort|watchtower)$/i))) {
      let fx = null, fy = null;
      for (let j = i + 1; j < Math.min(i + 8, lines.length); j++) {
        const cl = cleanLine(lines[j]);
        const xm = cl.match(/^x[\s,]*(\d+)/i), ym = cl.match(/^y[\s,]*(\d+)/i);
        if (xm) fx = parseInt(xm[1]);
        if (ym) fy = parseInt(ym[1]);
        if (fx !== null && fy !== null) break;
      }
      if (fx !== null && fy !== null)
        items.push({ id: itemId++, category: 'fortification', type: m[1], x: fx, y: fy, _lineNum: i });
      i++; continue;
    }

    i++;
  }

  return { raw: text, items, factions, startDate, endDate, timescale };
}

// ─── Settlement position computation ─────────────────────────────────────────
// Scan map_regions.tga: each black pixel (city) is adjacent to its region color.
// Build regionColor → city pixel map, then assign x,y to each settlement.
export function computeSettlementPositions(settlements, regionsData, regionsLayer) {
  if (!settlements?.length || !regionsData?.length || !regionsLayer?.data) return settlements;
  const { data, width, height } = regionsLayer;

  // region name (lower) → { r, g, b }
  const colorMap = {};
  for (const reg of regionsData) {
    if (reg.regionName) colorMap[reg.regionName.toLowerCase()] = { r: reg.r, g: reg.g, b: reg.b };
  }

  // colorKey → {x, y} (first city/black pixel adjacent to that color)
  const cityPx = {};
  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      const i = (py * width + px) * 4;
      if (data[i] > 5 || data[i+1] > 5 || data[i+2] > 5) continue; // not black
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nx = px + dx, ny = py + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const ni = (ny * width + nx) * 4;
        const nr = data[ni], ng = data[ni+1], nb = data[ni+2];
        if (nr < 5 && ng < 5 && nb < 5) continue;   // neighbor also black
        if (nr > 245 && ng > 245 && nb > 245) continue; // port (white)
        const key = `${nr},${ng},${nb}`;
        if (!cityPx[key]) cityPx[key] = { x: px, y: height - 1 - py }; // M2TW Y-flip
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
function generateSettlementBlock(s, indent = '') {
  const ind4 = indent + '    ';
  const ind8 = indent + '        ';
  const lines = [
    `${indent}settlement`,
    `${indent}{`,
    `${ind4}level ${s.level}`,
    `${ind4}region ${s.region}`,
    ``,
    `${ind4}year_founded ${s.yearFounded ?? 0}`,
    `${ind4}population ${s.population ?? 0}`,
    `${ind4}plan_set ${s.planSet || 'default'}`,
    `${ind4}faction_creator ${s.factionCreator || s.faction}`,
    ``,
    `${ind4}upgrades`,
    `${ind4}{`,
    ...(s.upgrades || []).map(u => `${ind8}${u}`),
    `${ind4}}`,
    `${indent}}`,
  ];
  return lines;
}

export function serializeDescrStrat(stratData, overlayItems, editedSettlements = {}) {
  if (!stratData?.raw) return '';
  const lines = stratData.raw.split('\n');

  // Collect replacements: { start, end, newLines }
  const replacements = [];

  // Patch moved character / resource / fort coordinates
  for (const item of overlayItems) {
    const orig = stratData.items?.find(o => o.id === item.id);
    if (!orig || (orig.x === item.x && orig.y === item.y)) continue;

    if (item.category === 'character' && orig._lineStart !== undefined) {
      // Replace the coordinates line within the character block
      for (let li = orig._lineStart; li <= orig._lineEnd; li++) {
        const cl = cleanLine(lines[li] || '');
        const cm = cl.match(/^coordinates\s+\d+[,\s]+\d+/);
        if (cm) {
          const indent = lines[li].match(/^(\s*)/)[1];
          lines[li] = `${indent}coordinates ${item.x}, ${item.y}`;
          break;
        }
      }
    }

    if (item.category === 'resource' && orig._lineNum !== undefined) {
      const old = lines[orig._lineNum];
      if (old) {
        lines[orig._lineNum] = old
          .replace(/x\s*\d+/, `x ${item.x}`)
          .replace(/y\s*\d+/, `y ${item.y}`);
      }
    }

    if (item.category === 'fortification' && orig._lineNum !== undefined) {
      const old = lines[orig._lineNum];
      if (old) {
        lines[orig._lineNum] = old
          .replace(/x\s*\d+/, `x ${item.x}`)
          .replace(/y\s*\d+/, `y ${item.y}`);
      }
    }
  }

  // Patch edited settlement blocks (replace their line range)
  for (const [id, edits] of Object.entries(editedSettlements)) {
    const orig = stratData.items?.find(it => it.id == id && it.category === 'settlement');
    if (!orig || orig._lineStart === undefined) continue;
    const merged = { ...orig, ...edits };
    // Detect indent from original
    const indentMatch = (lines[orig._lineStart] || '').match(/^(\s*)/);
    const indent = indentMatch ? indentMatch[1] : '    ';
    const newBlock = generateSettlementBlock(merged, indent);
    replacements.push({ start: orig._lineStart, end: orig._lineEnd, newLines: newBlock });
  }

  // Apply replacements in reverse order to preserve line numbers
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