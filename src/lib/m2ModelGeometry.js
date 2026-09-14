/**
 * Shared geometry plumbing for both real M2TW model decoders.
 *
 * Both formats end up as ONE vertex pool with named groups indexing into it —
 * a `.mesh` stores it that way, and a `.cas` scene's per-object meshes are
 * laid end to end into one. The viewer wants a list of drawable meshes, so
 * each group is handed the shared pool plus its own index run.
 */

/** Flat face normals, for a pool that shipped none. */
export function deriveNormals(positions, groups) {
  const normals = new Float32Array(positions.length);
  for (const g of groups) {
    const idx = g.indices;
    for (let f = 0; f + 2 < idx.length; f += 3) {
      const a = idx[f], b = idx[f + 1], c = idx[f + 2];
      const ax = positions[a * 3] - positions[c * 3];
      const ay = positions[a * 3 + 1] - positions[c * 3 + 1];
      const az = positions[a * 3 + 2] - positions[c * 3 + 2];
      const bx = positions[b * 3] - positions[c * 3];
      const by = positions[b * 3 + 1] - positions[c * 3 + 1];
      const bz = positions[b * 3 + 2] - positions[c * 3 + 2];
      const nx = ay * bz - az * by;
      const ny = az * bx - ax * bz;
      const nz = ax * by - ay * bx;
      const len = Math.hypot(nx, ny, nz) || 1;
      for (const vi of [a, b, c]) {
        normals[vi * 3] = nx / len;
        normals[vi * 3 + 1] = ny / len;
        normals[vi * 3 + 2] = nz / len;
      }
    }
  }
  return normals;
}

/**
 * Turn a decoded pool + groups into the `{ meshes, errors }` shape the
 * existing ModelViewer consumes. Every group shares the one pool and carries
 * its own indices, which is exactly how the file means it.
 */
export function toViewerMeshes(decoded) {
  const vertexCount = decoded.positions.length / 3;
  let normals = decoded.normals;
  if (!normals || normals.length !== decoded.positions.length) {
    normals = deriveNormals(decoded.positions, decoded.groups);
  }
  const uvs = (decoded.uvs && decoded.uvs.length === vertexCount * 2)
    ? decoded.uvs
    : new Float32Array(vertexCount * 2);

  const meshes = decoded.groups.map((g, i) => ({
    // The group TYPE is the slot the game fills (Body, Head, shield0); the
    // mesh name is the artist's name for the part. Show both.
    name: g.meshName ? `${g.name} · ${g.meshName}` : (g.name || `group_${i}`),
    groupType: g.name || '',
    meshName: g.meshName || '',
    optional: g.flag === 1,
    sheets: g.sheets || 'main',
    texture: g.texture || '',
    positions: decoded.positions,
    normals,
    uvs,
    indices: g.indices instanceof Uint32Array ? g.indices : Uint32Array.from(g.indices),
    numVertices: vertexCount,
    numFaces: g.indices.length / 3,
  }));

  return {
    format: decoded.format,
    meshes,
    bones: decoded.bones || [],
    lodName: decoded.lodName || '',
    textures: decoded.textures || [],
    errors: decoded.notes || [],
  };
}