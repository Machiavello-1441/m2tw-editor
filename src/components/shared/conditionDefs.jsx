/**
 * M2TW Trigger Condition Definitions
 * Each condition defines its name, argument type, and optional operator support.
 *
 * argumentType:
 *   'none'      – no extra argument (e.g. IsGeneral true/false → handled as boolean)
 *   'boolean'   – true / false
 *   'int_op'    – operator (>=, =, <=, >, <) + integer value
 *   'building'  – building tree name from EDB
 *   'trait_op'  – trait name + operator + integer
 *   'faction'   – faction name string
 *   'string'    – free string value
 *   'culture'   – culture string
 */

export const WHEN_TO_TEST_OPTIONS = [
  'PostBattle',
  'PreBattle',
  'StartOfTurn',
  'EndOfTurn',
  'GovernorGoverning',
  'GovernorGoverningCapital',
  'GeneralAssaultsGeneral',
  'GeneralAssaultsTown',
  'GeneralCapturedGeneral',
  'GeneralCapturedTown',
  'GeneralRouted',
  'GeneralRouts',
  'BecomesGeneral',
  'BecomesGovernor',
  'GeneralEntersSettlement',
  'GeneralLeavesSettlement',
  'AgentCreated',
  'AgentIntercepted',
  'AgentMissionCriticalSuccess',
  'AgentMissionSuccess',
  'AgentMissionFail',
  'AgentMissionCriticalFail',
  'DiplomatMission',
  'Married',
  'NewChild',
  'NewHeirBorn',
  'NewHeirDesignated',
  'HeirDesignated',
  'NotHeirDesignated',
  'PersonalityTendency',
  'Coronation',
  'BecomesFactionLeader',
  'BecomesFactionHeir',
  'FactionLeaderCaptures',
  'SettlementRaided',
  'SettlementSacked',
  'CityRioting',
  'CityRebelsinh',
  'DiplomatBribes',
  'DiplomatBribed',
  'CaptureAncillary',
  'AncillaryRemoved',
  'LevelUp',
  'TraitAdded',
  'TraitRemoved',
  'AmbassadorReceived',
  'InquisitorTests',
  'InquisitorBurns',
  'RandomOnTurnStart',
];

export const CONDITION_DEFS = [
  // ── Boolean conditions ──────────────────────────────────────────────────
  { name: 'IsGeneral',           argumentType: 'boolean', description: 'Is the character a general?' },
  { name: 'IsGovernor',          argumentType: 'boolean', description: 'Is the character a governor?' },
  { name: 'IsHeirApparent',      argumentType: 'boolean', description: 'Is heir apparent?' },
  { name: 'IsFactionHeir',       argumentType: 'boolean', description: 'Is faction heir?' },
  { name: 'IsFactionLeader',     argumentType: 'boolean', description: 'Is faction leader?' },
  { name: 'IsMarried',           argumentType: 'boolean', description: 'Is the character married?' },
  { name: 'CharacterIsLocal',    argumentType: 'boolean', description: 'Is the character local to their settlement?' },
  { name: 'CharacterReligion',   argumentType: 'string',  description: 'Character religion name (e.g. catholic)' },
  { name: 'IsOnCrusade',         argumentType: 'boolean', description: 'Is on crusade/jihad?' },
  { name: 'IsCapital',           argumentType: 'boolean', description: 'Is the settlement a capital?' },
  { name: 'SettlementIsPort',    argumentType: 'boolean', description: 'Settlement is a port?' },
  { name: 'SettlementIsCoastal', argumentType: 'boolean', description: 'Settlement is coastal?' },
  { name: 'InArmyWithLeader',    argumentType: 'boolean', description: 'Is in army with the faction leader?' },

  // ── Integer operator conditions ─────────────────────────────────────────
  { name: 'I_TurnNumber',         argumentType: 'int_op',  description: 'Current turn number' },
  { name: 'I_NumberOfSettlements',argumentType: 'int_op',  description: 'Number of settlements owned by faction' },
  { name: 'I_SettlementTaxLevel', argumentType: 'int_op',  description: 'Settlement tax level (0-3)' },
  { name: 'I_CharacterRecord',    argumentType: 'int_op',  description: 'Character record value' },
  { name: 'I_AgentType',          argumentType: 'string',  description: 'Agent type (e.g. spy, diplomat, assassin)' },
  { name: 'CharacterAge',         argumentType: 'int_op',  description: 'Character age' },
  { name: 'CitySize',             argumentType: 'int_op',  description: 'Settlement population size' },
  { name: 'NumberOfChildren',     argumentType: 'int_op',  description: 'Number of children' },
  { name: 'YearsMarried',         argumentType: 'int_op',  description: 'Years the character has been married' },
  { name: 'ReligiousOrder',       argumentType: 'int_op',  description: 'Religious order level' },
  { name: 'BattlesWon',           argumentType: 'int_op',  description: 'Battles won' },
  { name: 'BattlesLost',          argumentType: 'int_op',  description: 'Battles lost' },
  { name: 'TurnsAsLeader',        argumentType: 'int_op',  description: 'Turns as faction leader' },
  { name: 'YearsInDevelopment',   argumentType: 'int_op',  description: 'Years in development' },
  { name: 'DistanceCapital',      argumentType: 'int_op',  description: 'Distance from capital in regions' },
  { name: 'DistanceFactionCapital', argumentType: 'int_op', description: 'Distance from faction capital' },
  { name: 'SiegeEngineersLevel',  argumentType: 'int_op',  description: 'Siege engineers level' },
  { name: 'ArmyUnitsStrength',    argumentType: 'int_op',  description: 'Army unit count' },
  { name: 'ArmyMorale',          argumentType: 'int_op',  description: 'Army morale' },
  { name: 'ArmyStrength',        argumentType: 'int_op',  description: 'Army strength score' },

  // ── Settlement building ─────────────────────────────────────────────────
  { name: 'SettlementBuildingExists', argumentType: 'building', description: 'A building tree exists in the settlement (use building tree name from EDB)' },
  { name: 'SettlementBuildingFinished', argumentType: 'building', description: 'Building tree finished being built' },

  // ── Trait check ─────────────────────────────────────────────────────────
  { name: 'Trait', argumentType: 'trait_op', description: 'Character has trait at a given level (trait name from traits file)' },

  // ── Ancillary check ─────────────────────────────────────────────────────
  { name: 'Ancillary', argumentType: 'string', description: 'Character has the named ancillary' },

  // ── Faction / Culture ───────────────────────────────────────────────────
  { name: 'FactionType',    argumentType: 'faction', description: 'Faction type identifier (e.g. england, france)' },
  { name: 'CultureType',    argumentType: 'culture', description: 'Culture type (e.g. northern_european, middle_eastern)' },
  { name: 'FactionIsAtWar', argumentType: 'boolean', description: 'Is the faction at war with anyone?' },
  { name: 'IsAlliedWith',   argumentType: 'faction', description: 'Faction is allied with (faction type)' },
  { name: 'AtWarWith',      argumentType: 'faction', description: 'Faction is at war with (faction type)' },

  // ── Miscellaneous ───────────────────────────────────────────────────────
  { name: 'SettlementOwner',  argumentType: 'faction', description: 'Owner of the settlement' },
  { name: 'SettlementReligion', argumentType: 'string', description: 'Settlement religion (e.g. catholic)' },
  { name: 'RegionReligion',   argumentType: 'string',  description: 'Region religion name' },
  { name: 'CharacterFaction', argumentType: 'faction', description: 'The faction the character belongs to' },
  { name: 'EventCounter',     argumentType: 'int_op',  description: 'Named event counter value (prepend name after)' },
  { name: 'IsOccupied',       argumentType: 'boolean', description: 'Settlement is occupied' },
  { name: 'HasResource',      argumentType: 'string',  description: 'Region has a named resource' },
  { name: 'InRegion',         argumentType: 'string',  description: 'Character is in the named region' },
  { name: 'IsLocalPlayer',    argumentType: 'boolean', description: 'The faction is the local (human) player' },
];

export const CONDITION_PREFIXES = ['Condition', 'and', 'or', 'and not'];
export const INT_OPERATORS = ['>=', '<=', '=', '>', '<'];

/**
 * Parse a raw condition string like:
 *   "Condition IsGeneral true"
 *   "and Condition Trait StrategyDread >= 2"
 *   "or Condition SettlementBuildingExists = university"
 *   "and not Condition I_TurnNumber >= 10"
 *
 * Returns: { prefix, condName, operator, value1, value2 }
 *   - prefix: 'Condition' | 'and' | 'or' | 'and not'
 *   - condName: e.g. 'IsGeneral'
 *   - operator: '=' | '>=' | '<=' | '>' | '<' | '' (for boolean / building / string)
 *   - value1: first value (trait name, building name, bool string, faction, etc.)
 *   - value2: integer string for trait_op (the level)
 */
export function parseConditionString(raw) {
  if (!raw) return { prefix: 'Condition', condName: '', operator: '', value1: '', value2: '' };

  let rest = raw.trim();
  let prefix = 'Condition';

  if (rest.startsWith('and not ')) {
    prefix = 'and not';
    rest = rest.slice('and not '.length).trim();
  } else if (rest.startsWith('and ')) {
    prefix = 'and';
    rest = rest.slice('and '.length).trim();
  } else if (rest.startsWith('or ')) {
    prefix = 'or';
    rest = rest.slice('or '.length).trim();
  }

  // Remove 'Condition ' keyword
  if (rest.startsWith('Condition ')) {
    rest = rest.slice('Condition '.length).trim();
  }

  // Detect condition name
  const tokens = rest.split(/\s+/);
  const condName = tokens[0] || '';
  const def = CONDITION_DEFS.find(d => d.name === condName);

  if (!def) {
    // Unknown — return raw remainder as value1
    return { prefix, condName, operator: '', value1: tokens.slice(1).join(' '), value2: '' };
  }

  if (def.argumentType === 'boolean') {
    return { prefix, condName, operator: '', value1: tokens[1] || 'true', value2: '' };
  }

  if (def.argumentType === 'int_op') {
    // e.g. "I_TurnNumber >= 10"
    const op = INT_OPERATORS.find(o => tokens[1] === o) || '>=';
    return { prefix, condName, operator: op, value1: tokens[2] || '0', value2: '' };
  }

  if (def.argumentType === 'building') {
    // "SettlementBuildingExists = university"
    const hasEq = tokens[1] === '=' || tokens[1] === '==';
    return { prefix, condName, operator: '=', value1: hasEq ? tokens[2] || '' : tokens[1] || '', value2: '' };
  }

  if (def.argumentType === 'trait_op') {
    // "Trait TraitName >= 2"
    const traitName = tokens[1] || '';
    const op = INT_OPERATORS.find(o => tokens[2] === o) || '>';
    return { prefix, condName, operator: op, value1: traitName, value2: tokens[3] || '0' };
  }

  // string / faction / culture
  return { prefix, condName, operator: '', value1: tokens.slice(1).join(' '), value2: '' };
}

/**
 * Serialize a structured condition back to the raw string used in the file.
 */
export function serializeCondition({ prefix, condName, operator, value1, value2 }) {
  if (!condName) return '';
  const def = CONDITION_DEFS.find(d => d.name === condName);

  let body = condName;

  if (def) {
    if (def.argumentType === 'boolean') {
      body = `${condName} ${value1 || 'true'}`;
    } else if (def.argumentType === 'int_op') {
      body = `${condName} ${operator || '>='} ${value1 || '0'}`;
    } else if (def.argumentType === 'building') {
      body = `${condName} = ${value1}`;
    } else if (def.argumentType === 'trait_op') {
      body = `${condName} ${value1} ${operator || '>'} ${value2 || '0'}`;
    } else {
      body = `${condName} ${value1}`;
    }
  } else {
    body = `${condName} ${value1}`;
  }

  const prefixStr = prefix === 'Condition' ? 'Condition' : `${prefix} Condition`;
  return `${prefixStr} ${body}`;
}