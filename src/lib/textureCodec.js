/**
 * M2TW .texture ↔ .dds codec
 * M2TW wraps a standard DDS file with a small proprietary header (typically 4 bytes).
 * Strategy: scan for the DDS magic bytes "DDS " (0x44 0x44 0x53 0x20) to find the header size.
 */

export function extractDdsFromTexture(buffer) {
  const u8 = new Uint8Array(buffer);
  for (let i = 0; i < Math.min(u8.length - 4, 512); i++) {
    if (u8[i] === 0x44 && u8[i + 1] === 0x44 && u8[i + 2] === 0x53 && u8[i + 3] === 0x20) {
      return {
        ddsBuffer: buffer.slice(i),
        headerOffset: i,
        headerBytes: i > 0 ? buffer.slice(0, i) : null,
      };
    }
  }
  return null; // No DDS magic found
}

export function wrapDdsAsTexture(ddsBuffer, originalHeaderBytes) {
  // Use original header if available; fall back to the standard 4-byte M2TW prefix
  const header = originalHeaderBytes
    ? new Uint8Array(originalHeaderBytes)
    : new Uint8Array([0x00, 0x00, 0x01, 0x00]);
  const result = new Uint8Array(header.length + ddsBuffer.byteLength);
  result.set(header, 0);
  result.set(new Uint8Array(ddsBuffer), header.length);
  return result.buffer;
}

export function parseDdsInfo(buffer) {
  const view = new DataView(buffer);
  if (view.byteLength < 128) return null;
  if (view.getUint32(0, false) !== 0x44445320) return null; // "DDS "

  const height = view.getUint32(12, true);
  const width = view.getUint32(16, true);
  const mipMapCount = view.getUint32(28, true);
  const pfFlags = view.getUint32(80, true);
  const fourCC = String.fromCharCode(
    view.getUint8(84), view.getUint8(85), view.getUint8(86), view.getUint8(87)
  );
  const bitCount = view.getUint32(88, true);
  const isCompressed = (pfFlags & 0x4) !== 0;
  const format = isCompressed ? fourCC : `RGBA${bitCount}`;
  return { width, height, mipMapCount: Math.max(1, mipMapCount), format };
}

/** Very simple DXT1/DXT5/uncompressed → RGBA8 decoder for canvas preview */
function decodeDxt1Block(src, srcOff, dst, dstOff, width) {
  const c0 = src[srcOff] | (src[srcOff + 1] << 8);
  const c1 = src[srcOff + 2] | (src[srcOff + 3] << 8);
  const r0 = ((c0 >> 11) & 0x1F) * 255 / 31;
  const g0 = ((c0 >> 5) & 0x3F) * 255 / 63;
  const b0 = (c0 & 0x1F) * 255 / 31;
  const r1 = ((c1 >> 11) & 0x1F) * 255 / 31;
  const g1 = ((c1 >> 5) & 0x3F) * 255 / 63;
  const b1 = (c1 & 0x1F) * 255 / 31;
  const palette = [
    [r0, g0, b0, 255],
    [r1, g1, b1, 255],
    c0 > c1
      ? [(2 * r0 + r1) / 3, (2 * g0 + g1) / 3, (2 * b0 + b1) / 3, 255]
      : [(r0 + r1) / 2, (g0 + g1) / 2, (b0 + b1) / 2, 255],
    c0 > c1
      ? [(r0 + 2 * r1) / 3, (g0 + 2 * g1) / 3, (b0 + 2 * b1) / 3, 255]
      : [0, 0, 0, 0],
  ];
  const bits = src[srcOff + 4] | (src[srcOff + 5] << 8) | (src[srcOff + 6] << 16) | (src[srcOff + 7] << 24);
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      const idx = (bits >> (2 * (row * 4 + col))) & 3;
      const p = palette[idx];
      const di = dstOff + (row * width + col) * 4;
      dst[di] = p[0]; dst[di + 1] = p[1]; dst[di + 2] = p[2]; dst[di + 3] = p[3];
    }
  }
}

export function ddsToImageData(buffer) {
  const info = parseDdsInfo(buffer);
  if (!info) return null;
  const { width, height, format } = info;
  const data = new Uint8ClampedArray(width * height * 4);
  const src = new Uint8Array(buffer, 128);

  if (format === 'DXT1') {
    let srcOff = 0;
    for (let y = 0; y < height; y += 4) {
      for (let x = 0; x < width; x += 4) {
        decodeDxt1Block(src, srcOff, data, (y * width + x) * 4, width);
        srcOff += 8;
      }
    }
  } else if (format === 'DXT5') {
    // Skip alpha block (8 bytes), decode color block same as DXT1
    let srcOff = 0;
    for (let y = 0; y < height; y += 4) {
      for (let x = 0; x < width; x += 4) {
        decodeDxt1Block(src, srcOff + 8, data, (y * width + x) * 4, width);
        srcOff += 16;
      }
    }
  } else if (format === 'DXT3') {
    let srcOff = 0;
    for (let y = 0; y < height; y += 4) {
      for (let x = 0; x < width; x += 4) {
        decodeDxt1Block(src, srcOff + 8, data, (y * width + x) * 4, width);
        srcOff += 16;
      }
    }
  } else {
    // Assume BGRA8 or RGBA8 uncompressed
    for (let i = 0; i < width * height; i++) {
      data[i * 4] = src[i * 4 + 2]; // R
      data[i * 4 + 1] = src[i * 4 + 1]; // G
      data[i * 4 + 2] = src[i * 4]; // B
      data[i * 4 + 3] = src[i * 4 + 3]; // A
    }
  }
  return { imageData: new ImageData(data, width, height), width, height };
}