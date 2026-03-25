/**
 * M2TW battle_models.modeldb parser & serializer
 *
 * The file is text-based with length-prefix string encoding plus Boost
 * serialization "first-time pads" (pairs of 0 0) before each collection.
 *
 * Full per-entry structure (from IWTE docs):
 *   [nameLen] [name]
 *   [scale]                          float (1.0 for infantry, 1.12 for horses)
 *   [0] [0]                          first-time pad
 *   [lodCount]
 *   [0] [0]                          first-time pad
 *   [pathLen] [path] [dist]  × lodCount
 *   [0] [0]                          first-time pad
 *   [mainFactionCount]
 *   [0] [0]                          first-time pad
 *   for each main faction:
 *     [fLen] [faction] [texLen] [tex] [normLen] [norm] [sprLen] [spr]
 *   [attachFactionCount]
 *   [0] [0]                          first-time pad
 *   for each attach faction:
 *     [fLen] [faction] [texLen] [tex] [normLen] [norm] [0]
 *   [mountTypeCount]
 *   [0] [0]                          first-time pad
 *   for each mount type:
 *     [mtLen] [mountType]
 *     [primarySkeletonLen] [primarySkeleton]
 *     [secondarySkeletonLen] [secondarySkeleton]
 *     [0] [0]                        first-time pad
 *     [primaryWeaponCount]
 *     for each primary weapon: [wLen] [weaponName]
 *     [secondaryWeaponCount]
 *     for each secondary weapon: [wLen] [weaponName]
 *   [torchBoneIndex]                 int (-1 = no torch)
 *   [0] [0]                          first-time pad
 *   [tx] [ty] [tz] [rx] [ry] [rz]   6 floats (torch transform; all 0 if no torch)
 */

// ---------------------------------------------------------------------------
// Tokeniser helpers
// ---------------------------------------------------------------------------
function makeReader(text) {
  const tokens = text.trim().split(/[ \t\r\n]+/).filter(Boolean);
  let pos = 0;

  function peek() { return tokens[pos]; }
  function readInt() {
    if (pos >= tokens.length) throw new Error('EOF reading int');
    const v = parseInt(tokens[pos++], 10);
    if (isNaN(v)) throw new Error(`Expected int, got "${tokens[pos - 1]}" at pos ${pos - 1}`);
    return v;
  }
  function readFloat() {
    if (pos >= tokens.length) throw new Error('EOF reading float');
    const v = parseFloat(tokens[pos++]);
    if (isNaN(v)) throw new Error(`Expected float, got "${tokens[pos - 1]}" at pos ${pos - 1}`);
    return v;
  }
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
  // Read 0 0 first-time pad (silently consumed)
  function readPad() {
    readInt(); // 0
    readInt(); // 0
  }

  return { peek, readInt, readFloat, readStr, readPad, getPos: () => pos, setPos: (p) => { pos = p; }, tokens };
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------
export function parseModeldb(text) {
  const r = makeReader(text);

  // Header: "22 serialization::archive 3 0 0 0 0 N 0 0"
  r.readStr(); // "serialization::archive"
  r.readInt(); r.readInt(); r.readInt(); r.readInt(); r.readInt(); // 3 0 0 0 0
  const totalEntries = r.readInt();
  r.readInt(); r.readInt(); // 0 0

  const entries = [];

  function parseEntry() {
    const name = r.readStr();

    // Scale — float (1.0 for infantry, ~1.12 for horses)
    const scaleRaw = r.peek();
    let scale = 1;
    if (scaleRaw !== undefined && !isNaN(parseFloat(scaleRaw)) && isNaN(parseInt(scaleRaw, 10))) {
      scale = r.readFloat();
    } else if (scaleRaw !== undefined) {
      // Could be int 1 (scale=1) followed by pads
      const v = parseInt(scaleRaw, 10);
      if (v === 1 || v === 0) {
        r.readInt(); // consume it
        scale = v;
      }
    }

    // First-time pad
    r.readPad();

    const lodCount = r.readInt();

    // First-time pad before LODs
    r.readPad();

    const meshes = [];
    for (let m = 0; m < lodCount; m++) {
      const path = r.readStr();
      const dist = r.readInt();
      meshes.push({ path, dist });
    }

    // First-time pad before main factions
    r.readPad();

    const mainFactionCount = r.readInt();

    // First-time pad before faction list
    r.readPad();

    const factions = [];
    for (let f = 0; f < mainFactionCount; f++) {
      const faction = r.readStr();
      const texture = r.readStr();
      const normalTex = r.readStr();
      const sprite = r.readStr();
      factions.push({ faction, texture, normalTex, sprite });
    }

    // Attachment factions
    const attachCount = r.readInt();

    // First-time pad before attach list
    r.readPad();

    const attachFactions = [];
    for (let f = 0; f < attachCount; f++) {
      const faction = r.readStr();
      const diffTex = r.readStr();
      const normTex = r.readStr();
      r.readInt(); // trailing 0
      attachFactions.push({ faction, diffTex, normTex });
    }

    // Mount types / skeleton section
    const mountTypeCount = r.readInt();

    // First-time pad before mount list
    r.readPad();

    const mountTypes = [];
    for (let m = 0; m < mountTypeCount; m++) {
      const mountType = r.readStr();
      const primarySkeleton = r.readStr();
      const secondarySkeleton = r.readStr();

      // First-time pad before weapons
      r.readPad();

      const primaryWeaponCount = r.readInt();
      const primaryWeapons = [];
      for (let w = 0; w < primaryWeaponCount; w++) primaryWeapons.push(r.readStr());

      const secondaryWeaponCount = r.readInt();
      const secondaryWeapons = [];
      for (let w = 0; w < secondaryWeaponCount; w++) secondaryWeapons.push(r.readStr());

      mountTypes.push({ mountType, primarySkeleton, secondarySkeleton, primaryWeapons, secondaryWeapons });
    }

    // Torch
    const torchBoneIndex = r.readInt();
    r.readPad();
    const torchTx = r.readFloat();
    const torchTy = r.readFloat();
    const torchTz = r.readFloat();
    const torchRx = r.readFloat();
    const torchRy = r.readFloat();
    const torchRz = r.readFloat();

    return {
      name,
      scale,
      meshes,
      factions,
      attachFactions,
      mountTypes,
      torchBoneIndex,
      torch: [torchTx, torchTy, torchTz, torchRx, torchRy, torchRz],
    };
  }

  // Scan forward to find the start of the next modeldb entry heuristically.
  // An entry starts with: [nameLen] [name] [scaleOrInt] ...
  // where name is alphanumeric+underscore (no dots, slashes, spaces).
  function findNextEntryStart(fromPos) {
    const tokens = r.tokens;
    for (let p = fromPos; p < tokens.length - 3; p++) {
      const len = parseInt(tokens[p], 10);
      if (isNaN(len) || len < 3 || len > 80) continue;
      const name = tokens[p + 1];
      if (!name || name.length !== len) continue;
      if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(name)) continue;
      return p;
    }
    return tokens.length;
  }

  for (let e = 0; e < totalEntries && r.getPos() < r.tokens.length - 3; e++) {
    const savedPos = r.getPos();
    try {
      entries.push(parseEntry());
    } catch (err) {
      // Skip to next entry on parse error
      const next = findNextEntryStart(savedPos + 1);
      r.setPos(next);
      if (r.getPos() >= r.tokens.length - 3) break;
      e--;
    }
  }

  // Build case-insensitive lookup
  const byName = {};
  for (const e of entries) {
    byName[e.name.toLowerCase()] = e;
  }

  return { totalEntries, entries, byName };
}

// ---------------------------------------------------------------------------
// Serializer
// ---------------------------------------------------------------------------
function w(s) { return `${s.length} ${s}`; }
function wf(f) {
  // Preserve float formatting — avoid unnecessary precision
  if (Number.isInteger(f)) return String(f);
  return String(f);
}

export function serializeModeldb(parsed) {
  const hdr = 'serialization::archive';
  const parts = [`${hdr.length} ${hdr} 3 0 0 0 0 ${parsed.entries.length} 0 0`];
  for (const entry of parsed.entries) parts.push(serializeEntry(entry));
  return parts.join('\n');
}

function serializeEntry(entry) {
  const lines = [];

  lines.push(w(entry.name));
  lines.push(wf(entry.scale ?? 1));
  lines.push('0 0'); // first-time pad

  lines.push(String(entry.meshes.length));
  lines.push('0 0'); // first-time pad before lods
  for (const m of entry.meshes) {
    lines.push(`${m.path.length} ${m.path} ${m.dist}`);
  }

  lines.push('0 0'); // first-time pad before main factions
  lines.push(String(entry.factions.length));
  lines.push('0 0'); // first-time pad before faction list
  for (const f of entry.factions) {
    lines.push(w(f.faction));
    lines.push(w(f.texture));
    lines.push(w(f.normalTex));
    lines.push(w(f.sprite));
  }

  // Attachment factions
  const attachFactions = entry.attachFactions || [];
  lines.push(String(attachFactions.length));
  lines.push('0 0'); // first-time pad
  for (const f of attachFactions) {
    lines.push(w(f.faction));
    lines.push(w(f.diffTex));
    lines.push(w(f.normTex));
    lines.push('0');
  }

  // Mount types
  const mountTypes = entry.mountTypes || [];
  lines.push(String(mountTypes.length));
  lines.push('0 0'); // first-time pad
  for (const mt of mountTypes) {
    lines.push(w(mt.mountType));
    lines.push(w(mt.primarySkeleton));
    lines.push(w(mt.secondarySkeleton || ''));
    lines.push('0 0'); // first-time pad before weapons
    lines.push(String((mt.primaryWeapons || []).length));
    for (const wep of (mt.primaryWeapons || [])) lines.push(w(wep));
    lines.push(String((mt.secondaryWeapons || []).length));
    for (const wep of (mt.secondaryWeapons || [])) lines.push(w(wep));
  }

  // Torch
  lines.push(String(entry.torchBoneIndex ?? -1));
  lines.push('0 0'); // first-time pad
  const torch = entry.torch || [0, 0, 0, 0, 0, 0];
  lines.push(torch.map(wf).join(' '));

  return lines.join('\n');
}