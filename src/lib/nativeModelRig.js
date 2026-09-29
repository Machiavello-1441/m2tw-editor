import { skeletonJoints, boneKey } from '@/lib/casSkeleton';
export function buildNativeRig(parsed, skeleton) {
  if (!parsed.skinIndices || !parsed.skinWeights) throw new Error('This model has no readable skin weights.');
  const joints = skeletonJoints(skeleton.bones);
  const byName = new Map(joints.map((j, i) => [boneKey(j.name), i]));
  const mapping = parsed.bones.map(name => byName.get(boneKey(name)) ?? -1);
  const p = parsed.meshes[0].positions, missing = new Set(); let matched = 0;
  const vertices = Array.from({ length: p.length / 3 }, (_, i) => {
    const influences = [];
    for (let c = 0; c < 4; c++) {
      const weight = parsed.skinWeights[i * 4 + c]; if (!weight) continue;
      const source = parsed.skinIndices[i * 4 + c], boneId = mapping[source] ?? -1;
      if (boneId < 0) missing.add(parsed.bones[source] || `bone ${source}`); else matched++;
      influences.push({ boneId, weight });
    }
    return { x: p[i * 3], y: p[i * 3 + 1], z: p[i * 3 + 2], influences };
  });
  if (!matched) throw new Error('None of the model’s weighted bones match this skeleton.');
  return { joints, vertices, sharedPool: true, packedBones: skeleton.packedBones,
    normals: parsed.meshes[0].normals.slice(), warnings: missing.size ? [`Unmatched bones remain static: ${[...missing].join(', ')}`] : [] };
}