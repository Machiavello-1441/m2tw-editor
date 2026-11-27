'use strict';
// Reader for the game's .cas models (campaign map trees, settlements, resources). Little-endian throughout.
//   f32 version, u32 38, u32 9, u32 0, f32 length, u32 1, u32 0, 22 bytes of scene colours
//   at 0x32: u32 node count, u16 pad, u32 parent per node after the root, u32 key count + f32 key times
//   per node: string name, 5 x u32 (rotation keys, position keys, their offsets, 0), string properties
//   then the baked key block (16 bytes a rotation key, 12 a position key) and f32 x 3 pivot per node
//   then chunks to the end: u32 size (header included), u32 kind. 1 static meshes, 2 skinned, 5 materials.
// A mesh chunk is u32 count, then per object: string name, string properties,
//   static: string group (usually empty) and 32 bytes; skinned: 28 bytes,
//   u16 vertices, u16 triangles, u8 has uvs, u8 has colours, (u32 bone per vertex when skinned),
//   f32 positions, f32 normals, u16 indices, u32 material (-1 none), (f32 uvs), (u32 colours), u32 n + n x u32.
// A material is u32 named; when named: u8 embedded, a NUL-ended texture name, and when embedded a whole
//   .tga file follows (some tree models carry their picture this way). Then colours and a tail.
// Strings are u32 length (counting the NUL) and the bytes. Layout after the Medieval-2-Blender-Toolkit's
// m2formats/cas.py, checked against the game's own tree models.
(function () {
  function reader(bytes) {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const r = {
      p: 0,
      need(n) { if (n < 0 || r.p + n > bytes.length) throw new Error(`the model ends early (byte ${r.p} wants ${n} more)`); },
      u8() { r.need(1); return bytes[r.p++]; },
      u16() { r.need(2); const v = dv.getUint16(r.p, true); r.p += 2; return v; },
      u32() { r.need(4); const v = dv.getUint32(r.p, true); r.p += 4; return v; },
      f32() { r.need(4); const v = dv.getFloat32(r.p, true); r.p += 4; return v; },
      count(what) { const n = r.u32(); if (n > 4e6) throw new Error(`${what} reads ${n}, which can't be right`); return n; },
      floats(n) { r.need(n * 4); const a = new Float32Array(n); for (let i = 0; i < n; i++) a[i] = dv.getFloat32(r.p + i * 4, true); r.p += n * 4; return a; },
      u16s(n) { r.need(n * 2); const a = new Uint16Array(n); for (let i = 0; i < n; i++) a[i] = dv.getUint16(r.p + i * 2, true); r.p += n * 2; return a; },
      u32s(n) { r.need(n * 4); const a = new Uint32Array(n); for (let i = 0; i < n; i++) a[i] = dv.getUint32(r.p + i * 4, true); r.p += n * 4; return a; },
      text() {
        const n = r.count('a string length');
        r.need(n);
        let s = '';
        for (let i = 0; i < n; i++) { const c = bytes[r.p + i]; if (!c) break; s += String.fromCharCode(c); }
        r.p += n;
        return s;
      },
      cstring() {
        let e = r.p;
        while (e < bytes.length && bytes[e]) e++;
        if (e >= bytes.length) throw new Error('a material name never ends');
        let s = '';
        for (let i = r.p; i < e; i++) s += String.fromCharCode(bytes[i]);
        r.p = e + 1;
        return s;
      },
    };
    return r;
  }

  // byte length of an uncompressed or run-length .tga starting at o
  function tgaLength(bytes, o) {
    const idLen = bytes[o], cmType = bytes[o + 1], type = bytes[o + 2];
    const cmLen = bytes[o + 5] | (bytes[o + 6] << 8), cmBits = bytes[o + 7];
    const w = bytes[o + 12] | (bytes[o + 13] << 8), h = bytes[o + 14] | (bytes[o + 15] << 8), bpp = bytes[o + 16];
    const px = Math.ceil(bpp / 8);
    let p = o + 18 + idLen + (cmType ? cmLen * Math.ceil(cmBits / 8) : 0);
    if (type === 2 || type === 3 || type === 1) return p + w * h * px - o;
    if (type === 10 || type === 11 || type === 9) {
      for (let left = w * h; left > 0;) {
        const c = bytes[p++], n = (c & 127) + 1;
        p += c & 128 ? px : n * px;
        left -= n;
      }
      return p - o;
    }
    throw new Error('an embedded picture is not a .tga this reader knows');
  }

  function readObject(r, kind) {
    const o = { name: r.text(), skinned: kind === 2 };
    o.properties = r.text();
    // static: a string naming the object's group (usually empty, so 5 bytes), u32, quaternion, position
    if (kind === 2) r.p += 28;
    else { o.group = r.text(); r.p += 32; }
    const nv = r.u16(), nt = r.u16(), hasUV = r.u8(), hasCol = r.u8();
    if (hasUV > 1 || hasCol > 1) throw new Error(`mesh "${o.name}" isn't laid out as expected`);
    o.bones = o.skinned ? r.u32s(nv) : null;
    o.pos = r.floats(nv * 3);
    o.nrm = r.floats(nv * 3);
    o.idx = r.u16s(nt * 3);
    const mat = r.u32();
    o.material = mat === 0xffffffff ? -1 : mat;
    o.uv = hasUV ? r.floats(nv * 2) : new Float32Array(nv * 2);
    o.col = hasCol ? r.u32s(nv) : null;
    // a u32 count and that many u32 (0 in most models; southern_european_castle.cas's symbol has one)
    const nx = r.count('an object tail');
    r.need(nx * 4); r.p += nx * 4;
    for (let i = 0; i < o.idx.length; i++) if (o.idx[i] >= nv) throw new Error(`mesh "${o.name}" points past its vertices`);
    return o;
  }

  function readMaterial(r, bytes) {
    const m = { texture: '', image: null };
    if (!r.u32()) return m;
    const embedded = r.u8();
    m.texture = r.cstring();
    if (embedded) {
      const n = tgaLength(bytes, r.p);
      r.need(n);
      m.image = bytes.subarray(r.p, r.p + n);
      r.p += n;
    }
    return m;
  }

  // { version, nodes, objects: [{ name, pos, nrm, uv, idx, material, skinned }], materials: [{ texture, image }], notes, min, max }
  // image is the bytes of a .tga stored inside the model, when it carries one.
  function parse(bytes) {
    if (bytes.length < 0x40) throw new Error('not a .cas model');
    const r = reader(bytes);
    const version = r.f32();
    if (!(version >= 2 && version <= 4)) throw new Error('not a .cas model');
    if (version < 3.015) throw new Error(`this .cas is an old version (${version.toFixed(2)}) that isn't supported`);
    if (version > 3.225) throw new Error(`CAS ${version.toFixed(2)} uses an unsupported header. Convert this asset to CAS 3.20 before importing.`);
    r.p = 0x32;
    const nn = r.count('the node count');
    r.p += 2;
    const parents = [-1];
    for (let i = 1; i < nn; i++) parents.push(r.u32());
    const keys = r.count('the key count');
    r.p += keys * 4;
    const nodes = [];
    let block = 0;
    for (let i = 0; i < nn; i++) {
      nodes.push(r.text());
      const nrot = r.u32(), npos = r.u32();
      r.p += 12;
      r.text();
      block += nrot * 16 + npos * 12;
    }
    r.p += block;
    const piv = r.floats(nn * 3);
    const objects = [], materials = [], notes = [];
    while (r.p + 8 <= bytes.length) {
      // A few Tsardoms 3.18 exports have an eight-byte zero/one footer, not a chunk.
      if (bytes.length-r.p<=16 && bytes.subarray(r.p,bytes.length-1).every(v=>v===0) && bytes[bytes.length-1]<=1) break;
      const start = r.p, size = r.u32(), kind = r.u32();
      const end = start + size;
      if (size < 8 || (end > bytes.length && kind !== 1 && kind !== 2)) { notes.push(`a chunk at byte ${start} runs past the end`); break; }
      try {
        if (kind === 1 || kind === 2) {
          const n = r.count('an object count');
          for (let i = 0; i < n; i++) objects.push(readObject(r, kind));
          // the objects are followed by u16 0 and a u32; some exporters wrote a wrong chunk size (bigger
          // than the file in a few settlement models), so the next chunk starts where the objects end
          const q = r.p + 6;
          if (q + 8 <= bytes.length) {
            const qs = bytes[q] | (bytes[q + 1] << 8) | (bytes[q + 2] << 16) | (bytes[q + 3] << 24);
            if (qs >= 8 && q + qs <= bytes.length) { r.p = q; continue; }
          }
        } else if (kind === 5) {
          const n = r.count('a material count');
          for (let i = 0; i < n; i++) {
            const m = readMaterial(r, bytes);
            m.tail = bytes.slice(r.p, r.p + 57);
            r.p += 28 + 29; // colours and an undecoded tail
            materials.push(m);
          }
        }
      } catch (e) { notes.push(e.message); }
      r.p = end;
    }
    if (!objects.length) throw new Error(notes[0] || 'no mesh in the model');
    // skinned vertices are stored relative to their bone; chain the pivots to put them in place
    if (objects.some((o) => o.bones)) {
      const world = [];
      const at = (i, depth) => {
        if (i < 0 || i >= nn || depth > nn) return [0, 0, 0];
        if (world[i]) return world[i];
        const b = at(parents[i], depth + 1);
        return (world[i] = [b[0] + piv[i * 3], b[1] + piv[i * 3 + 1], b[2] + piv[i * 3 + 2]]);
      };
      for (const o of objects) {
        if (!o.bones) continue;
        for (let v = 0; v < o.bones.length; v++) {
          const w = at(o.bones[v], 0);
          o.pos[v * 3] += w[0]; o.pos[v * 3 + 1] += w[1]; o.pos[v * 3 + 2] += w[2];
        }
      }
    }
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (const o of objects) for (let i = 0; i < o.pos.length; i += 3) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], o.pos[i + k]); max[k] = Math.max(max[k], o.pos[i + k]); }
    return { version, nodes, objects, materials, notes, min, max, header: bytes.slice(0, 50) };
  }

  window.CAS = { parse };
})();
