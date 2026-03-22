/**
 * MilkShape 3D (.ms3d) binary file parser
 * Format: version 4 little-endian binary
 */

function readStr(view, offset, len) {
  let s = '';
  for (let i = 0; i < len; i++) {
    const c = view.getUint8(offset + i);
    if (c === 0) break;
    s += String.fromCharCode(c);
  }
  return s;
}

export function parseMs3d(buffer) {
  const view = new DataView(buffer);
  let off = 0;

  const id = readStr(view, off, 10); off += 10;
  const version = view.getInt32(off, true); off += 4;

  if (!id.startsWith('MS3D000000') || version !== 4) {
    return { error: `Not a valid MS3D v4 file (id="${id}", version=${version})` };
  }

  // ── Vertices ──────────────────────────────────────────────────────────────
  const nV = view.getUint16(off, true); off += 2;
  const vertices = [];
  for (let i = 0; i < nV; i++) {
    off += 1; // flags
    const x = view.getFloat32(off, true); off += 4;
    const y = view.getFloat32(off, true); off += 4;
    const z = view.getFloat32(off, true); off += 4;
    const boneId = view.getInt8(off); off += 1;
    off += 1; // refCount
    vertices.push({ x, y, z, boneId });
  }

  // ── Triangles ──────────────────────────────────────────────────────────────
  const nT = view.getUint16(off, true); off += 2;
  const triangles = [];
  for (let i = 0; i < nT; i++) {
    off += 2; // flags
    const vi = [
      view.getUint16(off, true),
      view.getUint16(off + 2, true),
      view.getUint16(off + 4, true),
    ]; off += 6;
    off += 36 + 24; // skip normals (9f) + UVs (6f)
    off += 1 + 1;   // smoothingGroup + groupIndex
    triangles.push({ vi });
  }

  // ── Groups ─────────────────────────────────────────────────────────────────
  const nG = view.getUint16(off, true); off += 2;
  const groups = [];
  for (let i = 0; i < nG; i++) {
    off += 1; // flags
    const name = readStr(view, off, 32); off += 32;
    const nTri = view.getUint16(off, true); off += 2;
    const triIndices = [];
    for (let j = 0; j < nTri; j++) { triIndices.push(view.getUint16(off, true)); off += 2; }
    const matIdx = view.getInt8(off); off += 1;
    groups.push({ name, triIndices, matIdx });
  }

  // ── Materials ──────────────────────────────────────────────────────────────
  const nM = view.getUint16(off, true); off += 2;
  const materials = [];
  for (let i = 0; i < nM; i++) {
    const name = readStr(view, off, 32); off += 32;
    off += 16; // ambient
    const dr = view.getFloat32(off, true);
    const dg = view.getFloat32(off + 4, true);
    const db = view.getFloat32(off + 8, true);
    off += 16; // diffuse
    off += 16 + 16 + 4 + 4 + 1; // specular, emissive, shininess, transparency, mode
    const texture = readStr(view, off, 128); off += 128;
    off += 128; // alphamap
    materials.push({ name, diffuse: [dr, dg, db], texture });
  }

  // ── Animation info ─────────────────────────────────────────────────────────
  const animFPS = view.getFloat32(off, true); off += 4;
  off += 4; // currentTime
  const totalFrames = view.getInt32(off, true); off += 4;

  // ── Joints ─────────────────────────────────────────────────────────────────
  const nJ = view.getUint16(off, true); off += 2;
  const joints = [];
  for (let i = 0; i < nJ; i++) {
    off += 1; // flags
    const name = readStr(view, off, 32); off += 32;
    const parentName = readStr(view, off, 32); off += 32;
    const brx = view.getFloat32(off, true); off += 4;
    const bry = view.getFloat32(off, true); off += 4;
    const brz = view.getFloat32(off, true); off += 4;
    const bpx = view.getFloat32(off, true); off += 4;
    const bpy = view.getFloat32(off, true); off += 4;
    const bpz = view.getFloat32(off, true); off += 4;
    const nRot = view.getUint16(off, true); off += 2;
    const nTrans = view.getUint16(off, true); off += 2;

    const rotFrames = [];
    for (let f = 0; f < nRot; f++) {
      const t = view.getFloat32(off, true); off += 4;
      const rx = view.getFloat32(off, true); off += 4;
      const ry = view.getFloat32(off, true); off += 4;
      const rz = view.getFloat32(off, true); off += 4;
      rotFrames.push({ t, rx, ry, rz });
    }
    const transFrames = [];
    for (let f = 0; f < nTrans; f++) {
      const t = view.getFloat32(off, true); off += 4;
      const tx = view.getFloat32(off, true); off += 4;
      const ty = view.getFloat32(off, true); off += 4;
      const tz = view.getFloat32(off, true); off += 4;
      transFrames.push({ t, tx, ty, tz });
    }

    joints.push({
      name, parentName,
      bindRot: { rx: brx, ry: bry, rz: brz },
      bindPos: { x: bpx, y: bpy, z: bpz },
      rotFrames, transFrames,
    });
  }

  // Resolve parent indices
  const nameToIdx = {};
  joints.forEach((j, i) => { nameToIdx[j.name] = i; });
  joints.forEach(j => { j.parentIdx = nameToIdx[j.parentName] ?? -1; });

  // ── Group Comments (MS3D extended section) ────────────────────────────────
  // After joints, MS3D v4 files may have sub-version and comments sections.
  // Group comments contain super-group metadata used by M2TW modding tools.
  // Format per comment: lines of text, e.g.:
  //   SuperGroupName\n
  //   MeshName\n
  //   0 or 1  (0=random, 1=always visible)
  const groupComments = [];
  try {
    if (off + 4 <= buffer.byteLength) {
      const subVersion = view.getInt32(off, true); off += 4;
      if (subVersion === 1 || subVersion === 2) {
        // Comment sections: group, material, joint, model (each uint32 count)
        for (let section = 0; section < 4; section++) {
          if (off + 4 > buffer.byteLength) break;
          const numComments = view.getUint32(off, true); off += 4;
          for (let c = 0; c < numComments; c++) {
            if (off + 8 > buffer.byteLength) break;
            const commentIndex = view.getInt32(off, true); off += 4;
            const commentLen = view.getUint32(off, true); off += 4;
            let commentText = '';
            if (commentLen > 0 && off + commentLen <= buffer.byteLength) {
              for (let ci = 0; ci < commentLen; ci++) {
                commentText += String.fromCharCode(view.getUint8(off + ci));
              }
              off += commentLen;
            }
            if (section === 0) { // group comments
              groupComments.push({ groupIndex: commentIndex, text: commentText });
            }
          }
        }
      }
    }
  } catch { /* comments section may be absent or truncated */ }

  return { vertices, triangles, groups, materials, animFPS, totalFrames, joints, groupComments };
}