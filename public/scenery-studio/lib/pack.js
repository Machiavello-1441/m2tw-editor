'use strict';
// Reader for the game's .pack archives (version 3, as in mods\british_isles\packs).
//   "PACK", u32 version, u32 file count n, u32 index size, u32 chunk count, u32 0,
//   (n - 1) x u32 entry offsets, chunk count x u32 compressed chunk sizes,
//   n entries: u32 file offset, u32 first chunk, u32 size, u32 stored size, name\0 padded to 4 bytes.
// Files are cut into 64 KB chunks, each LZO1X-compressed (stored as is when that would not be smaller).
window.Pack = (() => {
  // LZO1X decompression, following the Linux kernel's lzo1x_decompress_safe
  function lzo1x(src, outLen) {
    const out = new Uint8Array(outLen);
    let ip = 0, op = 0, state = 0;
    const lits = (n) => {
      if (op + n > outLen || ip + n > src.length) throw new Error('bad LZO data');
      out.set(src.subarray(ip, ip + n), op); ip += n; op += n;
    };
    const zrun = (base) => { let t = 0; while (src[ip] === 0) { t += 255; ip++; } return t + base + src[ip++]; };
    if (src[0] > 17) { const t = src[ip++] - 17; lits(t); state = t < 4 ? t : 4; }
    for (;;) {
      if (ip >= src.length) throw new Error('LZO data ends early');
      const t = src[ip++];
      let dist, len, next;
      if (t < 16) {
        if (state === 0) { lits((t === 0 ? zrun(15) : t) + 3); state = 4; continue; }
        next = t & 3;
        if (state === 4) { dist = 2049 + (t >> 2) + (src[ip++] << 2); len = 3; } else { dist = 1 + (t >> 2) + (src[ip++] << 2); len = 2; }
      } else if (t >= 64) {
        next = t & 3; dist = 1 + ((t >> 2) & 7) + (src[ip++] << 3); len = (t >> 5) + 1;
      } else if (t >= 32) {
        len = ((t & 31) === 0 ? zrun(31) : t & 31) + 2;
        const v = src[ip] | (src[ip + 1] << 8); ip += 2;
        dist = 1 + (v >> 2); next = v & 3;
      } else {
        len = ((t & 7) === 0 ? zrun(7) : t & 7) + 2;
        const v = src[ip] | (src[ip + 1] << 8); ip += 2;
        dist = ((t & 8) << 11) + (v >> 2); next = v & 3;
        if (dist === 0) break; // end of stream
        dist += 0x4000;
      }
      if (dist > op || op + len > outLen) throw new Error('bad LZO data');
      for (let k = 0; k < len; k++, op++) out[op] = out[op - dist];
      if (next) lits(next);
      state = next;
    }
    return out.subarray(0, op);
  }

  function open(bytes) {
    const d = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const dv = new DataView(d.buffer, d.byteOffset, d.byteLength);
    const u = (o) => dv.getUint32(o, true);
    if (String.fromCharCode(d[0], d[1], d[2], d[3]) !== 'PACK') throw new Error('not a .pack file');
    const n = u(8), nch = u(16), chunkAt = 24 + (n - 1) * 4;
    const chunks = new Uint32Array(nch);
    for (let i = 0; i < nch; i++) chunks[i] = u(chunkAt + i * 4);
    let p = chunkAt + nch * 4;
    const files = [];
    for (let k = 0; k < n; k++) {
      const off = u(p), first = u(p + 4), size = u(p + 8), stored = u(p + 12);
      p += 16;
      let e = p;
      while (d[e]) e++;
      let name = '';
      for (let i = p; i < e; i++) name += String.fromCharCode(d[i]);
      p = (e + 4) & ~3;
      files.push({ name, off, first, size, stored });
    }
    // the bytes of one file
    const read = (f) => {
      if (f.stored === f.size) return d.slice(f.off, f.off + f.size);
      const out = new Uint8Array(f.size);
      let o = f.off, w = 0, c = f.first;
      while (w < f.size) {
        const want = Math.min(65536, f.size - w), cs = chunks[c++];
        const part = cs === want ? d.subarray(o, o + cs) : lzo1x(d.subarray(o, o + cs), want);
        if (part.length !== want) throw new Error(`${f.name}: damaged chunk`);
        out.set(part, w); w += want; o += cs;
      }
      return out;
    };
    return { files, read };
  }
  return { open, lzo1x };
})();
