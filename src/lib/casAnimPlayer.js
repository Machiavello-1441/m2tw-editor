/**
 * Links a parsed .cas animation (casAnimCodec.parseCasAnim) to a rigged model's
 * skeleton joints and samples it into the `poseRotations` map the skeleton poser
 * already consumes.
 *
 * The poser applies poseRotations ON TOP of each joint's bind rotation, so each
 * track stores the delta rotation:  delta = inverse(bindQuat) * animQuat.
 */
import * as THREE from 'three';

const normName = (s) => (s || '').toLowerCase();

/**
 * Build a playable clip.
 * @param parsedAnim parseCasAnim() result
 * @param joints     skeleton joints ({ name, bindRot:{rx,ry,rz}, parentIdx })
 * @returns { duration, frameCount, tracks, matched, unmatched, times }
 */
export function buildAnimClip(parsedAnim, joints) {
  if (!parsedAnim?.bones?.length || !joints?.length) return null;
  const jointByName = new Map(joints.map((j, i) => [normName(j.name), i]));
  const frameCount = Math.max(1, parsedAnim.timeTicks?.length || 0, ...parsedAnim.bones.map(b => Math.max(b.quatFrames?.length || 0, b.animFrames?.length || 0)));
  const times = parsedAnim.timeTicks?.length ? parsedAnim.timeTicks : Array.from({ length: frameCount }, (_, i) => i / 20);
  const duration = Math.max(times[times.length - 1] - times[0], 0.001);
  const tracks = [], matched = [], unmatched = [];
  for (const bone of parsedAnim.bones) {
    const jointIdx = jointByName.get(normName(bone.name));
    if (jointIdx === undefined) { if (bone.quatFrames?.length || bone.animFrames?.length) unmatched.push(bone.name); continue; }
    matched.push(bone.name);
    const j = joints[jointIdx];
    const bindInv = new THREE.Quaternion().setFromEuler(new THREE.Euler(j.bindRot.rx, j.bindRot.ry, j.bindRot.rz, 'XYZ')).invert();
    const quats = (bone.quatFrames?.length ? bone.quatFrames : [{ q1: 0, q2: 0, q3: 0, q4: 1 }]).map(q => {
      const quaternion = new THREE.Quaternion(q.q1, q.q2, q.q3, q.q4);
      if (quaternion.lengthSq() < 1e-12) throw new Error(`Invalid zero quaternion on ${bone.name}.`);
      return bindInv.clone().multiply(quaternion.normalize());
    });
    const pivot = bone.poseFrame || j.bindPos;
    const translations = (bone.animFrames?.length ? bone.animFrames : [{ x: 0, y: 0, z: 0 }]).map(p => ({
      x: pivot.x + p.x - j.bindPos.x, y: pivot.y + p.y - j.bindPos.y, z: pivot.z + p.z - j.bindPos.z,
    }));
    tracks.push({ jointIdx, quats, translations });
  }
  return { duration, frameCount, times, tracks, matched, unmatched, format: parsedAnim.format };
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
  const time = clip.times[0] + p * clip.duration;
  let f0 = 0;
  while (f0 + 1 < clip.times.length - 1 && clip.times[f0 + 1] < time) f0++;
  const f1 = Math.min(f0 + 1, clip.times.length - 1);
  const span = clip.times[f1] - clip.times[f0];
  const alpha = span > 0 ? Math.min(1, Math.max(0, (time - clip.times[f0]) / span)) : 0;

  const out = {};
  for (const track of clip.tracks) {
    const a = track.quats[Math.min(f0, track.quats.length - 1)];
    const b = track.quats[Math.min(f1, track.quats.length - 1)];
    if (!a) continue;
    _q.copy(a);
    if (b && alpha > 0) _q.slerp(b, alpha);
    _e.setFromQuaternion(_q, 'XYZ');
    const t0 = track.translations[Math.min(f0, track.translations.length - 1)];
    const t1 = track.translations[Math.min(f1, track.translations.length - 1)];
    out[track.jointIdx] = { rx: _e.x, ry: _e.y, rz: _e.z,
      tx: t0.x + (t1.x - t0.x) * alpha, ty: t0.y + (t1.y - t0.y) * alpha, tz: t0.z + (t1.z - t0.z) * alpha };
  }
  return out;
}