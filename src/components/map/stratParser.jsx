/**
 * Parser and serializer for M2TW descr_strat.txt, descr_regions.txt,
 * *_regions_and_settlement_names.txt, and descr_sm_factions.txt
 */

// ─── descr_regions.txt ────────────────────────────────────────────────────────
export function parseDescrRegions(text) {
  const regions = [];
  const lines = text.split('\n').map(l => l.replace(/;.*$/, '').trim()).filter(Boolean);
  let i = 0;
  while (i < lines.length) {
    const regionName = lines[i++];
    if (!regionName || !lines[i]) break;
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

// ─── regions_and_settlement_names.txt ─────────────────────────────────────────
export function parseSettlementNames(text) {
  const names = {};
  const regex = /\{([^}]+)\}([^\n{]+)/g;
  let m;
  while ((m = regex.exec(text)) !== null) {
    names[m[1].trim()] = m[2].trim();
  }
  return names;
}

// ─── descr_sm_factions.txt ───────────────────────────────────────────────────
export function parseDescrSmFactions(text) {
  const factions = {};
  const lines = text.split('\n');
  let currentFaction = null;

  for (const raw of lines) {
    const line = raw.replace(/;.*$/, '').trim();
    if (!line) continue;

    const factionMatch = line.match(/^faction\s+(\w+)/);
    if (factionMatch) { currentFaction = factionMatch[1]; factions[currentFaction] = {}; continue; }
    if (!currentFaction) continue;

    const primaryColMatch = line.match(/^primary_colour\s+red\s+(\d+),?\s*green\s+(\d+),?\s*blue\s+(\d+)/);
    if (primaryColMatch) {
      factions[currentFaction].primaryColor = {
        r: parseInt(primaryColMatch[1]),
        g: parseInt(primaryColMatch[2]),
        b: parseInt(primaryColMatch[3]),
      };
    }
  }
  return factions;
}

// ─── descr_strat.txt (partial — extract resources, characters, fortifications) ─
export function parseDescrStrat(text) {
  const items = [];
  const lines = text.split('\n');
  let id = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/;.*$/, '').trim();
    if (!line) continue;

    // Resources: multiple formats
    // "resource coal, x 123, y 456" or "resource coal x 123 y 456"
    let resMatch = line.match(/^resource\s+(\w+)[\s,]+x[\s,]*(\d+)[\s,]+y[\s,]*(\d+)/i);
    if (resMatch) {
      items.push({ id: id++, category: 'resource', type: resMatch[1], x: parseInt(resMatch[2]), y: parseInt(resMatch[3]) });
      continue;
    }
    // Multiline resource: "resource <type>" followed by "x" and "y" lines
    const resKeyMatch = line.match(/^resource\s+(\w+)$/i);
    if (resKeyMatch) {
      const resType = resKeyMatch[1];
      let rx = null, ry = null;
      for (let j = i + 1; j < Math.min(i + 8, lines.length); j++) {
        const cl = lines[j].replace(/;.*$/, '').trim();
        const xm = cl.match(/^x[\s,]*(\d+)/i);
        const ym = cl.match(/^y[\s,]*(\d+)/i);
        if (xm) rx = parseInt(xm[1]);
        if (ym) ry = parseInt(ym[1]);
        if (rx !== null && ry !== null) break;
      }
      if (rx !== null && ry !== null) {
        items.push({ id: id++, category: 'resource', type: resType, x: rx, y: ry });
      }
      continue;
    }

    // Fortifications: "fort x 123, y 456" or "watchtower x 456, y 789"
    let fortMatch = line.match(/^(fort|watchtower)\s+x[\s,]*(\d+)[\s,]+y[\s,]*(\d+)/i);
    if (fortMatch) {
      items.push({ id: id++, category: 'fortification', type: fortMatch[1], x: parseInt(fortMatch[2]), y: parseInt(fortMatch[3]) });
      continue;
    }
    // Fortifications multiline format: "fort" or "watchtower" on its own line
    const fortKeyMatch = line.match(/^(fort|watchtower)$/i);
    if (fortKeyMatch) {
      const fortType = fortKeyMatch[1];
      let fx = null, fy = null;
      for (let j = i + 1; j < Math.min(i + 8, lines.length); j++) {
        const cl = lines[j].replace(/;.*$/, '').trim();
        const xm = cl.match(/^x[\s,]*(\d+)/i);
        const ym = cl.match(/^y[\s,]*(\d+)/i);
        if (xm) fx = parseInt(xm[1]);
        if (ym) fy = parseInt(ym[1]);
        if (fx !== null && fy !== null) break;
      }
      if (fx !== null && fy !== null) {
        items.push({ id: id++, category: 'fortification', type: fortType, x: fx, y: fy });
      }
      continue;
    }

    // Characters: "character <name>, <type>, ..." optionally with inline x/y or a following "coordinates x y" line
    const charMatch = line.match(/^character\s+(.+?),\s*(general|admiral|spy|merchant|diplomat|priest|assassin|princess|heretic|witch|inquisitor|named character)/i);
    if (charMatch) {
      const charName = charMatch[1].trim();
      const charType = charMatch[2].toLowerCase();
      // Check for inline coordinates: "x 123, y 456" on same line
      const inlineCoord = line.match(/[,\s]+x\s+(\d+)[,\s]+y\s+(\d+)/i);
      if (inlineCoord) {
        items.push({ id: id++, category: 'character', charType, name: charName, x: parseInt(inlineCoord[1]), y: parseInt(inlineCoord[2]) });
      } else {
        // Look ahead for coordinates
        for (let j = i + 1; j < Math.min(i + 20, lines.length); j++) {
          const cl = lines[j].replace(/;.*$/, '').trim();
          const coordMatch = cl.match(/^coordinates\s+(\d+)[,\s]+(\d+)/);
          if (coordMatch) {
            items.push({ id: id++, category: 'character', charType, name: charName, x: parseInt(coordMatch[1]), y: parseInt(coordMatch[2]) });
            break;
          }
          // Stop if we hit another top-level keyword
          if (/^(character|agent|settlement|resource|fort|watchtower|end)\b/.test(cl)) break;
        }
      }
      continue;
    }

    // Agents: "agent <name>, <type>, ..." (separate from named character)
    const agentMatch = line.match(/^agent\s+(.+),\s*(\w+)/i);
    if (agentMatch) {
      const agentName = agentMatch[1].trim();
      const agentType = agentMatch[2].toLowerCase();
      for (let j = i + 1; j < Math.min(i + 15, lines.length); j++) {
        const cl = lines[j].replace(/;.*$/, '').trim();
        const coordMatch = cl.match(/^coordinates\s+(\d+),?\s*(\d+)/);
        if (coordMatch) {
          items.push({ id: id++, category: 'character', charType: agentType, name: agentName, x: parseInt(coordMatch[1]), y: parseInt(coordMatch[2]) });
          break;
        }
      }
      continue;
    }
  }

  return { raw: text, items };
}

export function serializeDescrStrat(stratData, overlayItems) {
  // Simple passthrough — we just update coordinates for moved items
  if (!stratData?.raw) return '';
  // Return raw for now; a full serializer would patch coordinate lines
  return stratData.raw;
}