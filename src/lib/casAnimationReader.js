import CasBinaryReader from '@/lib/casBinaryReader';
// Binary layout learned from GUI Toolkit v2.4.0 casanim.py, commit 8634137.
// Keep this viewer reader separate from the legacy Animation Editor writer.
function decodeLoose(buffer, pad, properties) {
  const r = new CasBinaryReader(buffer), version = r.f32();
  if (version < 2 || version > 4) throw new Error('Not a loose CAS scene or animation.');
  r.skip(12); const animTime = r.f32(); r.p = 0x32;
  const count = r.u32();
  if (count < 1 || count > 1024) throw new Error('Invalid CAS bone count.');
  r.skip(pad);
  const hierarchy = [-1, ...Array.from({ length: count - 1 }, () => r.u32())];
  if (hierarchy.some(p => p >= count)) throw new Error('CAS parent index is outside the skeleton.');
  const timeTicks = r.floats(r.u32());
  if (timeTicks.length && (Math.abs(timeTicks[0]) > 1e-6 || timeTicks.some((t, i) => i && t < timeTicks[i - 1]))) throw new Error('Invalid CAS key times.');
  const bones = Array.from({ length: count }, (_, i) => {
    const name = r.text(), nQuat = r.u32(), nAnim = r.u32(), quatOffset = r.u32(), animOffset = r.u32(), extra = r.u32();
    return { name, parentIdx: hierarchy[i], nQuat, nAnim, quatOffset, animOffset, extra, properties: properties ? r.text() : '' };
  });
  const base = r.p; let end = 0;
  for (const b of bones) {
    if (b.nQuat > timeTicks.length || b.nAnim > timeTicks.length || b.quatOffset !== end) throw new Error(`Invalid rotation layout for ${b.name}.`);
    end += b.nQuat * 16;
  }
  for (const b of bones) {
    if (b.animOffset !== end) throw new Error(`Invalid position layout for ${b.name}.`);
    end += b.nAnim * 12;
  }
  r.need(end + count * 12);
  for (const b of bones) {
    r.p = base + b.quatOffset;
    b.quatFrames = Array.from({ length: b.nQuat }, () => ({ q1: r.f32(), q2: r.f32(), q3: r.f32(), q4: r.f32() }));
    r.p = base + b.animOffset;
    b.animFrames = Array.from({ length: b.nAnim }, () => ({ x: r.f32(), y: r.f32(), z: r.f32() }));
  }
  // Keys precede pivots; reading pivots first shifts every quaternion.
  r.p = base + end;
  bones.forEach(b => { b.poseFrame = { x: r.f32(), y: r.f32(), z: r.f32() }; });
  const dataEnd = r.p;
  while (r.p < buffer.byteLength) {
    const start = r.p, size = r.u32(); r.u32();
    if (size < 8) throw new Error('Invalid CAS trailing chunk size.');
    r.skip(size - 8);
    if (r.p !== start + size) throw new Error('Invalid CAS chunk boundary.');
  }
  return { format: 'loose', header: { version, animTime }, bones, hierarchy, timeTicks, nFrames: timeTicks.length,
    isPose: bones.every(b => !b.nQuat && !b.nAnim), dataEnd, errors: [] };
}
export function readLooseCas(buffer) {
  let firstError;
  // These are the four measured scene layouts, not guesses based on the version.
  for (const [pad, props] of [[2, true], [1, false], [2, false], [1, true]]) {
    try { return decodeLoose(buffer, pad, props); } catch (error) { firstError ||= error; }
  }
  throw firstError;
}