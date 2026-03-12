/**
 * Minimal TGA reader that handles uncompressed TGA (type 2) and run-length encoded (type 10).
 * Returns { width, height, data: Uint8ClampedArray (RGBA) }
 */
export function parseTGA(buffer) {
  const view = new DataView(buffer);
  const idLength = view.getUint8(0);
  // colorMapType = view.getUint8(1)
  const imageType = view.getUint8(2);
  // skip color map spec (5 bytes at offset 3)
  // image spec at offset 8
  // const xOrigin = view.getUint16(8, true);
  // const yOrigin = view.getUint16(10, true);
  const width = view.getUint16(12, true);
  const height = view.getUint16(14, true);
  const bitsPerPixel = view.getUint8(16);
  const imageDescriptor = view.getUint8(17);
  const topToBottom = !!(imageDescriptor & 0x20);

  const bytesPerPixel = bitsPerPixel >> 3;
  const dataOffset = 18 + idLength; // skip color map data (assume 0 bytes for non-color-mapped)
  const pixels = new Uint8ClampedArray(width * height * 4);

  function readPixel(offset, out, idx) {
    if (bytesPerPixel === 3) {
      out[idx]     = view.getUint8(offset + 2); // R
      out[idx + 1] = view.getUint8(offset + 1); // G
      out[idx + 2] = view.getUint8(offset + 0); // B
      out[idx + 3] = 255;
    } else if (bytesPerPixel === 4) {
      out[idx]     = view.getUint8(offset + 2); // R
      out[idx + 1] = view.getUint8(offset + 1); // G
      out[idx + 2] = view.getUint8(offset + 0); // B
      out[idx + 3] = view.getUint8(offset + 3); // A
    } else if (bytesPerPixel === 1) {
      const v = view.getUint8(offset);
      out[idx] = v; out[idx+1] = v; out[idx+2] = v; out[idx+3] = 255;
    }
  }

  if (imageType === 2) {
    // Uncompressed RGB/RGBA
    let srcOffset = dataOffset;
    for (let i = 0; i < width * height; i++) {
      readPixel(srcOffset, pixels, i * 4);
      srcOffset += bytesPerPixel;
    }
  } else if (imageType === 10) {
    // Run-length encoded
    let srcOffset = dataOffset;
    let i = 0;
    while (i < width * height) {
      const header = view.getUint8(srcOffset++);
      const count = (header & 0x7f) + 1;
      if (header & 0x80) {
        // RLE packet
        const tmp = new Uint8ClampedArray(4);
        readPixel(srcOffset, tmp, 0);
        srcOffset += bytesPerPixel;
        for (let j = 0; j < count; j++) {
          pixels.set(tmp, (i + j) * 4);
        }
      } else {
        // Raw packet
        for (let j = 0; j < count; j++) {
          readPixel(srcOffset, pixels, (i + j) * 4);
          srcOffset += bytesPerPixel;
        }
      }
      i += count;
    }
  } else {
    throw new Error(`Unsupported TGA image type: ${imageType}`);
  }

  // TGA origin is bottom-left by default (unless topToBottom flag set)
  if (!topToBottom) {
    const rowBytes = width * 4;
    const tmp = new Uint8ClampedArray(rowBytes);
    for (let y = 0; y < Math.floor(height / 2); y++) {
      const top = pixels.subarray(y * rowBytes, (y + 1) * rowBytes);
      const bot = pixels.subarray((height - 1 - y) * rowBytes, (height - y) * rowBytes);
      tmp.set(top);
      top.set(bot);
      bot.set(tmp);
    }
  }

  return { width, height, data: pixels };
}

/**
 * Encode RGBA pixel data back to an uncompressed 24-bit TGA (type 2).
 */
export function encodeTGA(width, height, rgbaData) {
  const bytesPerPixel = 3;
  const pixelCount = width * height;
  const headerSize = 18;
  const buf = new ArrayBuffer(headerSize + pixelCount * bytesPerPixel);
  const view = new DataView(buf);
  const u8 = new Uint8Array(buf);

  // Header
  view.setUint8(0, 0);   // id length
  view.setUint8(1, 0);   // color map type
  view.setUint8(2, 2);   // image type: uncompressed RGB
  // color map spec (5 bytes = 3-7): all zeros
  view.setUint16(8, 0, true);  // x origin
  view.setUint16(10, 0, true); // y origin
  view.setUint16(12, width, true);
  view.setUint16(14, height, true);
  view.setUint8(16, 24); // bits per pixel
  view.setUint8(17, 0);  // image descriptor (bottom-left origin)

  // Pixel data — flip vertically (TGA is bottom-left)
  let dstOffset = headerSize;
  for (let y = height - 1; y >= 0; y--) {
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 4;
      u8[dstOffset++] = rgbaData[srcIdx + 2]; // B
      u8[dstOffset++] = rgbaData[srcIdx + 1]; // G
      u8[dstOffset++] = rgbaData[srcIdx];     // R
    }
  }

  return buf;
}