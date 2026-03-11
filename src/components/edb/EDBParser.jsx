// EDB Parser - parses export_descr_buildings.txt into structured data

export const BUILDING_TRAITS = [
  'recruit_pool', 'wall_level', 'tower_level', 'gate_strength', 'gate_defences',
  'happiness_bonus', 'law_bonus', 'trade_base_income_bonus', 'trade_level_bonus',
  'trade_fleet', 'taxable_income_bonus', 'mine_resource', 'farming_level',
  'road_level', 'free_upkeep', 'armour', 'weapon_simple', 'weapon_bladed',
  'weapon_missile', 'weapon_siege', 'weapon_other', 'weapon_naval_gunpowder',
  'recruitment_slots', 'agent', 'agent_limit', 'population_health_bonus',
  'population_growth_bonus', 'stage_games', 'stage_races', 'construction_cost_bonus_military',
  'construction_cost_bonus_religious', 'construction_cost_bonus_defensive',
  'construction_cost_bonus_other', 'construction_time_bonus_military',
  'construction_time_bonus_religious', 'construction_time_bonus_defensive',
  'construction_time_bonus_other', 'religious_belief', 'religious_order',
  'archer_bonus', 'cavalry_bonus', 'heavy_cavalry_bonus', 'gun_bonus',
  'navy_bonus', 'religious_conversion', 'body_guard',
];

export const SETTLEMENT_TYPES = ['city', 'castle'];
export const SETTLEMENT_LEVELS = ['village', 'town', 'large_town', 'city', 'large_city', 'huge_city'];
export const MATERIALS = ['wooden', 'stone'];

export const CULTURES = [
  'northern_european', 'mesoamerican', 'middle_eastern',
  'eastern_european', 'greek', 'southern_european'
];

export const FACTIONS = [
  'england', 'scotland', 'france', 'hre', 'denmark', 'spain', 'portugal',
  'milan', 'venice', 'papal_states', 'sicily', 'poland', 'russia', 'hungary',
  'byzantium', 'moors', 'egypt', 'turks', 'mongols', 'timurids', 'aztecs',
  'Normans', 'Saxons'
];

export const HIDDEN_RESOURCES_DEFAULT = [
  'sparta', 'rome', 'italy', 'america', 'atlantic', 'explorers_guild',
  'swordsmiths_guild', 'woodsmens_guild', 'teutonic_knights_chapter_house',
  'knights_of_santiago_chapter_house', 'crusade', 'jihad', 'arguin',
  'horde_target', 'no_pirates', 'no_brigands'
];

function parseRequirements(reqStr) {
  // Parse requirement string like:
  // "factions { england, scotland, }  and event_counter gunpowder_discovered 1"
  if (!reqStr || !reqStr.trim()) return [];
  
  const conditions = [];
  let remaining = reqStr.trim();
  
  // Split on top-level "and" / "or" / "and not" outside braces
  const parts = [];
  let depth = 0;
  let current = '';
  const tokens = remaining.split(/\s+/);
  let i = 0;
  
  while (i < tokens.length) {
    const token = tokens[i];
    
    if (token === '{') {
      depth++;
      current += ' ' + token;
    } else if (token === '}') {
      depth--;
      current += ' ' + token;
    } else if (depth === 0 && (token === 'and' || token === 'or')) {
      if (current.trim()) {
        // Check if next token is "not"
        let connector = token;
        if (i + 1 < tokens.length && tokens[i + 1] === 'not') {
          connector = token + ' not';
          i++;
        }
        parts.push({ text: current.trim(), connector: null });
        current = '';
        parts[parts.length - 1].nextConnector = connector;
      }
    } else {
      current += ' ' + token;
    }
    i++;
  }
  if (current.trim()) {
    parts.push({ text: current.trim(), connector: null });
  }
  
  for (const part of parts) {
    const text = part.text;
    const cond = { connector: part.nextConnector || null };
    
    if (text.startsWith('factions')) {
      const match = text.match(/factions\s*\{([^}]*)\}/);
      if (match) {
        cond.type = 'factions';
        cond.values = match[1].split(',').map(f => f.trim()).filter(Boolean);
      }
    } else if (text.startsWith('event_counter')) {
      const match = text.match(/event_counter\s+(\S+)\s+(\d+)/);
      if (match) {
        cond.type = 'event_counter';
        cond.event = match[1];
        cond.value = parseInt(match[2]);
      }
    } else if (text.startsWith('hidden_resource')) {
      const match = text.match(/hidden_resource\s+(\S+)/);
      if (match) {
        cond.type = 'hidden_resource';
        cond.resource = match[1];
      }
    } else if (text.startsWith('building_present')) {
      const match = text.match(/building_present(?:_min_level)?\s+(\S+)\s+(\S+)/);
      if (match) {
        cond.type = 'building_present_min_level';
        cond.building = match[1];
        cond.level = match[2];
      }
    } else if (text.startsWith('resource')) {
      const match = text.match(/resource\s+(\S+)/);
      if (match) {
        cond.type = 'resource';
        cond.resource = match[1];
      }
    } else if (text.startsWith('region_religion')) {
      const match = text.match(/region_religion\s+(\S+)\s+(\d+)/);
      if (match) {
        cond.type = 'region_religion';
        cond.religion = match[1];
        cond.percentage = parseInt(match[2]);
      }
    } else {
      cond.type = 'raw';
      cond.text = text;
    }
    
    conditions.push(cond);
  }
  
  return conditions;
}

function parseCapabilityLine(line) {
  line = line.trim();
  
  // recruit_pool parsing
  if (line.startsWith('recruit_pool')) {
    const match = line.match(/recruit_pool\s+"([^"]+)"\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s+requires\s+(.*))?/);
    if (match) {
      return {
        type: 'recruit_pool',
        unitName: match[1],
        initialPool: parseFloat(match[2]),
        replenishRate: parseFloat(match[3]),
        maxPool: parseFloat(match[4]),
        experience: parseInt(match[5]),
        requirements: match[6] ? parseRequirements(match[6]) : []
      };
    }
  }
  
  // bonus-style capabilities: "identifier bonus N" or "identifier N"
  const bonusMatch = line.match(/^(\S+)\s+bonus\s+([-\d.]+)/);
  if (bonusMatch) {
    return {
      type: 'bonus',
      identifier: bonusMatch[1],
      value: parseFloat(bonusMatch[2])
    };
  }
  
  // simple value capabilities: "identifier N"
  const simpleMatch = line.match(/^(\S+)\s+([-\d.]+)/);
  if (simpleMatch) {
    return {
      type: 'simple',
      identifier: simpleMatch[1],
      value: parseFloat(simpleMatch[2])
    };
  }
  
  // agent-style: "agent merchant" or "agent_limit merchant 1"
  if (line.startsWith('agent_limit')) {
    const parts = line.split(/\s+/);
    return { type: 'agent_limit', identifier: 'agent_limit', agentType: parts[1], value: parseInt(parts[2] || 1) };
  }
  if (line.startsWith('agent ')) {
    const parts = line.split(/\s+/);
    return { type: 'agent', identifier: 'agent', agentType: parts[1] };
  }
  
  // body_guard
  if (line.startsWith('body_guard')) {
    return { type: 'raw', text: line };
  }
  
  return { type: 'raw', text: line };
}

export function parseEDB(text) {
  const lines = text.split('\n');
  let hiddenResources = [];
  const buildings = [];
  let i = 0;
  
  // Skip comments and empty lines, find hidden_resources
  while (i < lines.length) {
    const line = lines[i].trim();
    if (line.startsWith(';') || line === '') { i++; continue; }
    if (line.startsWith('hidden_resources')) {
      hiddenResources = line.replace('hidden_resources', '').trim().split(/\s+/);
      i++;
      continue;
    }
    if (line.startsWith('building ')) {
      const building = parseBuilding(lines, i);
      buildings.push(building.data);
      i = building.nextIndex;
    } else {
      i++;
    }
  }
  
  return { hiddenResources, buildings };
}

function parseBuilding(lines, startIndex) {
  const headerLine = lines[startIndex].trim();
  const buildingName = headerLine.replace('building ', '').trim();
  
  const building = {
    name: buildingName,
    convertTo: null,
    levels: [],
    plugins: '',
    factionCapability: []
  };
  
  let i = startIndex + 1;
  // Skip to opening brace
  while (i < lines.length && lines[i].trim() !== '{') i++;
  i++; // skip {
  
  let braceDepth = 1;
  
  while (i < lines.length && braceDepth > 0) {
    const line = lines[i].trim();
    
    if (line === '}') {
      braceDepth--;
      if (braceDepth === 0) { i++; break; }
      i++; continue;
    }
    
    if (line.startsWith('convert_to ')) {
      building.convertTo = line.replace('convert_to ', '').trim();
      i++; continue;
    }
    
    if (line.startsWith('levels ')) {
      // Parse levels line - extract level names
      const levelsLine = line.replace('levels ', '').trim();
      // Level names are space-separated, but the block starts with {
      // We need to find where the level names end
      const levelsPart = [];
      const parts = levelsLine.split(/\s+/);
      
      // Collect all level names (they come before the { or are on the same line)
      for (const p of parts) {
        if (p === '{') break;
        levelsPart.push(p);
      }
      
      // Find the { that starts the levels block
      let levelsBlockStart = i;
      if (!levelsLine.includes('{')) {
        i++;
        while (i < lines.length && !lines[i].trim().startsWith('{')) i++;
      }
      i++; // skip {
      
      // Now parse each level
      let levelDepth = 1;
      while (i < lines.length && levelDepth > 0) {
        const lLine = lines[i].trim();
        
        if (lLine === '}') {
          levelDepth--;
          i++;
          continue;
        }
        
        // Check if this is a level definition line
        // Format: level_name (city|castle) requires ...
        const levelMatch = lLine.match(/^(\S+)\s+(city|castle)\s*(.*)/);
        if (levelMatch && levelsPart.includes(levelMatch[1])) {
          const level = parseLevelBlock(lines, i, levelMatch[1], levelMatch[2], levelMatch[3] || '');
          building.levels.push(level.data);
          i = level.nextIndex;
        } else {
          i++;
        }
      }
      continue;
    }
    
    if (line.startsWith('plugins')) {
      // Skip plugins block
      while (i < lines.length && !lines[i].trim().startsWith('{')) i++;
      i++; // skip {
      let pluginDepth = 1;
      while (i < lines.length && pluginDepth > 0) {
        if (lines[i].trim() === '{') pluginDepth++;
        if (lines[i].trim() === '}') pluginDepth--;
        i++;
      }
      continue;
    }
    
    if (line.startsWith('faction_capability')) {
      // Parse faction_capability block
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('{')) i++;
      i++; // skip {
      let fcDepth = 1;
      while (i < lines.length && fcDepth > 0) {
        const fcLine = lines[i].trim();
        if (fcLine === '{') { fcDepth++; i++; continue; }
        if (fcLine === '}') { fcDepth--; i++; continue; }
        if (fcLine) {
          building.factionCapability.push(parseCapabilityLine(fcLine));
        }
        i++;
      }
      continue;
    }
    
    i++;
  }
  
  return { data: building, nextIndex: i };
}

function parseLevelBlock(lines, startIndex, levelName, settlementType, requiresStr) {
  const level = {
    name: levelName,
    settlementType,
    requirements: [],
    convertTo: null,
    capabilities: [],
    factionCapability: [],
    material: 'wooden',
    construction: 1,
    cost: 0,
    settlementMin: 'village',
    upgrades: []
  };
  
  // Parse the requirements from the header line
  if (requiresStr) {
    let reqText = requiresStr.trim();
    if (reqText.startsWith('requires')) {
      reqText = reqText.replace(/^requires\s*/, '');
    }
    level.requirements = parseRequirements(reqText);
  }
  
  let i = startIndex + 1;
  // Find opening brace
  while (i < lines.length && lines[i].trim() !== '{') i++;
  i++; // skip {
  
  let depth = 1;
  let inCapability = false;
  let inFactionCapability = false;
  let inUpgrades = false;
  let capDepth = 0;
  
  while (i < lines.length && depth > 0) {
    const line = lines[i].trim();
    
    if (line === '}') {
      if (inCapability) {
        capDepth--;
        if (capDepth === 0) inCapability = false;
        i++; continue;
      }
      if (inFactionCapability) {
        capDepth--;
        if (capDepth === 0) inFactionCapability = false;
        i++; continue;
      }
      if (inUpgrades) {
        inUpgrades = false;
        i++; continue;
      }
      depth--;
      i++; continue;
    }
    
    if (line === '{') {
      if (inCapability || inFactionCapability) capDepth++;
      i++; continue;
    }
    
    if (inCapability) {
      if (line) level.capabilities.push(parseCapabilityLine(line));
      i++; continue;
    }
    
    if (inFactionCapability) {
      if (line) level.factionCapability.push(parseCapabilityLine(line));
      i++; continue;
    }
    
    if (inUpgrades) {
      if (line && line !== '{' && line !== '}') {
        level.upgrades.push(line.trim());
      }
      i++; continue;
    }
    
    if (line.startsWith('convert_to ')) {
      level.convertTo = line.replace('convert_to ', '').trim();
      i++; continue;
    }
    
    if (line === 'capability') {
      inCapability = true;
      // Find next {
      i++;
      while (i < lines.length && lines[i].trim() !== '{') i++;
      capDepth = 1;
      i++; continue;
    }
    
    if (line === 'faction_capability') {
      inFactionCapability = true;
      i++;
      while (i < lines.length && lines[i].trim() !== '{') i++;
      capDepth = 1;
      i++; continue;
    }
    
    if (line.startsWith('material ')) {
      level.material = line.replace('material ', '').trim();
      i++; continue;
    }
    
    if (line.startsWith('construction')) {
      const match = line.match(/construction\s+([\d.]+)/);
      if (match) level.construction = parseInt(match[1]);
      i++; continue;
    }
    
    if (line.startsWith('cost')) {
      const match = line.match(/cost\s+([\d.]+)/);
      if (match) level.cost = parseInt(match[1]);
      i++; continue;
    }
    
    if (line.startsWith('settlement_min')) {
      level.settlementMin = line.replace('settlement_min ', '').trim();
      i++; continue;
    }
    
    if (line === 'upgrades' || line.startsWith('upgrades')) {
      inUpgrades = true;
      if (!line.includes('{')) {
        i++;
        while (i < lines.length && lines[i].trim() !== '{') i++;
      }
      i++; continue;
    }
    
    i++;
  }
  
  return { data: level, nextIndex: i };
}

// Serialize back to EDB format
export function serializeEDB(edbData) {
  let output = ';This file is generated from M2TW EDB Editor\n\n\n\n\n';
  output += 'hidden_resources ' + edbData.hiddenResources.join(' ') + '\n\n';
  
  for (const building of edbData.buildings) {
    output += serializeBuilding(building);
    output += '\n';
  }
  
  return output;
}

function serializeBuilding(building) {
  let out = `building ${building.name}\n{\n`;
  
  if (building.convertTo) {
    out += `    convert_to ${building.convertTo}\n`;
  }
  
  const levelNames = building.levels.map(l => l.name).join(' ');
  out += `    levels ${levelNames} \n    {\n`;
  
  for (const level of building.levels) {
    out += serializeLevel(level);
  }
  
  out += '    }\n';
  out += '    plugins \n    {\n    }\n';
  out += '}\n';
  
  return out;
}

function serializeRequirements(reqs) {
  if (!reqs || reqs.length === 0) return '';
  
  let out = '';
  for (let i = 0; i < reqs.length; i++) {
    const req = reqs[i];
    
    if (i > 0) {
      const prevConn = reqs[i - 1].connector;
      if (prevConn) {
        out += ` ${prevConn} `;
      } else {
        out += ' and ';
      }
    }
    
    if (req.type === 'factions') {
      out += `factions { ${req.values.join(', ')}, }`;
    } else if (req.type === 'event_counter') {
      out += `event_counter ${req.event} ${req.value}`;
    } else if (req.type === 'hidden_resource') {
      out += `hidden_resource ${req.resource}`;
    } else if (req.type === 'building_present_min_level') {
      out += `building_present_min_level ${req.building} ${req.level}`;
    } else if (req.type === 'resource') {
      out += `resource ${req.resource}`;
    } else if (req.type === 'region_religion') {
      out += `region_religion ${req.religion} ${req.percentage}`;
    } else if (req.type === 'raw') {
      out += req.text;
    }
  }
  
  return out;
}

function serializeLevel(level) {
  let reqStr = '';
  if (level.requirements && level.requirements.length > 0) {
    reqStr = ' requires ' + serializeRequirements(level.requirements);
  }
  
  let out = `        ${level.name} ${level.settlementType}${reqStr} \n        {\n`;
  
  if (level.convertTo !== null && level.convertTo !== undefined) {
    out += `            convert_to ${level.convertTo}\n`;
  }
  
  out += '            capability\n            {\n';
  for (const cap of level.capabilities) {
    out += '                ' + serializeCapability(cap) + '\n';
  }
  out += '            }\n';
  
  if (level.factionCapability && level.factionCapability.length > 0) {
    out += '            faction_capability\n            {\n';
    for (const cap of level.factionCapability) {
      out += '                ' + serializeCapability(cap) + '\n';
    }
    out += '            }\n';
  }
  
  out += `            material ${level.material}\n`;
  out += `            construction  ${level.construction} \n`;
  out += `            cost  ${level.cost} \n`;
  out += `            settlement_min ${level.settlementMin}\n`;
  out += '            upgrades\n            {\n';
  for (const up of level.upgrades) {
    out += `                ${up}\n`;
  }
  out += '            }\n';
  out += '        }\n';
  
  return out;
}

function serializeCapability(cap) {
  if (cap.type === 'recruit_pool') {
    let line = `recruit_pool "${cap.unitName}"  ${cap.initialPool}   ${cap.replenishRate}   ${cap.maxPool}  ${cap.experience}`;
    if (cap.requirements && cap.requirements.length > 0) {
      line += '  requires ' + serializeRequirements(cap.requirements);
    }
    return line;
  }
  
  if (cap.type === 'bonus') {
    return `${cap.identifier} bonus ${cap.value}`;
  }
  
  if (cap.type === 'simple') {
    return `${cap.identifier} ${cap.value}`;
  }
  
  if (cap.type === 'agent') {
    return `agent ${cap.agentType}`;
  }
  
  if (cap.type === 'agent_limit') {
    return `agent_limit ${cap.agentType} ${cap.value}`;
  }
  
  return cap.text || '';
}

// Create a new building with defaults
export function createDefaultBuilding(name) {
  return {
    name: name || 'new_building',
    convertTo: null,
    levels: [{
      name: name ? name + '_1' : 'new_level_1',
      settlementType: 'city',
      requirements: [{ type: 'factions', values: ['northern_european', 'southern_european'], connector: null }],
      convertTo: null,
      capabilities: [
        { type: 'bonus', identifier: 'happiness_bonus', value: 1 }
      ],
      factionCapability: [],
      material: 'wooden',
      construction: 2,
      cost: 600,
      settlementMin: 'village',
      upgrades: []
    }],
    plugins: '',
    factionCapability: []
  };
}

// Create a new level with defaults
export function createDefaultLevel(baseName, index) {
  return {
    name: baseName + '_' + (index + 1),
    settlementType: 'city',
    requirements: [{ type: 'factions', values: ['northern_european', 'southern_european'], connector: null }],
    convertTo: null,
    capabilities: [],
    factionCapability: [],
    material: 'wooden',
    construction: 2,
    cost: 600,
    settlementMin: 'village',
    upgrades: []
  };
}