/**
 * GOAT-equivalent animation utilities (SLERP, concatenate, skeleton extract)
 * Ported from KnightErrant's GameObjectApplicationLibrary.py
 */
import { eulerToQuat, quatToEuler } from './casAnimCodec.js';

// ─── SLERP between two quaternions ─────────────────────────────────────────
function slerpQuat(q0, q1, t) {
  // q0, q1 = [q1,q2,q3,q4]
  let dot = q0[0]*q1[0] + q0[1]*q1[1] + q0[2]*q1[2] + q0[3]*q1[3];
  // Ensure shortest path
  if (dot < 0) { q1 = q1.map(v => -v); dot = -dot; }
  if (dot > 0.9995) {
    // Linear interpolation if very close
    const r = q0.map((v, i) => v + t * (q1[i] - v));
    const mag = Math.sqrt(r.reduce((s, v) => s + v*v, 0));
    return r.map(v => v / mag);
  }
  const omega = Math.acos(Math.min(dot, 1.0));
  const sinOmega = Math.sin(omega);
  const s0 = Math.sin((1 - t) * omega) / sinOmega;
  const s1 = Math.sin(t * omega) / sinOmega;
  return q0.map((v, i) => s0 * v + s1 * q1[i]);
}

function lerpVec(v0, v1, t) {
  return v0.map((v, i) => v + t * (v1[i] - v));
}

// ─── Resample a bone's quat frames to newN frames ──────────────────────────
function resampleQuatFrames(frames, newN) {
  const oldN = frames.length;
  if (oldN === 0 || newN === 0) return [];
  const result = [];
  for (let i = 0; i < newN; i++) {
    const frac = (oldN - 1) * i / (newN - 1);
    const lo   = Math.min(Math.floor(frac), oldN - 2);
    const hi   = lo + 1;
    const t    = frac - lo;
    const f0   = frames[lo];
    const f1   = frames[hi] || frames[lo];
    const q0   = [f0.q1, f0.q2, f0.q3, f0.q4];
    const q1   = [f1.q1, f1.q2, f1.q3, f1.q4];
    const qr   = slerpQuat(q0, q1, t);
    const [roll, pitch, yaw] = quatToEuler(qr[0], qr[1], qr[2], qr[3]);
    result.push({ q1: qr[0], q2: qr[1], q3: qr[2], q4: qr[3], roll, pitch, yaw });
  }
  return result;
}

function resampleAnimFrames(frames, newN) {
  const oldN = frames.length;
  if (oldN === 0 || newN === 0) return [];
  const result = [];
  for (let i = 0; i < newN; i++) {
    const frac = (oldN - 1) * i / (newN - 1);
    const lo   = Math.min(Math.floor(frac), oldN - 2);
    const hi   = lo + 1;
    const t    = frac - lo;
    const f0   = frames[lo];
    const f1   = frames[hi] || frames[lo];
    const v0   = [f0.x, f0.y, f0.z];
    const v1   = [f1.x, f1.y, f1.z];
    const vr   = lerpVec(v0, v1, t);
    result.push({ x: vr[0], y: vr[1], z: vr[2] });
  }
  return result;
}

// ─── SLERP Animation: resample entire .cas to newN frames ──────────────────
export function slerpAnimation(parsed, newN) {
  const clone = JSON.parse(JSON.stringify(parsed));
  clone.footerBytes = parsed.footerBytes;

  const oldN = parsed.nFrames;
  if (oldN < 2 || newN < 2) return clone;

  const dt = (oldN - 1) * 0.05 / (oldN - 1); // original delta = 0.05
  const newAnimTime = (newN - 1) * 0.05;
  clone.header.animTime = newAnimTime;
  clone.nFrames = newN;
  clone.timeTicks = Array.from({ length: newN }, (_, i) => i * 0.05);

  for (const b of clone.bones) {
    if (b.quatFrames && b.quatFrames.length > 0) {
      b.quatFrames = resampleQuatFrames(b.quatFrames, newN);
      b.nQuat = newN;
    }
    if (b.animFrames && b.animFrames.length > 0) {
      b.animFrames = resampleAnimFrames(b.animFrames, newN);
      b.nAnim = newN;
    }
  }
  return clone;
}

// ─── SLERP Two Segment: divide at splitFrame, resample each independently ──
export function slerpTwoSegment(parsed, splitFrame, newN1, newN2) {
  const oldN = parsed.nFrames;
  if (splitFrame < 1 || splitFrame >= oldN || newN1 < 1 || newN2 < 1) {
    throw new Error('Invalid split frame or segment sizes');
  }

  const totalNew = newN1 + newN2 - 1; // shared frame at boundary
  const clone = JSON.parse(JSON.stringify(parsed));
  clone.footerBytes = parsed.footerBytes;
  clone.header.animTime = (totalNew - 1) * 0.05;
  clone.nFrames = totalNew;
  clone.timeTicks = Array.from({ length: totalNew }, (_, i) => i * 0.05);

  for (const b of clone.bones) {
    if (b.quatFrames && b.quatFrames.length > 0) {
      const seg1 = b.quatFrames.slice(0, splitFrame + 1);
      const seg2 = b.quatFrames.slice(splitFrame);
      const r1   = resampleQuatFrames(seg1, newN1);
      const r2   = resampleQuatFrames(seg2, newN2);
      b.quatFrames = [...r1, ...r2.slice(1)];
      b.nQuat = totalNew;
    }
    if (b.animFrames && b.animFrames.length > 0) {
      const seg1 = b.animFrames.slice(0, splitFrame + 1);
      const seg2 = b.animFrames.slice(splitFrame);
      const r1   = resampleAnimFrames(seg1, newN1);
      const r2   = resampleAnimFrames(seg2, newN2);
      b.animFrames = [...r1, ...r2.slice(1)];
      b.nAnim = totalNew;
    }
  }
  return clone;
}

// ─── Concatenate two .cas animations ───────────────────────────────────────
export function concatenateAnimations(parsed1, parsed2) {
  // Use parsed1 as base (header, footer, hierarchy, bone structure)
  const clone = JSON.parse(JSON.stringify(parsed1));
  clone.footerBytes = parsed1.footerBytes;

  const n1 = parsed1.nFrames;
  const n2 = parsed2.nFrames;
  const totalN = n1 + n2;
  const lastTick = parsed1.timeTicks[n1 - 1] || 0;

  clone.nFrames = totalN;
  clone.header.animTime = lastTick + (n2 - 1) * 0.05;
  clone.timeTicks = [
    ...parsed1.timeTicks,
    ...parsed2.timeTicks.map(t => t + lastTick + 0.05),
  ];

  // Merge bones by name
  const boneMap2 = {};
  for (const b of parsed2.bones) boneMap2[b.name.toLowerCase()] = b;

  for (const b of clone.bones) {
    const b2 = boneMap2[b.name.toLowerCase()];
    if (!b2) continue;
    if (b.quatFrames) {
      b.quatFrames = [...b.quatFrames, ...(b2.quatFrames || [])];
      b.nQuat = b.quatFrames.length;
    }
    if (b.animFrames) {
      b.animFrames = [...b.animFrames, ...(b2.animFrames || [])];
      b.nAnim = b.animFrames.length;
    }
  }
  return clone;
}

// ─── Extract skeleton from .ms3d joints → .skelexport text format ──────────
export function extractSkeletonToText(ms3d) {
  // game coords: x sign is flipped from Milkshape coords
  const { joints } = ms3d;
  if (!joints || joints.length === 0) return '';
  const lines = [];
  joints.forEach((j, i) => {
    const x = -j.bindPos.x; // flip x for game coords
    const y =  j.bindPos.y;
    const z =  j.bindPos.z;
    const parentIdx = j.parentIdx >= 0 ? j.parentIdx : 0;
    lines.push(
      `${x >= 0 ? '+' : ''}${x.toFixed(8)}, ` +
      `${y >= 0 ? '+' : ''}${y.toFixed(8)}, ` +
      `${z >= 0 ? '+' : ''}${z.toFixed(8)}, ` +
      `${String(parentIdx).padStart(2)}, ${j.name}`
    );
  });
  return lines.join('\n');
}

// ─── Merge two .ms3d files (geometry + first file's skeleton) ───────────────
export function mergeMs3d(primary, secondary) {
  // primary must have joints; secondary provides extra geometry groups
  const merged = JSON.parse(JSON.stringify(primary));
  const nVprimary = primary.vertices.length;
  const nTprimary = primary.triangles.length;
  const nMprimary = primary.materials.length;

  // Append vertices (offset bone IDs by 0 since we keep primary skeleton)
  for (const v of secondary.vertices) {
    merged.vertices.push({ ...v });
  }

  // Append triangles (offset vertex indices)
  for (const t of secondary.triangles) {
    merged.triangles.push({
      vi: [t.vi[0] + nVprimary, t.vi[1] + nVprimary, t.vi[2] + nVprimary]
    });
  }

  // Append materials
  for (const m of secondary.materials) {
    merged.materials.push({ ...m });
  }

  // Append groups (offset triangle indices and material IDs)
  for (const g of secondary.groups) {
    merged.groups.push({
      name: g.name,
      triIndices: g.triIndices.map(i => i + nTprimary),
      matIdx: g.matIdx >= 0 ? g.matIdx + nMprimary : -1,
    });
  }

  return merged;
}