import * as THREE from 'three';
export default function skeletonWorldMatrices(joints, local, reuse) {
  const world = reuse?.length >= joints.length ? reuse : joints.map(() => new THREE.Matrix4());
  const done = new Set();
  for (let start = 0; start < joints.length; start++) {
    const chain = [], active = new Set(); let i = start;
    while (i >= 0 && i < joints.length && !done.has(i) && !active.has(i)) {
      active.add(i); chain.push(i); i = joints[i].parentIdx;
    }
    let base = done.has(i) ? world[i] : new THREE.Matrix4();
    for (let k = chain.length - 1; k >= 0; k--) {
      const index = chain[k]; world[index].multiplyMatrices(base, local[index]);
      done.add(index); base = world[index];
    }
  }
  return world;
}