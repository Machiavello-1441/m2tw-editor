/**
 * stratCasCodec.js
 *
 * Parses M2TW full-format strat map unit .cas files (the "animation library" format
 * used by unit figures, city models etc. in data/world/maps/...).
 *
 * These files start with a 42-byte header, followed by hierarchy tree, time ticks,
 * bone section, quaternion / anim / pose float arrays, and finally mesh data.
 *
 * This is a JavaScript port of Sandy Wilson's stratmodelconverter.py, adapted to
 * run entirely in the browser and return data in the same format as casCodec.js so
 * it feeds directly into the existing ModelViewer + meshesToMs3d pipeline.
 *
 * Returned shape:
 *   { meshes: [{ name, positions, normals, uvs, indices, numVertices, numFaces }],
 *     errors: string[] }
 */

// ── Low-level binary readers ──────────────────────────────────────────────────

class BinaryReader {
  constructor(buffer) {
    this.view = new DataView(buffer);
    this.u8   = new Uint8Array(buffer);
    this.pos  = 0;
    this.size = buffer.byteLength;
  }
  eof()           { return this.pos >= this.size; }
  peekEof()       { return this.pos >= this.size; }
  byte()          { return this.view.getUint8(this.pos++); }
  sbyte()         { const v = this.view.getInt8(this.pos); this.pos++; return v; }
  ushort()        { const v = this.view.getUint16(this.pos, true); this.pos += 2; return v; }
  short()         { const v = this.view.getInt16(this.pos, true);  this.pos += 2; return v; }
  uint()          { const v = this.view.getUint32(this.pos, true); this.pos += 4; return v; }
  int()           { const v = this.view.getInt32(this.pos,  true); this.pos += 4; return v; }
  float()         { const v = this.view.getFloat32(this.pos, true); this.pos += 4; return v; }
  seek(n)         { this.pos += n; }
  tell()          { return this.pos; }
  readBytes(n)    {
    const bytes = [];
    for (let i = 0; i < n; i++) bytes.push(this.byte());
    return bytes;
  }
  readString(n)   {
    let s = '';
    for (let i = 0; i < n; i++) {
      const c = this.view.getUint8(this.pos++);
      s += String.fromCharCode(c);
    }
    return s;
  }
  readFloats(n) {
    const arr = new Float32Array(n);
    for (let i = 0; i < n; i++) { arr[i] = this.float(); }
    return arr;
  }
  readUints(n) {
    const arr = [];
    for (let i = 0; i < n; i++) arr.push(this.uint());
    return arr;
  }
  readUshorts(n) {
    const arr = [];
    for (let i = 0; i < n; i++) arr.push(this.ushort());
    return arr;
  }
}

// ── CAS header (42 bytes) ─────────────────────────────────────────────────────

function readHeader(r) {
  const float_version_raw = r.float();
  let float_version = float_version_raw;
  for (const v of [3.02, 3.0, 2.23, 2.22, 3.12, 3.05, 2.19]) {
    if (Math.abs(float_version_raw - v) < 0.001) { float_version = v; break; }
  }

  const int_thirtyeight = r.uint();
  const int_nine        = r.uint();
  const int_zero1       = r.uint();
  const float_animtime  = r.float();
  const int_one1        = r.uint();
  const int_zero2       = r.uint();
  const sig1            = [r.byte(), r.byte(), r.byte()];
  const int_one2        = r.uint();
  const int_zero3       = r.uint();
  const sig2            = [r.byte(), r.byte(), r.byte()];

  return { float_version, sig1, sig2, signaturebyte: sig2[0] };
}

// ── Hierarchy tree ────────────────────────────────────────────────────────────

function readHierarchyTree(r, version_float) {
  // All versions read nbones as a uint (4 bytes); each hierarchy entry is also uint (4 bytes)
  const nbones = r.uint();
  if (nbones === 0 || nbones > 512) throw new Error(`Invalid nbones ${nbones}`);
  const hierarchy = [];
  for (let i = 0; i < nbones; i++) hierarchy.push(r.uint());
  return hierarchy;
}

// ── Time ticks ────────────────────────────────────────────────────────────────

function readTimeTicks(r) {
  const nframes = r.uint();
  if (nframes > 10000) throw new Error(`Unreasonably large nframes ${nframes} — file may be corrupt or misdetected`);
  const ticks = [];
  for (let i = 0; i < nframes; i++) ticks.push(r.float());
  return ticks;
}

// ── Bone section ──────────────────────────────────────────────────────────────

function readBoneSection(r, nbones, version_float) {
  const OLD = [3.02, 2.23, 3.0, 2.22, 3.12, 3.05, 2.19];
  const bonenames           = [];
  const quatframesperbone   = [];
  const animframesperbone   = [];
  const onesperbone         = [];

  for (let ii = 0; ii < nbones; ii++) {
    const nch      = r.uint();
    if (nch === 0 || nch > 256) throw new Error(`Invalid bone name length ${nch} at bone ${ii}`);
    const bonename = r.readString(nch - 1);
    r.byte(); // null terminator

    const quatframes = r.uint();
    const animframes = r.uint();
    r.uint(); // quatoffset
    r.uint(); // animoffset
    r.uint(); // zero

    let one = 1;
    if (!OLD.includes(version_float)) {
      one = r.uint();
      r.byte(); // byte1
    }

    bonenames.push(bonename);
    quatframesperbone.push(quatframes);
    animframesperbone.push(animframes);
    onesperbone.push(one);
  }

  return { bonenames, quatframesperbone, animframesperbone, onesperbone };
}

// ── Chunk header variants ─────────────────────────────────────────────────────

function readResourceChunkHeader(r) {
  r.uint(); // chunk length
  r.uint(); // 1
  r.uint(); // 2
  const numchars = r.uint();
  if (numchars === 26) {
    r.readString(25); r.byte(); // attrib string + null
    r.uint(); r.byte();
    r.uint(); r.byte();
    for (let i = 0; i < 9; i++) r.float(); // 9 floats
    r.ushort(); r.int(); r.uint();
  } else {
    r.pos -= 4; // seek back 4
  }
  return 1; // nummeshes
}

function readNavyChunkHeader(r) {
  r.uint(); r.uint(); r.uint(); // chunk data
  const nch = r.uint();
  r.readString(nch - 1); r.byte(); // attrib string
  r.uint(); r.byte();
  r.uint(); r.byte();
  for (let i = 0; i < 9; i++) r.float();
  r.ushort(); r.int(); r.uint();
  return 1;
}

function readRegularChunkHeader(r) {
  r.uint(); r.uint(); r.uint(); r.uint(); r.ushort(); r.uint(); r.uint();
  return r.uint(); // nummeshes
}

function readAttribNodeChunkHeader(r) {
  r.uint(); r.uint(); r.uint(); // sizes
  const nch = r.uint();
  r.readString(nch - 1); r.byte();
  r.uint(); r.byte();
  r.uint(); r.byte();
  for (let i = 0; i < 9; i++) r.float();
  r.ushort(); r.int(); r.ushort(); r.uint(); r.uint(); r.uint(); r.uint();
  return r.uint(); // nummeshes
}

// ── Mesh middle section (returns raw mesh arrays) ─────────────────────────────

function readMeshMiddle(r, FLAGRESOURCE, FLAGNAVY) {
  if (r.peekEof()) return null;

  let nummeshes;
  if (FLAGNAVY) {
    nummeshes = readNavyChunkHeader(r);
  } else if (FLAGRESOURCE) {
    nummeshes = readResourceChunkHeader(r);
  } else {
    const savedPos = r.pos;
    const chunklength = r.uint();
    r.pos = savedPos;
    if (chunklength === 104) {
      nummeshes = readAttribNodeChunkHeader(r);
    } else {
      nummeshes = readRegularChunkHeader(r);
    }
  }

  // ── Read first mesh ──
  const nch1     = r.uint();
  const meshname1 = r.readString(nch1 - 1); r.byte();

  // comment block
  r.uint(); r.byte(); // first comment uint + null byte
  if (FLAGRESOURCE || FLAGNAVY) { r.uint(); r.byte(); r.uint(); }
  for (let i = 0; i < 7; i++) r.float(); // 7 floats

  const numverts1   = r.ushort();
  const numfaces1   = r.ushort();
  const flagTVerts1  = r.byte();
  const flagVColors1 = r.byte();

  // bone IDs
  const boneIds1 = new Int32Array(numverts1);
  if (FLAGRESOURCE || FLAGNAVY) {
    boneIds1.fill(-1);
  } else {
    for (let i = 0; i < numverts1; i++) boneIds1[i] = r.int();
  }

  const verts1   = r.readFloats(3 * numverts1);
  const normals1 = r.readFloats(3 * numverts1);
  const faces1   = new Uint16Array(3 * numfaces1);
  for (let i = 0; i < 3 * numfaces1; i++) faces1[i] = r.ushort();

  const texId1 = r.uint();
  const tverts1  = flagTVerts1  === 1 ? r.readFloats(2 * numverts1) : null;
  if (flagVColors1 === 1) {
    for (let i = 0; i < 4 * numverts1; i++) r.sbyte(); // skip vcolors
  }
  r.uint(); // terminating 0

  // Accumulate across all meshes
  let allBoneIds = Array.from(boneIds1);
  let allVerts   = Array.from(verts1);
  let allNormals = Array.from(normals1);
  let allFaces   = Array.from(faces1);
  let allTverts  = tverts1 ? Array.from(tverts1) : [];
  let hasTverts  = flagTVerts1 === 1;

  for (let imesh = 1; imesh < nummeshes; imesh++) {
    const nch2      = r.uint();
    const _meshname2 = r.readString(nch2 - 1); r.byte();

    r.uint(); r.byte(); // comment uint + null
    for (let i = 0; i < 7; i++) r.float();

    const numverts2   = r.ushort();
    const numfaces2   = r.ushort();
    const flagTVerts2  = r.byte();
    const flagVColors2 = r.byte();

    const boneIds2 = new Uint32Array(numverts2);
    for (let i = 0; i < numverts2; i++) boneIds2[i] = r.uint();
    const verts2   = r.readFloats(3 * numverts2);
    const normals2 = r.readFloats(3 * numverts2);

    const faces2 = new Uint16Array(3 * numfaces2);
    for (let i = 0; i < 3 * numfaces2; i++) faces2[i] = r.ushort();

    r.uint(); // texId2
    const tverts2 = flagTVerts2 === 1 ? r.readFloats(2 * numverts2) : null;
    if (flagVColors2 === 1) {
      for (let i = 0; i < 4 * numverts2; i++) r.sbyte();
    }
    r.uint(); // terminating 0

    const nvcur = allVerts.length / 3;
    // Offset faces and append
    for (let i = 0; i < 3 * numfaces2; i++) allFaces.push(faces2[i] + nvcur);
    // Append verts
    for (let i = 0; i < numverts2; i++) {
      allBoneIds.push(boneIds2[i]);
      allVerts.push(verts2[3*i], verts2[3*i+1], verts2[3*i+2]);
      allNormals.push(normals2[3*i], normals2[3*i+1], normals2[3*i+2]);
      if (hasTverts && tverts2) {
        allTverts.push(tverts2[2*i], tverts2[2*i+1]);
      }
    }
  }

  return {
    boneIds: allBoneIds,
    verts:   allVerts,
    normals: allNormals,
    faces:   allFaces,
    tverts:  allTverts,
    hasTverts,
    meshname: meshname1,
  };
}

// ── Main parse entry point ────────────────────────────────────────────────────

export function parseStratCasFile(buffer) {
  const errors = [];
  const r = new BinaryReader(buffer);

  // Quick sanity check: the first 4 bytes as a float should be near known version values
  if (buffer.byteLength < 50) {
    return { meshes: [], errors: ['File too small to be a strat .cas file'] };
  }

  let header;
  try {
    header = readHeader(r);
  } catch(e) {
    return { meshes: [], errors: [`Header parse failed: ${e.message}`] };
  }

  const { float_version, signaturebyte } = header;

  // Known valid version floats
  const KNOWN_VERSIONS = [3.02, 3.0, 2.23, 2.22, 3.12, 3.05, 2.19];
  if (!KNOWN_VERSIONS.includes(float_version) && !(float_version > 2.0 && float_version < 4.0)) {
    errors.push(`Unusual version float: ${float_version}`);
  }

  // These 2 uints appear in some versions but not all — skip them tentatively.
  // We'll detect if the hierarchy read looks sane; if nbones fails we don't need to backtrack
  // because the Python script always reads them for ALL known versions.
  r.uint(); // filesizesans
  r.uint(); // int_zero (padding)

  // Determine file type from filename hint if available (fallback to signaturebyte)
  // We use signaturebyte only — 99 = 'c' = resource/symbol
  const FLAGRESOURCE = signaturebyte === 99;
  const FLAGNAVY     = false; // set externally if needed; we rely on name checks in callers

  // Hierarchy tree
  let hierarchy;
  try {
    hierarchy = readHierarchyTree(r, float_version);
  } catch(e) {
    return { meshes: [], errors: [`Hierarchy tree parse failed: ${e.message}`] };
  }
  const nbones = hierarchy.length;

  // Time ticks
  try {
    readTimeTicks(r); // not needed for mesh output
  } catch(e) {
    return { meshes: [], errors: [`Time ticks parse failed: ${e.message}`] };
  }

  // Bone section
  let bonedata;
  try {
    bonedata = readBoneSection(r, nbones, float_version);
  } catch(e) {
    return { meshes: [], errors: [`Bone section parse failed: ${e.message}`] };
  }

  const { bonenames, quatframesperbone, animframesperbone, onesperbone } = bonedata;

  // Count frames
  let nquatframes = 0, nanimframes = 0, nposeframes = 0;
  for (let i = 0; i < nbones; i++) {
    nquatframes += quatframesperbone[i];
    nanimframes += animframesperbone[i];
    nposeframes += onesperbone[i];
  }

  // Read float data blocks
  let quatfloats, animfloats, posefloats;
  try {
    quatfloats = r.readFloats(nquatframes * 4);
    animfloats = r.readFloats(nanimframes * 3);
    posefloats = r.readFloats(nposeframes * 3);
  } catch(e) {
    return { meshes: [], errors: [`Float data read failed: ${e.message}`] };
  }

  // Read mesh geometry
  let meshRaw;
  try {
    meshRaw = readMeshMiddle(r, FLAGRESOURCE, FLAGNAVY);
  } catch(e) {
    return { meshes: [], errors: [`Mesh data parse failed: ${e.message}`] };
  }

  if (!meshRaw || meshRaw.verts.length === 0) {
    return { meshes: [], errors: ['No mesh data found in strat .cas file'] };
  }

  // ── Apply pose offsets to un-skin vertices ──────────────────────────────────
  // The vertices in the file are relative to their bone's local frame.
  // We compute absolute bone positions from posefloats + hierarchy and add them.

  const poseabs = [];
  // Scene_Root (bone 0)
  poseabs.push(-posefloats[0], posefloats[1], posefloats[2]);

  const nbones2 = Math.floor(posefloats.length / 3);
  for (let ib = 1; ib < nbones2; ib++) {
    const idx = hierarchy[ib] || 0;
    poseabs.push(
      -posefloats[3*ib+0] + poseabs[3*idx+0],
       posefloats[3*ib+1] + poseabs[3*idx+1],
       posefloats[3*ib+2] + poseabs[3*idx+2],
    );
  }

  const verts   = meshRaw.verts;
  const boneIds = meshRaw.boneIds;
  for (let iv = 0; iv < boneIds.length; iv++) {
    const Id = boneIds[iv];
    if (Id >= 0 && 3*Id+2 < poseabs.length) {
      verts[3*iv+0] += poseabs[3*Id+0];
      verts[3*iv+1] += poseabs[3*Id+1];
      verts[3*iv+2] += poseabs[3*Id+2];
    }
  }

  // ── Geometry corrections (mirror x, flip winding) ──────────────────────────
  // The Python script flips x → -x and swaps face indices 1 & 2.
  // These were already applied in readMeshMiddle so we just convert to typed arrays.

  const numVerts = Math.floor(verts.length / 3);
  const numFaces = Math.floor(meshRaw.faces.length / 3);

  const positions = new Float32Array(numVerts * 3);
  const normals   = new Float32Array(numVerts * 3);
  const uvs       = new Float32Array(numVerts * 2);
  const indices   = new Uint32Array(numFaces * 3);

  for (let i = 0; i < numVerts; i++) {
    // Mirror x → -x (Python: verts[3*ii] = -verts[3*ii])
    positions[3*i]   = -verts[3*i];
    positions[3*i+1] =  verts[3*i+1];
    positions[3*i+2] =  verts[3*i+2];

    normals[3*i]   = -meshRaw.normals[3*i];
    normals[3*i+1] =  meshRaw.normals[3*i+1];
    normals[3*i+2] =  meshRaw.normals[3*i+2];

    if (meshRaw.hasTverts && meshRaw.tverts.length >= 2*i+2) {
      uvs[2*i]   = meshRaw.tverts[2*i];
      uvs[2*i+1] = meshRaw.tverts[2*i+1];
    }
  }

  for (let f = 0; f < numFaces; f++) {
    const i0 = meshRaw.faces[3*f+0];
    const i1 = meshRaw.faces[3*f+1];
    const i2 = meshRaw.faces[3*f+2];
    // Swap 1 & 2 (Python: faces[3*ii+1] ↔ faces[3*ii+2])
    indices[3*f+0] = i0;
    indices[3*f+1] = i2;
    indices[3*f+2] = i1;
  }

  // Compute normals if not stored
  if (!meshRaw.hasTverts) {
    errors.push('No UV data found in .cas file — UVs will be zero.');
  }

  const meshName = meshRaw.meshname || 'strat_model';

  return {
    meshes: [{ name: meshName, positions, normals, uvs, indices, numVertices: numVerts, numFaces }],
    errors,
    isStratCas: true,
  };
}

/**
 * Try to detect if this buffer is a full-format strat .cas (with header)
 * vs the simple mesh-dump format. The full-format starts with a float
 * in the range ~2.0–4.0 that matches known version numbers.
 */
export function isFullFormatStratCas(buffer) {
  if (buffer.byteLength < 50) return false;
  const view = new DataView(buffer);
  const vf = view.getFloat32(0, true);
  // Known version floats for full-format strat CAS
  return (Math.abs(vf - 3.02) < 0.01 || Math.abs(vf - 3.0) < 0.01 ||
          Math.abs(vf - 2.23) < 0.01 || Math.abs(vf - 2.22) < 0.01 ||
          Math.abs(vf - 3.12) < 0.01 || Math.abs(vf - 3.05) < 0.01 ||
          Math.abs(vf - 2.19) < 0.01);
}