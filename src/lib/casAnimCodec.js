/**
 * M2TW .cas animation binary codec
 * Reverse-engineered from KnightErrant's animationlibrary.py / animationutilities.py
 *
 * Standard v3.21 file layout:
 *   [header: 42 bytes]
 *   [int32 bodySize][int32 0]          ← 8 bytes (bodySize includes these 8)
 *   [uint16 nBones]                    ← 2 bytes
 *   [int16 × nBones hierarchy]         ← nBones × 2
 *   [bone section: nBones × 44 bytes]  ← name(20) + 6 int fields(24)
 *   [float32 × nFrames timeticks]      ← nFrames × 4
 *   [quat data]                        ← bone quatOffsets (4 floats/frame)
 *   [anim data]                        ← bone animOffsets (3 floats/frame)
 *   [pose data]                        ← 3 floats per active bone
 *   [footer: variable (192 std)]
 */

const HEADER_SIZE = 42;
const BONE_NAME_LEN = 20;   // null-padded fixed-length bone names in .cas
const BONE_RECORD_SIZE = BONE_NAME_LEN + 2 + 2 + 4 + 4 + 4 + 4 + 4; // 44 bytes
const FILESIZE_SECTION = 8; // int32 bodySize + int32 0

// ─────────────────────────────────────────────────────────────────────────────
// Quaternion ↔ Euler helpers  (GrumpyOldMan's formulas from animationlibrary.py)
// ─────────────────────────────────────────────────────────────────────────────
export function quatToEuler(q1, q2, q3, q4) {
  const sint = 2 * (q2 * q4 - q1 * q3);
  const cost_tmp = 1.0 - sint * sint;
  const cost = Math.abs(cost_tmp) > 0.0001 ? Math.sqrt(cost_tmp) : 0.0;

  let sinv, cosv, sinf, cosf;
  if (Math.abs(cost) > 0.01) {
    sinv = 2 * (q2 * q3 + q1 * q4) / cost;
    cosv = (1 - 2 * (q1 * q1 + q2 * q2)) / cost;
    sinf = 2 * (q1 * q2 + q3 * q4) / cost;
    cosf = (1 - 2 * (q2 * q2 + q3 * q3)) / cost;
  } else {
    sinv = 2 * (q1 * q4 - q2 * q3);
    cosv = 1 - 2 * (q1 * q1 + q3 * q3);
    sinf = 0.0; cosf = 1.0;
  }
  const roll  =  Math.atan2(sinv, cosv);
  const pitch = -Math.atan2(sint, cost);
  const yaw   = -Math.atan2(sinf, cosf);
  return [roll, pitch, yaw];
}

export function eulerToQuat(roll, pitch, yaw) {
  // Milkshape x,y,z → CA quaternion (sign convention from animationlibrary.py)
  const phi   = roll;
  const theta = -pitch;
  const psi   = -yaw;

  const cx = Math.cos(phi / 2),   sx = Math.sin(phi / 2);
  const cy = Math.cos(theta / 2), sy = Math.sin(theta / 2);
  const cz = Math.cos(psi / 2),   sz = Math.sin(psi / 2);

  const q4 = cx * cy * cz + sx * sy * sz;
  const q1 = sx * cy * cz - cx * sy * sz;
  const q2 = cx * sy * cz + sx * cy * sz;
  const q3 = cx * cy * sz - sx * sy * cz;
  return [q1, q2, q3, q4];
}

// ─────────────────────────────────────────────────────────────────────────────
// Low-level binary helpers
// ─────────────────────────────────────────────────────────────────────────────
function readNullPaddedString(view, offset, len) {
  let s = '';
  for (let i = 0; i < len; i++) {
    const c = view.getUint8(offset + i);
    if (c === 0) break;
    s += String.fromCharCode(c);
  }
  return s;
}

function writeNullPaddedString(view, offset, str, len) {
  for (let i = 0; i < len; i++) {
    view.setUint8(offset + i, i < str.length ? str.charCodeAt(i) : 0);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Parse a .cas binary buffer
// ─────────────────────────────────────────────────────────────────────────────
export function parseCasAnim(buffer) {
  const view = new DataView(buffer);
  const errors = [];
  let off = 0;

  if (buffer.byteLength < HEADER_SIZE + FILESIZE_SECTION) {
    return { errors: ['File too small to be a valid .cas file'] };
  }

  // ── Header (42 bytes) ──────────────────────────────────────────────────────
  const version    = view.getFloat32(off, true); off += 4;
  const h38        = view.getInt32(off, true);   off += 4;
  const h9         = view.getInt32(off, true);   off += 4;
  const h0a        = view.getInt32(off, true);   off += 4;
  const animTime   = view.getFloat32(off, true); off += 4;
  const h1a        = view.getInt32(off, true);   off += 4;
  const h0b        = view.getInt32(off, true);   off += 4;
  const sig1       = [view.getUint8(off), view.getUint8(off+1), view.getUint8(off+2)]; off += 3;
  const h1b        = view.getInt32(off, true);   off += 4;
  const h0c        = view.getInt32(off, true);   off += 4;
  const sig2       = [view.getUint8(off), view.getUint8(off+1), view.getUint8(off+2)]; off += 3;
  // off === 42

  const header = { version, h38, h9, animTime, sig1: [...sig1], sig2: [...sig2] };

  const isOldVersion = version <= 3.02;

  // ── Body size + filler (8 bytes) ──────────────────────────────────────────
  const bodySize  = view.getInt32(off, true); off += 4;
  const bodyFlag  = view.getInt32(off, true); off += 4;

  // Footer is stored at the end; save it as a blob
  const footerSize = buffer.byteLength - HEADER_SIZE - bodySize;
  const footerBytes = footerSize > 0
    ? new Uint8Array(buffer, HEADER_SIZE + bodySize, footerSize)
    : new Uint8Array(0);

  // ── Hierarchy (nBones × int16) ─────────────────────────────────────────────
  const nBones = view.getUint16(off, true); off += 2;
  const hierarchy = [];
  for (let i = 0; i < nBones; i++) {
    hierarchy.push(view.getInt16(off, true));
    off += 2;
  }

  // ── Bone section (nBones × 44 bytes each) ─────────────────────────────────
  const bones = [];
  for (let i = 0; i < nBones; i++) {
    const boneName   = readNullPaddedString(view, off, BONE_NAME_LEN); off += BONE_NAME_LEN;
    const nQuat      = view.getInt16(off, true); off += 2;
    const nAnim      = view.getInt16(off, true); off += 2;
    const quatOffset = view.getInt32(off, true); off += 4;
    const animOffset = view.getInt32(off, true); off += 4;
    const field6     = view.getInt32(off, true); off += 4;
    const nPose      = view.getInt32(off, true); off += 4;
    const field8     = view.getInt32(off, true); off += 4;
    bones.push({ name: boneName, nQuat, nAnim, quatOffset, animOffset, nPose, parentIdx: hierarchy[i] });
  }

  // ── Time ticks ─────────────────────────────────────────────────────────────
  // nFrames derived from first active bone
  const nFrames = bones.find(b => b.nAnim > 0)?.nAnim ?? 0;
  const timeTicks = [];
  for (let i = 0; i < nFrames; i++) {
    timeTicks.push(view.getFloat32(off, true)); off += 4;
  }

  // ── Data section (quat + anim + pose) ─────────────────────────────────────
  const dataStart = off;

  // Read quat data for each bone
  for (let b = 0; b < nBones; b++) {
    const bn = bones[b];
    if (bn.nQuat > 0) {
      const start = dataStart + bn.quatOffset;
      bn.quatFrames = [];
      for (let f = 0; f < bn.nQuat; f++) {
        const q1 = view.getFloat32(start + f * 16 + 0, true);
        const q2 = view.getFloat32(start + f * 16 + 4, true);
        const q3 = view.getFloat32(start + f * 16 + 8, true);
        const q4 = view.getFloat32(start + f * 16 + 12, true);
        const [roll, pitch, yaw] = quatToEuler(q1, q2, q3, q4);
        bn.quatFrames.push({ q1, q2, q3, q4, roll, pitch, yaw });
      }
    } else {
      bn.quatFrames = [];
    }
  }

  // Read anim (translation) data for each bone
  for (let b = 0; b < nBones; b++) {
    const bn = bones[b];
    if (bn.nAnim > 0) {
      // animOffset is from the start of the anim data block
      // anim block starts after quat data
      const totalQuatBytes = bones.reduce((s, bone) => s + bone.nQuat * 16, 0);
      const animBlockStart = dataStart + totalQuatBytes;
      const start = animBlockStart + (bn.animOffset - totalQuatBytes);
      // Alternatively: animOffset in file is absolute from dataStart
      // Let's use animOffset directly from dataStart
      const absStart = dataStart + bn.animOffset;
      bn.animFrames = [];
      for (let f = 0; f < bn.nAnim; f++) {
        const x = view.getFloat32(absStart + f * 12 + 0, true);
        const y = view.getFloat32(absStart + f * 12 + 4, true);
        const z = view.getFloat32(absStart + f * 12 + 8, true);
        bn.animFrames.push({ x, y, z });
      }
    } else {
      bn.animFrames = [];
    }
  }

  // Total data bytes: compute where we are after quat+anim
  const totalQuatBytes = bones.reduce((s, b) => s + b.nQuat * 16, 0);
  const totalAnimBytes = bones.reduce((s, b) => s + b.nAnim * 12, 0);
  let poseOff = dataStart + totalQuatBytes + totalAnimBytes;

  // Read pose data (3 floats per bone, only bones after scene root)
  for (let b = 0; b < nBones; b++) {
    const bn = bones[b];
    if (bn.nPose > 0 && b > 0) { // skip scene root (index 0)
      if (poseOff + 12 <= buffer.byteLength - footerSize) {
        const px = view.getFloat32(poseOff, true); poseOff += 4;
        const py = view.getFloat32(poseOff, true); poseOff += 4;
        const pz = view.getFloat32(poseOff, true); poseOff += 4;
        bn.poseFrame = { x: px, y: py, z: pz };
      }
    } else {
      bn.poseFrame = null;
    }
  }

  return { header, bodySize, bodyFlag, nBones, hierarchy, bones, nFrames, timeTicks, footerBytes, errors };
}

// ─────────────────────────────────────────────────────────────────────────────
// Convert parsed .cas to human-readable text  (like convertcastotxt)
// ─────────────────────────────────────────────────────────────────────────────
export function casAnimToText(parsed) {
  const { header, bodySize, bodyFlag, nBones, hierarchy, bones, nFrames, timeTicks } = parsed;
  const fmt = (v, w = 5, d = 3) => (v >= 0 ? '+' : '') + v.toFixed(d).padStart(w + (v >= 0 ? 1 : 0));

  const lines = [];

  // Header line
  lines.push(
    `${fmt(header.version)} ${header.h38} ${header.h9} 0 ` +
    `${fmt(header.animTime)} 1 0 ` +
    `${header.sig1.join(' ')} 1 0 ${header.sig2.join(' ')}`
  );

  // Body size line
  lines.push(`${bodySize} ${bodyFlag}`);

  // Hierarchy
  lines.push(`${nBones} ${hierarchy.join(' ')}`);

  // Time ticks
  lines.push(`${nFrames} ${timeTicks.map(t => fmt(t)).join(' ')}`);

  // Bone section
  for (const b of bones) {
    lines.push(
      `${b.name.padEnd(16)} ${b.nQuat} ${b.nAnim} ${b.quatOffset} ${b.animOffset} 0 ${b.nPose} 0`
    );
  }

  // Quaternion + Euler data per bone
  for (const b of bones) {
    if (b.nQuat > 0) {
      lines.push(`0 ${b.name} quaternion data`);
      for (const q of b.quatFrames) {
        lines.push(
          `${fmt(q.q1)} ${fmt(q.q2)} ${fmt(q.q3)} ${fmt(q.q4)} ` +
          `${fmt(q.roll)} ${fmt(q.pitch)} ${fmt(q.yaw)}`
        );
      }
    }
  }

  // Animation / translation data per bone
  for (const b of bones) {
    if (b.nAnim > 0) {
      lines.push(`0 ${b.name} animation data and deltas`);
      for (const a of b.animFrames) {
        lines.push(`${fmt(a.x)} ${fmt(a.y)} ${fmt(a.z)}`);
      }
    }
  }

  // Pose data per bone
  for (const b of bones) {
    if (b.poseFrame) {
      lines.push(`0 ${b.name} pose data`);
      lines.push(`${fmt(b.poseFrame.x)} ${fmt(b.poseFrame.y)} ${fmt(b.poseFrame.z)}`);
    }
  }

  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Scale animation translation data (exportskeleton / scale utility)
// ─────────────────────────────────────────────────────────────────────────────
export function scaleCasAnim(parsed, sx, sy, sz) {
  const clone = JSON.parse(JSON.stringify(parsed));
  clone.footerBytes = parsed.footerBytes; // keep original Uint8Array
  for (const b of clone.bones) {
    for (const a of (b.animFrames || [])) {
      a.x *= sx;
      a.y *= sy;
      a.z *= sz;
    }
    if (b.poseFrame) {
      b.poseFrame.x *= sx;
      b.poseFrame.y *= sy;
      b.poseFrame.z *= sz;
    }
  }
  return clone;
}

// ─────────────────────────────────────────────────────────────────────────────
// Encode parsed structure back to binary .cas
// ─────────────────────────────────────────────────────────────────────────────
export function encodeCasAnim(parsed) {
  const { header, bodySize, bodyFlag, nBones, hierarchy, bones, nFrames, timeTicks, footerBytes } = parsed;

  // Compute sizes
  const hierSize  = nBones * 2;
  const boneSize  = nBones * BONE_RECORD_SIZE;
  const tickSize  = nFrames * 4;
  const quatSize  = bones.reduce((s, b) => s + b.nQuat * 16, 0);
  const animSize  = bones.reduce((s, b) => s + b.nAnim * 12, 0);
  const poseSize  = bones.filter((b, i) => i > 0 && b.nPose > 0).length * 12;

  const bodyDataSize = 2 + hierSize + boneSize + tickSize + quatSize + animSize + poseSize;
  const newBodySize  = bodyDataSize + FILESIZE_SECTION; // includes the 8-byte size section

  const totalSize = HEADER_SIZE + newBodySize + (footerBytes ? footerBytes.byteLength : 0);
  const buf = new ArrayBuffer(totalSize);
  const view = new DataView(buf);
  let off = 0;

  // Header
  view.setFloat32(off, header.version, true);  off += 4;
  view.setInt32(off, header.h38, true);        off += 4;
  view.setInt32(off, header.h9, true);         off += 4;
  view.setInt32(off, 0, true);                 off += 4;
  view.setFloat32(off, header.animTime, true); off += 4;
  view.setInt32(off, 1, true);                 off += 4;
  view.setInt32(off, 0, true);                 off += 4;
  header.sig1.forEach(b => { view.setUint8(off++, b); });
  view.setInt32(off, 1, true);                 off += 4;
  view.setInt32(off, 0, true);                 off += 4;
  header.sig2.forEach(b => { view.setUint8(off++, b); });

  // Body size
  view.setInt32(off, newBodySize, true); off += 4;
  view.setInt32(off, bodyFlag, true);    off += 4;

  // nBones + hierarchy
  view.setUint16(off, nBones, true); off += 2;
  for (const h of hierarchy) { view.setInt16(off, h, true); off += 2; }

  // Bone section
  // Recompute offsets
  let quatOff = 0, animOff = 0;
  const activeBones = bones.filter(b => b.nQuat > 0);
  animOff = activeBones.reduce((s, b) => s + b.nQuat * 16, 0);

  let runningQuat = 0, runningAnim = animOff;
  for (let i = 0; i < nBones; i++) {
    const b = bones[i];
    const qOff = b.nQuat > 0 ? runningQuat : 0;
    const aOff = b.nAnim > 0 ? runningAnim : animOff;

    writeNullPaddedString(view, off, b.name, BONE_NAME_LEN); off += BONE_NAME_LEN;
    view.setInt16(off, b.nQuat, true);   off += 2;
    view.setInt16(off, b.nAnim, true);   off += 2;
    view.setInt32(off, qOff, true);      off += 4;
    view.setInt32(off, aOff, true);      off += 4;
    view.setInt32(off, 0, true);         off += 4;
    view.setInt32(off, b.nPose, true);   off += 4;
    view.setInt32(off, 0, true);         off += 4;

    if (b.nQuat > 0) runningQuat += b.nQuat * 16;
    if (b.nAnim > 0) runningAnim += b.nAnim * 12;
  }

  // Time ticks
  for (const t of timeTicks) { view.setFloat32(off, t, true); off += 4; }

  // Quaternion data
  for (const b of bones) {
    for (const q of (b.quatFrames || [])) {
      // Convert Euler back to quaternion
      const [q1, q2, q3, q4] = eulerToQuat(q.roll, q.pitch, q.yaw);
      view.setFloat32(off, q1, true); off += 4;
      view.setFloat32(off, q2, true); off += 4;
      view.setFloat32(off, q3, true); off += 4;
      view.setFloat32(off, q4, true); off += 4;
    }
  }

  // Animation data
  for (const b of bones) {
    for (const a of (b.animFrames || [])) {
      view.setFloat32(off, a.x, true); off += 4;
      view.setFloat32(off, a.y, true); off += 4;
      view.setFloat32(off, a.z, true); off += 4;
    }
  }

  // Pose data
  for (let i = 1; i < nBones; i++) {
    const b = bones[i];
    if (b.nPose > 0 && b.poseFrame) {
      view.setFloat32(off, b.poseFrame.x, true); off += 4;
      view.setFloat32(off, b.poseFrame.y, true); off += 4;
      view.setFloat32(off, b.poseFrame.z, true); off += 4;
    }
  }

  // Footer
  if (footerBytes && footerBytes.byteLength > 0) {
    new Uint8Array(buf, off).set(footerBytes);
  }

  return buf;
}

// ─────────────────────────────────────────────────────────────────────────────
// Parse a .cas text file (like convertcastotxt output) back to parsed structure
// ─────────────────────────────────────────────────────────────────────────────
export function textToCasAnim(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  let li = 0;

  const headerTokens = lines[li++].split(/\s+/);
  const version  = parseFloat(headerTokens[0]);
  const h38      = parseInt(headerTokens[1]);
  const h9       = parseInt(headerTokens[2]);
  const animTime = parseFloat(headerTokens[4]);
  const sig1     = [parseInt(headerTokens[7]), parseInt(headerTokens[8]), parseInt(headerTokens[9])];
  const sig2     = [parseInt(headerTokens[12]), parseInt(headerTokens[13]), parseInt(headerTokens[14])];

  const sizeTokens = lines[li++].split(/\s+/);
  const bodySize = parseInt(sizeTokens[0]);
  const bodyFlag = parseInt(sizeTokens[1]);

  const hierTokens = lines[li++].split(/\s+/);
  const nBones = parseInt(hierTokens[0]);
  const hierarchy = hierTokens.slice(1).map(Number);

  const tickTokens = lines[li++].split(/\s+/);
  const nFrames = parseInt(tickTokens[0]);
  const timeTicks = tickTokens.slice(1).map(Number);

  const bones = [];
  for (let i = 0; i < nBones; i++) {
    const parts = lines[li++].split(/\s+/);
    const name       = parts[0];
    const nQuat      = parseInt(parts[1]);
    const nAnim      = parseInt(parts[2]);
    const quatOffset = parseInt(parts[3]);
    const animOffset = parseInt(parts[4]);
    const nPose      = parseInt(parts[6]);
    const parentIdx  = hierarchy[i];
    bones.push({ name, nQuat, nAnim, quatOffset, animOffset, nPose, parentIdx, quatFrames: [], animFrames: [], poseFrame: null });
  }

  // Parse quaternion data
  for (const b of bones) {
    if (b.nQuat > 0) {
      li++; // skip "0 boneName quaternion data"
      for (let f = 0; f < b.nQuat; f++) {
        const tok = lines[li++].split(/\s+/).map(Number);
        const [q1, q2, q3, q4, roll, pitch, yaw] = tok;
        b.quatFrames.push({ q1, q2, q3, q4, roll, pitch, yaw });
      }
    }
  }

  // Parse animation data
  for (const b of bones) {
    if (b.nAnim > 0) {
      li++; // skip "0 boneName animation data..."
      for (let f = 0; f < b.nAnim; f++) {
        const tok = lines[li++].split(/\s+/).map(Number);
        b.animFrames.push({ x: tok[0], y: tok[1], z: tok[2] });
      }
    }
  }

  // Parse pose data
  for (const b of bones) {
    if (b.poseFrame !== undefined && li < lines.length) {
      const peek = lines[li];
      if (peek && peek.includes('pose data')) {
        li++;
        const tok = lines[li++].split(/\s+/).map(Number);
        b.poseFrame = { x: tok[0], y: tok[1], z: tok[2] };
      }
    }
  }

  const header = { version, h38, h9, animTime, sig1, sig2 };
  return { header, bodySize, bodyFlag, nBones, hierarchy, bones, nFrames, timeTicks, footerBytes: new Uint8Array(0), errors: [] };
}

// ─────────────────────────────────────────────────────────────────────────────
// Survey: extract header info from multiple .cas files
// ─────────────────────────────────────────────────────────────────────────────
export function surveyCasHeader(buffer, filename) {
  if (buffer.byteLength < HEADER_SIZE) return null;
  const view = new DataView(buffer);
  const version  = view.getFloat32(0, true);
  const animTime = view.getFloat32(16, true);
  const sig1 = [view.getUint8(28), view.getUint8(29), view.getUint8(30)];
  const sig2 = [view.getUint8(37), view.getUint8(38), view.getUint8(39)];
  const bodySize = view.getInt32(HEADER_SIZE, true);
  const nBones = view.getUint16(HEADER_SIZE + 8, true);
  return { filename, version: version.toFixed(2), animTime: animTime.toFixed(3), bodySize, nBones, sig1: sig1.join(','), sig2: sig2.join(',') };
}