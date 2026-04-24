/**
 * Parser and serializer for export_descr_guilds.txt (M2TW)
 *
 * Real file format:
 *
 *   ;------------------------------------------
 *   Guild assassins_guild
 *       building guild_assassins_guild
 *       levels  100 250 500
 *       ...
 *       Trigger <name>
 *       {
 *           WhenToTest  <event>
 *           Condition   <expr>
 *           GuildPointsEffect   <building>  <s|o|a>  <integer>
 *       }
 *
 * The separator line ";---..." is a comment and is ignored.
 * Each guild block starts with "Guild <name>" (no braces around the whole block).
 * A new guild block begins when the next "Guild" keyword is encountered.
 */

// ── Helpers ───────────────────────────────────────────────────────────────────

function stripComment(line) {
  const sc = line.indexOf(';');
  return sc >= 0 ? line.slice(0, sc) : line;
}

// ── Parse one Trigger block (brace-delimited) ─────────────────────────────────

function parseTrigger(lines, startIdx) {
  const trigger = { name: '', whenToTest: '', conditions: [], pointsEffects: [] };
  let i = startIdx;

  // Find the opening brace
  while (i < lines.length && !lines[i].trim().startsWith('{')) i++;
  i++; // skip '{'

  while (i < lines.length) {
    const raw = stripComment(lines[i]).trim();
    i++;
    if (raw === '}') break;
    if (!raw) continue;

    const tokens = raw.split(/\s+/);
    const key = tokens[0].toLowerCase();

    if (key === 'whentotest') {
      trigger.whenToTest = tokens[1] || '';
    } else if (key === 'condition') {
      trigger.conditions.push(raw);
    } else if (key === 'and' || key === 'or') {
      trigger.conditions.push(raw);
    } else if (key === 'guildpointseffect') {
      const building = tokens[1] || '';
      const scope = tokens[2] || 'o';
      const amount = parseInt(tokens[3]) || 0;
      trigger.pointsEffects.push({ building, scope, amount });
    }
  }

  return { trigger, nextIdx: i };
}

// ── Main parser ───────────────────────────────────────────────────────────────

export function parseGuildsFile(text) {
  const lines = text.split('\n');
  const guilds = [];
  let current = null;
  let i = 0;

  while (i < lines.length) {
    const raw = lines[i];
    const clean = stripComment(raw).trim();
    
    if (!clean) { i++; continue; }

    const tokens = clean.split(/\s+/);
    const key = tokens[0].toLowerCase();

    if (key === 'guild') {
      // Start a new guild block
      if (current) guilds.push(current);
      current = {
        name: tokens[1] || '',           // internal guild name (e.g. assassins_guild)
        buildingTree: '',                 // building tree name (e.g. guild_assassins_guild)
        pointThresholds: [],              // [level1pts, level2pts, level3pts]
        settlementMinLevel: '',
        factionSupport: [],
        triggers: [],
        rawLines: [],
      };
      i++;
    } else if (key === 'building' && current) {
      current.buildingTree = tokens[1] || '';
      i++;
    } else if (key === 'levels' && current) {
      current.pointThresholds = tokens.slice(1).map(Number).filter(n => !isNaN(n));
      i++;
    } else if (key === 'settlementminlevel' && current) {
      current.settlementMinLevel = tokens[1] || '';
      i++;
    } else if (key === 'factionsupport' && current) {
      // FactionSupport <faction> <value> ...
      const pairs = tokens.slice(1);
      for (let p = 0; p + 1 < pairs.length; p += 2) {
        current.factionSupport.push({ faction: pairs[p], value: parseInt(pairs[p + 1]) || 0 });
      }
      i++;
    } else if (key === 'trigger' && current) {
      const trigName = tokens[1] || '';
      const { trigger, nextIdx } = parseTrigger(lines, i + 1);
      trigger.name = trigName;
      current.triggers.push(trigger);
      i = nextIdx;
    } else {
      // Unknown line — store as raw for round-trip
      if (current && clean) {
        current.rawLines.push({ key: tokens[0], value: tokens.slice(1).join(' ') });
      }
      i++;
    }
  }

  if (current) guilds.push(current);
  return guilds;
}

// ── Serializer ────────────────────────────────────────────────────────────────

function serializeTrigger(trigger, indent = '    ') {
  const lines = [];
  lines.push(`${indent}Trigger ${trigger.name}`);
  lines.push(`${indent}{`);
  lines.push(`${indent}    WhenToTest  ${trigger.whenToTest}`);
  for (const cond of trigger.conditions) {
    lines.push(`${indent}    ${cond}`);
  }
  for (const eff of trigger.pointsEffects) {
    lines.push(`${indent}    GuildPointsEffect  ${eff.building}  ${eff.scope}  ${eff.amount}`);
  }
  lines.push(`${indent}}`);
  return lines.join('\n');
}

export function serializeGuildsFile(guilds) {
  const separator = ';------------------------------------------';
  const out = [];
  for (const guild of guilds) {
    out.push(separator);
    out.push(`Guild ${guild.name}`);
    if (guild.buildingTree) {
      out.push(`    building ${guild.buildingTree}`);
    }
    if (guild.pointThresholds?.length) {
      out.push(`    levels  ${guild.pointThresholds.join(' ')}`);
    }
    if (guild.settlementMinLevel) {
      out.push(`    SettlementMinLevel  ${guild.settlementMinLevel}`);
    }
    if (guild.factionSupport?.length) {
      const pairs = guild.factionSupport.map(f => `${f.faction} ${f.value}`).join('  ');
      out.push(`    FactionSupport      ${pairs}`);
    }
    for (const raw of guild.rawLines || []) {
      out.push(`    ${raw.key}${raw.value ? '  ' + raw.value : ''}`);
    }
    for (const trigger of guild.triggers || []) {
      out.push('');
      out.push(serializeTrigger(trigger, '    '));
    }
    out.push('');
  }
  return out.join('\n');
}

// ── Map guild building tree name → guild object ───────────────────────────────
// The EDB building tree name matches the "building" field (e.g. "guild_assassins_guild")
export function getGuildBuildingPrefix(guildBuildingTree) {
  return guildBuildingTree;
}