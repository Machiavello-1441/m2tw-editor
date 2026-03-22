/**
 * Forward Kinematics skeleton poser for MS3D skeletons.
 * 
 * Takes skeleton joints + per-bone rotation overrides → computes world transforms.
 * Then skins mesh vertices using bone assignments from MS3D vertex data.
 * 
 * Optimized: reuses matrix/vector objects to minimize GC pressure during posing.
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

// ── Reusable scratch objects for computePosedMatrices ──
const _euler = new THREE.Euler(0, 0, 0, 'XYZ');
const _bindRotMat = new THREE.Matrix4();
const _bindTransMat = new THREE.Matrix4();
const _poseRotMat = new THREE.Matrix4();
const _localMat = new THREE.Matrix4();
const _tempRot = new THREE.Matrix4();

/**
 * Compute posed world matrices given per-bone Euler rotation overrides.
 * poseRotations: { [boneIndex]: { rx, ry, rz } } — additional rotation on top of bind pose
 * 
 * Optionally pass a pre-allocated array of Matrix4 to reuse (avoids allocations).
 */
export function computePosedMatrices(joints, poseRotations, reuseWorldMats) {
  const n = joints.length;
  const worldMats = reuseWorldMats && reuseWorldMats.length >= n
    ? reuseWorldMats
    : joints.map(() => new THREE.Matrix4());

  for (let i = 0; i < n; i++) {
    const j = joints[i];
    
    _euler.set(j.bindRot.rx, j.bindRot.ry, j.bindRot.rz, 'XYZ');
    _bindRotMat.makeRotationFromEuler(_euler);
    _bindTransMat.makeTranslation(j.bindPos.x, j.bindPos.y, j.bindPos.z);

    if (poseRotations[i]) {
      const pr = poseRotations[i];
      _euler.set(pr.rx || 0, pr.ry || 0, pr.rz || 0, 'XYZ');
      _poseRotMat.makeRotationFromEuler(_euler);
      _tempRot.copy(_bindRotMat).multiply(_poseRotMat);
      _localMat.multiplyMatrices(_bindTransMat, _tempRot);
    } else {
      _localMat.multiplyMatrices(_bindTransMat, _bindRotMat);
    }

    if (j.parentIdx >= 0 && worldMats[j.parentIdx]) {
      worldMats[i].multiplyMatrices(worldMats[j.parentIdx], _localMat);
    } else {
      worldMats[i].copy(_localMat);
    }
  }

  return worldMats;
}

// ── Reusable scratch for skinVertices ──
const _v = new THREE.Vector3();

/**
 * Skin vertices: apply bone transforms to original vertex positions.
 * vertices: ms3dCodec parsed vertices array [{ x, y, z, boneId }]
 * invBindMats: from buildBindPoseMatrices
 * posedWorldMats: from computePosedMatrices
 * 
 * Pass reuseOut to avoid allocating a new Float32Array each call.
 */
export function skinVertices(vertices, invBindMats, posedWorldMats, reuseOut) {
  const n = vertices.length;
  const out = reuseOut && reuseOut.length >= n * 3 ? reuseOut : new Float32Array(n * 3);

  for (let i = 0; i < n; i++) {
    const vert = vertices[i];
    const boneId = vert.boneId;

    if (boneId >= 0 && boneId < invBindMats.length) {
      _v.set(vert.x, vert.y, vert.z);
      _v.applyMatrix4(invBindMats[boneId]);
      _v.applyMatrix4(posedWorldMats[boneId]);
    } else {
      _v.set(vert.x, vert.y, vert.z);
    }

    out[i * 3] = _v.x;
    out[i * 3 + 1] = _v.y;
    out[i * 3 + 2] = _v.z;
  }

  return out;
}

// ── Reusable scratch for getJointWorldPositions ──
const _posVec = new THREE.Vector3();

/**
 * Compute world positions for skeleton joints (for visualization).
 * Pass reusePositions to avoid allocating new Vector3 objects each call.
 */
export function getJointWorldPositions(posedWorldMats, reusePositions) {
  const n = posedWorldMats.length;
  const positions = reusePositions && reusePositions.length >= n
    ? reusePositions
    : posedWorldMats.map(() => new THREE.Vector3());

  for (let i = 0; i < n; i++) {
    positions[i].setFromMatrixPosition(posedWorldMats[i]);
  }
  return positions;
}