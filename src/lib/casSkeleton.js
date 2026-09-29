// CAS vertices are bone-local; a bind position is the sum of ancestor pivots.
// Reference: Medieval2-GUI-Toolkit v2.4.0, cas.bind_world / posed_positions.
export const boneKey = name => (name || '').toLowerCase();
export function skeletonJoints(bones) {
  const joints = bones.map(b => ({ name: b.name, parentIdx: b.parentIdx,
    bindRot: { rx: 0, ry: 0, rz: 0 }, bindPos: { ...(b.poseFrame || { x: 0, y: 0, z: 0 }) } }));
  const done = new Set();
  for (let i = 0; i < joints.length; i++) {
    const chain = new Set(); let j = i;
    while (j >= 0 && !done.has(j)) {
      chain.add(j); const parent = joints[j].parentIdx;
      if (parent < 0 || parent >= joints.length || chain.has(parent)) { joints[j].parentIdx = -1; break; }
      j = parent;
    }
    chain.forEach(n => done.add(n));
  }
  return joints;
}
export function jointWorldPositions(joints) {
  const world = new Array(joints.length);
  function visit(i) { if (world[i]) return world[i]; const j = joints[i]; const p = j.parentIdx >= 0 ? visit(j.parentIdx) : { x: 0, y: 0, z: 0 }; return world[i] = { x: p.x + j.bindPos.x, y: p.y + j.bindPos.y, z: p.z + j.bindPos.z }; }
  joints.forEach((_, i) => visit(i)); return world;
}
export function casSceneJoints(scene, external) {
  const byName = new Map((external?.bones || []).map(b => [boneKey(b.name), b]));
  const used = new Set(scene.objects.filter(o => o.skinned).flatMap(o => Array.from(o.bones || [])));
  if (external && [...used].some(i => !byName.has(boneKey(scene.nodes[i])))) throw new Error('This skeleton does not contain all bones used by the CAS character.');
  return skeletonJoints(scene.nodes.map((name, i) => ({ name, parentIdx: scene.parents[i],
    poseFrame: byName.get(boneKey(name))?.poseFrame || { x: scene.pivots[i * 3], y: scene.pivots[i * 3 + 1], z: scene.pivots[i * 3 + 2] } })));
}