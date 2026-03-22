/**
 * Unified texture loader: .texture, .dds, .tga → ImageData
 * Returns { imageData: ImageData, width, height } or null
 */
import { extractDdsFromTexture, ddsToImageData } from './textureCodec';

function loadTgaToImageData(buffer) {
  const data = new Uint8Array(buffer);
  if (data.length < 18) return null;

  const idLength = data[0];
  const colorMapType = data[1];
  const imageType = data[2];
  const width = data[12] | (data[13] << 8);
  const height = data[14] | (data[15] << 8);
  const bpp = data[16];
  const imageDescriptor = data[17];
  const topOrigin = !!(imageDescriptor & 0x20);

  if (colorMapType !== 0) return null;
  if (imageType !== 2 && imageType !== 10) return null;
  if (bpp !== 24 && bpp !== 32) return null;
  if (width === 0 || height === 0) return null;

  const headerSize = 18 + idLength;
  const pixels = new Uint8ClampedArray(width * height * 4);
  let srcIdx = headerSize, pixIdx = 0;

  if (imageType === 2) {
    for (let i = 0; i < width * height; i++) {
      const b = data[srcIdx++], g = data[srcIdx++], r = data[srcIdx++];
      const a = bpp === 32 ? data[srcIdx++] : 255;
      pixels[pixIdx++] = r; pixels[pixIdx++] = g; pixels[pixIdx++] = b; pixels[pixIdx++] = a;
    }
  } else {
    let pixel = 0;
    while (pixel < width * height) {
      const rc = data[srcIdx++], count = (rc & 0x7f) + 1;
      if (rc & 0x80) {
        const b = data[srcIdx++], g = data[srcIdx++], r = data[srcIdx++];
        const a = bpp === 32 ? data[srcIdx++] : 255;
        for (let i = 0; i < count; i++, pixel++) {
          pixels[pixIdx++] = r; pixels[pixIdx++] = g; pixels[pixIdx++] = b; pixels[pixIdx++] = a;
        }
      } else {
        for (let i = 0; i < count; i++, pixel++) {
          const b = data[srcIdx++], g = data[srcIdx++], r = data[srcIdx++];
          const a = bpp === 32 ? data[srcIdx++] : 255;
          pixels[pixIdx++] = r; pixels[pixIdx++] = g; pixels[pixIdx++] = b; pixels[pixIdx++] = a;
        }
      }
    }
  }

  if (!topOrigin) {
    const rowSize = width * 4;
    for (let y = 0; y < Math.floor(height / 2); y++) {
      const top = y * rowSize, bot = (height - 1 - y) * rowSize;
      for (let i = 0; i < rowSize; i++) {
        const tmp = pixels[top + i]; pixels[top + i] = pixels[bot + i]; pixels[bot + i] = tmp;
      }
    }
  }

  return { imageData: new ImageData(pixels, width, height), width, height };
}

/**
 * Load a texture file buffer and return ImageData.
 * @param {ArrayBuffer} buffer
 * @param {string} ext - 'texture', 'dds', or 'tga'
 * @returns {{ imageData: ImageData, width: number, height: number } | null}
 */
export function loadTextureBuffer(buffer, ext) {
  if (ext === 'texture') {
    const result = extractDdsFromTexture(buffer);
    if (!result) return null;
    return ddsToImageData(result.ddsBuffer);
  }
  if (ext === 'dds') {
    return ddsToImageData(buffer);
  }
  if (ext === 'tga') {
    return loadTgaToImageData(buffer);
  }
  return null;
}