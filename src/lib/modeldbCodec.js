/**
 * M2TW battle_models.modeldb parser & serializer
 *
 * The file is text-based with length-prefix string encoding.
 * Every string is preceded by its character count as an integer.
 * Strings may contain spaces (e.g. "Final Special Heads_england_diff.texture").
 *
 * Entry structure:
 *   [nameLen] [name]
 *   [meshType=1] [meshCount]
 *   [pathLen] [path] [distThreshold]   × meshCount  (LOD levels)
 *   [factionCount]
 *   [fLen] [faction] [texLen] [tex] [normLen] [norm] [sprLen] [spr]  × factionCount
 *   rawTail – attachment-sets section + rest section + terminator
 */

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------
export function parseModeldb(text) {
  const tokens = text.trim().split(/[ \t\r\n]+/).filter(Boolean);
  let pos = 0;

  function readInt() {
    if (pos >= tokens.length) throw new Error('EOF reading int');
    const v = parseInt(tokens[pos++], 10);
    if (isNaN(v)) throw new Error(`Expected int, got "${tokens[pos - 1]}"`);
    return v;
  }

  // Read a length-prefixed string (may span multiple tokens for paths with spaces)
  function readStr() {
    const len = readInt();
    let str = '';
    while (str.length < len) {
      if (pos >= tokens.length) throw new Error('EOF reading string');
      if (str.length > 0) str += ' ';
      str += tokens[pos++];
    }
    return str;
  }

  // Scan forward to find the start of the next modeldb entry.
  // An entry starts with: [nameLen] [name] [1 or 2] [meshCount]
  // where name is alphanumeric+underscore (no dots, slashes, spaces).
  function findNextEntryStart(fromPos) {
    for (let p = fromPos; p < tokens.length - 3; p++) {
      const len = parseInt(tokens[p], 10);
      if (isNaN(len) || len < 3 || len > 80) continue;
      const name = tokens[p + 1];
      if (!name || name.length !== len) continue;
      if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(name)) continue; // no dots/slashes
      const meshType = tokens[p + 2];
      if (meshType !== '1' && meshType !== '2') continue;
      const mc = parseInt(tokens[p + 3], 10);
      if (isNaN(mc) || mc < 1 || mc > 12) continue;
      return p;
    }
    return tokens.length;
  }

  // Parse attachment-set factions from rawTail string (display only, non-destructive)
  function parseAttachFromRawTail(rawTail) {
    const toks = rawTail.trim().split(/\s+/).filter(Boolean);
    let p = 0;
    const result = [];
    if (!toks.length) return result;
    const count = parseInt(toks[p++], 10);
    if (isNaN(count) || count <= 0 || count > 100) return result;
    for (let f = 0; f < count && p < toks.length; f++) {
      try {
        const fl = parseInt(toks[p++], 10);
        if (isNaN(fl) || fl <= 0 || fl > 30) return result;
        let faction = '';
        while (faction.length < fl && p < toks.length) { if (faction.length > 0) faction += ' '; faction += toks[p++]; }

        const dl = parseInt(toks[p++], 10);
        if (isNaN(dl) || dl <= 0 || dl > 200) return result;
        let diffTex = '';
        while (diffTex.length < dl && p < toks.length) { if (diffTex.length > 0) diffTex += ' '; diffTex += toks[p++]; }

        // If first faction's texture doesn't contain AttachmentSets → not an attach section
        if (f === 0 && !diffTex.includes('AttachmentSets')) return result;

        const nl = parseInt(toks[p++], 10);
        if (isNaN(nl) || nl <= 0 || nl > 200) return result;
        let normTex = '';
        while (normTex.length < nl && p < toks.length) { if (normTex.length > 0) normTex += ' '; normTex += toks[p++]; }

        if (toks[p] === '0') p++; // trailing 0 for AttachmentSets normal textures

        result.push({ faction, diffTex, normTex });
      } catch {
        return result;
      }
    }
    return result;
  }

  // --- Parse header ---
  // "22 serialization::archive 3 0 0 0 0 701 0 0"
  readStr(); // "serialization::archive"
  readInt(); readInt(); readInt(); readInt(); readInt(); // 3 0 0 0 0
  const totalEntries = readInt();
  readInt(); readInt(); // 0 0

  const entries = [];

  function parseEntry() {
    const name = readStr();
    readInt(); // mesh type (1 or 2)
    const meshCount = readInt();

    const meshes = [];
    for (let m = 0; m < meshCount; m++) {
      const path = readStr();
      const dist = readInt();
      meshes.push({ path, dist });
    }

    // Body faction textures
    const factionCount = readInt();
    const factions = [];
    for (let f = 0; f < factionCount; f++) {
      const faction = readStr();
      const texture = readStr();
      const normalTex = readStr();
      const sprite = readStr();
      factions.push({ faction, texture, normalTex, sprite });
    }

    // Raw tail: everything from here to the start of the next entry (or EOF)
    // This preserves attachment-sets + rest section + terminator for lossless serialization
    const tailStart = pos;
    const nextStart = findNextEntryStart(pos);
    const rawTail = tokens.slice(tailStart, nextStart).join(' ');
    pos = nextStart;

    // Parse attach factions from rawTail for display only
    const attachFactions = parseAttachFromRawTail(rawTail);

    return { name, meshes, factions, attachFactions, rawTail };
  }

  for (let e = 0; e < totalEntries && pos < tokens.length - 3; e++) {
    const savedPos = pos;
    try {
      entries.push(parseEntry());
    } catch {
      pos = savedPos + 1;
      e--;
      if (pos >= tokens.length - 3) break;
    }
  }

  const byName = {};
  for (const e of entries) byName[e.name] = e;

  return { totalEntries, entries, byName };
}

// ---------------------------------------------------------------------------
// Serializer
// ---------------------------------------------------------------------------
export function serializeModeldb(parsed) {
  const lines = [];
  const hdr = 'serialization::archive';
  lines.push(`${hdr.length} ${hdr} 3 0 0 0 0 ${parsed.entries.length} 0 0`);
  for (const entry of parsed.entries) lines.push(serializeEntry(entry));
  return lines.join('\n');
}

function serializeEntry(entry) {
  const lines = [];
  lines.push(`${entry.name.length} ${entry.name}`);
  lines.push(`1 ${entry.meshes.length}`);
  for (const m of entry.meshes) {
    lines.push(`${m.path.length} ${m.path} ${m.dist}`);
  }
  lines.push(`${entry.factions.length}`);
  for (const f of entry.factions) {
    lines.push(`${f.faction.length} ${f.faction}`);
    lines.push(`${f.texture.length} ${f.texture}`);
    lines.push(`${f.normalTex.length} ${f.normalTex}`);
    lines.push(`${f.sprite.length} ${f.sprite}`);
  }
  if (entry.rawTail) lines.push(entry.rawTail);
  return lines.join('\n');
}