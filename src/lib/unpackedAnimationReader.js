import CasBinaryReader from '@/lib/casBinaryReader';
import { readLooseCas } from '@/lib/casAnimationReader';
// Unpacked pack.dat entries keep .cas names, but have no CAS scene header.
// Reference: GUI Toolkit v2.4.0 casanim.py packed_counts/read_packed_bytes.
export function packedAnimationCounts(buffer) {
  if (buffer.byteLength < 45) return null;
  const d = new DataView(buffer), frames = d.getUint16(0, true), rotations = d.getUint16(2, true), positions = d.getUint8(4);
  if (!frames || !rotations || positions > rotations || positions > 64 || buffer.byteLength !== 45 + frames * (16 * rotations + 12 * positions + 24)) return null;
  const moving = [];
  for (let b = 0; b < 64; b++) if (d.getUint8(buffer.byteLength - 8 + (b >> 3)) & (1 << (b % 8))) moving.push(b);
  return moving.length === positions && moving.every(b => b < rotations) ? { frames, rotations, positions, moving } : null;
}
export function readPackedSkeleton(buffer) {
  const r = new CasBinaryReader(buffer);
  const scale = r.f32(), count = r.u16(); r.f32();
  if (scale <= 0 || !count || count > 1024) throw new Error('Not an unpacked skeletons.dat entry.');
  const packedBones = Array.from({ length: count }, () => {
    r.skip(4); const poseFrame = { x: r.f32(), y: r.f32(), z: r.f32() }, parentIdx = r.i32();
    r.skip(56); const name = r.cstring();
    if (!name || parentIdx < -1 || parentIdx >= count) throw new Error('Invalid unpacked skeleton bone.');
    return { name, parentIdx, poseFrame };
  });
  return { bones: packedBones, packedBones, format: 'packed-skeleton' };
}
export function readSkeleton(buffer) {
  const d = new DataView(buffer);
  if (packedAnimationCounts(buffer)) throw new Error('This is an animation; select its matching file from animations/skeleton instead.');
  return buffer.byteLength >= 8 && d.getUint32(4, true) === 38 ? readLooseCas(buffer) : readPackedSkeleton(buffer);
}
export function readViewerAnimation(buffer, packedBones) {
  const counts = packedAnimationCounts(buffer);
  if (!counts) return readLooseCas(buffer);
  if (!packedBones?.length) throw new Error('Unpacked animation: load its matching file from animations/skeleton first (usually no extension).');
  const { frames, rotations, positions, moving } = counts;
  if (packedBones.length < rotations) throw new Error(`Animation needs ${rotations} bones; the selected skeleton has ${packedBones.length}.`);
  const r = new CasBinaryReader(buffer), posBase = 5 + frames * rotations * 16;
  const ctrlBase = posBase + frames * positions * 12 + frames * 12;
  const bones = [{ name: 'Scene Root', parentIdx: -1, poseFrame: { x: 0, y: 0, z: 0 }, quatFrames: [], animFrames: [] }];
  packedBones.forEach((b, index) => {
    const bone = { ...b, parentIdx: b.parentIdx >= 0 && b.parentIdx < index ? b.parentIdx + 1 : 0, quatFrames: [], animFrames: [] };
    for (let f = 0; f < frames; f++) {
      if (index < rotations) { r.p = 5 + (f * rotations + index) * 16; bone.quatFrames.push({ q1: r.f32(), q2: r.f32(), q3: r.f32(), q4: r.f32() }); }
      const slot = moving.indexOf(index);
      if (slot >= 0) {
        r.p = index === 0 ? ctrlBase + f * 12 : posBase + (f * positions + slot) * 12;
        bone.animFrames.push({ x: r.f32() - b.poseFrame.x, y: r.f32() - b.poseFrame.y, z: r.f32() - b.poseFrame.z });
      }
    }
    bones.push(bone);
  });
  return { format: 'unpacked', bones, nFrames: frames, timeTicks: Array.from({ length: frames }, (_, i) => i / 20), header: { animTime: (frames - 1) / 20 }, errors: [] };
}