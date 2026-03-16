/**
 * M2TW .cas (Collision And Shape) & .mesh file reader
 * Based on community-documented reverse-engineering of M2TW formats.
 *
 * .cas format layout (little-endian):
 *   Header:
 *     char[4]  magic = "CSAB" or version variations
 *     uint32   version
 *     uint32   numMeshes
 *   Per mesh:
 *     uint32   numVertices
 *     uint32   numFaces
 *     Vertices: [numVertices × (float x, float y, float z, float nx, float ny, float nz, float u, float v)]
 *     Faces:    [numFaces × uint16 × 3]
 *
 * .mesh is similar but uses a different header.
 *
 * This is a best-effort parser for preview purposes.
 * Outputs a simple {meshes:[{vertices, normals, uvs, indices}]} structure suitable for Three.js.
 */

function readString(view, offset, len) {
  let s = '';
  for (let i = 0; i < len; i++) {
    const c = view.getUint8(offset + i);
    if (c === 0) break;
    s += String.fromCharCode(c);
  }
  return s;
}

export function parseCas(buffer) {
  const view = new DataView(buffer);
  const u8 = new Uint8Array(buffer);
  let pos = 0;

  const magic = readString(view, pos, 4); pos += 4;
  const version = view.getUint32(pos, true); pos += 4;

  const meshes = [];

  // Generic fallback: scan for usable float sequences
  // Try to read numMeshes
  let numMeshes = 1;
  try {
    numMeshes = view.getUint32(pos, true); pos += 4;
    if (numMeshes === 0 || numMeshes > 256) numMeshes = 1;
  } catch { numMeshes = 1; }

  for (let m = 0; m < numMeshes && pos < buffer.byteLength - 8; m++) {
    const numVertices = view.getUint32(pos, true); pos += 4;
    const numFaces = view.getUint32(pos, true); pos += 4;

    if (numVertices === 0 || numVertices > 200000 || numFaces === 0 || numFaces > 400000) break;
    if (pos + numVertices * 32 + numFaces * 6 > buffer.byteLength) break;

    const positions = new Float32Array(numVertices * 3);
    const normals = new Float32Array(numVertices * 3);
    const uvs = new Float32Array(numVertices * 2);

    for (let v = 0; v < numVertices; v++) {
      positions[v * 3] = view.getFloat32(pos, true); pos += 4;
      positions[v * 3 + 1] = view.getFloat32(pos, true); pos += 4;
      positions[v * 3 + 2] = view.getFloat32(pos, true); pos += 4;
      normals[v * 3] = view.getFloat32(pos, true); pos += 4;
      normals[v * 3 + 1] = view.getFloat32(pos, true); pos += 4;
      normals[v * 3 + 2] = view.getFloat32(pos, true); pos += 4;
      uvs[v * 2] = view.getFloat32(pos, true); pos += 4;
      uvs[v * 2 + 1] = view.getFloat32(pos, true); pos += 4;
    }

    const indices = new Uint32Array(numFaces * 3);
    for (let f = 0; f < numFaces; f++) {
      indices[f * 3] = view.getUint16(pos, true); pos += 2;
      indices[f * 3 + 1] = view.getUint16(pos, true); pos += 2;
      indices[f * 3 + 2] = view.getUint16(pos, true); pos += 2;
    }

    meshes.push({ positions, normals, uvs, indices, numVertices, numFaces });
  }

  return meshes.length > 0 ? { magic, version, meshes } : null;
}

/**
 * Export parsed mesh data to MilkShape 3D binary format (.ms3d)
 * MS3D format: http://paulbourke.net/dataformats/ms3d/ms3dspec.txt
 */
export function meshesToMs3d(meshes) {
  // Calculate buffer size
  // Header: 10 bytes ("MS3D000000") + 4 bytes version
  // uint16 numVerts, per vertex: uint8 flags, float[3] pos, float boneId, uint8 refCount
  // uint16 numTriangles, per triangle: uint16 flags, uint16[3] vi, float[3][3] normals, float[2] s, float[2] t, uint8 sg, uint8 gi
  // uint16 numGroups, per group: uint8 flags, char[32] name, uint16 numTri, uint16[] triIdxs, int8 materialIdx
  // uint16 numMaterials (0)
  // float editTime, anim fps, current frame, numFrames

  const allVerts = [];
  const allTris = [];
  const groupInfos = [];
  let vertOffset = 0;

  for (const mesh of meshes) {
    const groupStart = allTris.length;
    for (let v = 0; v < mesh.numVertices; v++) {
      allVerts.push({
        x: mesh.positions[v * 3],
        y: mesh.positions[v * 3 + 1],
        z: mesh.positions[v * 3 + 2],
      });
    }
    for (let f = 0; f < mesh.numFaces; f++) {
      const vi = [
        mesh.indices[f * 3] + vertOffset,
        mesh.indices[f * 3 + 1] + vertOffset,
        mesh.indices[f * 3 + 2] + vertOffset,
      ];
      const nx = [mesh.normals[vi[0] * 3], mesh.normals[vi[1] * 3], mesh.normals[vi[2] * 3]];
      const ny = [mesh.normals[vi[0] * 3 + 1], mesh.normals[vi[1] * 3 + 1], mesh.normals[vi[2] * 3 + 1]];
      const nz = [mesh.normals[vi[0] * 3 + 2], mesh.normals[vi[1] * 3 + 2], mesh.normals[vi[2] * 3 + 2]];
      const s = [mesh.uvs[vi[0] * 2], mesh.uvs[vi[1] * 2], mesh.uvs[vi[2] * 2]];
      const t = [mesh.uvs[vi[0] * 2 + 1], mesh.uvs[vi[1] * 2 + 1], mesh.uvs[vi[2] * 2 + 1]];
      allTris.push({ vi, nx, ny, nz, s, t });
    }
    groupInfos.push({ start: groupStart, count: mesh.numFaces });
    vertOffset += mesh.numVertices;
  }

  const nV = allVerts.length;
  const nT = allTris.length;
  const nG = groupInfos.length;

  // Per-vertex: 1 + 12 + 4 + 1 = 18 bytes
  // Per-triangle: 2 + 6 + 36 + 8 + 8 + 1 + 1 = 62 bytes  (actually: flags uint16, vi 3×uint16, normals 9×float, s 3×float, t 3×float, smoothingGroup uint8, groupIndex uint8)
  // = 2 + 6 + 36 + 12 + 12 + 1 + 1 = 70 bytes
  // Per-group header: 1 + 32 + 2 + (nT*2) + 1
  let groupsSize = 0;
  for (const g of groupInfos) groupsSize += 1 + 32 + 2 + g.count * 2 + 1;

  const bufSize = 14 + 2 + nV * 18 + 2 + nT * 70 + 2 + groupsSize + 2 + 4 * 4;
  const buf = new ArrayBuffer(bufSize);
  const view = new DataView(buf);
  const u8 = new Uint8Array(buf);
  let pos = 0;

  // Header
  const hdr = 'MS3D000000';
  for (let i = 0; i < 10; i++) { u8[pos++] = hdr.charCodeAt(i); }
  view.setInt32(pos, 4, true); pos += 4; // version

  // Vertices
  view.setUint16(pos, nV, true); pos += 2;
  for (const v of allVerts) {
    u8[pos++] = 0; // flags
    view.setFloat32(pos, v.x, true); pos += 4;
    view.setFloat32(pos, v.y, true); pos += 4;
    view.setFloat32(pos, v.z, true); pos += 4;
    u8[pos++] = 0xFF; // boneId = -1
    u8[pos++] = 0; // refCount
  }

  // Triangles
  view.setUint16(pos, nT, true); pos += 2;
  for (let i = 0; i < allTris.length; i++) {
    const tri = allTris[i];
    view.setUint16(pos, 0, true); pos += 2; // flags
    view.setUint16(pos, tri.vi[0], true); pos += 2;
    view.setUint16(pos, tri.vi[1], true); pos += 2;
    view.setUint16(pos, tri.vi[2], true); pos += 2;
    // vertex normals (9 floats)
    view.setFloat32(pos, tri.nx[0], true); pos += 4;
    view.setFloat32(pos, tri.nx[1], true); pos += 4;
    view.setFloat32(pos, tri.nx[2], true); pos += 4;
    view.setFloat32(pos, tri.ny[0], true); pos += 4;
    view.setFloat32(pos, tri.ny[1], true); pos += 4;
    view.setFloat32(pos, tri.ny[2], true); pos += 4;
    view.setFloat32(pos, tri.nz[0], true); pos += 4;
    view.setFloat32(pos, tri.nz[1], true); pos += 4;
    view.setFloat32(pos, tri.nz[2], true); pos += 4;
    // S coords
    view.setFloat32(pos, tri.s[0], true); pos += 4;
    view.setFloat32(pos, tri.s[1], true); pos += 4;
    view.setFloat32(pos, tri.s[2], true); pos += 4;
    // T coords
    view.setFloat32(pos, tri.t[0], true); pos += 4;
    view.setFloat32(pos, tri.t[1], true); pos += 4;
    view.setFloat32(pos, tri.t[2], true); pos += 4;
    u8[pos++] = 1; // smoothingGroup
    u8[pos++] = 0; // groupIndex (updated below)
  }

  // Groups
  view.setUint16(pos, nG, true); pos += 2;
  for (let g = 0; g < nG; g++) {
    const gi = groupInfos[g];
    u8[pos++] = 0; // flags
    const name = `mesh_${g}`;
    for (let i = 0; i < 32; i++) u8[pos++] = i < name.length ? name.charCodeAt(i) : 0;
    view.setUint16(pos, gi.count, true); pos += 2;
    for (let t = 0; t < gi.count; t++) {
      view.setUint16(pos, gi.start + t, true); pos += 2;
      // Also patch groupIndex in the triangle
      const triPos = 14 + 2 + nV * 18 + 2 + (gi.start + t) * 70 + 69;
      u8[triPos] = g;
    }
    u8[pos++] = 0xFF; // material index = -1
  }

  // Materials (none)
  view.setUint16(pos, 0, true); pos += 2;

  // Animation
  view.setFloat32(pos, 24.0, true); pos += 4; // fps
  view.setFloat32(pos, 0.0, true); pos += 4; // current frame
  view.setInt32(pos, 0, true); pos += 4; // total frames

  return buf;
}

/**
 * Parse a .ms3d binary file into our mesh format for re-encoding
 */
export function parseMs3d(buffer) {
  const view = new DataView(buffer);
  const u8 = new Uint8Array(buffer);
  let pos = 0;

  // Header
  const hdr = String.fromCharCode(...u8.slice(0, 10)); pos += 10;
  if (!hdr.startsWith('MS3D000000')) return null;
  const ver = view.getInt32(pos, true); pos += 4;

  const nV = view.getUint16(pos, true); pos += 2;
  const vertices = [];
  for (let i = 0; i < nV; i++) {
    pos++; // flags
    const x = view.getFloat32(pos, true); pos += 4;
    const y = view.getFloat32(pos, true); pos += 4;
    const z = view.getFloat32(pos, true); pos += 4;
    pos++; pos++; // boneId, refCount
    vertices.push([x, y, z]);
  }

  const nT = view.getUint16(pos, true); pos += 2;
  const triangles = [];
  for (let i = 0; i < nT; i++) {
    pos += 2; // flags
    const vi = [view.getUint16(pos, true), view.getUint16(pos + 2, true), view.getUint16(pos + 4, true)];
    pos += 6;
    const nx = [view.getFloat32(pos, true), view.getFloat32(pos + 4, true), view.getFloat32(pos + 8, true)]; pos += 12;
    const ny = [view.getFloat32(pos, true), view.getFloat32(pos + 4, true), view.getFloat32(pos + 8, true)]; pos += 12;
    const nz = [view.getFloat32(pos, true), view.getFloat32(pos + 4, true), view.getFloat32(pos + 8, true)]; pos += 12;
    const s = [view.getFloat32(pos, true), view.getFloat32(pos + 4, true), view.getFloat32(pos + 8, true)]; pos += 12;
    const t = [view.getFloat32(pos, true), view.getFloat32(pos + 4, true), view.getFloat32(pos + 8, true)]; pos += 12;
    pos += 2; // smoothingGroup, groupIndex
    triangles.push({ vi, nx, ny, nz, s, t });
  }

  // Build a single mesh from all triangles
  const positions = new Float32Array(nV * 3);
  const normals = new Float32Array(nV * 3);
  const uvs = new Float32Array(nV * 2);
  for (let v = 0; v < nV; v++) {
    positions[v * 3] = vertices[v][0];
    positions[v * 3 + 1] = vertices[v][1];
    positions[v * 3 + 2] = vertices[v][2];
  }
  const indices = new Uint32Array(nT * 3);
  for (let t = 0; t < nT; t++) {
    indices[t * 3] = triangles[t].vi[0];
    indices[t * 3 + 1] = triangles[t].vi[1];
    indices[t * 3 + 2] = triangles[t].vi[2];
    for (let k = 0; k < 3; k++) {
      const v = triangles[t].vi[k];
      normals[v * 3] = triangles[t].nx[k];
      normals[v * 3 + 1] = triangles[t].ny[k];
      normals[v * 3 + 2] = triangles[t].nz[k];
      uvs[v * 2] = triangles[t].s[k];
      uvs[v * 2 + 1] = triangles[t].t[k];
    }
  }

  return { meshes: [{ positions, normals, uvs, indices, numVertices: nV, numFaces: nT }] };
}

/** Re-encode a parsed mesh back to .cas binary format */
export function encodeCas(parsedResult) {
  const meshes = parsedResult.meshes;
  // Header: 4 (magic) + 4 (version) + 4 (numMeshes) = 12
  let size = 12;
  for (const m of meshes) size += 8 + m.numVertices * 32 + m.numFaces * 6;
  const buf = new ArrayBuffer(size);
  const view = new DataView(buf);
  const u8 = new Uint8Array(buf);
  let pos = 0;

  // magic "CSAB"
  u8[pos++] = 0x43; u8[pos++] = 0x53; u8[pos++] = 0x41; u8[pos++] = 0x42;
  view.setUint32(pos, 0, true); pos += 4; // version
  view.setUint32(pos, meshes.length, true); pos += 4;

  for (const m of meshes) {
    view.setUint32(pos, m.numVertices, true); pos += 4;
    view.setUint32(pos, m.numFaces, true); pos += 4;
    for (let v = 0; v < m.numVertices; v++) {
      view.setFloat32(pos, m.positions[v * 3], true); pos += 4;
      view.setFloat32(pos, m.positions[v * 3 + 1], true); pos += 4;
      view.setFloat32(pos, m.positions[v * 3 + 2], true); pos += 4;
      view.setFloat32(pos, m.normals[v * 3], true); pos += 4;
      view.setFloat32(pos, m.normals[v * 3 + 1], true); pos += 4;
      view.setFloat32(pos, m.normals[v * 3 + 2], true); pos += 4;
      view.setFloat32(pos, m.uvs[v * 2], true); pos += 4;
      view.setFloat32(pos, m.uvs[v * 2 + 1], true); pos += 4;
    }
    for (let f = 0; f < m.numFaces; f++) {
      view.setUint16(pos, m.indices[f * 3], true); pos += 2;
      view.setUint16(pos, m.indices[f * 3 + 1], true); pos += 2;
      view.setUint16(pos, m.indices[f * 3 + 2], true); pos += 2;
    }
  }
  return buf;
}