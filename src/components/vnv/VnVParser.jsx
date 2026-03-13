// Parser & Serializer for export_descr_character_traits.txt (EDCT) and export_descr_ancillaries.txt (EDA)

// ─── TRAIT PARSER ─────────────────────────────────────────────────────────────

export function parseTraitFile(text) {
  const lines = text.replace(/\r/g, '').split('\n');
  const traits = [];
  const triggers = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line || line.startsWith(';')) { i++; continue; }

    if (line.startsWith('Trait ')) {
      const result = parseTrait(lines, i);
      traits.push(result.data);
      i = result.nextIndex;
    } else if (line.startsWith('Trigger ')) {
      const result = parseTraitTrigger(lines, i);
      triggers.push(result.data);
      i = result.nextIndex;
    } else {
      i++;
    }
  }

  return { traits, triggers };
}

function parseTrait(lines, startIndex) {
  const nameLine = lines[startIndex].trim();
  const traitName = nameLine.replace(/^Trait\s+/, '').trim();

  const trait = {
    name: traitName,
    characters: [],
    hidden: false,
    excludeCultures: [],
    noGoingBackLevel: null,
    antiTraits: [],
    levels: [],
  };

  let i = startIndex + 1;

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trim();

    // Stop if we hit next top-level block
    if (line.startsWith('Trait ') || line.startsWith('Trigger ')) break;
    if (!line || line.startsWith(';')) { i++; continue; }

    if (line.startsWith('Characters ')) {
      trait.characters = line.replace('Characters ', '').split(',').map(s => s.trim()).filter(Boolean);
      i++; continue;
    }
    if (line === 'Hidden') {
      trait.hidden = true;
      i++; continue;
    }
    if (line.startsWith('ExcludeCultures ')) {
      trait.excludeCultures = line.replace('ExcludeCultures ', '').split(',').map(s => s.trim()).filter(Boolean);
      i++; continue;
    }
    if (line.startsWith('NoGoingBackLevel ')) {
      trait.noGoingBackLevel = parseInt(line.replace('NoGoingBackLevel ', '').trim());
      i++; continue;
    }
    if (line.startsWith('AntiTraits ')) {
      trait.antiTraits = line.replace('AntiTraits ', '').split(',').map(s => s.trim()).filter(Boolean);
      i++; continue;
    }
    if (line.startsWith('Level ')) {
      const result = parseTraitLevel(lines, i);
      trait.levels.push(result.data);
      i = result.nextIndex;
      continue;
    }
    i++;
  }

  return { data: trait, nextIndex: i };
}

function parseTraitLevel(lines, startIndex) {
  const levelName = lines[startIndex].trim().replace(/^Level\s+/, '').trim();

  const level = {
    name: levelName,
    description: '',
    effectsDescription: '',
    gainMessage: '',
    loseMessage: '',
    epithet: '',
    threshold: 0,
    effects: [],
  };

  let i = startIndex + 1;

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trim();

    // Stop at next Level, Trait, or Trigger
    if (line.startsWith('Level ') || line.startsWith('Trait ') || line.startsWith('Trigger ')) break;
    if (!line || line.startsWith(';')) { i++; continue; }

    if (line.startsWith('Description ')) {
      level.description = line.replace('Description ', '').trim();
      i++; continue;
    }
    if (line.startsWith('EffectsDescription ')) {
      level.effectsDescription = line.replace('EffectsDescription ', '').trim();
      i++; continue;
    }
    if (line.startsWith('GainMessage ')) {
      level.gainMessage = line.replace('GainMessage ', '').trim();
      i++; continue;
    }
    if (line.startsWith('LoseMessage ')) {
      level.loseMessage = line.replace('LoseMessage ', '').trim();
      i++; continue;
    }
    if (line.startsWith('Epithet ')) {
      level.epithet = line.replace('Epithet ', '').trim();
      i++; continue;
    }
    if (line.startsWith('Threshold ')) {
      level.threshold = parseInt(line.replace('Threshold', '').trim());
      i++; continue;
    }
    if (line.startsWith('Effect ')) {
      const match = line.match(/^Effect\s+(\S+)\s+([-\d]+)/);
      if (match) {
        level.effects.push({ stat: match[1], value: parseInt(match[2]) });
      }
      i++; continue;
    }
    i++;
  }

  return { data: level, nextIndex: i };
}

function parseTraitTrigger(lines, startIndex) {
  const triggerName = lines[startIndex].trim().replace(/^Trigger\s+/, '').trim();

  const trigger = {
    name: triggerName,
    whenToTest: '',
    conditions: [],
    affects: [],
  };

  let i = startIndex + 1;

  while (i < lines.length) {
    const line = lines[i].trim();
    if (line.startsWith('Trait ') || line.startsWith('Trigger ') || line.startsWith('Ancillary ')) break;
    if (!line || line.startsWith(';')) { i++; continue; }

    if (line.startsWith('WhenToTest ')) {
      trigger.whenToTest = line.replace('WhenToTest ', '').trim();
      i++; continue;
    }
    if (line.startsWith('Condition') || line.startsWith('and ') || line.startsWith('or ')) {
      trigger.conditions.push(line);
      i++; continue;
    }
    if (line.startsWith('Affects ')) {
      // Affects TraitName chance N points M
      const m = line.match(/^Affects\s+(\S+)\s+chance\s+(\d+)\s+points\s+([-\d]+)/);
      if (m) trigger.affects.push({ trait: m[1], chance: parseInt(m[2]), points: parseInt(m[3]) });
      i++; continue;
    }
    i++;
  }

  return { data: trigger, nextIndex: i };
}

// ─── TRAIT SERIALIZER ─────────────────────────────────────────────────────────

export function serializeTraitFile(data) {
  let out = ';This file is generated from M2TW Mod Editor\n\n';
  out += ';===============================================================\n';
  out += ';== TRAIT DATA STARTS HERE ==\n';
  out += ';===============================================================\n\n';

  for (const trait of data.traits) {
    out += ';------------------------------------------\n';
    out += `Trait ${trait.name}\n`;
    if (trait.characters && trait.characters.length > 0)
      out += `    Characters ${trait.characters.join(', ')}\n`;
    if (trait.hidden) out += `    Hidden\n`;
    if (trait.excludeCultures && trait.excludeCultures.length > 0)
      out += `    ExcludeCultures ${trait.excludeCultures.join(', ')}\n`;
    if (trait.noGoingBackLevel !== null && trait.noGoingBackLevel !== undefined)
      out += `    NoGoingBackLevel  ${trait.noGoingBackLevel} \n`;
    if (trait.antiTraits && trait.antiTraits.length > 0)
      out += `    AntiTraits ${trait.antiTraits.join(', ')}\n`;
    out += '\n';

    for (const level of trait.levels) {
      out += `    Level ${level.name}\n`;
      if (level.description) out += `        Description ${level.description}\n`;
      if (level.effectsDescription) out += `        EffectsDescription ${level.effectsDescription}\n`;
      if (level.gainMessage) out += `        GainMessage ${level.gainMessage}\n`;
      if (level.loseMessage) out += `        LoseMessage ${level.loseMessage}\n`;
      if (level.epithet) out += `        Epithet ${level.epithet}\n`;
      out += `        Threshold  ${level.threshold} \n`;
      out += '\n';
      for (const eff of level.effects) {
        out += `        Effect ${eff.stat}  ${eff.value} \n`;
      }
      out += '\n';
    }
    out += '\n';
  }

  out += '\n';
  out += ';===============================================================\n';
  out += ';== TRIGGER DATA STARTS HERE ==\n';
  out += ';===============================================================\n\n';

  for (const trig of data.triggers) {
    out += ';------------------------------------------\n';
    out += `Trigger ${trig.name}\n`;
    out += `    WhenToTest ${trig.whenToTest}\n`;
    for (const cond of trig.conditions) {
      out += `    ${cond}\n`;
    }
    out += '\n';
    for (const aff of trig.affects) {
      out += `    Affects ${aff.trait} chance ${aff.chance} points ${aff.points}\n`;
    }
    out += '\n';
  }

  return out;
}

// ─── ANCILLARY PARSER ─────────────────────────────────────────────────────────

export function parseAncillaryFile(text) {
  const lines = text.replace(/\r/g, '').split('\n');
  const ancillaries = [];
  const triggers = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line || line.startsWith(';')) { i++; continue; }

    if (line.startsWith('Ancillary ')) {
      const result = parseAncillary(lines, i);
      ancillaries.push(result.data);
      i = result.nextIndex;
    } else if (line.startsWith('Trigger ')) {
      const result = parseAncTrigger(lines, i);
      triggers.push(result.data);
      i = result.nextIndex;
    } else {
      i++;
    }
  }

  return { ancillaries, triggers };
}

function parseAncillary(lines, startIndex) {
  const nameLine = lines[startIndex].trim();
  const ancName = nameLine.replace(/^Ancillary\s+/, '').trim();

  const anc = {
    name: ancName,
    type: '',
    transferable: 0,
    image: '',
    unique: false,
    excludedAncillaries: [],
    excludeCultures: [],
    description: '',
    effectsDescription: '',
    effects: [],
  };

  let i = startIndex + 1;

  while (i < lines.length) {
    const line = lines[i].trim();
    if (line.startsWith('Ancillary ') || line.startsWith('Trigger ')) break;
    if (!line || line.startsWith(';')) { i++; continue; }

    if (line.startsWith('Type ')) { anc.type = line.replace('Type ', '').trim(); i++; continue; }
    if (line.startsWith('Transferable ')) { anc.transferable = parseInt(line.replace('Transferable', '').trim()); i++; continue; }
    if (line.startsWith('Image ')) { anc.image = line.replace('Image ', '').trim(); i++; continue; }
    if (line === 'Unique') { anc.unique = true; i++; continue; }
    if (line.startsWith('ExcludedAncillaries ')) {
      anc.excludedAncillaries = line.replace('ExcludedAncillaries ', '').split(',').map(s => s.trim()).filter(Boolean);
      i++; continue;
    }
    if (line.startsWith('ExcludeCultures ')) {
      anc.excludeCultures = line.replace('ExcludeCultures ', '').split(',').map(s => s.trim()).filter(Boolean);
      i++; continue;
    }
    if (line.startsWith('Description ')) { anc.description = line.replace('Description ', '').trim(); i++; continue; }
    if (line.startsWith('EffectsDescription ')) { anc.effectsDescription = line.replace('EffectsDescription ', '').trim(); i++; continue; }
    if (line.startsWith('Effect ')) {
      const match = line.match(/^Effect\s+(\S+)\s+([-\d]+)/);
      if (match) anc.effects.push({ stat: match[1], value: parseInt(match[2]) });
      i++; continue;
    }
    i++;
  }

  return { data: anc, nextIndex: i };
}

function parseAncTrigger(lines, startIndex) {
  const trigName = lines[startIndex].trim().replace(/^Trigger\s+/, '').trim();

  const trigger = {
    name: trigName,
    whenToTest: '',
    conditions: [],
    acquireAncillary: '',
    chance: 0,
  };

  let i = startIndex + 1;

  while (i < lines.length) {
    const line = lines[i].trim();
    if (line.startsWith('Ancillary ') || line.startsWith('Trigger ') || line.startsWith('Trait ')) break;
    if (!line || line.startsWith(';')) { i++; continue; }

    if (line.startsWith('WhenToTest ')) { trigger.whenToTest = line.replace('WhenToTest ', '').trim(); i++; continue; }
    if (line.startsWith('Condition') || line.startsWith('and ') || line.startsWith('or ') || line.startsWith('not ')) {
      trigger.conditions.push(line);
      i++; continue;
    }
    if (line.startsWith('AcquireAncillary ')) {
      const m = line.match(/^AcquireAncillary\s+(\S+)\s+chance\s+(\d+)/);
      if (m) { trigger.acquireAncillary = m[1]; trigger.chance = parseInt(m[2]); }
      i++; continue;
    }
    i++;
  }

  return { data: trigger, nextIndex: i };
}

// ─── ANCILLARY SERIALIZER ─────────────────────────────────────────────────────

export function serializeAncillaryFile(data) {
  let out = ';This file is generated from M2TW Mod Editor\n\n';
  out += ';===============================================================\n';
  out += ';== ANCILLARY DATA STARTS HERE ==\n';
  out += ';===============================================================\n\n';

  for (const anc of data.ancillaries) {
    out += ';------------------------------------------\n';
    out += `Ancillary ${anc.name}\n`;
    out += `    Type ${anc.type}\n`;
    out += `    Transferable  ${anc.transferable} \n`;
    if (anc.image) out += `    Image ${anc.image}\n`;
    if (anc.unique) out += `    Unique\n`;
    if (anc.excludedAncillaries && anc.excludedAncillaries.length > 0)
      out += `    ExcludedAncillaries ${anc.excludedAncillaries.join(', ')}\n`;
    if (anc.excludeCultures && anc.excludeCultures.length > 0)
      out += `    ExcludeCultures ${anc.excludeCultures.join(', ')}\n`;
    if (anc.description) out += `    Description ${anc.description}\n`;
    if (anc.effectsDescription) out += `    EffectsDescription ${anc.effectsDescription}\n`;
    for (const eff of anc.effects) {
      out += `    Effect ${eff.stat}  ${eff.value} \n`;
    }
    out += '\n';
  }

  out += ';===============================================================\n';
  out += ';== ANCILLARY TRIGGERS START HERE ==============================\n';
  out += ';===============================================================\n\n';

  for (const trig of data.triggers) {
    out += ';------------------------------------------\n';
    out += `Trigger ${trig.name}\n`;
    out += `    WhenToTest ${trig.whenToTest}\n`;
    for (const cond of trig.conditions) {
      out += `    ${cond}\n`;
    }
    if (trig.acquireAncillary) {
      out += `\n    AcquireAncillary ${trig.acquireAncillary} chance  ${trig.chance} \n`;
    }
    out += '\n';
  }

  return out;
}

// ─── Known character stats for autocomplete ─────────────────────────────────

export const CHARACTER_STATS = [
  'Command', 'Attack', 'Defence', 'Ambush', 'SiegeAttack', 'SiegeDefence',
  'SiegeEngineering', 'NavalCommand', 'InfantryCommand', 'CavalryCommand',
  'ArtilleryCommand', 'GunpowderCommand', 'NightBattle',
  'Subterfuge', 'Assassination', 'Sabotage', 'Bribery', 'Influence',
  'Piety', 'Chivalry', 'Loyalty', 'Authority', 'LocalPopularity',
  'TroopMorale', 'PersonalSecurity', 'PublicSecurity', 'Law', 'Unrest',
  'Squalor', 'Trading', 'TaxCollection', 'Finance', 'Construction',
  'Farming', 'Mining', 'BribeResistance', 'BattleSurgery',
  'MovementPoints', 'LineOfSight', 'HitPoints', 'Fertility', 'Health',
  'TrainingAgents', 'TrainingUnits', 'Looting', 'Magic',
  'Charm', 'Violence', 'Purity', 'Unorthodoxy',
  'Combat_V_Faction_England', 'Combat_V_Faction_France', 'Combat_V_Faction_HRE',
  'Combat_V_Faction_Scotland', 'Combat_V_Faction_Denmark', 'Combat_V_Faction_Spain',
  'Combat_V_Faction_Portugal', 'Combat_V_Faction_Milan', 'Combat_V_Faction_Venice',
  'Combat_V_Faction_Papal_States', 'Combat_V_Faction_Sicily', 'Combat_V_Faction_Poland',
  'Combat_V_Faction_Russia', 'Combat_V_Faction_Hungary', 'Combat_V_Faction_Byzantium',
  'Combat_V_Faction_Moors', 'Combat_V_Faction_Egypt', 'Combat_V_Faction_Turks',
  'Combat_V_Faction_Mongols', 'Combat_V_Faction_Timurids', 'Combat_V_Faction_Aztecs',
  'Combat_V_Religion_catholic', 'Combat_V_Religion_orthodox', 'Combat_V_Religion_islam',
];

export const ANCILLARY_TYPES = [
  'Academic', 'Court', 'Diplomacy', 'Entertain', 'Family', 'Health',
  'Item', 'Magic', 'Military', 'Money', 'Naval', 'Pet', 'Politics',
  'Religion', 'Relic', 'Security', 'Sex',
];

export const CHARACTER_TYPES = ['family', 'spy', 'assassin', 'diplomat', 'admiral', 'merchant', 'priest', 'all'];

export const CULTURE_TYPES = [
  'northern_european', 'eastern_european', 'southern_european', 'greek',
  'middle_eastern', 'mesoamerican',
];