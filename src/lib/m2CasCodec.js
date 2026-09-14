/**
 * Real decoder for M2TW strat-map models (`.cas`, data/models_strat/).
 *
 * A `.cas` is a **3ds-max scene export**, laid out as a scene rather than a
 * model: a frame rate and key times, a node hierarchy with a parent table,
 * then a CHUNK LIST — and the meshes are one kind of chunk among several. So
 * there is no single vertex pool and no single object: a settlement is several
 * named meshes with a material each, all in one file.
 *
 * The file, in order:
 *   float32  version — 3.2 for most, 2.19 to 3.21 across the installed set
 *   uint32   38, uint32 9, uint32 0    (constant)
 *   float32  the scene's length in seconds
 *   uint32   1, uint32 0               (constant)
 *   22 bytes scene settings: two RGB triples (light and ambient) and a count
 *   uint32   node count, uint16 pad
 *   uint32   parent index, one per node after the root
 *   uint32   key count, then that many float32 key times
 *   per node: uint32 length, name with its NUL, then 25 bytes
 *   per node: 3 float32 pivot
 *   then chunks: uint32 size (whole chunk), uint32 kind, payload
 *
 * The two RGB triples are why the header looks misaligned: six bytes of colour
 * amid 32-bit fields puts everything after them two bytes off the grid, which
 * is why the node count sits at 0x32 and two pad bytes follow it.
 *
 * **A model is painted from ONE texture, named in the file** — the plain
 * difference from a `.mesh`. UVs are stored as a renderer wants them and are
 * NOT doubled.
 *
 * **A chunk that goes wrong loses that chunk and not the file**: chunk sizes
 * are absolute, so the next chunk's offset survives whatever happens inside
 * this one.
 */
import { toViewerMeshes } from './m2ModelGeometry';
import { probeModelBytes } from './m2MeshCodec';

const NODE_COUNT_AT = 0x32;
const MIN_VERSION = 2.0, MAX_VERSION = 4.0;
const NODE_TRAILER = 25;

/** Bytes between an object's user-properties string and its vertex counts, by
 *  chunk kind. The static form carries nine floats (the quaternion is four of
 *  them), the skinned form nine bytes fewer. */
const OBJECT_HEADER = { 1: 37, 2: 28 };

/** What a mesh chunk has after its last object. The static trailer lost three
 *  bytes before version 3.17. */
const CHUNK_TRAILER = { 1: 6, 2: 4 };
const CHUNK_TRAILER_OLD = { 1: 3, 2: 4 };
const TRAILER_VERSION = 3.17;

const STATIC_MESHES = 1, SKINNED_MESHES = 2, MATERIALS = 5;
const ALWAYS_EMPTY = [3, 8, 10];

/** A material with this index is no material at all. */
const NO_MATERIAL = 0xFFFFFFFF;

/** Bytes a material writes after its two colours: three more float triples and
 *  a scalar. Measured, not decoded. */
const MATERIAL_TAIL = 29;

const MAX_COUNT = 4000000;

export class CasError extends Error {}

// ─── a bounded cursor ─────────────────────────────────────────────────────────

class Reader {
  constructor(buffer, source) {
    this.d = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    this.view = new DataView(this.d.buffer, this.d.byteOffset, this.d.byteLength);
    this.p = 0;
    this.source = source;
  }

  get length() { return this.d.length; }

  fail(why) { return new CasError(`${this.source}: ${why}`); }

  need(n) {
    if (n < 0 || this.p + n > this.d.length) {
      throw this.fail(`ran off the end at byte ${this.p.toLocaleString()} wanting ${n.toLocaleString()} more of ${this.d.length.toLocaleString()}`);
    }
  }

  u8()  { this.need(1); return this.d[this.p++]; }
  u16() { this.need(2); const v = this.view.getUint16(this.p, true);  this.p += 2; return v; }
  u32() { this.need(4); const v = this.view.getUint32(this.p, true);  this.p += 4; return v; }
  f32() { this.need(4); const v = this.view.getFloat32(this.p, true); this.p += 4; return v; }

  count(what) {
    const n = this.u32();
    if (n > MAX_COUNT) throw this.fail(`${what} says ${n.toLocaleString()}, which is not a real count`);
    return n;
  }

  floats(n) {
    this.need(n * 4);
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) out[i] = this.view.getFloat32(this.p + i * 4, true);
    this.p += n * 4;
    return out;
  }

  u16s(n) {
    this.need(n * 2);
    const out = new Uint16Array(n);
    for (let i = 0; i < n; i++) out[i] = this.view.getUint16(this.p + i * 2, true);
    this.p += n * 2;
    return out;
  }

  u32s(n) {
    this.need(n * 4);
    const out = new Uint32Array(n);
    for (let i = 0; i < n; i++) out[i] = this.view.getUint32(this.p + i * 4, true);
    this.p += n * 4;
    return out;
  }

  /** A length-prefixed string. The length counts the NUL it ends with. */
  text() {
    const n = this.count('a string length');
    if (n === 0) return '';
    this.need(n);
    let s = '';
    for (let i = 0; i < n; i++) {
      const c = this.d[this.p + i];
      if (c === 0) break;
      s += String.fromCharCode(c);
    }
    this.p += n;
    return s;
  }

  /** A bare NUL-terminated string — how a material writes its two. */
  cstring() {
    let end = this.p;
    while (end < this.d.length && this.d[end] !== 0) end++;
    if (end >= this.d.length) throw this.fail(`a string starting at byte ${this.p.toLocaleString()} never ends`);
    let s = '';
    for (let i = this.p; i < end; i++) s += String.fromCharCode(this.d[i]);
    this.p = end + 1;
    return s;
  }

  skip(n) {
    this.need(n);
    const out = this.d.slice(this.p, this.p + n);
    this.p += n;
    return out;
  }
}

// ─── header and node hierarchy ────────────────────────────────────────────────

function readHeader(r, out) {
  out.version = r.f32();
  if (!(out.version >= MIN_VERSION && out.version <= MAX_VERSION)) {
    throw r.fail(`opens with ${out.version}, which is not a .cas version`);
  }
  r.skip(8);            // 38 and 9, constant everywhere
  r.skip(4);            // 0, constant everywhere
  out.length = r.f32();
  r.p = NODE_COUNT_AT;  // over the two RGB triples
  const nodes = r.count('the node count');
  r.skip(2);            // pad, back onto the 32-bit grid
  out.parents = [-1];
  for (let i = 0; i < Math.max(nodes - 1, 0); i++) out.parents.push(r.u32());
  const keys = r.count('the key count');
  out.keyTimes = r.floats(keys);

  for (let i = 0; i < nodes; i++) {
    let name;
    try {
      name = r.text();
    } catch {
      // Six terrain models are stamped 2.23 and lay their header out
      // differently. Say so by version rather than by a billion-byte string.
      throw r.fail(`its header is version ${out.version}, and the layout this reader knows starts at 3.02 — the node names are not where ${out.version} puts them`);
    }
    out.nodes.push(name);
    const rest = r.skip(NODE_TRAILER);
    let meaningful = 0;
    for (const b of rest) if (b !== 0) meaningful++;
    if (meaningful > 1) {
      out.notes.push(`node "${name}" carries something other than the 25 bytes every other node writes after its name`);
    }
  }
  out.pivots = r.floats(nodes * 3);

  const bad = out.parents.slice(1).filter(p => !(p >= 0 && p < nodes));
  if (bad.length) {
    throw r.fail(`the parent table points at nodes ${bad.slice(0, 4).join(', ')} of ${nodes} — the header is not being read where it really is`);
  }
}

// ─── chunks ───────────────────────────────────────────────────────────────────

function trailerFor(version, kind) {
  return (version >= TRAILER_VERSION ? CHUNK_TRAILER : CHUNK_TRAILER_OLD)[kind];
}

function kindName(kind) {
  return kind === SKINNED_MESHES ? 'skinned mesh' : 'static mesh';
}

function readObject(r, kind, out) {
  const obj = { name: r.text(), skinned: kind === SKINNED_MESHES };
  obj.properties = r.text();
  r.skip(OBJECT_HEADER[kind]);
  const verts = r.u16();
  const faces = r.u16();
  const hasUvs = r.u8();
  const hasColours = r.u8();
  if (hasUvs > 1 || hasColours > 1) {
    throw r.fail(`mesh "${obj.name}" says its UV flag is ${hasUvs} and its colour flag is ${hasColours}; both are 0 or 1 in every file measured, so the record is not where we think`);
  }

  if (obj.skinned) obj.bones = r.u32s(verts);
  obj.positions = r.floats(verts * 3);
  obj.normals = r.floats(verts * 3);
  obj.indices = r.u16s(faces * 3);
  // The material index sits BETWEEN the indices and the UVs, reads 0 in three
  // quarters of all objects, and would pass for padding — except a settlement
  // has three meshes and three materials, and reading it as padding leaves
  // nothing saying which wall gets which texture.
  const material = r.u32();
  obj.material = material === NO_MATERIAL ? null : material;
  if (hasUvs) obj.uvs = r.floats(verts * 2);
  if (hasColours) obj.colours = r.u32s(verts);
  r.skip(4); // 0 between one mesh and the next

  obj.vertices = verts;
  obj.triangles = faces;

  if (verts && obj.indices.length) {
    let max = 0;
    for (const i of obj.indices) if (i > max) max = i;
    if (max >= verts) throw r.fail(`mesh "${obj.name}" indexes vertex ${max} of ${verts}`);
  }
  if (obj.bones) {
    const stray = [...obj.bones].find(b => b >= out.nodes.length);
    if (stray !== undefined) {
      out.notes.push(`mesh "${obj.name}" weights vertices to node ${stray} of ${out.nodes.length}`);
    }
  }
  return obj;
}

function readMeshes(r, kind, end, out) {
  const count = r.count('an object count');
  for (let i = 0; i < count; i++) {
    try {
      out.objects.push(readObject(r, kind, out));
    } catch (exc) {
      // Chunk sizes are absolute, so the next chunk's offset survives this.
      out.notes.push(`${String(exc.message).split(': ').slice(1).join(': ') || exc.message} — mesh ${i + 1} of ${count} in the ${kindName(kind)} chunk and every mesh after it was left out`);
      r.p = end;
      return;
    }
  }
  const want = trailerFor(out.version, kind);
  if (r.p + want !== end) {
    out.notes.push(`the ${kindName(kind)} chunk ends at byte ${end.toLocaleString()} and its ${count} meshes end at ${r.p.toLocaleString()} — what was read may not be the whole of it`);
  }
  r.p = end;
}

function looksLikePath(text) {
  if (!text || text.length <= 4) return false;
  for (const ch of text) { const c = ch.charCodeAt(0); if (c < 32 || c > 126) return false; }
  const ext = text.toLowerCase().split('.').pop();
  return ['tga', 'dds', 'png', 'bmp'].includes(ext);
}

/**
 * The material list. **The leading flag is whether the material is named at
 * all**, and it has to be read before the strings: a material with the flag
 * clear writes no name and no path — not two empty strings — and reading two
 * anyway eats the first two bytes of the diffuse colour and slides every
 * material after it.
 */
function readMaterials(r, end, out) {
  const count = r.count('a material count');
  for (let i = 0; i < count; i++) {
    const named = r.u32();
    const mat = { name: '', texture: '', diffuse: [1, 1, 1, 1], specular: [0, 0, 0] };
    if (named) {
      mat.name = r.cstring();
      mat.texture = r.cstring();
      if (mat.texture && !looksLikePath(mat.texture)) {
        // Some tree models EMBED their bitmap in this chunk instead of naming
        // a file. Their geometry is fine; the "path" is not one.
        out.notes.push(`material ${out.materials.length} names "${mat.texture.slice(0, 24)}", which is not a texture path — this material's sheet is inside the file rather than beside it`);
        mat.texture = '';
      }
    }
    mat.diffuse = Array.from(r.floats(4));
    mat.specular = Array.from(r.floats(3));
    r.skip(MATERIAL_TAIL);
    out.materials.push(mat);
  }
  if (r.p !== end) {
    out.notes.push(`the material chunk has ${end - r.p} bytes after its ${count} materials that this reader does not read`);
  }
  r.p = end;
}

function readChunks(r, out) {
  while (r.p < r.length) {
    const start = r.p;
    if (start + 8 > r.length) {
      out.notes.push(`${r.length - start} bytes after the last chunk, too few to be another one`);
      return;
    }
    const size = r.u32();
    const kind = r.u32();
    if (size < 8 || start + size > r.length) {
      throw r.fail(`the chunk at byte ${start.toLocaleString()} says it is ${size.toLocaleString()} bytes of the ${r.length.toLocaleString()} in the file`);
    }
    const end = start + size;
    if (kind === STATIC_MESHES || kind === SKINNED_MESHES) {
      readMeshes(r, kind, end, out);
    } else if (kind === MATERIALS) {
      readMaterials(r, end, out);
    } else {
      if (!ALWAYS_EMPTY.includes(kind)) {
        out.notes.push(`chunk kind ${kind} at byte ${start.toLocaleString()} is not one of the five this format writes; ${size.toLocaleString()} bytes skipped`);
      } else if (size > 20) {
        out.notes.push(`chunk kind ${kind} is ${size.toLocaleString()} bytes and is empty in every file measured`);
      }
    }
    r.p = end;
  }
}

// ─── front door ───────────────────────────────────────────────────────────────

/** Decode a strat-map model into its scene. Throws with a sentence. */
export function readCas(buffer, source = 'model.cas') {
  const kind = probeModelBytes(buffer);
  if (kind !== 'cas') {
    throw new CasError(kind === 'mesh'
      ? `${source} is a battle .mesh, not a strat-map .cas`
      : `${source} is not a Medieval II model file`);
  }
  const out = {
    source, version: 0, length: 0,
    nodes: [], parents: [], pivots: new Float32Array(0), keyTimes: new Float32Array(0),
    objects: [], materials: [], notes: [],
  };
  const r = new Reader(buffer, source);
  readHeader(r, out);
  readChunks(r, out);
  for (const obj of out.objects) {
    if (obj.material !== null && obj.material >= out.materials.length) {
      out.notes.push(`mesh "${obj.name}" asks for material ${obj.material} of ${out.materials.length}`);
      obj.material = null;
    }
  }
  return out;
}

/**
 * The scene as one pool with groups, so one viewer draws both formats. A
 * `.cas` gives every mesh its own vertices, so the objects are laid end to end
 * and each one's indices shifted by where its vertices landed.
 */
export function casToMeshFile(scene) {
  const total = scene.objects.reduce((s, o) => s + o.vertices, 0);
  const anyUvs = scene.objects.some(o => o.uvs && o.uvs.length);
  const positions = new Float32Array(total * 3);
  const normals = new Float32Array(total * 3);
  const uvs = anyUvs ? new Float32Array(total * 2) : null;
  const groups = [];
  const textures = [];
  let base = 0;

  for (const obj of scene.objects) {
    positions.set(obj.positions, base * 3);
    normals.set(obj.normals, base * 3);
    // An object with no UVs of its own gets zeros rather than being left out:
    // the UV array is one run over the whole pool, so a hole would slide every
    // mesh after it onto the wrong corner of the texture.
    if (uvs && obj.uvs && obj.uvs.length) uvs.set(obj.uvs, base * 2);

    let texture = '';
    if (obj.material !== null && obj.material < scene.materials.length) {
      texture = scene.materials[obj.material].texture || '';
    }
    if (texture && !textures.includes(texture)) textures.push(texture);

    const indices = new Uint32Array(obj.indices.length);
    for (let i = 0; i < obj.indices.length; i++) indices[i] = obj.indices[i] + base;

    groups.push({
      name: obj.name, meshName: texture ? texture.split(/[\\/]/).pop() : '',
      indices, flag: 0, sheets: 'main', texture,
    });
    base += obj.vertices;
  }

  return {
    source: scene.source, format: 'cas',
    positions, normals, uvs, groups,
    bones: scene.nodes.slice(), lodName: '', notes: scene.notes.slice(), textures,
  };
}

/** In the `{ meshes, errors }` shape the viewer consumes. */
export function parseCasFile(buffer, source = 'model.cas') {
  try {
    const scene = readCas(buffer, source);
    const decoded = casToMeshFile(scene);
    const view = toViewerMeshes(decoded);
    view.scene = scene;
    return view;
  } catch (e) {
    return { format: 'cas', meshes: [], bones: [], errors: [e.message] };
  }
}