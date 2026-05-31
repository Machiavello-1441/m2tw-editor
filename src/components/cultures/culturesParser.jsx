/**
 * Full parser and serializer for descr_cultures.txt
 */

export const SETTLEMENT_TYPES = [
  'village', 'moot_and_bailey', 'town', 'wooden_castle',
  'large_town', 'castle', 'city', 'fortress',
  'large_city', 'citadel', 'huge_city'
];

export const AGENT_TYPES = ['spy', 'assassin', 'diplomat', 'admiral', 'merchant', 'priest'];

function parsePath(str) {
  // "data/some/path.CAS,    anim_name" → { path, anim }
  const comma = str.indexOf(',');
  if (comma === -1) {
    const parts = str.trim().split(/\s+/);
    return { path: parts[0] || '', anim: parts[1] || '' };
  }
  const path = str.slice(0, comma).trim();
  const anim = str.slice(comma + 1).trim();
  return { path, anim };
}

export function parseDescrCulturesFull(text) {
  const cultures = [];

  // Split by separator lines (lines of 3+ semicolons)
  const rawBlocks = text.split(/^;{3,}[;\s]*$/m);

  for (const block of rawBlocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    // Find culture header
    const cultureMatch = trimmed.match(/^culture\s+(\S+)/m);
    if (!cultureMatch) continue;

    const culture = {
      name: cultureMatch[1],
      portraitMapping: '',
      rebelStandardIndex: 0,
      settlements: {},
      fort: { path: '', anim: '' },
      fortCost: 500,
      fortWall: '',
      fishingVillage: { path: '', anim: '' },
      ports: [
        { land: { path: '', anim: '' }, sea: { path: '' } },
        { land: { path: '', anim: '' }, sea: { path: '' } },
        { land: { path: '', anim: '' }, sea: { path: '' } },
      ],
      watchtower: { path: '', anim: '' },
      watchtowerCost: 200,
      agents: {},
      offmapSettlement: {
        village:    { path: 'data/models_building/offmap_village_dummy.cas', dist: 200, num: 0 },
        town:       { path: 'data/models_building/offmap_town_roman.cas',    dist: 200, num: 0 },
        large_town: { path: 'data/models_building/offmap_town_roman.cas',    dist: 200, num: 0 },
        city:       { path: 'data/models_building/offmap_city_roman.cas',    dist: 200, num: 0 },
        large_city: { path: 'data/models_building/offmap_city_roman.cas',    dist: 200, num: 0 },
        huge_city:  { path: 'data/models_building/offmap_city_roman.cas',    dist: 200, num: 0 },
      },
      offmapPort: {
        fishing_village: { path: 'data/models_building/offmap_fishing_village_roman.CAS', dist: 200, num: 0 },
        sea_port:        { path: 'data/models_building/offmap_port_roman.cas',            dist: 200, num: 0 },
        shipwright:      { path: 'data/models_building/offmap_port_roman.cas',            dist: 200, num: 0 },
        dockyard:        { path: 'data/models_building/offmap_port_roman.cas',            dist: 200, num: 0 },
      },
    };

    // Init all settlement types
    for (const st of SETTLEMENT_TYPES) {
      culture.settlements[st] = { normal: '', normalAnim: '', card: '' };
    }

    // Init agents
    for (const ag of AGENT_TYPES) {
      culture.agents[ag] = { tga: `${ag}.tga`, infoTga: `${ag}_info.tga`, tga2: `${ag}.tga`, cost: 200, n1: 1, n2: 1 };
    }

    const lines = trimmed.split('\n');
    let inSettlements = false;
    let braceDepth = 0;
    let currentType = null;
    let portIdx = -1;

    for (const raw of lines) {
      const line = raw.replace(/;.*$/, '').trim();
      if (!line) continue;

      if (!inSettlements) {
        let m;
        if ((m = line.match(/^portrait_mapping\s+(\S+)/i))) { culture.portraitMapping = m[1]; continue; }
        if ((m = line.match(/^rebel_standard_index\s+(\d+)/i))) { culture.rebelStandardIndex = parseInt(m[1]); continue; }

        if (line === '{') { inSettlements = true; braceDepth = 1; continue; }

        if ((m = line.match(/^fort\s+(.+)/i))) {
          culture.fort = parsePath(m[1]);
          continue;
        }
        if ((m = line.match(/^fort_cost\s+(\d+)/i))) { culture.fortCost = parseInt(m[1]); continue; }
        if ((m = line.match(/^fort_wall\s+(\S+)/i))) { culture.fortWall = m[1]; continue; }
        if ((m = line.match(/^fishing_village\s+(.+)/i))) { culture.fishingVillage = parsePath(m[1]); continue; }
        if ((m = line.match(/^watchtower\s+(.+)/i))) { culture.watchtower = parsePath(m[1]); continue; }
        if ((m = line.match(/^watchtower_cost\s+(\d+)/i))) { culture.watchtowerCost = parseInt(m[1]); continue; }

        if ((m = line.match(/^port_land\s+(.+)/i))) {
          portIdx = Math.min(portIdx + 1, 2);
          culture.ports[portIdx].land = parsePath(m[1]);
          continue;
        }
        if ((m = line.match(/^port_sea\s+(.+)/i))) {
          const idx = Math.max(portIdx, 0);
          const p = parsePath(m[1]);
          culture.ports[idx].sea = { path: p.path };
          continue;
        }

        // Agents: spy tga info.tga tga2 cost n1 n2
        const agentRx = new RegExp(`^(${AGENT_TYPES.join('|')})\\s+(\\S+)\\s+(\\S+)\\s+(\\S+)\\s+(\\d+)\\s+(\\d+)\\s+(\\d+)`, 'i');
        if ((m = line.match(agentRx))) {
          const ag = m[1].toLowerCase();
          culture.agents[ag] = {
            tga: m[2], infoTga: m[3], tga2: m[4],
            cost: parseInt(m[5]), n1: parseInt(m[6]), n2: parseInt(m[7])
          };
        }
      } else {
        // Inside settlement block
        if (line === '{') { braceDepth++; continue; }
        if (line === '}') {
          braceDepth--;
          if (braceDepth === 0) { inSettlements = false; currentType = null; }
          else if (braceDepth === 1) { currentType = null; }
          continue;
        }
        if (braceDepth === 1 && SETTLEMENT_TYPES.includes(line)) {
          currentType = line;
          continue;
        }
        if (braceDepth === 2 && currentType) {
          let m;
          if ((m = line.match(/^normal\s+(.+)/i))) {
            const { path, anim } = parsePath(m[1]);
            culture.settlements[currentType].normal = path;
            culture.settlements[currentType].normalAnim = anim;
          } else if ((m = line.match(/^card\s+(\S+)/i))) {
            culture.settlements[currentType].card = m[1];
          }
        }
      }
    }

    cultures.push(culture);
  }

  return cultures;
}

const T = '\t\t\t\t'; // 4 tabs for alignment

function pad(key, value, tabs = 3) {
  return key + '\t'.repeat(Math.max(1, tabs - Math.floor(key.length / 4))) + value;
}

export function serializeDescrCulturesFull(cultures) {
  const SEP = ';'.repeat(169);
  const blocks = [];

  for (const c of cultures) {
    const lines = [];
    lines.push(SEP);
    lines.push('');
    lines.push(`culture\t\t\t\t${c.name}`);
    lines.push(`portrait_mapping\t${c.portraitMapping}`);
    lines.push(`rebel_standard_index\t${c.rebelStandardIndex}`);
    lines.push('{');
    for (const st of SETTLEMENT_TYPES) {
      const s = c.settlements[st] || { normal: '', normalAnim: '', card: '' };
      lines.push(st);
      lines.push('{');
      lines.push(`\tnormal\t\t\t\t${s.normal}${s.normalAnim ? ',\t\t' + s.normalAnim : ''}`);
      lines.push(`\tcard\t\t\t\t${s.card}`);
      lines.push('}');
    }
    lines.push('}');

    // Fort
    lines.push(`fort\t\t\t\t${c.fort.path}${c.fort.anim ? ',\t\t\t\t\t' + c.fort.anim : ''}`);
    lines.push(`fort_cost\t\t\t${c.fortCost}`);
    lines.push(`fort_wall\t\t\t${c.fortWall}`);

    // Ports
    lines.push(`fishing_village\t\t${c.fishingVillage.path}${c.fishingVillage.anim ? ',\t\t\t\t' + c.fishingVillage.anim : ''}`);
    for (let i = 0; i < 3; i++) {
      const port = c.ports[i] || { land: { path: '', anim: '' }, sea: { path: '' } };
      lines.push(`port_land\t\t\t${port.land.path}${port.land.anim ? ',\t\t\t\t\t' + port.land.anim : ','}`);
      lines.push(`port_sea\t\t\t${port.sea.path},`);
    }

    // Watchtower
    lines.push(`watchtower\t\t\t${c.watchtower.path}${c.watchtower.anim ? ',\t\t\t\t\t' + c.watchtower.anim : ''}`);
    lines.push(`watchtower_cost\t\t${c.watchtowerCost}`);

    // Agents
    for (const ag of AGENT_TYPES) {
      const a = c.agents[ag] || { tga: `${ag}.tga`, infoTga: `${ag}_info.tga`, tga2: `${ag}.tga`, cost: 200, n1: 1, n2: 1 };
      const extraTab = ag === 'spy' || ag === 'assassin' || ag === 'diplomat' || ag === 'merchant' || ag === 'admiral' ? '\t' : '';
      lines.push(`${ag}\t\t${extraTab}${a.tga}\t\t${a.infoTga}\t\t\t${a.tga2}\t${a.cost}\t${a.n1}\t${a.n2}`);
    }

    blocks.push(lines.join('\n'));
  }

  return blocks.join('\n') + '\n' + SEP + '\n';
}