/**
 * All known M2TW trigger condition types with their argument shapes.
 * argType:
 *   'none'        — no argument (e.g. IsGeneral)
 *   'bool'        — true/false
 *   'int'         — plain integer (e.g. I_NumberOfSettlements)
 *   'compare_int' — operator (>=|=|<=|>|<) + integer (e.g. I_TurnNumber >= 50)
 *   'compare_trait' — traitName + operator + integer (e.g. Trait StrategyDread > 0)
 *   'building'    — = buildingTreeName (e.g. SettlementBuildingExists = university)
 *   'faction'     — faction name string
 *   'culture'     — culture name string
 *   'string'      — free string value
 *   'religion'    — religion name
 */
export const CONDITION_DEFS = [
  // ─── Character / General ───────────────────────────────────────────────────
  { key: 'IsGeneral',             label: 'IsGeneral',              argType: 'bool',         hint: 'Is character a general?' },
  { key: 'IsAdmiral',             label: 'IsAdmiral',              argType: 'bool' },
  { key: 'IsSpy',                 label: 'IsSpy',                  argType: 'bool' },
  { key: 'IsAssassin',            label: 'IsAssassin',             argType: 'bool' },
  { key: 'IsMerchant',            label: 'IsMerchant',             argType: 'bool' },
  { key: 'IsPriest',              label: 'IsPriest',               argType: 'bool' },
  { key: 'IsHeretic',             label: 'IsHeretic',              argType: 'bool' },
  { key: 'IsWitch',               label: 'IsWitch',                argType: 'bool' },
  { key: 'IsFamilyMember',        label: 'IsFamilyMember',         argType: 'bool' },
  { key: 'IsLeader',              label: 'IsLeader',               argType: 'bool' },
  { key: 'IsHeir',                label: 'IsHeir',                 argType: 'bool' },
  { key: 'IsFactionLeader',       label: 'IsFactionLeader',        argType: 'bool' },
  { key: 'FactionIsLocal',        label: 'FactionIsLocal',         argType: 'bool' },
  { key: 'CharacterIsLocal',      label: 'CharacterIsLocal',       argType: 'bool' },
  { key: 'InSettlement',          label: 'InSettlement',           argType: 'bool' },
  { key: 'IsYounger',             label: 'IsYounger',              argType: 'bool' },
  { key: 'IsMarried',             label: 'IsMarried',              argType: 'bool' },
  { key: 'IsOnCrusade',           label: 'IsOnCrusade',            argType: 'bool' },
  { key: 'IsOnJihad',             label: 'IsOnJihad',              argType: 'bool' },
  { key: 'OwnsBrother',           label: 'OwnsBrother',            argType: 'bool' },
  { key: 'OwnsNephew',            label: 'OwnsNephew',             argType: 'bool' },
  { key: 'OwnsUncle',             label: 'OwnsUncle',              argType: 'bool' },
  { key: 'OwnsFather',            label: 'OwnsFather',             argType: 'bool' },
  { key: 'OwnsSon',               label: 'OwnsSon',                argType: 'bool' },
  { key: 'OwnsGrandson',          label: 'OwnsGrandson',           argType: 'bool' },
  { key: 'OwnsDaughter',          label: 'OwnsDaughter',           argType: 'bool' },
  { key: 'OwnsWife',              label: 'OwnsWife',               argType: 'bool' },
  { key: 'HasNoBrother',          label: 'HasNoBrother',           argType: 'bool' },
  { key: 'HasNoSon',              label: 'HasNoSon',               argType: 'bool' },
  { key: 'OwnsAncillary',         label: 'OwnsAncillary',          argType: 'string',       hint: 'ancillary internal name' },

  // ─── Trait-based ────────────────────────────────────────────────────────────
  { key: 'Trait',                 label: 'Trait',                  argType: 'compare_trait', hint: 'TraitName > 0' },

  // ─── Turn / Numeric ────────────────────────────────────────────────────────
  { key: 'I_TurnNumber',          label: 'I_TurnNumber',           argType: 'compare_int',  hint: '>= 50' },
  { key: 'I_NumberOfSettlements', label: 'I_NumberOfSettlements',  argType: 'compare_int' },
  { key: 'I_NumberOfUnits',       label: 'I_NumberOfUnits',        argType: 'compare_int' },
  { key: 'I_MapWidth',            label: 'I_MapWidth',             argType: 'compare_int' },
  { key: 'I_MapHeight',           label: 'I_MapHeight',            argType: 'compare_int' },
  { key: 'I_RegionCount',         label: 'I_RegionCount',          argType: 'compare_int' },
  { key: 'I_SpottedRegionCount',  label: 'I_SpottedRegionCount',   argType: 'compare_int' },
  { key: 'GeneralAge',            label: 'GeneralAge',             argType: 'compare_int' },
  { key: 'YearsMarried',          label: 'YearsMarried',           argType: 'compare_int' },
  { key: 'YearsInTrouble',        label: 'YearsInTrouble',         argType: 'compare_int' },
  { key: 'HealthLevel',           label: 'HealthLevel',            argType: 'compare_int' },
  { key: 'NumberOfChildren',      label: 'NumberOfChildren',       argType: 'compare_int' },
  { key: 'NumberOfSons',          label: 'NumberOfSons',           argType: 'compare_int' },
  { key: 'NumberOfFollowers',     label: 'NumberOfFollowers',      argType: 'compare_int' },
  { key: 'GuildLevel',            label: 'GuildLevel',             argType: 'compare_int' },

  // ─── Settlement / Building ──────────────────────────────────────────────────
  { key: 'SettlementBuildingExists',   label: 'SettlementBuildingExists',   argType: 'building', hint: '= building_tree_name' },
  { key: 'SettlementBuildingNotExists',label: 'SettlementBuildingNotExists',argType: 'building' },
  { key: 'IsSettlement',               label: 'IsSettlement',               argType: 'bool' },
  { key: 'SettlementIsReligion',       label: 'SettlementIsReligion',       argType: 'religion' },
  { key: 'SettlementIsCulture',        label: 'SettlementIsCulture',        argType: 'culture' },
  { key: 'FactionHasBuilding',         label: 'FactionHasBuilding',         argType: 'building' },
  { key: 'SettlementLevel',            label: 'SettlementLevel',            argType: 'compare_int' },
  { key: 'SettlementPopulace',         label: 'SettlementPopulace',         argType: 'compare_int' },

  // ─── Battle / Combat ────────────────────────────────────────────────────────
  { key: 'WonBattle',             label: 'WonBattle',              argType: 'bool' },
  { key: 'LostBattle',            label: 'LostBattle',             argType: 'bool' },
  { key: 'IsAttacker',            label: 'IsAttacker',             argType: 'bool' },
  { key: 'IsDefender',            label: 'IsDefender',             argType: 'bool' },
  { key: 'InBattleAt',            label: 'InBattleAt',             argType: 'bool' },
  { key: 'BattleSuccess',         label: 'BattleSuccess',          argType: 'string',       hint: 'crushing/clear/close/marginal/defeat' },
  { key: 'BattleType',            label: 'BattleType',             argType: 'string',       hint: 'field/siege/naval/...' },
  { key: 'InBattle',              label: 'InBattle',               argType: 'bool' },

  // ─── Faction / Culture ──────────────────────────────────────────────────────
  { key: 'FactionType',           label: 'FactionType',            argType: 'faction',      hint: 'faction internal name' },
  { key: 'IsLocalFaction',        label: 'IsLocalFaction',         argType: 'bool' },
  { key: 'FactionIsAtWar',        label: 'FactionIsAtWar',         argType: 'bool' },
  { key: 'Culture',               label: 'Culture',                argType: 'culture' },
  { key: 'ReligionInSettlement',  label: 'ReligionInSettlement',   argType: 'religion' },
  { key: 'Religion',              label: 'Religion',               argType: 'religion' },

  // ─── Ancillary ──────────────────────────────────────────────────────────────
  { key: 'AncillaryExists',       label: 'AncillaryExists',        argType: 'string',       hint: 'ancillary internal name' },
  { key: 'CharacterHasAncillary', label: 'CharacterHasAncillary',  argType: 'string' },

  // ─── Building Finished ──────────────────────────────────────────────────────
  { key: 'SettlementBuildingFinished', label: 'SettlementBuildingFinished', argType: 'compare_building', hint: '>= building_level_name' },

  // ─── Misc ───────────────────────────────────────────────────────────────────
  { key: 'IsExecutioner',         label: 'IsExecutioner',          argType: 'bool' },
  { key: 'IsTorturer',            label: 'IsTorturer',             argType: 'bool' },
  { key: 'EndedInSiege',          label: 'EndedInSiege',           argType: 'bool' },
  { key: 'Random',                label: 'Random',                 argType: 'int',          hint: 'percentage (0–100)' },
  { key: 'AgentType',             label: 'AgentType',              argType: 'agent',        hint: 'spy/assassin/merchant/...' },
  { key: 'Attribute',             label: 'Attribute',              argType: 'compare_attribute', hint: 'TraitAttribute >= value' },
  { key: 'CharacterReligion',     label: 'CharacterReligion',      argType: 'religion' },
];

export const WHEN_TO_TEST_OPTIONS = [
  'PostBattle',
  'PreBattle',
  'PostBattleAfterResults',
  'OnGeneral',
  'OnCharacterTurnEnd',
  'OnCharacterTurnStart',
  'OnCharacterComesOfAge',
  'OnCharacterMarriage',
  'OnCharacterDeath',
  'OnCharacterBecomesFactionLeader',
  'OnCharacterLooted',
  'OnMakingAlliance',
  'OnBreakingAlliance',
  'OnSmallestArmyWinsBattle',
  'OnSuccessfulMission',
  'OnFailedMission',
  'OnBribeSuccess',
  'OnBribeFailure',
  'OnConstructBuilding',
  'OnHereticBurned',
  'OnHereticConverted',
  'OnCharacterEndsTurnInSettlement',
  'OnEnteringCity',
  'OnLeavingCity',
  'OnCaptureSettlement',
  'OnSiegeSuccessful',
  'OnSiegeFailed',
  'OnAssassinationSuccess',
  'OnAssassinationFailure',
  'OnSpySuccess',
  'OnSpyFailure',
  'OnDiplomacySuccess',
  'OnDiplomacyFailure',
  'OnTradeSuccess',
  'OnTradeFailure',
  'InquisitionSuccess',
  'InquisitionFailure',
  'OnCrusade',
  'OnJihad',
  'OnCrusadeEnd',
  'OnJihadEnd',
  'Always',
];

export const RELIGION_OPTIONS = [
  'catholic', 'orthodox', 'islam', 'pagan', 'heretic',
  'jewish', 'zoroastrian', 'hindu', 'buddhist',
];

export const CULTURE_OPTIONS = [
  'western_european', 'eastern_european', 'greek', 'middle_eastern',
  'north_african', 'sub_saharan', 'steppe_nomad', 'mesoamerican',
];

export const COMPARE_OPS = ['>=', '<=', '>', '<', '='];

// ── Parse a raw condition string into a structured object ─────────────────────
// Raw examples:
//   "Condition IsGeneral true"
//   "and Condition Trait StrategyDread > 0"
//   "or Condition SettlementBuildingExists = university"
//   "and not Condition I_TurnNumber >= 50"
export function parseConditionString(raw) {
  const s = raw.trim();

  // Extract connector (first word if 'and', 'or', optionally followed by 'not')
  let connector = 'Condition'; // first condition, no connector
  let rest = s;

  const andNotMatch = s.match(/^(and not|or not)\s+/i);
  const connectorMatch = s.match(/^(and|or)\s+/i);

  if (andNotMatch) {
    connector = andNotMatch[1].toLowerCase(); // 'and not' | 'or not'
    rest = s.slice(andNotMatch[0].length);
  } else if (connectorMatch) {
    connector = connectorMatch[1].toLowerCase();
    rest = s.slice(connectorMatch[0].length);
  }

  // Strip leading "Condition " keyword
  if (rest.startsWith('Condition ')) rest = rest.slice('Condition '.length).trim();

  // Match Trait <name> <op> <int>
  const traitMatch = rest.match(/^Trait\s+(\S+)\s*(>=|<=|>|<|=)\s*(-?\d+)$/i);
  if (traitMatch) {
    return { connector, type: 'Trait', traitName: traitMatch[1], op: traitMatch[2], value: traitMatch[3] };
  }

  // Match I_TurnNumber (or other compare_int) <op> <int>
  const compareIntMatch = rest.match(/^(\S+)\s+(>=|<=|>|<|=)\s*(-?\d+)$/);
  if (compareIntMatch) {
    return { connector, type: compareIntMatch[1], op: compareIntMatch[2], value: compareIntMatch[3] };
  }

  // Match SettlementBuildingExists = <building>
  const buildingMatch = rest.match(/^(\S+)\s*=\s*(.+)$/);
  const def = CONDITION_DEFS.find(d => buildingMatch && d.key === buildingMatch[1]);
  if (buildingMatch && def && def.argType === 'building') {
    return { connector, type: buildingMatch[1], value: buildingMatch[2].trim() };
  }

  // Match bool: "IsGeneral true" or "IsGeneral false"
  const boolMatch = rest.match(/^(\S+)\s+(true|false)$/i);
  if (boolMatch) {
    return { connector, type: boolMatch[1], boolVal: boolMatch[2].toLowerCase() };
  }

  // Generic: type + value separated by space
  const spaceMatch = rest.match(/^(\S+)\s+(.+)$/);
  if (spaceMatch) {
    return { connector, type: spaceMatch[1], value: spaceMatch[2].trim() };
  }

  // Just a type with no args
  return { connector, type: rest, value: '' };
}

// ── Serialize a structured condition back to a raw string ──────────────────────
export function serializeCondition(cond) {
  const { connector, type } = cond;
  const def = CONDITION_DEFS.find(d => d.key === type);

  let body = '';
  if (type === 'Trait') {
    body = `Trait ${cond.traitName || ''} ${cond.op || '>'} ${cond.value ?? 0}`;
  } else if (def?.argType === 'compare_int') {
    body = `${type} ${cond.op || '>='} ${cond.value ?? 0}`;
  } else if (def?.argType === 'building') {
    body = `${type} = ${cond.value || ''}`;
  } else if (def?.argType === 'bool') {
    body = `${type} ${cond.boolVal ?? 'true'}`;
  } else if (def?.argType === 'int') {
    body = `${type} ${cond.value ?? 0}`;
  } else {
    body = `${type}${cond.value ? ' ' + cond.value : ''}`;
  }

  const condStr = `Condition ${body}`;
  if (connector === 'Condition') return condStr;
  return `${connector} ${condStr}`;
}