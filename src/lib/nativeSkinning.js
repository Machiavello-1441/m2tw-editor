import * as THREE from 'three';
const v = new THREE.Vector3(), n = new THREE.Vector3();
// Shared-pool CAS and battle meshes need both position and normal skinning.
export default function skinNativeRig(rig, invBind, posed, reuse) {
  const count = rig.vertices.length;
  const out = reuse?.positions?.length === count * 3 ? reuse : { positions: new Float32Array(count * 3), normals: new Float32Array(count * 3) };
  const transforms = posed.map((m, i) => new THREE.Matrix4().multiplyMatrices(m, invBind[i]));
  const rotations = transforms.map(m => new THREE.Matrix3().setFromMatrix4(m));
  rig.vertices.forEach((vert, i) => {
    let x = 0, y = 0, z = 0, nx = 0, ny = 0, nz = 0;
    const influences = vert.influences || [{ boneId: vert.boneId, weight: 1 }];
    for (const { boneId, weight } of influences) {
      v.set(vert.x, vert.y, vert.z); n.fromArray(rig.normals, i * 3);
      if (transforms[boneId]) { v.applyMatrix4(transforms[boneId]); n.applyMatrix3(rotations[boneId]); }
      x += v.x * weight; y += v.y * weight; z += v.z * weight;
      nx += n.x * weight; ny += n.y * weight; nz += n.z * weight;
    }
    out.positions.set([x, y, z], i * 3);
    n.set(nx, ny, nz).normalize().toArray(out.normals, i * 3);
  });
  return out;
}