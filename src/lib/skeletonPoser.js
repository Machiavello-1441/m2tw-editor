/**
 * Forward Kinematics skeleton poser for MS3D skeletons.
 * 
 * Takes skeleton joints + per-bone rotation overrides → computes world transforms.
 * Then skins mesh vertices using bone assignments from MS3D vertex data.
 */
import * as THREE from 'three';

/**
 * Build bind-pose matrices for each joint.
 * Each joint's local transform: rotate by bindRot (Euler XYZ), translate by bindPos.
 * World = parent.world * local
 */
export function buildBindPoseMatrices(joints) {
  const localMats = [];
  const worldMats = [];
  const invBindMats = [];

  for (let i = 0; i < joints.length; i++) {
    const j = joints[i];
    const local = new THREE.Matrix4();
    const rotMat = new THREE.Matrix4().makeRotationFromEuler(
      new THREE.Euler(j.bindRot.rx, j.bindRot.ry, j.bindRot.rz, 'XYZ')
    );
    const transMat = new THREE.Matrix4().makeTranslation(j.bindPos.x, j.bindPos.y, j.bindPos.z);
    local.multiplyMatrices(transMat, rotMat);
    localMats.push(local);

    const world = new THREE.Matrix4();
    if (j.parentIdx >= 0 && worldMats[j.parentIdx]) {
      world.multiplyMatrices(worldMats[j.parentIdx], local);
    } else {
      world.copy(local);
    }
    worldMats.push(world);
    invBindMats.push(world.clone().invert());
  }

  return { localMats, worldMats, invBindMats };
}

/**
 * Compute posed world matrices given per-bone Euler rotation overrides.
 * poseRotations: { [boneIndex]: { rx, ry, rz } } — additional rotation on top of bind pose
 */
export function computePosedMatrices(joints, poseRotations) {
  const worldMats = [];

  for (let i = 0; i < joints.length; i++) {
    const j = joints[i];
    
    // Start with bind-pose local transform
    const bindRot = new THREE.Matrix4().makeRotationFromEuler(
      new THREE.Euler(j.bindRot.rx, j.bindRot.ry, j.bindRot.rz, 'XYZ')
    );
    const bindTrans = new THREE.Matrix4().makeTranslation(j.bindPos.x, j.bindPos.y, j.bindPos.z);

    // Apply pose rotation override on top
    let local = new THREE.Matrix4();
    if (poseRotations[i]) {
      const pr = poseRotations[i];
      const poseRot = new THREE.Matrix4().makeRotationFromEuler(
        new THREE.Euler(pr.rx || 0, pr.ry || 0, pr.rz || 0, 'XYZ')
      );
      // local = translate * bindRot * poseRot
      local.multiplyMatrices(bindTrans, bindRot.clone().multiply(poseRot));
    } else {
      local.multiplyMatrices(bindTrans, bindRot);
    }

    const world = new THREE.Matrix4();
    if (j.parentIdx >= 0 && worldMats[j.parentIdx]) {
      world.multiplyMatrices(worldMats[j.parentIdx], local);
    } else {
      world.copy(local);
    }
    worldMats.push(world);
  }

  return worldMats;
}

/**
 * Skin vertices: apply bone transforms to original vertex positions.
 * vertices: ms3dCodec parsed vertices array [{ x, y, z, boneId }]
 * invBindMats: from buildBindPoseMatrices
 * posedWorldMats: from computePosedMatrices
 * Returns: Float32Array of skinned positions (3 per vertex)
 */
export function skinVertices(vertices, invBindMats, posedWorldMats) {
  const out = new Float32Array(vertices.length * 3);
  const v = new THREE.Vector3();

  for (let i = 0; i < vertices.length; i++) {
    const vert = vertices[i];
    const boneId = vert.boneId;

    if (boneId >= 0 && boneId < invBindMats.length) {
      // Transform: posedWorld * invBind * originalPos
      v.set(vert.x, vert.y, vert.z);
      v.applyMatrix4(invBindMats[boneId]);
      v.applyMatrix4(posedWorldMats[boneId]);
    } else {
      v.set(vert.x, vert.y, vert.z);
    }

    out[i * 3] = v.x;
    out[i * 3 + 1] = v.y;
    out[i * 3 + 2] = v.z;
  }

  return out;
}

/**
 * Compute world positions for skeleton joints (for visualization)
 */
export function getJointWorldPositions(posedWorldMats) {
  return posedWorldMats.map(mat => {
    const pos = new THREE.Vector3();
    pos.setFromMatrixPosition(mat);
    return pos;
  });
}