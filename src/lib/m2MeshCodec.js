/**
 * Real decoder for M2TW battle models (`.mesh`, data/unit_models/).
 *
 * A `.mesh` is a **boost::serialization binary archive** — every file opens
 * with `16 00 00 00 "serialization::archive"`. That is why a fixed-stride
 * reader cannot work: boost writes a class descriptor the FIRST time it meets
 * a type, so the same record is two bytes longer the first time it appears.
 *
 * Record layout on top of it:
 *   header, then a group count, then per group:
 *     string group type ("Body", "shield0"), string mesh name, uint32 triangle
 *     count, uint16 index triples, uint32 flag (0 required, 1 optional)
 *   then the vertex pool the groups all index into:
 *     uint32 vertex count, then per attribute: uint32 stream type,
 *     uint32 count, count * stride bytes
 *   then a bounding sphere and a bone table
 *   then a per-LOD block, named but not decoded.
 *
 * **Indices are global** — a group is a face range over one shared pool, not a
 * mesh of its own.
 *
 * **UVs address TWO textures glued side by side.** The file normalises u over
 * the pair (main 0..0.5, attachment 0.5..1); we double it on read so callers
 * get the community/IWTE convention: main 0..1, attachment 1..2.
 *
 * **The models are left-handed** (right +X, up +Y, forward +Z, Direct3D) and
 * stand up the Y axis.
 */
import { BoostArchive, ArchiveError, BOOST_SIGNATURE } from './boostArchive';
import { toViewerMeshes } from './m2ModelGeometry';

/** Bytes per vertex by stream type. Types 3/10/11 have two lengths because
 *  two vertex formats share the numbers: a skinned model packs normal, tangent
 *  and binormal into three biased bytes + pad, a static one writes 3 floats. */
const STREAM_STRIDE = {
  0: [12], 1: [8], 2: [4], 4: [8],
  3: [4, 12], 10: [4, 12], 11: [4, 12],
  8: [4], 9: [4], 13: [4], 14: [4],
};

const POSITION_STREAM = 0;
const NORMAL_STREAM = 3;
const UV_STREAM = 4;

/** How far ahead of a finished stream the next one's header may sit. The gap
 *  is boost's own bookkeeping; the longest measured is 40 bytes. */
const STREAM_GAP = 96;

/** The LOD/attachment block after the bone table. Roomy on purpose: the point
 *  of the ceiling is catching a decode that stopped early. */
const MAX_TRAILER = 64 * 1024;

const TILE_EPS = 0.001;

// ─── header ───────────────────────────────────────────────────────────────────

function looksLikeDescriptor(a) {
  if (a.p + 8 > a.length) return false;
  const zero = a.view.getUint16(a.p, true);
  const cid = a.view.getUint16(a.p + 2, true);
  const tracking = a.d[a.p + 4];
  const version = a.d[a.p + 5];
  return zero === 0 && cid > 0 && cid <= 64 && tracking <= 1 && version <= 8;
}

/** The signature and the words before the first class: four in a skinned
 *  model, three in a static one. Take the length that leaves the cursor on a
 *  class descriptor rather than guessing from the file's folder. */
function readHeader(a) {
  const sig = a.text();
  if (sig !== BOOST_SIGNATURE) {
    throw new ArchiveError(
      `${a.source} is not a .mesh (expected a boost archive, found "${sig.slice(0, 32)}")`);
  }
  a.blob(5); // library version + the archive's type sizes
  const mark = a.p;
  for (const words of [4, 3]) {
    a.p = mark;
    for (let i = 0; i < words; i++) a.u32();
    if (looksLikeDescriptor(a)) return;
  }
  throw new ArchiveError(`${a.source}: the archive header is not a shape this tool knows`);
}

// ─── groups ───────────────────────────────────────────────────────────────────

function readGroups(a) {
  a.u16(); a.obj();
  a.u16(); a.obj();
  a.u16();
  const n = a.count('groups', 4096);
  const groups = [];
  for (let i = 0; i < n; i++) {
    a.obj();
    const name = a.text();       // group TYPE — the slot the game fills
    const meshName = a.text();   // the artist's mesh name within that type
    if (i === 0) a.u16();        // the index container's descriptor, written once
    const tris = a.count('triangles');
    const raw = a.blob(tris * 6);
    const indices = new Uint16Array(raw.buffer, raw.byteOffset, tris * 3);
    const flag = a.u32();
    groups.push({ name, meshName, indices, flag, sheets: 'main', texture: '' });
    a.u8();
    a.obj();  // the group's two child objects: no geometry, but they have to
    a.obj();  // be stepped over exactly
  }
  return groups;
}

// ─── the vertex pool ──────────────────────────────────────────────────────────

/**
 * `{ stype, start }` for the next stream, or null.
 * The bytes between streams are boost bookkeeping whose length depends on
 * which classes are already introduced, so look ahead for the header itself: a
 * known type, this file's exact vertex count, and room for the data. Three
 * things keep it honest — the window is small, a type already read is not
 * matched twice, and every later stream must be found from where this one
 * ends, so a coincidence does not survive the chain.
 */
function findStream(a, from, verts, got) {
  const limit = Math.min(from + STREAM_GAP, a.length - 8);
  for (let off = from; off <= limit; off += 2) {
    const stype = a.view.getUint32(off, true);
    if (!STREAM_STRIDE[stype] || got.has(stype)) continue;
    for (const skip of [4, 6]) { // count straight after the type, or past a marker
      if (off + skip + 4 > a.length) continue;
      if (a.view.getUint32(off + skip, true) !== verts) continue;
      const start = off + skip + 4;
      const min = Math.min(...STREAM_STRIDE[stype]);
      if (start + verts * min <= a.length) return { stype, start };
    }
  }
  return null;
}

/** Which of a type's possible strides this file uses: try each and keep the
 *  one that leaves the cursor somewhere the rest of the file reads. */
function resolveStride(a, stype, start, verts, got) {
  const options = STREAM_STRIDE[stype];
  if (options.length === 1) return options[0];
  for (const stride of options) {
    const end = start + verts * stride;
    if (end > a.length) continue;
    if (findStream(a, end, verts, got) !== null) return stride;
    const probe = new BoostArchive(a.d, a.source);
    probe.p = end;
    try {
      readBones(probe, { bones: [] });
      const trailer = a.length - probe.p;
      if (trailer >= 0 && trailer <= MAX_TRAILER) return stride;
    } catch { /* wrong stride — try the other */ }
  }
  return null;
}

function readStreams(a, out) {
  a.obj();
  a.obj();
  const verts = a.count('vertices');
  a.u16();
  a.u32(); // weights per vertex (2 in every file measured)

  const packed = {};
  for (;;) {
    const got = new Set(Object.keys(packed).map(Number));
    const found = findStream(a, a.p, verts, got);
    if (!found) break;
    got.add(found.stype);
    const stride = resolveStride(a, found.stype, found.start, verts, got);
    if (stride === null) {
      out.notes.push(`vertex stream type ${found.stype} has a length this tool could not settle; it was left out`);
      break;
    }
    a.p = found.start;
    packed[found.stype] = a.blob(verts * stride);
  }

  if (!packed[POSITION_STREAM]) {
    const seen = Object.keys(packed).join(', ') || 'none';
    throw new ArchiveError(`${a.source} has no vertex positions — found streams ${seen}`);
  }

  const pos = packed[POSITION_STREAM];
  out.positions = new Float32Array(pos.buffer, pos.byteOffset, verts * 3);

  if (packed[UV_STREAM]) {
    const uv = packed[UV_STREAM];
    out.uvs = new Float32Array(new Float32Array(uv.buffer, uv.byteOffset, verts * 2));
    // The file normalises u over the two-sheet PAIR. Doubling puts every UV
    // into the convention IWTE and the Blender addon speak: main 0..1,
    // attachment 1..2. v is per sheet already.
    for (let i = 0; i < out.uvs.length; i += 2) out.uvs[i] *= 2.0;
  }

  if (packed[NORMAL_STREAM]) {
    out.normals = unpackNormals(packed[NORMAL_STREAM], verts);
  } else {
    out.notes.push('no normal stream; normals were derived from the faces');
  }
}

/**
 * The normal stream as floats, whichever of its two forms it is in.
 * Twelve bytes a vertex are already three floats. Four are a D3DCOLOR-style
 * packed vector: unsigned bytes biased around 127.5 (`b / 255 * 2 - 1`), laid
 * out BGRA-fashion — x in the third byte, y in the second, z in the first,
 * fourth a pad. Read as signed bytes in x-y-z order (the obvious first guess)
 * half of them point against their own faces, which on screen is a model
 * covered in dark patches with hard seams.
 */
function unpackNormals(raw, verts) {
  if (verts && Math.floor(raw.length / verts) === 12) {
    return new Float32Array(new Float32Array(raw.buffer, raw.byteOffset, verts * 3));
  }
  const out = new Float32Array(verts * 3);
  for (let v = 0; v < verts; v++) {
    for (let c = 0; c < 3; c++) {
      out[v * 3 + c] = (raw[v * 4 + (2 - c)] / 255) * 2 - 1;
    }
  }
  return out;
}

// ─── bones and the tail ───────────────────────────────────────────────────────

/** The bounding sphere and bone table after the vertex streams. A settlement
 *  mesh has no skeleton and writes a count of zero — same grammar, empty
 *  table, no class descriptor. */
function readBones(a, out) {
  a.ref();
  a.ref();
  a.blob(10);
  for (let i = 0; i < 4; i++) a.f32(); // bounding sphere: centre and radius
  a.u32();
  const n = a.count('bones', 4096);
  if (n) a.u16(); // the table's class descriptor, once
  for (let i = 0; i < n; i++) {
    out.bones.push(a.text());
    a.u32(); // the bone's index, which is its position anyway
  }
}

/** The closing block's name (`characterlod0` and the like). Read for the name
 *  alone — the rest is per-LOD material and attachment settings. */
function readLodName(a) {
  const mark = a.p;
  let name = '';
  try {
    a.ref(); a.ref();
    a.u32(); a.u32(); a.u16();
    a.ref();
    name = a.text();
  } catch {
    a.p = mark;
    return '';
  }
  a.p = mark;
  if (!name) return '';
  for (const ch of name) {
    const c = ch.charCodeAt(0);
    if (c < 32 || c >= 127) return '';
  }
  return name;
}

/**
 * The proof. Reaching the bone table at all means every index block and every
 * vertex stream before it was exactly the size the reader believed — a single
 * wrong stride would put the table outside the window it is looked for in.
 */
function finish(a, out) {
  out.trailer = a.length - a.p;
  if (out.trailer > MAX_TRAILER) {
    if (!out.lodName) {
      throw new ArchiveError(
        `${a.source} holds more than one model, one after another; this tool reads a single-model file`);
    }
    throw new ArchiveError(
      `${a.source}: ${out.trailer.toLocaleString()} of ${a.length.toLocaleString()} bytes left after the bone table — the layout does not match, so the geometry cannot be trusted`);
  }
  const top = out.positions.length / 3;
  for (const g of out.groups) {
    if (!g.indices.length) continue;
    let max = 0;
    for (const i of g.indices) if (i > max) max = i;
    if (max >= top) {
      throw new ArchiveError(
        `${a.source}: group "${g.name}"/"${g.meshName}" indexes vertex ${max} of ${top}`);
    }
  }
}

/**
 * Say which of the entry's two textures each group's art lands on. NOT a
 * rendering instruction — the UVs already address both sheets as one image.
 * This is a label, for saying what a part uses.
 */
function classifySheets(out) {
  if (!out.uvs || !out.uvs.length) return;
  for (const g of out.groups) {
    let main = false, attach = false;
    for (const vi of g.indices) {
      const u = out.uvs[vi * 2];
      const tile = u - Math.floor(u / 2) * 2; // period 2
      if (tile < 1 - TILE_EPS) main = true;
      else if (tile > 1 + TILE_EPS) attach = true;
    }
    g.sheets = main && attach ? 'both' : attach ? 'attach' : 'main';
  }
}

// ─── front door ───────────────────────────────────────────────────────────────

export function probeModelBytes(buffer) {
  const d = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (d.length >= 4 + BOOST_SIGNATURE.length) {
    const view = new DataView(d.buffer, d.byteOffset, d.byteLength);
    if (view.getUint32(0, true) === BOOST_SIGNATURE.length) {
      let s = '';
      for (let i = 0; i < BOOST_SIGNATURE.length; i++) s += String.fromCharCode(d[4 + i]);
      if (s === BOOST_SIGNATURE) return 'mesh';
    }
  }
  if (d.length >= 4) {
    // A .cas is known by a NUMBER: the exporter's version as a float. The
    // installed set runs 2.19 to 3.21, so take the range and not one value.
    const version = new DataView(d.buffer, d.byteOffset, d.byteLength).getFloat32(0, true);
    if (version >= 2.0 && version <= 4.0) return 'cas';
  }
  return '';
}

/** Decode a battle model. Throws with a sentence on anything else. */
export function readMesh(buffer, source = 'model.mesh') {
  const kind = probeModelBytes(buffer);
  if (kind !== 'mesh') {
    throw new ArchiveError(kind === 'cas'
      ? `${source} is a .cas strat-map model, not a battle .mesh`
      : `${source} is not a Medieval II model file`);
  }
  const a = new BoostArchive(buffer, source);
  const out = {
    source, format: 'mesh',
    positions: new Float32Array(0), normals: null, uvs: null,
    groups: [], bones: [], lodName: '', trailer: 0, notes: [], textures: [],
  };
  readHeader(a);
  out.groups = readGroups(a);
  readStreams(a, out);
  readBones(a, out);
  out.lodName = readLodName(a);
  finish(a, out);
  classifySheets(out);
  return out;
}

/** The same, in the `{ meshes, errors }` shape the viewer consumes. */
export function parseMeshFile(buffer, source = 'model.mesh') {
  try {
    return toViewerMeshes(readMesh(buffer, source));
  } catch (e) {
    return { format: 'mesh', meshes: [], bones: [], errors: [e.message] };
  }
}