import { Matrix4, Matrix3, Euler, Quaternion, Vector3 } from 'three';

export default function armoryGeometry(parts, sources) {
  return { meshes: parts.filter(part => part.visible && sources[part.source]).map(part => {
    const source = sources[part.source], mesh = source.parsed.meshes[part.group];
    const matrix = new Matrix4().compose(new Vector3(...part.position), new Quaternion().setFromEuler(new Euler(...part.rotation.map(v => v * Math.PI / 180))), new Vector3().setScalar(part.scale));
    const normalMatrix = new Matrix3().getNormalMatrix(matrix), vector = new Vector3();
    const vertices = [...new Set(mesh.indices)], remap = new Map(vertices.map((value, index) => [value, index]));
    const positions = new Float32Array(vertices.length * 3), normals = new Float32Array(vertices.length * 3), uvs = new Float32Array(vertices.length * 2);
    vertices.forEach((old, index) => {
      vector.fromArray(mesh.positions, old * 3).applyMatrix4(matrix).toArray(positions, index * 3);
      vector.fromArray(mesh.normals, old * 3).applyMatrix3(normalMatrix).normalize().toArray(normals, index * 3);
      uvs[index * 2] = mesh.uvs[old * 2]; uvs[index * 2 + 1] = mesh.uvs[old * 2 + 1];
    });
    return { ...mesh, name: part.name, positions, normals, uvs, indices: Uint32Array.from(mesh.indices, value => remap.get(value)),
      numVertices: vertices.length, numFaces: mesh.indices.length / 3, armoryAtlas: source.atlas, armorySource: source.id };
  }), bones: [], errors: [] };
}