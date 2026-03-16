// =====================================================================
// M2TW Animation .cas file codec (JavaScript port of KnightErrant's
// animationlibrary.py / animationutilities.py)
// =====================================================================

// ── Euler ↔ Quaternion (GrumpyOldMan's method from animationlibrary.py) ──

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
    sinf = 0.0;
    cosf = 1.0;
  }

  const roll  =  Math.atan2(sinv, cosv);
  const pitch = -Math.atan2(sint, cost);
  const yaw   = -Math.atan2(sinf, cosf);
  return [roll, pitch, yaw]; // Milkshape x, y, z (radians)
}

export function eulerToQuat(x, y, z) {
  // Signs from animationlibrary.py: phi=+x, theta=-y, psi=-z
  const phi   =  x;
  const theta = -y;
  const psi   = -z;

  const cphi = Math.cos(phi),   sphi = Math.sin(phi);
  const ct   = Math.cos(theta), st   = Math.sin(theta);
  const cpsi = Math.cos(psi),   spsi = Math.sin(psi);

  // 321 rotation matrix
  const R11 = cpsi * ct;
  const R12 = cpsi * st * sphi - spsi * cphi;
  const R13 = cpsi * st * cphi + spsi * sphi;
  const R21 = spsi * ct;
  const R22 = spsi * st * sphi + cpsi * cphi;
  const R23 = spsi * st * cphi - cpsi * sphi;
  const R31 = -st;
  const R32 = ct * sphi;
  const R33 = ct * cphi;

  const q4 = 0.5 * Math.sqrt(Math.max(0, 1 + R11 + R22 + R33));
  if (q4 < 0.0001) {
    // Fallback: identity
    return [0, 0, 0, 1];
  }
  const q1 = 0.25 * (R32 - R23) / q4;
  const q2 = 0.25 * (R13 - R31) / q4;
  const q3 = 0.25 * (R21 - R12) / q4;
  return [q1, q2, q3, q4];
}

// ── Parser ────────────────────────────────────────────────────────────

export function parseCasAnim(buffer) {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  let p = 0;

  const rf  = () => { const v = view.getFloat32(p, true); p += 4; return v; };
  const ru  = () => { const v = view.getUint32(p, true);  p += 4; return v; };
  const ri  = () => { const v = view.getInt32(p, true);   p += 4; return v; };
  const rus = () => { const v = view.getUint16(p, true);  p += 2; return v; };
  const rub = () => { const v = bytes[p];                 p += 1; return v; };
  const rs  = (n) => {
    let s = '';
    for (let i = 0; i < n; i++) {
      const c = bytes[p + i];
      if (c === 0) break;
      s += String.fromCharCode(c);
    }
    p += n;
    return s;
  };

  // ── 42-byte header ──
  let version = rf();
  if (Math.abs(version - 3.02) < 0.001) version = 3.02;
  if (Math.abs(version - 3.0)  < 0.001) version = 3.0;
  if (Math.abs(version - 2.23) < 0.001) version = 2.23;

  const int38    = ru();
  const int9     = ru();
  const intZ1    = ru();
  const animTime = rf();
  const intO1    = ru();
  const intZ2    = ru();
  const sig1     = [rub(), rub(), rub()];
  const intO2    = ru();
  const intZ3    = ru();
  const sig2     = [rub(), rub(), rub()];

  // File size sans header/footer
  const filesizeSans = ru();
  const intZeroFS    = ru();

  // ── Hierarchy tree ──
  const isOld = (version === 3.02 || version === 3.0 || version === 2.23);
  const nbones = isOld ? rub() : rus();
  const hierarchy = [];
  for (let i = 0; i < nbones; i++) hierarchy.push(ru());

  // ── Time ticks ──
  const nframes = ru();
  const timeTicks = [];
  for (let i = 0; i < nframes; i++) timeTicks.push(rf());

  // ── Bone section ──
  const bones = [];
  for (let i = 0; i < nbones; i++) {
    const nch = ru();
    const name = rs(nch - 1);
    rub(); // null terminator
    const quatFrames = ru();
    const animFrames = ru();
    const quatOffset = ru();
    const animOffset = ru();
    const zero       = ru();
    let poseFrames = 1;
    if (!isOld) {
      poseFrames = ru(); // typically 1
      rub();             // trailing 0
    }
    bones.push({ name, quatFrames, animFrames, quatOffset, animOffset, zero, poseFrames });
  }

  // ── Quaternion data ──
  const nquatTotal = bones.reduce((s, b) => s + b.quatFrames, 0);
  const quatData = new Float32Array(nquatTotal * 4);
  for (let i = 0; i < nquatTotal * 4; i++) {
    quatData[i] = view.getFloat32(p, true); p += 4;
  }

  // ── Animation / delta data ──
  const nanimTotal = bones.reduce((s, b) => s + b.animFrames, 0);
  const animData = new Float32Array(nanimTotal * 3);
  for (let i = 0; i < nanimTotal * 3; i++) {
    animData[i] = view.getFloat32(p, true); p += 4;
  }

  // ── Pose data ──
  const nposeTotal = bones.reduce((s, b) => s + b.poseFrames, 0);
  const poseData = new Float32Array(nposeTotal * 3);
  for (let i = 0; i < nposeTotal * 3; i++) {
    poseData[i] = view.getFloat32(p, true); p += 4;
  }

  // ── Compute Euler angles (degrees) for display ──
  const eulersDeg = [];
  let qi = 0;
  for (const bone of bones) {
    const boneEulers = [];
    for (let f = 0; f < bone.quatFrames; f++) {
      const q1 = quatData[qi], q2 = quatData[qi+1], q3 = quatData[qi+2], q4 = quatData[qi+3];
      const [ex, ey, ez] = quatToEuler(q1, q2, q3, q4);
      boneEulers.push([
        ex * 180 / Math.PI,
        ey * 180 / Math.PI,
        ez * 180 / Math.PI,
      ]);
      qi += 4;
    }
    eulersDeg.push(boneEulers);
  }

  // ── Footer (raw bytes for round-trip) ──
  const footerBytes = buffer.slice(p);

  return {
    version, animTime, nframes, nbones, isOld,
    hierarchy, timeTicks, bones,
    quatData: Array.from(quatData),
    animData: Array.from(animData),
    poseData: Array.from(poseData),
    eulersDeg,
    footerBytes,
    _hdr: { int38, int9, intZ1, intO1, intZ2, sig1, intO2, intZ3, sig2, intZeroFS },
  };
}

// ── Serializer ────────────────────────────────────────────────────────

export function encodeCasAnim(parsed) {
  const {
    version, animTime, isOld,
    hierarchy, timeTicks, bones,
    quatData, animData, poseData,
    footerBytes, _hdr,
  } = parsed;

  // Compute buffer size
  const hdrSize = 42;
  const fsSansSize = 8;

  const hierSize = (isOld ? 1 : 2) + hierarchy.length * 4;

  const timeSize = 4 + timeTicks.length * 4;

  let boneSecSize = 0;
  for (const b of bones) {
    boneSecSize += 4 + b.name.length + 1 + 5 * 4;
    if (!isOld) boneSecSize += 4 + 1;
  }

  const quatSize = quatData.length * 4;
  const animSize = animData.length * 4;
  const poseSize = poseData.length * 4;

  const totalDataSize = hdrSize + fsSansSize + hierSize + timeSize + boneSecSize + quatSize + animSize + poseSize;
  const totalSize = totalDataSize + (footerBytes ? footerBytes.byteLength : 0);

  const buf = new ArrayBuffer(totalSize);
  const view = new DataView(buf);
  const bytes = new Uint8Array(buf);
  let p = 0;

  const wf  = (v) => { view.setFloat32(p, v, true); p += 4; };
  const wu  = (v) => { view.setUint32(p, v, true);  p += 4; };
  const wi  = (v) => { view.setInt32(p, v, true);   p += 4; };
  const wus = (v) => { view.setUint16(p, v, true);  p += 2; };
  const wub = (v) => { bytes[p] = v;                 p += 1; };
  const ws  = (s) => { for (let i = 0; i < s.length; i++) bytes[p + i] = s.charCodeAt(i); p += s.length; };

  // Header
  wf(version);
  wu(_hdr.int38);
  wu(_hdr.int9);
  wu(_hdr.intZ1);
  wf(animTime);
  wu(_hdr.intO1);
  wu(_hdr.intZ2);
  wub(_hdr.sig1[0]); wub(_hdr.sig1[1]); wub(_hdr.sig1[2]);
  wu(_hdr.intO2);
  wu(_hdr.intZ3);
  wub(_hdr.sig2[0]); wub(_hdr.sig2[1]); wub(_hdr.sig2[2]);

  // Compute filesizeSans (bytes between header and footer)
  const filesizeSans = fsSansSize + hierSize + timeSize + boneSecSize + quatSize + animSize + poseSize;
  wu(filesizeSans);
  wu(_hdr.intZeroFS);

  // Hierarchy
  if (isOld) { wub(hierarchy.length); }
  else        { wus(hierarchy.length); }
  for (const h of hierarchy) wu(h);

  // Time ticks
  wu(timeTicks.length);
  for (const t of timeTicks) wf(t);

  // Bone section
  for (const b of bones) {
    wu(b.name.length + 1);
    ws(b.name);
    wub(0); // null terminator
    wu(b.quatFrames);
    wu(b.animFrames);
    wu(b.quatOffset);
    wu(b.animOffset);
    wu(b.zero);
    if (!isOld) {
      wu(b.poseFrames);
      wub(0);
    }
  }

  // Quaternion data
  for (const v of quatData) wf(v);

  // Animation data
  for (const v of animData) wf(v);

  // Pose data
  for (const v of poseData) wf(v);

  // Footer (raw bytes)
  if (footerBytes && footerBytes.byteLength > 0) {
    const fb = new Uint8Array(footerBytes);
    bytes.set(fb, p);
  }

  return buf;
}

// ── Scale animation data (exportskeleton equivalent) ─────────────────
// Scales the x, y, z values in animData across all bones.

export function scaleAnimData(parsed, sx, sy, sz) {
  const newAnimData = [...parsed.animData];
  for (let i = 0; i < newAnimData.length; i += 3) {
    newAnimData[i]     *= sx;
    newAnimData[i + 1] *= sy;
    newAnimData[i + 2] *= sz;
  }
  return { ...parsed, animData: newAnimData };
}

// ── Apply edited Euler angles back to quaternion data ─────────────────
// eulersDeg: same structure as parsed.eulersDeg but with user edits

export function applyEulersToQuats(parsed, eulersDeg) {
  const newQuat = [];
  for (let bi = 0; bi < parsed.bones.length; bi++) {
    const boneEulers = eulersDeg[bi];
    for (let f = 0; f < boneEulers.length; f++) {
      const [xDeg, yDeg, zDeg] = boneEulers[f];
      const [q1, q2, q3, q4] = eulerToQuat(
        xDeg * Math.PI / 180,
        yDeg * Math.PI / 180,
        zDeg * Math.PI / 180
      );
      newQuat.push(q1, q2, q3, q4);
    }
  }
  return { ...parsed, quatData: newQuat };
}

// ── Convert parsed .cas to human-readable text (convertcastotxt) ──────

export function casAnimToText(parsed) {
  const lines = [];
  const { version, animTime, nframes, nbones, hierarchy, timeTicks, bones, quatData, animData, poseData, eulersDeg } = parsed;

  // Header line
  lines.push(`version=${version.toFixed(3)}  animTime=${animTime.toFixed(3)}  bones=${nbones}`);

  // Hierarchy
  lines.push(`hierarchy: ${hierarchy.join(' ')}`);

  // Time ticks
  lines.push(`frames=${nframes}  ticks: ${timeTicks.map(t => t.toFixed(3)).join('  ')}`);

  // Bone section header
  lines.push('');
  lines.push('BONE SECTION:');
  lines.push('bone_name            quatFrames  animFrames  quatOffset  animOffset');
  for (const b of bones) {
    lines.push(`  ${b.name.padEnd(20)} ${String(b.quatFrames).padEnd(11)} ${String(b.animFrames).padEnd(11)} ${String(b.quatOffset).padEnd(11)} ${b.animOffset}`);
  }

  // Quaternion / Euler data
  lines.push('');
  lines.push('QUATERNION DATA (q1 q2 q3 q4  x_deg y_deg z_deg):');
  let qi = 0;
  for (let bi = 0; bi < bones.length; bi++) {
    const b = bones[bi];
    if (b.quatFrames === 0) continue;
    lines.push(`  [${bi - 1}] ${b.name}:`);
    for (let f = 0; f < b.quatFrames; f++) {
      const q1 = parsed.quatData[qi], q2 = parsed.quatData[qi+1], q3 = parsed.quatData[qi+2], q4 = parsed.quatData[qi+3];
      const [xd, yd, zd] = eulersDeg[bi][f];
      lines.push(`    ${q1.toFixed(10)}  ${q2.toFixed(10)}  ${q3.toFixed(10)}  ${q4.toFixed(10)}    ${xd.toFixed(6)}  ${yd.toFixed(6)}  ${zd.toFixed(6)}`);
      qi += 4;
    }
  }

  // Animation / delta data
  lines.push('');
  lines.push('ANIMATION DATA (x y z per frame):');
  let ai = 0;
  for (let bi = 0; bi < bones.length; bi++) {
    const b = bones[bi];
    if (b.animFrames === 0) continue;
    lines.push(`  [${bi - 1}] ${b.name}:`);
    for (let f = 0; f < b.animFrames; f++) {
      lines.push(`    ${parsed.animData[ai].toFixed(10)}  ${parsed.animData[ai+1].toFixed(10)}  ${parsed.animData[ai+2].toFixed(10)}`);
      ai += 3;
    }
  }

  // Pose data
  lines.push('');
  lines.push('POSE DATA (rest pose x y z per bone):');
  let pi = 0;
  for (let bi = 0; bi < bones.length; bi++) {
    const b = bones[bi];
    for (let f = 0; f < b.poseFrames; f++) {
      lines.push(`  ${b.name}: ${parsed.poseData[pi].toFixed(10)}  ${parsed.poseData[pi+1].toFixed(10)}  ${parsed.poseData[pi+2].toFixed(10)}`);
      pi += 3;
    }
  }

  return lines.join('\n');
}