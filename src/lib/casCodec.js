/**
 * M2TW Binary Model Codecs
 *
 * ── .mesh (battle unit models, data/unit_models/) ────────────────────────────
 *   uint32  version  (= 20 / 0x14 for most M2TW files)
 *   uint32  numSubMeshes
 *   per SubMesh:
 *     uint32        nameLen
 *     char[nameLen] name (ASCII)
 *     uint32        numVerts
 *     per Vert (32 bytes): float3 pos, float3 normal, float2 uv
 *     uint32        numFaces
 *     per Face:     uint16[3] indices
 *     float4        boundingSphere (cx, cy, cz, radius)
 *
 * ── .cas (strat map models, data/world/maps/…) ───────────────────────────────
 *   uint32  numVerts
 *   uint32  numFaces
 *   per Vert (32 bytes): float3 pos, float3 normal, float2 uv
 *   per Face:     uint16[3] indices
 *   (no magic header)
 *
 * ── MS3D spec (http://paulbourke.net/dataformats/ms3d/ms3dspec.txt) ──────────
 *   Vertex: uint8 flags, float3 pos, int8 boneId, uint8 refCount  = 15 bytes
 *   Triangle: uint16 flags, uint16[3] vi, float[3][3] normals,
 *             float[3] s, float[3] t, uint8 sg, uint8 gi          = 70 bytes
 */

// ─── helpers ──────────────────────────────────────────────────────────────────

function readAscii(view, pos, len) {
  let s = '';
  for (let i = 0; i < len; i++) s += String.fromCharCode(view.getUint8(pos + i));
  return s;
}

function isReasonableCount(n, max = 200000) {
  return Number.isFinite(n) && n > 0 && n <= max;
}

// ─── .mesh parser ─────────────────────────────────────────────────────────────

export function parseMeshFile(buffer) {
  const view = new DataView(buffer);
  let pos = 0;
  const errors = [];

  if (buffer.byteLength < 8) return { meshes: [], errors: ['File too small'] };

  const version = view.getUint32(pos, true); pos += 4;
  // Accept version 20 (0x14) and nearby variants
  if (version !== 20 && version !== 19 && version !== 21 && version !== 22) {
    errors.push(`Unexpected version ${version} (expected 20). Attempting to parse anyway.`);
  }

  let numSubMeshes;
  try { numSubMeshes = view.getUint32(pos, true); pos += 4; } catch { return { meshes: [], errors: ['Cannot read mesh count'] }; }

  if (!isReasonableCount(numSubMeshes, 256)) {
    return { meshes: [], errors: [`Unreasonable mesh count: ${numSubMeshes}. Not a valid .mesh file (check it's not a .cas file).`] };
  }

  const meshes = [];

  for (let m = 0; m < numSubMeshes; m++) {
    if (pos + 4 > buffer.byteLength) { errors.push(`EOF before submesh ${m} name`); break; }

    const nameLen = view.getUint32(pos, true); pos += 4;
    if (nameLen > 256 || pos + nameLen > buffer.byteLength) { errors.push(`Bad name length ${nameLen} in submesh ${m}`); break; }
    const name = readAscii(view, pos, nameLen); pos += nameLen;

    if (pos + 4 > buffer.byteLength) { errors.push(`EOF before vertex count in submesh ${m}`); break; }
    const numVerts = view.getUint32(pos, true); pos += 4;
    if (!isReasonableCount(numVerts)) { errors.push(`Bad vertex count ${numVerts} in submesh "${name}"`); break; }
    if (pos + numVerts * 32 > buffer.byteLength) { errors.push(`Not enough data for ${numVerts} vertices in "${name}"`); break; }

    const positions = new Float32Array(numVerts * 3);
    const normals   = new Float32Array(numVerts * 3);
    const uvs       = new Float32Array(numVerts * 2);

    for (let v = 0; v < numVerts; v++) {
      positions[v*3]   = view.getFloat32(pos, true); pos += 4;
      positions[v*3+1] = view.getFloat32(pos, true); pos += 4;
      positions[v*3+2] = view.getFloat32(pos, true); pos += 4;
      normals[v*3]     = view.getFloat32(pos, true); pos += 4;
      normals[v*3+1]   = view.getFloat32(pos, true); pos += 4;
      normals[v*3+2]   = view.getFloat32(pos, true); pos += 4;
      uvs[v*2]         = view.getFloat32(pos, true); pos += 4;
      uvs[v*2+1]       = view.getFloat32(pos, true); pos += 4;
    }

    if (pos + 4 > buffer.byteLength) { errors.push(`EOF before face count in "${name}"`); break; }
    const numFaces = view.getUint32(pos, true); pos += 4;
    if (!isReasonableCount(numFaces, 400000)) { errors.push(`Bad face count ${numFaces} in "${name}"`); break; }
    if (pos + numFaces * 6 > buffer.byteLength) { errors.push(`Not enough data for ${numFaces} faces in "${name}"`); break; }

    const indices = new Uint32Array(numFaces * 3);
    for (let f = 0; f < numFaces; f++) {
      indices[f*3]   = view.getUint16(pos, true); pos += 2;
      indices[f*3+1] = view.getUint16(pos, true); pos += 2;
      indices[f*3+2] = view.getUint16(pos, true); pos += 2;
    }

    // Bounding sphere (16 bytes) — optional, skip if present
    if (pos + 16 <= buffer.byteLength) pos += 16;

    meshes.push({ name, positions, normals, uvs, indices, numVertices: numVerts, numFaces });
  }

  return { version, meshes, errors };
}

// ─── .cas parser ──────────────────────────────────────────────────────────────

export function parseCasFile(buffer) {
  const view = new DataView(buffer);
  const errors = [];

  if (buffer.byteLength < 8) return { meshes: [], errors: ['File too small'] };

  // Try simple format: uint32 numVerts, uint32 numFaces
  let pos = 0;
  const numVerts = view.getUint32(pos, true); pos += 4;
  const numFaces = view.getUint32(pos, true); pos += 4;

  if (!isReasonableCount(numVerts) || !isReasonableCount(numFaces, 400000)) {
    // Try uint16 variant
    pos = 0;
    const nv16 = view.getUint16(pos, true); pos += 2;
    const nf16 = view.getUint16(pos, true); pos += 2;
    if (isReasonableCount(nv16) && isReasonableCount(nf16, 400000)
        && pos + nv16 * 32 + nf16 * 6 <= buffer.byteLength) {
      return parseCasBody(view, pos, nv16, nf16, errors);
    }
    return { meshes: [], errors: [`Cannot determine vertex/face counts. numVerts=${numVerts} numFaces=${numFaces}. Check this is a .cas strat model.`] };
  }

  if (pos + numVerts * 32 + numFaces * 6 > buffer.byteLength) {
    // Maybe 24-byte vertices (no normal): float3 pos + float2 uv + float pad?
    if (pos + numVerts * 20 + numFaces * 6 <= buffer.byteLength) {
      return parseCasBody20(view, pos, numVerts, numFaces, errors);
    }
    return { meshes: [], errors: [`Buffer too small for ${numVerts} verts × 32B + ${numFaces} faces × 6B. File may use a non-standard vertex layout.`] };
  }

  return parseCasBody(view, pos, numVerts, numFaces, errors);
}

function parseCasBody(view, pos, numVerts, numFaces, errors) {
  const positions = new Float32Array(numVerts * 3);
  const normals   = new Float32Array(numVerts * 3);
  const uvs       = new Float32Array(numVerts * 2);

  for (let v = 0; v < numVerts; v++) {
    positions[v*3]   = view.getFloat32(pos, true); pos += 4;
    positions[v*3+1] = view.getFloat32(pos, true); pos += 4;
    positions[v*3+2] = view.getFloat32(pos, true); pos += 4;
    normals[v*3]     = view.getFloat32(pos, true); pos += 4;
    normals[v*3+1]   = view.getFloat32(pos, true); pos += 4;
    normals[v*3+2]   = view.getFloat32(pos, true); pos += 4;
    uvs[v*2]         = view.getFloat32(pos, true); pos += 4;
    uvs[v*2+1]       = view.getFloat32(pos, true); pos += 4;
  }

  const indices = new Uint32Array(numFaces * 3);
  for (let f = 0; f < numFaces; f++) {
    indices[f*3]   = view.getUint16(pos, true); pos += 2;
    indices[f*3+1] = view.getUint16(pos, true); pos += 2;
    indices[f*3+2] = view.getUint16(pos, true); pos += 2;
  }

  return { meshes: [{ name: 'mesh_0', positions, normals, uvs, indices, numVertices: numVerts, numFaces }], errors };
}

// 20-byte vertex variant: pos(12) + uv(8) — no normals stored
function parseCasBody20(view, pos, numVerts, numFaces, errors) {
  errors.push('Using compact vertex format (no stored normals — will be computed).');
  const positions = new Float32Array(numVerts * 3);
  const normals   = new Float32Array(numVerts * 3); // will be zero-filled
  const uvs       = new Float32Array(numVerts * 2);

  for (let v = 0; v < numVerts; v++) {
    positions[v*3]   = view.getFloat32(pos, true); pos += 4;
    positions[v*3+1] = view.getFloat32(pos, true); pos += 4;
    positions[v*3+2] = view.getFloat32(pos, true); pos += 4;
    uvs[v*2]         = view.getFloat32(pos, true); pos += 4;
    uvs[v*2+1]       = view.getFloat32(pos, true); pos += 4;
  }

  const indices = new Uint32Array(numFaces * 3);
  for (let f = 0; f < numFaces; f++) {
    indices[f*3]   = view.getUint16(pos, true); pos += 2;
    indices[f*3+1] = view.getUint16(pos, true); pos += 2;
    indices[f*3+2] = view.getUint16(pos, true); pos += 2;
  }

  // Compute flat normals
  for (let f = 0; f < numFaces; f++) {
    const a = indices[f*3], b = indices[f*3+1], c = indices[f*3+2];
    const ax = positions[a*3]-positions[c*3], ay = positions[a*3+1]-positions[c*3+1], az = positions[a*3+2]-positions[c*3+2];
    const bx = positions[b*3]-positions[c*3], by = positions[b*3+1]-positions[c*3+1], bz = positions[b*3+2]-positions[c*3+2];
    const nx = ay*bz-az*by, ny = az*bx-ax*bz, nz = ax*by-ay*bx;
    const len = Math.sqrt(nx*nx+ny*ny+nz*nz) || 1;
    for (const vi of [a,b,c]) { normals[vi*3] = nx/len; normals[vi*3+1] = ny/len; normals[vi*3+2] = nz/len; }
  }

  return { meshes: [{ name: 'mesh_0', positions, normals, uvs, indices, numVertices: numVerts, numFaces }], errors };
}

// ─── .mesh encoder ────────────────────────────────────────────────────────────

export function encodeMeshFile(meshes) {
  let size = 8; // version + numMeshes
  for (const m of meshes) size += 4 + (m.name || 'mesh_0').length + 4 + m.numVertices * 32 + 4 + m.numFaces * 6 + 16;
  const buf = new ArrayBuffer(size);
  const view = new DataView(buf);
  let pos = 0;

  view.setUint32(pos, 20, true); pos += 4; // version
  view.setUint32(pos, meshes.length, true); pos += 4;

  for (const m of meshes) {
    const name = m.name || 'mesh_0';
    view.setUint32(pos, name.length, true); pos += 4;
    for (let i = 0; i < name.length; i++) { new DataView(buf).setUint8(pos, name.charCodeAt(i)); pos++; }

    view.setUint32(pos, m.numVertices, true); pos += 4;
    for (let v = 0; v < m.numVertices; v++) {
      view.setFloat32(pos, m.positions[v*3], true); pos += 4;
      view.setFloat32(pos, m.positions[v*3+1], true); pos += 4;
      view.setFloat32(pos, m.positions[v*3+2], true); pos += 4;
      view.setFloat32(pos, m.normals[v*3], true); pos += 4;
      view.setFloat32(pos, m.normals[v*3+1], true); pos += 4;
      view.setFloat32(pos, m.normals[v*3+2], true); pos += 4;
      view.setFloat32(pos, m.uvs[v*2], true); pos += 4;
      view.setFloat32(pos, m.uvs[v*2+1], true); pos += 4;
    }

    view.setUint32(pos, m.numFaces, true); pos += 4;
    for (let f = 0; f < m.numFaces; f++) {
      view.setUint16(pos, m.indices[f*3], true); pos += 2;
      view.setUint16(pos, m.indices[f*3+1], true); pos += 2;
      view.setUint16(pos, m.indices[f*3+2], true); pos += 2;
    }
    // Bounding sphere placeholder
    for (let i = 0; i < 4; i++) { view.setFloat32(pos, 0, true); pos += 4; }
  }
  return buf;
}

// ─── .cas encoder ─────────────────────────────────────────────────────────────

export function encodeCasFile(meshes) {
  // Write first mesh only (strat models are single-mesh)
  const m = meshes[0];
  const size = 8 + m.numVertices * 32 + m.numFaces * 6;
  const buf = new ArrayBuffer(size);
  const view = new DataView(buf);
  let pos = 0;

  view.setUint32(pos, m.numVertices, true); pos += 4;
  view.setUint32(pos, m.numFaces, true); pos += 4;

  for (let v = 0; v < m.numVertices; v++) {
    view.setFloat32(pos, m.positions[v*3], true); pos += 4;
    view.setFloat32(pos, m.positions[v*3+1], true); pos += 4;
    view.setFloat32(pos, m.positions[v*3+2], true); pos += 4;
    view.setFloat32(pos, m.normals[v*3], true); pos += 4;
    view.setFloat32(pos, m.normals[v*3+1], true); pos += 4;
    view.setFloat32(pos, m.normals[v*3+2], true); pos += 4;
    view.setFloat32(pos, m.uvs[v*2], true); pos += 4;
    view.setFloat32(pos, m.uvs[v*2+1], true); pos += 4;
  }
  for (let f = 0; f < m.numFaces; f++) {
    view.setUint16(pos, m.indices[f*3], true); pos += 2;
    view.setUint16(pos, m.indices[f*3+1], true); pos += 2;
    view.setUint16(pos, m.indices[f*3+2], true); pos += 2;
  }
  return buf;
}

// ─── MS3D encoder ─────────────────────────────────────────────────────────────
// Vertex = 15 bytes: uint8 flags, float3 pos, int8 boneId, uint8 refCount
// Triangle = 70 bytes: uint16 flags, uint16[3] vi, float[3][3] normals, float[3] s, float[3] t, uint8 sg, uint8 gi

export function meshesToMs3d(meshes) {
  const allVerts = [];
  const allTris  = [];
  const groupInfos = [];
  let vertOffset = 0;

  for (const mesh of meshes) {
    const groupStart = allTris.length;
    for (let v = 0; v < mesh.numVertices; v++) {
      allVerts.push({ x: mesh.positions[v*3], y: mesh.positions[v*3+1], z: mesh.positions[v*3+2] });
    }
    for (let f = 0; f < mesh.numFaces; f++) {
      const i0 = mesh.indices[f*3]   + vertOffset;
      const i1 = mesh.indices[f*3+1] + vertOffset;
      const i2 = mesh.indices[f*3+2] + vertOffset;

      // Local indices into this mesh for normal/uv lookup
      const l0 = mesh.indices[f*3];
      const l1 = mesh.indices[f*3+1];
      const l2 = mesh.indices[f*3+2];

      allTris.push({
        vi: [i0, i1, i2],
        nx: [mesh.normals[l0*3],   mesh.normals[l1*3],   mesh.normals[l2*3]  ],
        ny: [mesh.normals[l0*3+1], mesh.normals[l1*3+1], mesh.normals[l2*3+1]],
        nz: [mesh.normals[l0*3+2], mesh.normals[l1*3+2], mesh.normals[l2*3+2]],
        s:  [mesh.uvs[l0*2],       mesh.uvs[l1*2],       mesh.uvs[l2*2]      ],
        t:  [mesh.uvs[l0*2+1],     mesh.uvs[l1*2+1],     mesh.uvs[l2*2+1]    ],
      });
    }
    groupInfos.push({ start: groupStart, count: mesh.numFaces, name: mesh.name || `mesh_${groupInfos.length}` });
    vertOffset += mesh.numVertices;
  }

  const nV = allVerts.length;
  const nT = allTris.length;
  const nG = groupInfos.length;

  // Sizes: vertex=15, triangle=70
  let groupsSize = 0;
  for (const g of groupInfos) groupsSize += 1 + 32 + 2 + g.count * 2 + 1;
  // Header=14, nV_count=2, verts, nT_count=2, tris, nG_count=2, groups, nMat_count=2, anim=12
  const bufSize = 14 + 2 + nV*15 + 2 + nT*70 + 2 + groupsSize + 2 + 12;
  const buf = new ArrayBuffer(bufSize);
  const view = new DataView(buf);
  const u8 = new Uint8Array(buf);
  let pos = 0;

  // Header: "MS3D000000" + int32 version=4
  const hdr = 'MS3D000000';
  for (let i = 0; i < 10; i++) u8[pos++] = hdr.charCodeAt(i);
  view.setInt32(pos, 4, true); pos += 4;

  // Vertices (15 bytes each)
  view.setUint16(pos, nV, true); pos += 2;
  for (const v of allVerts) {
    u8[pos++] = 0;                              // flags
    view.setFloat32(pos, v.x, true); pos += 4;
    view.setFloat32(pos, v.y, true); pos += 4;
    view.setFloat32(pos, v.z, true); pos += 4;
    u8[pos++] = 0xFF;                           // boneId = -1 (cast as signed = -1)
    u8[pos++] = 0;                              // refCount
  }

  // Triangles (70 bytes each)
  view.setUint16(pos, nT, true); pos += 2;
  for (const tri of allTris) {
    view.setUint16(pos, 0, true);    pos += 2;  // flags
    view.setUint16(pos, tri.vi[0], true); pos += 2;
    view.setUint16(pos, tri.vi[1], true); pos += 2;
    view.setUint16(pos, tri.vi[2], true); pos += 2;
    // normals: 3 verts × 3 components = 9 floats, laid out as [n0x,n1x,n2x, n0y,n1y,n2y, n0z,n1z,n2z]
    for (const nx of tri.nx) { view.setFloat32(pos, nx, true); pos += 4; }
    for (const ny of tri.ny) { view.setFloat32(pos, ny, true); pos += 4; }
    for (const nz of tri.nz) { view.setFloat32(pos, nz, true); pos += 4; }
    for (const s  of tri.s)  { view.setFloat32(pos, s,  true); pos += 4; }
    for (const t  of tri.t)  { view.setFloat32(pos, t,  true); pos += 4; }
    u8[pos++] = 1;   // smoothingGroup
    u8[pos++] = 0;   // groupIndex (patched below)
  }

  // Groups
  view.setUint16(pos, nG, true); pos += 2;
  // Offsets needed for patching groupIndex in triangle records
  const triBlockStart = 14 + 2 + nV*15 + 2; // start of triangle data
  for (let g = 0; g < nG; g++) {
    const gi = groupInfos[g];
    u8[pos++] = 0; // flags
    const name = gi.name.substring(0, 32);
    for (let i = 0; i < 32; i++) u8[pos++] = i < name.length ? name.charCodeAt(i) : 0;
    view.setUint16(pos, gi.count, true); pos += 2;
    for (let t = 0; t < gi.count; t++) {
      const triIdx = gi.start + t;
      view.setUint16(pos, triIdx, true); pos += 2;
      // Patch groupIndex byte at offset 69 within each triangle record
      u8[triBlockStart + triIdx * 70 + 69] = g;
    }
    u8[pos++] = 0xFF; // materialIndex = -1
  }

  // Materials (none)
  view.setUint16(pos, 0, true); pos += 2;

  // Animation footer
  view.setFloat32(pos, 24.0, true); pos += 4; // animFPS
  view.setFloat32(pos, 0.0,  true); pos += 4; // currentTime
  view.setInt32(pos,   0,    true); pos += 4; // totalFrames

  return buf;
}

// ─── MS3D parser ──────────────────────────────────────────────────────────────

export function parseMs3d(buffer) {
  const view = new DataView(buffer);
  const u8 = new Uint8Array(buffer);
  let pos = 0;

  const sig = String.fromCharCode(...u8.slice(0, 10));
  if (!sig.startsWith('MS3D000000')) return { meshes: [], errors: ['Not a valid MS3D file'] };
  pos += 14; // header + version

  // ── Vertices ──
  const nV = view.getUint16(pos, true); pos += 2;
  const allPos = new Float32Array(nV * 3);
  const allNormals = new Float32Array(nV * 3);
  const allUvs = new Float32Array(nV * 2);

  for (let i = 0; i < nV; i++) {
    pos++; // flags
    allPos[i*3]   = view.getFloat32(pos, true); pos += 4;
    allPos[i*3+1] = view.getFloat32(pos, true); pos += 4;
    allPos[i*3+2] = view.getFloat32(pos, true); pos += 4;
    pos += 2; // boneId + refCount
  }

  // ── Triangles ──
  const nT = view.getUint16(pos, true); pos += 2;
  const triVerts = new Uint16Array(nT * 3);

  for (let t = 0; t < nT; t++) {
    pos += 2; // flags
    const i0 = view.getUint16(pos, true); pos += 2;
    const i1 = view.getUint16(pos, true); pos += 2;
    const i2 = view.getUint16(pos, true); pos += 2;
    triVerts[t*3] = i0; triVerts[t*3+1] = i1; triVerts[t*3+2] = i2;
    const nx = [view.getFloat32(pos,true),view.getFloat32(pos+4,true),view.getFloat32(pos+8,true)]; pos += 12;
    const ny = [view.getFloat32(pos,true),view.getFloat32(pos+4,true),view.getFloat32(pos+8,true)]; pos += 12;
    const nz = [view.getFloat32(pos,true),view.getFloat32(pos+4,true),view.getFloat32(pos+8,true)]; pos += 12;
    const s  = [view.getFloat32(pos,true),view.getFloat32(pos+4,true),view.getFloat32(pos+8,true)]; pos += 12;
    const tv = [view.getFloat32(pos,true),view.getFloat32(pos+4,true),view.getFloat32(pos+8,true)]; pos += 12;
    pos += 2; // smoothingGroup + groupIndex
    for (let k = 0; k < 3; k++) {
      const vi = [i0,i1,i2][k];
      allNormals[vi*3] = nx[k]; allNormals[vi*3+1] = ny[k]; allNormals[vi*3+2] = nz[k];
      allUvs[vi*2] = s[k]; allUvs[vi*2+1] = tv[k];
    }
  }

  // ── Groups ──
  let nG = 0;
  const groups = [];
  try {
    nG = view.getUint16(pos, true); pos += 2;
    for (let g = 0; g < nG; g++) {
      pos++; // flags
      let name = '';
      for (let c = 0; c < 32; c++) { const ch = u8[pos + c]; if (ch === 0) break; name += String.fromCharCode(ch); }
      pos += 32;
      const nTri = view.getUint16(pos, true); pos += 2;
      const triIndices = [];
      for (let t = 0; t < nTri; t++) { triIndices.push(view.getUint16(pos, true)); pos += 2; }
      pos++; // materialIndex
      groups.push({ name: name || `group_${g}`, triIndices });
    }
  } catch { /* groups section may be absent or truncated */ }

  // If we have groups, split into per-group meshes
  if (groups.length > 1) {
    const meshes = [];
    for (const grp of groups) {
      // Collect unique vertex indices used by this group's triangles
      const vertSet = new Set();
      for (const ti of grp.triIndices) {
        vertSet.add(triVerts[ti*3]); vertSet.add(triVerts[ti*3+1]); vertSet.add(triVerts[ti*3+2]);
      }
      const oldToNew = {};
      const uniqueVerts = [...vertSet].sort((a,b) => a - b);
      uniqueVerts.forEach((vi, ni) => { oldToNew[vi] = ni; });

      const numVertices = uniqueVerts.length;
      const numFaces = grp.triIndices.length;
      const gPositions = new Float32Array(numVertices * 3);
      const gNormals = new Float32Array(numVertices * 3);
      const gUvs = new Float32Array(numVertices * 2);
      const gIndices = new Uint32Array(numFaces * 3);

      for (let ni = 0; ni < numVertices; ni++) {
        const oi = uniqueVerts[ni];
        gPositions[ni*3] = allPos[oi*3]; gPositions[ni*3+1] = allPos[oi*3+1]; gPositions[ni*3+2] = allPos[oi*3+2];
        gNormals[ni*3] = allNormals[oi*3]; gNormals[ni*3+1] = allNormals[oi*3+1]; gNormals[ni*3+2] = allNormals[oi*3+2];
        gUvs[ni*2] = allUvs[oi*2]; gUvs[ni*2+1] = allUvs[oi*2+1];
      }

      for (let f = 0; f < numFaces; f++) {
        const ti = grp.triIndices[f];
        gIndices[f*3]   = oldToNew[triVerts[ti*3]];
        gIndices[f*3+1] = oldToNew[triVerts[ti*3+1]];
        gIndices[f*3+2] = oldToNew[triVerts[ti*3+2]];
      }

      meshes.push({ name: grp.name, positions: gPositions, normals: gNormals, uvs: gUvs, indices: gIndices, numVertices, numFaces });
    }
    return { meshes, errors: [] };
  }

  // Single group or no groups — return as one mesh
  const indices = new Uint32Array(nT * 3);
  for (let i = 0; i < nT * 3; i++) indices[i] = triVerts[i];

  return {
    meshes: [{ name: groups[0]?.name || 'ms3d_mesh', positions: allPos, normals: allNormals, uvs: allUvs, indices, numVertices: nV, numFaces: nT }],
    errors: []
  };
}