/**
 * Parser and serializer for export_descr_guilds.txt (M2TW)
 *
 * File structure (simplified):
 *
 *   GuildDef
 *   {
 *       Name                guild_assassins
 *       Points              120 200 350           ; threshold pts for levels 1, 2, 3
 *       SettlementMinLevel  large_town
 *       ...
 *       Trigger <name>
 *       {
 *           WhenToTest  <event>
 *           Condition   <expr>
 *           ...
 *           GuildPointsEffect   <building>  <s|o|a>  <integer>
 *       }
 *   }
 *
 * Guild point scores (from research / guide):
 *   "o"  — adds points to the LOCAL settlement being exported
 *   "a"  — adds points to ALL settlements of the faction
 *   "s"  — effectively same as "o" in practice (game ignores the label
 *            unless the token is "a"); kept for compatibility
 *
 * Only settlement-export events respect "o"/"s" vs "a". Faction-export
 * events only respond to "a".
 */

// ── Helpers ──────────────────────────────────────────────────────────────────

function stripComment(line) {
  const sc = line.indexOf(';');
  return sc >= 0 ? line.slice(0, sc) : line;
}

function tokenize(text) {
  // Return an array of { type: 'word'|'open'|'close', value } tokens
  const tokens = [];
  for (const raw of text.split('\n')) {
    const line = stripComment(raw).trim();
    if (!line) continue;
    for (const tok of line.split(/\s+/)) {
      if (!tok) continue;
      if (tok === '{') tokens.push({ type: 'open' });
      else if (tok === '}') tokens.push({ type: 'close' });
      else tokens.push({ type: 'word', value: tok });
    }
  }
  return tokens;
}

// ── Parse one Trigger block ───────────────────────────────────────────────────

function parseTrigger(tokens, pos) {
  // Expect name already consumed; pos points to '{' or the trigger body words
  // Actually: "Trigger <name>" then "{ ... }"
  const trigger = { name: '', whenToTest: '', conditions: [], pointsEffects: [] };
  // name was consumed before call, passed in
  // advance past '{'
  if (tokens[pos]?.type === 'open') pos++;

  while (pos < tokens.length) {
    const tok = tokens[pos];
    if (tok.type === 'close') { pos++; break; }
    if (tok.type !== 'word') { pos++; continue; }

    const key = tok.value.toLowerCase();
    if (key === 'whentotest') {
      trigger.whenToTest = tokens[++pos]?.value || '';
      pos++;
    } else if (key === 'condition') {
      // Collect rest of the condition line (until next keyword-like word on a new logical line)
      // Tokens are flattened, so we collect until we see a known keyword or block boundary
      const condParts = ['Condition'];
      pos++;
      while (pos < tokens.length && tokens[pos].type === 'word') {
        const peek = tokens[pos].value.toLowerCase();
        if (['condition', 'and', 'or', 'guildpointseffect', 'whentotest'].includes(peek) ||
            tokens[pos].type === 'close') break;
        condParts.push(tokens[pos].value);
        pos++;
      }
      trigger.conditions.push(condParts.join(' '));
    } else if (key === 'and' || key === 'or') {
      // "and Condition ..." or "or Condition ..."
      const connector = tok.value; // preserve case
      pos++;
      const condParts = [connector];
      if (tokens[pos]?.value?.toLowerCase() === 'condition') {
        condParts.push('Condition');
        pos++;
      }
      while (pos < tokens.length && tokens[pos].type === 'word') {
        const peek = tokens[pos].value.toLowerCase();
        if (['condition', 'and', 'or', 'guildpointseffect', 'whentotest'].includes(peek) ||
            tokens[pos].type === 'close') break;
        condParts.push(tokens[pos].value);
        pos++;
      }
      trigger.conditions.push(condParts.join(' '));
    } else if (key === 'guildpointseffect') {
      // GuildPointsEffect  <building_level_or_guild_name>  <s|o|a>  <integer>
      const building = tokens[++pos]?.value || '';
      const scope = tokens[++pos]?.value || 'o'; // s | o | a
      const amount = parseInt(tokens[++pos]?.value) || 0;
      pos++;
      trigger.pointsEffects.push({ building, scope, amount });
    } else {
      pos++;
    }
  }
  return { trigger, pos };
}

// ── Parse one GuildDef block ──────────────────────────────────────────────────

function parseGuildDef(tokens, pos) {
  const guild = {
    name: '',              // internal guild name (matches building tree prefix)
    pointThresholds: [],   // [level1pts, level2pts, level3pts]
    settlementMinLevel: '',
    factionSupport: [],    // optional per-faction support values
    triggers: [],
    rawLines: [],          // preserve unknown lines for round-trip
  };

  // advance past '{'
  if (tokens[pos]?.type === 'open') pos++;

  while (pos < tokens.length) {
    const tok = tokens[pos];
    if (tok.type === 'close') { pos++; break; }
    if (tok.type !== 'word') { pos++; continue; }

    const key = tok.value.toLowerCase();

    if (key === 'name') {
      guild.name = tokens[++pos]?.value || '';
      pos++;
    } else if (key === 'points') {
      pos++;
      const pts = [];
      while (pos < tokens.length && tokens[pos].type === 'word' && /^-?\d+$/.test(tokens[pos].value)) {
        pts.push(parseInt(tokens[pos].value));
        pos++;
      }
      guild.pointThresholds = pts;
    } else if (key === 'settlementsminlevel' || key === 'settlementminlevel') {
      guild.settlementMinLevel = tokens[++pos]?.value || '';
      pos++;
    } else if (key === 'factionsupport') {
      pos++;
      // FactionSupport  <faction>  <value> pairs (arbitrary count)
      while (pos < tokens.length && tokens[pos].type === 'word') {
        const fac = tokens[pos].value;
        if (['name','points','trigger','settlementsminlevel','settlementminlevel','factionsupport'].includes(fac.toLowerCase())) break;
        const val = parseInt(tokens[++pos]?.value) || 0;
        pos++;
        guild.factionSupport.push({ faction: fac, value: val });
      }
    } else if (key === 'trigger') {
      const trigName = tokens[++pos]?.value || '';
      pos++;
      const { trigger, pos: newPos } = parseTrigger(tokens, pos);
      trigger.name = trigName;
      guild.triggers.push(trigger);
      pos = newPos;
    } else {
      // Unknown key — collect this and next token as a raw line
      const rawKey = tok.value;
      pos++;
      const rawVal = tokens[pos]?.type === 'word' ? tokens[pos].value : '';
      if (rawVal) pos++;
      guild.rawLines.push({ key: rawKey, value: rawVal });
    }
  }

  return { guild, pos };
}

// ── Main parser ───────────────────────────────────────────────────────────────

export function parseGuildsFile(text) {
  const tokens = tokenize(text);
  const guilds = [];
  let pos = 0;

  while (pos < tokens.length) {
    const tok = tokens[pos];
    if (tok.type !== 'word') { pos++; continue; }
    if (tok.value.toLowerCase() === 'guilddef') {
      pos++;
      // skip open brace
      if (tokens[pos]?.type === 'open') pos++;
      const { guild, pos: newPos } = parseGuildDef(tokens, pos);
      guilds.push(guild);
      pos = newPos;
    } else {
      pos++;
    }
  }

  return guilds; // Array of guild objects
}

// ── Serializer ────────────────────────────────────────────────────────────────

function serializeTrigger(trigger, indent = '        ') {
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
  const out = [];
  for (const guild of guilds) {
    out.push('GuildDef');
    out.push('{');
    out.push(`    Name                ${guild.name}`);
    if (guild.pointThresholds?.length) {
      out.push(`    Points              ${guild.pointThresholds.join(' ')}`);
    }
    if (guild.settlementMinLevel) {
      out.push(`    SettlementMinLevel  ${guild.settlementMinLevel}`);
    }
    for (const raw of guild.rawLines || []) {
      out.push(`    ${raw.key}${raw.value ? '  ' + raw.value : ''}`);
    }
    if (guild.factionSupport?.length) {
      const pairs = guild.factionSupport.map(f => `${f.faction} ${f.value}`).join('  ');
      out.push(`    FactionSupport      ${pairs}`);
    }
    for (const trigger of guild.triggers || []) {
      out.push('');
      out.push(serializeTrigger(trigger, '    '));
    }
    out.push('}');
    out.push('');
  }
  return out.join('\n');
}

// ── Map guild name → EDB building tree prefix ─────────────────────────────────
// e.g. "guild_assassins" → building tree starting with "guild_assassins"
export function getGuildBuildingPrefix(guildName) {
  // Convention: guild Name IS the building tree prefix in EDB
  return guildName;
}