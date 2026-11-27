'use strict';
// Image codecs: TGA read/write, DDS read (DXT1/3/5 and uncompressed), anything else via the browser.
// All decoders return { width, height, data } with data as top-down RGBA bytes.
(function () {
  function decodeTGA(bytes) {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const idLength = bytes[0];
    const cmapType = bytes[1];
    const type = bytes[2];
    const cmapFirst = dv.getUint16(3, true);
    const cmapLen = dv.getUint16(5, true);
    const cmapBits = bytes[7];
    const width = dv.getUint16(12, true);
    const height = dv.getUint16(14, true);
    const bpp = bytes[16];
    const desc = bytes[17];
    const topDown = (desc & 0x20) !== 0;
    const rightToLeft = (desc & 0x10) !== 0;
    let p = 18 + idLength;
    let cmap = null;
    if (cmapType === 1) {
      const eb = Math.ceil(cmapBits / 8);
      cmap = new Uint8Array(cmapLen * 4);
      for (let i = 0; i < cmapLen; i++) {
        readPixel(bytes, p + i * eb, cmapBits, cmap, i * 4, null);
      }
      p += cmapLen * eb;
    }
    const n = width * height;
    const out = new Uint8Array(n * 4);
    const pixBytes = Math.ceil(bpp / 8);
    const rle = type >= 9;
    const base = type & 7; // 1 colormapped, 2 truecolor, 3 gray
    let i = 0;
    const put = (src, at) => {
      // decode pixel at bytes[src] into out at pixel index at
      const o = at * 4;
      if (base === 1) {
        const idx = (pixBytes === 2 ? bytes[src] | (bytes[src + 1] << 8) : bytes[src]) - cmapFirst;
        out[o] = cmap[idx * 4]; out[o + 1] = cmap[idx * 4 + 1]; out[o + 2] = cmap[idx * 4 + 2]; out[o + 3] = cmap[idx * 4 + 3];
      } else if (base === 3) {
        out[o] = out[o + 1] = out[o + 2] = bytes[src];
        out[o + 3] = bpp === 16 ? bytes[src + 1] : 255;
      } else {
        readPixel(bytes, src, bpp, out, o, null);
      }
    };
    if (!rle) {
      for (; i < n; i++) put(p + i * pixBytes, i);
    } else {
      while (i < n && p < bytes.length) {
        const h = bytes[p++];
        const count = (h & 0x7f) + 1;
        if (h & 0x80) {
          for (let k = 0; k < count && i < n; k++) put(p, i++);
          p += pixBytes;
        } else {
          for (let k = 0; k < count && i < n; k++) { put(p, i++); p += pixBytes; }
        }
      }
    }
    // reorder to top-down, left-to-right
    if (!topDown || rightToLeft) {
      const fixed = new Uint8Array(n * 4);
      for (let y = 0; y < height; y++) {
        const sy = topDown ? y : height - 1 - y;
        for (let x = 0; x < width; x++) {
          const sx = rightToLeft ? width - 1 - x : x;
          const s = (sy * width + sx) * 4, d = (y * width + x) * 4;
          fixed[d] = out[s]; fixed[d + 1] = out[s + 1]; fixed[d + 2] = out[s + 2]; fixed[d + 3] = out[s + 3];
        }
      }
      return { width, height, data: fixed, tga: { type, bpp, desc, topDown } };
    }
    return { width, height, data: out, tga: { type, bpp, desc, topDown } };
  }

  function readPixel(b, s, bpp, out, o) {
    if (bpp === 32) { out[o] = b[s + 2]; out[o + 1] = b[s + 1]; out[o + 2] = b[s]; out[o + 3] = b[s + 3]; }
    else if (bpp === 24) { out[o] = b[s + 2]; out[o + 1] = b[s + 1]; out[o + 2] = b[s]; out[o + 3] = 255; }
    else if (bpp === 16 || bpp === 15) {
      const v = b[s] | (b[s + 1] << 8);
      out[o] = ((v >> 10) & 31) * 255 / 31; out[o + 1] = ((v >> 5) & 31) * 255 / 31; out[o + 2] = (v & 31) * 255 / 31;
      out[o + 3] = bpp === 16 && !(v & 0x8000) ? 255 : 255;
    } else { out[o] = out[o + 1] = out[o + 2] = b[s]; out[o + 3] = 255; }
  }

  // Encode uncompressed truecolor TGA. bpp 24 or 32. bottomUp=true writes the classic bottom-left origin.
  function encodeTGA(width, height, rgba, bpp = 24, bottomUp = true) {
    const pb = bpp / 8;
    const out = new Uint8Array(18 + width * height * pb);
    out[2] = 2;
    out[12] = width & 255; out[13] = width >> 8;
    out[14] = height & 255; out[15] = height >> 8;
    out[16] = bpp;
    out[17] = (bpp === 32 ? 8 : 0) | (bottomUp ? 0 : 0x20);
    let p = 18;
    for (let yy = 0; yy < height; yy++) {
      const y = bottomUp ? height - 1 - yy : yy;
      let s = y * width * 4;
      for (let x = 0; x < width; x++, s += 4) {
        out[p++] = rgba[s + 2]; out[p++] = rgba[s + 1]; out[p++] = rgba[s];
        if (pb === 4) out[p++] = rgba[s + 3];
      }
    }
    return out;
  }

  // ---------- DDS ----------
  function decodeDDS(bytes) {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (dv.getUint32(0, true) !== 0x20534444) throw new Error('Not a DDS file');
    const height = dv.getUint32(12, true);
    const width = dv.getUint32(16, true);
    const pfFlags = dv.getUint32(80, true);
    const fourCC = String.fromCharCode(bytes[84], bytes[85], bytes[86], bytes[87]);
    const rgbBits = dv.getUint32(88, true);
    const rMask = dv.getUint32(92, true), gMask = dv.getUint32(96, true), bMask = dv.getUint32(100, true), aMask = dv.getUint32(104, true);
    let p = 128;
    const out = new Uint8Array(width * height * 4);
    if (pfFlags & 4) {
      const kind = fourCC;
      if (kind !== 'DXT1' && kind !== 'DXT3' && kind !== 'DXT5') throw new Error('Unsupported DDS format ' + kind);
      const blockBytes = kind === 'DXT1' ? 8 : 16;
      const bw = Math.max(1, (width + 3) >> 2), bh = Math.max(1, (height + 3) >> 2);
      const col = new Uint8Array(16 * 4);
      const alpha = new Uint8Array(16);
      for (let by = 0; by < bh; by++) {
        for (let bx = 0; bx < bw; bx++, p += blockBytes) {
          let cp = p;
          alpha.fill(255);
          if (kind === 'DXT3') {
            for (let k = 0; k < 8; k++) { const v = bytes[p + k]; alpha[k * 2] = (v & 15) * 17; alpha[k * 2 + 1] = (v >> 4) * 17; }
            cp = p + 8;
          } else if (kind === 'DXT5') {
            const a0 = bytes[p], a1 = bytes[p + 1];
            const pal = [a0, a1];
            if (a0 > a1) for (let k = 1; k < 7; k++) pal.push(((7 - k) * a0 + k * a1) / 7 | 0);
            else { for (let k = 1; k < 5; k++) pal.push(((5 - k) * a0 + k * a1) / 5 | 0); pal.push(0, 255); }
            let bits = 0n;
            for (let k = 0; k < 6; k++) bits |= BigInt(bytes[p + 2 + k]) << BigInt(8 * k);
            for (let k = 0; k < 16; k++) alpha[k] = pal[Number((bits >> BigInt(3 * k)) & 7n)];
            cp = p + 8;
          }
          decodeColorBlock(bytes, cp, col, kind === 'DXT1');
          for (let py = 0; py < 4; py++) {
            const y = by * 4 + py; if (y >= height) continue;
            for (let px = 0; px < 4; px++) {
              const x = bx * 4 + px; if (x >= width) continue;
              const k = py * 4 + px, o = (y * width + x) * 4;
              out[o] = col[k * 4]; out[o + 1] = col[k * 4 + 1]; out[o + 2] = col[k * 4 + 2];
              out[o + 3] = kind === 'DXT1' ? col[k * 4 + 3] : alpha[k];
            }
          }
        }
      }
    } else {
      const pb = rgbBits / 8;
      const sh = (m) => { if (!m) return [0, 0]; let s = 0; while (!((m >>> s) & 1)) s++; let w = 0; while ((m >>> (s + w)) & 1) w++; return [s, w]; };
      const [rs, rw] = sh(rMask), [gs, gw] = sh(gMask), [bs, bw2] = sh(bMask), [as, aw] = sh(aMask);
      const sc = (v, w) => (w ? Math.round(v * 255 / ((1 << w) - 1)) : 255);
      for (let i = 0; i < width * height; i++, p += pb) {
        let v = 0;
        for (let k = 0; k < pb; k++) v |= bytes[p + k] << (8 * k);
        v >>>= 0;
        out[i * 4] = sc((v >>> rs) & ((1 << rw) - 1), rw);
        out[i * 4 + 1] = sc((v >>> gs) & ((1 << gw) - 1), gw);
        out[i * 4 + 2] = sc((v >>> bs) & ((1 << bw2) - 1), bw2);
        out[i * 4 + 3] = (pfFlags & 1) && aw ? sc((v >>> as) & ((1 << aw) - 1), aw) : 255;
      }
    }
    return { width, height, data: out };
  }

  function decodeColorBlock(b, p, out, dxt1) {
    const c0 = b[p] | (b[p + 1] << 8), c1 = b[p + 2] | (b[p + 3] << 8);
    const pal = [rgb565(c0), rgb565(c1)];
    if (c0 > c1 || !dxt1) {
      pal.push(mix(pal[0], pal[1], 2, 1, 3), mix(pal[0], pal[1], 1, 2, 3));
    } else {
      pal.push(mix(pal[0], pal[1], 1, 1, 2), [0, 0, 0, 0]);
    }
    const bits = (b[p + 4] | (b[p + 5] << 8) | (b[p + 6] << 16) | (b[p + 7] << 24)) >>> 0;
    for (let k = 0; k < 16; k++) {
      const c = pal[(bits >>> (2 * k)) & 3];
      out[k * 4] = c[0]; out[k * 4 + 1] = c[1]; out[k * 4 + 2] = c[2]; out[k * 4 + 3] = c[3];
    }
  }
  const rgb565 = (v) => [((v >> 11) & 31) * 255 / 31 | 0, ((v >> 5) & 63) * 255 / 63 | 0, (v & 31) * 255 / 31 | 0, 255];
  const mix = (a, b, wa, wb, d) => [(a[0] * wa + b[0] * wb) / d | 0, (a[1] * wa + b[1] * wb) / d | 0, (a[2] * wa + b[2] * wb) / d | 0, 255];

  async function decodeBrowser(bytes) {
    const bmp = await createImageBitmap(new Blob([bytes]));
    const c = new OffscreenCanvas(bmp.width, bmp.height);
    const g = c.getContext('2d');
    g.drawImage(bmp, 0, 0);
    const id = g.getImageData(0, 0, bmp.width, bmp.height);
    return { width: bmp.width, height: bmp.height, data: new Uint8Array(id.data.buffer) };
  }

  async function decodeAny(bytes, name = '') {
    const lower = name.toLowerCase();
    if (bytes[0] === 0x44 && bytes[1] === 0x44 && bytes[2] === 0x53 && bytes[3] === 0x20) return decodeDDS(bytes);
    if (lower.endsWith('.tga')) return decodeTGA(bytes);
    try { return await decodeBrowser(bytes); } catch (e) {
      return decodeTGA(bytes); // extensionless TGA
    }
  }

  // Resize RGBA image to size x size with good filtering, returns ImageData-compatible bytes.
  async function resizeRGBA(img, w, h) {
    if (img.width === w && img.height === h) return img.data;
    const id = new ImageData(new Uint8ClampedArray(img.data.buffer, img.data.byteOffset, img.width * img.height * 4), img.width, img.height);
    const bmp = await createImageBitmap(id, { resizeWidth: w, resizeHeight: h, resizeQuality: 'high', premultiplyAlpha: 'none' });
    const c = new OffscreenCanvas(w, h);
    const g = c.getContext('2d');
    g.drawImage(bmp, 0, 0);
    return new Uint8Array(g.getImageData(0, 0, w, h).data.buffer);
  }

  // Thumbnail data URL from RGBA image (alpha ignored so the artist sees colour).
  function thumbnail(img, size = 64) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const src = document.createElement('canvas');
    src.width = img.width; src.height = img.height;
    const opaque = new Uint8ClampedArray(img.data);
    for (let i = 3; i < opaque.length; i += 4) opaque[i] = 255;
    src.getContext('2d').putImageData(new ImageData(opaque, img.width, img.height), 0, 0);
    const g = c.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.drawImage(src, 0, 0, size, size);
    return c.toDataURL('image/png');
  }

  // ---------- 16-bit greyscale PNG (map_heights_ex.png) ----------
  const PNG_SIG = [137, 80, 78, 71, 13, 10, 26, 10];
  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
  })();
  function crc32(bytes, start, end) {
    let c = 0xffffffff;
    for (let i = start; i < end; i++) c = CRC_TABLE[(c ^ bytes[i]) & 255] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }
  async function streamBytes(bytes, stream) {
    const out = await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer();
    return new Uint8Array(out);
  }
  function pngChunks(bytes) {
    for (let i = 0; i < 8; i++) if (bytes[i] !== PNG_SIG[i]) throw new Error('Not a PNG file');
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const chunks = [];
    for (let p = 8; p + 8 <= bytes.length;) {
      const len = dv.getUint32(p), type = String.fromCharCode(bytes[p + 4], bytes[p + 5], bytes[p + 6], bytes[p + 7]);
      chunks.push({ type, data: bytes.subarray(p + 8, p + 8 + len), raw: bytes.subarray(p, p + 12 + len) });
      p += 12 + len;
      if (type === 'IEND') break;
    }
    return chunks;
  }
  // -> { width, height, data: Uint16Array top-down, chunks } ; only 16-bit greyscale, not interlaced
  async function decodePNG16(bytes) {
    const chunks = pngChunks(bytes);
    const ih = chunks.find((c) => c.type === 'IHDR');
    const dv = new DataView(ih.data.buffer, ih.data.byteOffset, ih.data.byteLength);
    const width = dv.getUint32(0), height = dv.getUint32(4), depth = ih.data[8], colour = ih.data[9], interlace = ih.data[12];
    if (depth !== 16 || colour !== 0 || interlace !== 0) throw new Error('Not a 16-bit greyscale PNG');
    const idat = chunks.filter((c) => c.type === 'IDAT');
    const all = new Uint8Array(idat.reduce((n, c) => n + c.data.length, 0));
    let o = 0; for (const c of idat) { all.set(c.data, o); o += c.data.length; }
    const raw = await streamBytes(all, new DecompressionStream('deflate'));
    const stride = width * 2, bpp = 2;
    const out = new Uint16Array(width * height);
    let prev = new Uint8Array(stride), cur = new Uint8Array(stride);
    for (let y = 0; y < height; y++) {
      const base = y * (stride + 1), f = raw[base];
      for (let x = 0; x < stride; x++) {
        const v = raw[base + 1 + x], a = x >= bpp ? cur[x - bpp] : 0, b = prev[x], c = x >= bpp ? prev[x - bpp] : 0;
        let r;
        if (f === 0) r = v;
        else if (f === 1) r = v + a;
        else if (f === 2) r = v + b;
        else if (f === 3) r = v + ((a + b) >> 1);
        else { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); r = v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c); }
        cur[x] = r & 255;
      }
      for (let x = 0; x < width; x++) out[y * width + x] = (cur[x * 2] << 8) | cur[x * 2 + 1];
      [prev, cur] = [cur, prev];
    }
    return { width, height, data: out, chunks };
  }
  // Writes a 16-bit greyscale PNG. keepChunks: chunks of the original file to carry over (gAMA, pHYs, tEXt…).
  async function encodePNG16(width, height, data, keepChunks = []) {
    const stride = width * 2;
    const raw = new Uint8Array(height * (stride + 1));
    for (let y = 0; y < height; y++) {
      const base = y * (stride + 1);
      raw[base] = 2; // "up" filter
      for (let x = 0; x < width; x++) {
        const v = data[y * width + x], u = y ? data[(y - 1) * width + x] : 0;
        raw[base + 1 + x * 2] = ((v >> 8) - (u >> 8)) & 255;
        raw[base + 2 + x * 2] = ((v & 255) - (u & 255)) & 255;
      }
    }
    const z = await streamBytes(raw, new CompressionStream('deflate'));
    const parts = [new Uint8Array(PNG_SIG)];
    const chunk = (type, body) => {
      const c = new Uint8Array(12 + body.length);
      const dv = new DataView(c.buffer);
      dv.setUint32(0, body.length);
      for (let i = 0; i < 4; i++) c[4 + i] = type.charCodeAt(i);
      c.set(body, 8);
      dv.setUint32(8 + body.length, crc32(c, 4, 8 + body.length));
      parts.push(c);
    };
    const ih = new Uint8Array(13), dv = new DataView(ih.buffer);
    dv.setUint32(0, width); dv.setUint32(4, height); ih[8] = 16; ih[9] = 0;
    chunk('IHDR', ih);
    for (const c of keepChunks) if (!['IHDR', 'IDAT', 'IEND'].includes(c.type)) parts.push(c.raw);
    chunk('IDAT', z);
    chunk('IEND', new Uint8Array(0));
    const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let o = 0; for (const p of parts) { out.set(p, o); o += p.length; }
    return out;
  }

  // ---------- colour changes that keep a file's own format ----------
  // fn(r, g, b) -> [r, g, b], 0..255. A DXT1/3/5 DDS keeps its format, size, mip maps and alpha: only the
  // two end colours of each block change (the in-between colours follow them), every mip level included.
  // DXT colour block from 16 pixels (rgb 0..255 in px, 48 numbers); clear[k] marks a DXT1 pixel left transparent.
  // Endpoints along the colours' main axis, refined by least squares, then the nearest palette entry per pixel.
  function encodeColorBlock(px, clear, dxt1, out, o) {
    const three = dxt1 && clear.some(Boolean); // DXT1 with see-through pixels: 3 colours + transparent
    const use = [];
    for (let k = 0; k < 16; k++) if (!clear[k]) use.push(k);
    // nearest 5/6-bit value as the decoder expands it (v * 255 / max, rounded down)
    const q = (v, m) => { let a = Math.max(0, Math.min(m, Math.floor(v * m / 255))); const b = Math.min(m, a + 1); return Math.abs((b * 255 / m | 0) - v) < Math.abs((a * 255 / m | 0) - v) ? b : a; };
    const q565 = (c) => (q(c[0], 31) << 11) | (q(c[1], 63) << 5) | q(c[2], 31);
    const put = (c0, c1, bits) => { out[o] = c0 & 255; out[o + 1] = c0 >> 8; out[o + 2] = c1 & 255; out[o + 3] = c1 >> 8; out[o + 4] = bits & 255; out[o + 5] = (bits >>> 8) & 255; out[o + 6] = (bits >>> 16) & 255; out[o + 7] = bits >>> 24; };
    if (!use.length) { put(0, 0xffff, 0xffffffff); return; }
    // palette for quantised ends, as the decoder builds it
    const palOf = (c0, c1, three) => { const a = rgb565(c0), b = rgb565(c1); return three ? [a, b, mix(a, b, 1, 1, 2)] : [a, b, mix(a, b, 2, 1, 3), mix(a, b, 1, 2, 3)]; };
    const fit = (c0, c1, three) => {
      const pal = palOf(c0, c1, three);
      let bits = 0, err = 0;
      const idx = new Array(16).fill(3);
      for (const k of use) {
        let best = 0, bd = Infinity;
        for (let j = 0; j < pal.length; j++) {
          const dr = px[k * 3] - pal[j][0], dg = px[k * 3 + 1] - pal[j][1], db = px[k * 3 + 2] - pal[j][2];
          const d = dr * dr * 0.299 + dg * dg * 0.587 + db * db * 0.114;
          if (d < bd) { bd = d; best = j; }
        }
        idx[k] = best; err += bd;
      }
      for (let k = 0; k < 16; k++) bits |= idx[k] << (2 * k);
      return { bits: bits >>> 0, err, idx };
    };
    // main axis of the colours
    const mean = [0, 0, 0];
    for (const k of use) for (let c = 0; c < 3; c++) mean[c] += px[k * 3 + c] / use.length;
    const cov = [0, 0, 0, 0, 0, 0];
    for (const k of use) {
      const r = px[k * 3] - mean[0], g = px[k * 3 + 1] - mean[1], b = px[k * 3 + 2] - mean[2];
      cov[0] += r * r; cov[1] += r * g; cov[2] += r * b; cov[3] += g * g; cov[4] += g * b; cov[5] += b * b;
    }
    let ax = [1, 1, 1];
    for (let it = 0; it < 8; it++) {
      const n = [cov[0] * ax[0] + cov[1] * ax[1] + cov[2] * ax[2], cov[1] * ax[0] + cov[3] * ax[1] + cov[4] * ax[2], cov[2] * ax[0] + cov[4] * ax[1] + cov[5] * ax[2]];
      const l = Math.hypot(n[0], n[1], n[2]);
      if (l < 1e-9) break;
      ax = [n[0] / l, n[1] / l, n[2] / l];
    }
    let lo = Infinity, hi = -Infinity;
    for (const k of use) { const t = (px[k * 3] - mean[0]) * ax[0] + (px[k * 3 + 1] - mean[1]) * ax[1] + (px[k * 3 + 2] - mean[2]) * ax[2]; lo = Math.min(lo, t); hi = Math.max(hi, t); }
    let A = mean.map((m, c) => m + ax[c] * hi), B = mean.map((m, c) => m + ax[c] * lo);
    // weights of end A per palette index
    const wA = three ? [1, 0, 0.5] : [1, 0, 2 / 3, 1 / 3];
    let best = null;
    const tryEnds = (A, B) => {
      let c0 = q565(A), c1 = q565(B);
      let r;
      if (three) { if (c0 > c1) [c0, c1] = [c1, c0]; r = fit(c0, c1, true); }
      else {
        if (c0 < c1) [c0, c1] = [c1, c0];
        if (c0 === c1) { if (c0 > 0) c1 = c0 - 1; else c0 = 1; } // keep the four-colour mode (c0 > c1)
        r = fit(c0, c1, false);
      }
      if (!best || r.err < best.err) best = { c0, c1, ...r };
      return r;
    };
    for (let it = 0; it < 3; it++) {
      const r = tryEnds(A, B);
      // least squares: x = a A + (1 - a) B over the pixels, a by their palette index
      let aa = 0, ab = 0, bb = 0;
      const xa = [0, 0, 0], xb = [0, 0, 0];
      const swapped = three ? q565(A) > q565(B) : q565(A) < q565(B);
      for (const k of use) {
        let a = wA[r.idx[k]];
        if (swapped) a = 1 - a;
        aa += a * a; ab += a * (1 - a); bb += (1 - a) * (1 - a);
        for (let c = 0; c < 3; c++) { xa[c] += a * px[k * 3 + c]; xb[c] += (1 - a) * px[k * 3 + c]; }
      }
      const det = aa * bb - ab * ab;
      if (Math.abs(det) < 1e-9) break;
      A = [0, 1, 2].map((c) => (xa[c] * bb - xb[c] * ab) / det);
      B = [0, 1, 2].map((c) => (xb[c] * aa - xa[c] * ab) / det);
    }
    tryEnds(A, B);
    // nudge each end's channels by one step while that lowers the error
    const step = [2048, 32, 1], lim = [31 << 11, 63 << 5, 31];
    for (let round = 0; round < 2; round++) {
      let better = false;
      for (const e of [0, 1]) for (let c = 0; c < 3; c++) for (const d of [-1, 1]) {
        let c0 = best.c0, c1 = best.c1;
        const v = e ? c1 : c0, ch = v & lim[c], nv = ch + d * step[c];
        if (nv < 0 || nv > lim[c]) continue;
        if (e) c1 = (c1 & ~lim[c]) | nv; else c0 = (c0 & ~lim[c]) | nv;
        if (three ? c0 > c1 : c0 <= c1) continue;
        const r = fit(c0, c1, three);
        if (r.err < best.err - 1e-9) { best = { c0, c1, ...r }; better = true; }
      }
      if (!better) break;
    }
    let bits = best.bits;
    if (three) { for (let k = 0; k < 16; k++) if (clear[k]) bits = (bits & ~(3 << (2 * k))) | (3 << (2 * k)); bits >>>= 0; }
    put(best.c0, best.c1, bits);
  }

  // Applies fn(r, g, b) -> [r, g, b] to a DDS. Compressed (DXT1/3/5): every block of every mip level is decoded,
  // changed pixel by pixel and compressed again (alpha untouched), so the file holds the changed picture to
  // within DXT's own rounding, in the same format and size.
  function adjustDDS(bytes, fn) {
    const out = new Uint8Array(bytes);
    const dv = new DataView(out.buffer);
    if (dv.getUint32(0, true) !== 0x20534444) throw new Error('Not a DDS file');
    const pfFlags = dv.getUint32(80, true);
    const fourCC = String.fromCharCode(out[84], out[85], out[86], out[87]);
    if (pfFlags & 4) {
      if (fourCC !== 'DXT1' && fourCC !== 'DXT3' && fourCC !== 'DXT5') throw new Error('Unsupported DDS format ' + fourCC);
      const dxt1 = fourCC === 'DXT1', bb = dxt1 ? 8 : 16, off = dxt1 ? 0 : 8;
      const col = new Uint8Array(64), px = new Float64Array(48), clear = new Array(16);
      for (let p = 128; p + bb <= out.length; p += bb) {
        const q = p + off;
        decodeColorBlock(out, q, col, dxt1);
        for (let k = 0; k < 16; k++) {
          clear[k] = dxt1 && col[k * 4 + 3] === 0;
          const c = clear[k] ? [0, 0, 0] : fn(col[k * 4], col[k * 4 + 1], col[k * 4 + 2]);
          px[k * 3] = c[0]; px[k * 3 + 1] = c[1]; px[k * 3 + 2] = c[2];
        }
        encodeColorBlock(px, clear, dxt1, out, q);
      }
      return out;
    }
    const pb = dv.getUint32(88, true) / 8;
    const masks = [92, 96, 100].map((o) => dv.getUint32(o, true));
    if (!(pfFlags & 0x40) || (pb !== 3 && pb !== 4) || masks.some((m) => ![0xff, 0xff00, 0xff0000].includes(m))) throw new Error('Unsupported DDS pixel format');
    const at = masks.map((m) => (m === 0xff ? 0 : m === 0xff00 ? 1 : 2));
    for (let p = 128; p + pb <= out.length; p += pb) {
      const c = fn(out[p + at[0]], out[p + at[1]], out[p + at[2]]);
      out[p + at[0]] = c[0]; out[p + at[1]] = c[1]; out[p + at[2]] = c[2];
    }
    return out;
  }
  // DXT5 alpha block from 16 alpha values: the two ends are the block's lowest and highest alpha, 8-step palette
  function encodeAlphaBlock(a, out, o) {
    let lo = 255, hi = 0;
    for (let k = 0; k < 16; k++) { lo = Math.min(lo, a[k]); hi = Math.max(hi, a[k]); }
    out[o] = hi; out[o + 1] = lo;
    const pal = [hi, lo];
    for (let k = 1; k < 7; k++) pal.push(((7 - k) * hi + k * lo) / 7 | 0);
    let bits = 0n;
    if (hi !== lo) for (let k = 0; k < 16; k++) {
      let best = 0, bd = 1e9;
      for (let j = 0; j < 8; j++) { const d = Math.abs(pal[j] - a[k]); if (d < bd) { bd = d; best = j; } }
      bits |= BigInt(best) << BigInt(3 * k);
    }
    for (let k = 0; k < 6; k++) out[o + 2 + k] = Number((bits >> BigInt(8 * k)) & 255n);
  }
  // RGBA -> a DXT1 or DXT5 .dds with every mip level down to 1x1 (each level a 2x2 box average of the one above).
  // DXT1 keeps pixels with alpha under 128 see-through only when keepClear is set.
  function encodeDDS(width, height, rgba, fourCC = 'DXT1', keepClear = false) {
    const dxt1 = fourCC === 'DXT1', bb = dxt1 ? 8 : 16;
    const levels = [];
    let w = width, h = height, d = rgba;
    for (;;) {
      levels.push({ w, h, d });
      if (w === 1 && h === 1) break;
      const nw = Math.max(1, w >> 1), nh = Math.max(1, h >> 1), nd = new Uint8Array(nw * nh * 4);
      for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) for (let c = 0; c < 4; c++) {
        let sum = 0, n = 0;
        for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
          const sx = Math.min(w - 1, x * 2 + dx), sy = Math.min(h - 1, y * 2 + dy);
          sum += d[(sy * w + sx) * 4 + c]; n++;
        }
        nd[(y * nw + x) * 4 + c] = Math.round(sum / n);
      }
      w = nw; h = nh; d = nd;
    }
    const sizeOf = (l) => Math.max(1, (l.w + 3) >> 2) * Math.max(1, (l.h + 3) >> 2) * bb;
    const total = 128 + levels.reduce((t, l) => t + sizeOf(l), 0);
    const out = new Uint8Array(total), dv = new DataView(out.buffer);
    dv.setUint32(0, 0x20534444, true); dv.setUint32(4, 124, true);
    dv.setUint32(8, 0x1 | 0x2 | 0x4 | 0x1000 | 0x20000 | 0x80000, true);
    dv.setUint32(12, height, true); dv.setUint32(16, width, true); dv.setUint32(20, sizeOf(levels[0]), true);
    dv.setUint32(28, levels.length, true);
    dv.setUint32(76, 32, true); dv.setUint32(80, 4, true);
    for (let k = 0; k < 4; k++) out[84 + k] = fourCC.charCodeAt(k);
    dv.setUint32(108, 0x1000 | 0x400000 | 0x8, true);
    let o = 128;
    const px = new Float64Array(48), clear = new Array(16), al = new Uint8Array(16);
    for (const l of levels) {
      const bw = Math.max(1, (l.w + 3) >> 2), bh = Math.max(1, (l.h + 3) >> 2);
      for (let by = 0; by < bh; by++) for (let bx = 0; bx < bw; bx++, o += bb) {
        for (let k = 0; k < 16; k++) {
          const x = Math.min(l.w - 1, bx * 4 + (k & 3)), y = Math.min(l.h - 1, by * 4 + (k >> 2)), q = (y * l.w + x) * 4;
          px[k * 3] = l.d[q]; px[k * 3 + 1] = l.d[q + 1]; px[k * 3 + 2] = l.d[q + 2];
          al[k] = l.d[q + 3];
          clear[k] = dxt1 && keepClear && l.d[q + 3] < 128;
        }
        if (dxt1) encodeColorBlock(px, clear, true, out, o);
        else { encodeAlphaBlock(al, out, o); encodeColorBlock(px, clear, false, out, o + 8); }
      }
    }
    return out;
  }
  // the compression a .dds uses ('DXT1', 'DXT3', 'DXT5', or '' when uncompressed)
  function ddsFormat(bytes) {
    if (!bytes || bytes.length < 128 || !(bytes[80] & 4)) return '';
    return String.fromCharCode(bytes[84], bytes[85], bytes[86], bytes[87]);
  }
  // a TGA comes back uncompressed, at its own bit depth and row order
  function adjustTGA(bytes, fn) {
    const t = decodeTGA(bytes);
    const d = new Uint8Array(t.data);
    for (let i = 0; i < d.length; i += 4) { const c = fn(d[i], d[i + 1], d[i + 2]); d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; }
    return encodeTGA(t.width, t.height, d, t.tga.bpp === 32 ? 32 : 24, !t.tga.topDown);
  }

  window.Images = { decodeTGA, encodeTGA, decodeDDS, decodeAny, resizeRGBA, thumbnail, decodePNG16, encodePNG16, adjustDDS, adjustTGA, encodeColorBlock, encodeDDS, ddsFormat };
})();
