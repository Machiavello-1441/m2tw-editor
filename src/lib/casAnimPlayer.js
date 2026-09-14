/**
 * Links a parsed .cas animation (casAnimCodec.parseCasAnim) to a rigged model's
 * skeleton joints and samples it into the `poseRotations` map the skeleton poser
 * already consumes.
 *
 * The poser applies poseRotations ON TOP of each joint's bind rotation, so each
 * track stores the delta rotation:  delta = inverse(bindQuat) * animQuat.
 */
import * as THREE from 'three';

const normName = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Build a playable clip.
 * @param parsedAnim parseCasAnim() result
 * @param joints     skeleton joints ({ name, bindRot:{rx,ry,rz}, parentIdx })
 * @returns { duration, frameCount, tracks, matched, unmatched, times }
 */
export function buildAnimClip(parsedAnim, joints) {
  if (!parsedAnim?.bones?.length || !joints?.length) return null;

  const jointByName = new Map();
  joints.forEach((j, idx) => {
    const key = normName(j.name);
    if (key && !jointByName.has(key)) jointByName.set(key, idx);
  });

  const frameCount = Math.max(
    1,
    parsedAnim.bones.reduce((m, b) => Math.max(m, b.quatFrames?.length || 0), 0)
  );

  // Time per frame — prefer the file's tick list, else a 25 fps fallback.
  const ticks = parsedAnim.timeTicks?.length >= frameCount
    ? parsedAnim.timeTicks.slice(0, frameCount)
    : Array.from({ length: frameCount }, (_, i) => i / 25);
  const times = ticks.map((t, i) => (Number.isFinite(t) ? t : i / 25));
  const duration = Math.max(times[times.length - 1] - times[0], 0.001);

  const tracks = [];
  const matched = [];
  const unmatched = [];
  const bindInv = new THREE.Quaternion();
  const animQ = new THREE.Quaternion();

  for (const bone of parsedAnim.bones) {
    if (!bone.quatFrames?.length) continue;
    const jointIdx = jointByName.get(normName(bone.name));
    if (jointIdx === undefined) { unmatched.push(bone.name); continue; }
    matched.push(bone.name);

    const j = joints[jointIdx];
    bindInv.setFromEuler(new THREE.Euler(j.bindRot.rx, j.bindRot.ry, j.bindRot.rz, 'XYZ')).invert();

    const quats = bone.quatFrames.map(q => {
      animQ.set(q.q1, q.q2, q.q3, q.q4).normalize();
      return new THREE.Quaternion().copy(bindInv).multiply(animQ);
    });
    tracks.push({ jointIdx, quats });
  }

  return { duration, frameCount, times, tracks, matched, unmatched };
}

const _q = new THREE.Quaternion();
const _e = new THREE.Euler(0, 0, 0, 'XYZ');

/**
 * Sample the clip at a normalised position (0..1) → poseRotations map.
 * Interpolates between the two neighbouring frames.
 */
export function sampleAnimClip(clip, progress) {
  if (!clip?.tracks.length) return {};
  const p = Math.min(Math.max(progress, 0), 1);
  const pos = p * (clip.frameCount - 1);
  const f0 = Math.floor(pos);
  const f1 = Math.min(f0 + 1, clip.frameCount - 1);
  const alpha = pos - f0;

  const out = {};
  for (const track of clip.tracks) {
    const a = track.quats[Math.min(f0, track.quats.length - 1)];
    const b = track.quats[Math.min(f1, track.quats.length - 1)];
    if (!a) continue;
    _q.copy(a);
    if (b && alpha > 0) _q.slerp(b, alpha);
    _e.setFromQuaternion(_q, 'XYZ');
    out[track.jointIdx] = { rx: _e.x, ry: _e.y, rz: _e.z };
  }
  return out;
}