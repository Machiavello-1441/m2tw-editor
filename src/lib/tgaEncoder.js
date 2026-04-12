/**
 * TGA Encoder - produces valid TGA files for M2TW map layers
 * Supports: 8-bit grayscale (type 3), 24-bit RGB (type 2)
 */

export function encodeTGA(imageData, mode = 'rgb') {
  const { width, height, data } = imageData;
  const isGrayscale = mode === 'grayscale';
  const pixelDepth = isGrayscale ? 8 : 24;
  const imageType = isGrayscale ? 3 : 2;
  const pixelBytes = isGrayscale ? 1 : 3;
  const pixelCount = width * height;

  const header = new Uint8Array(18);
  header[0] = 0;           // ID length
  header[1] = 0;           // Color map type
  header[2] = imageType;   // Image type
  // Color map spec (bytes 3-7): all zeros
  header[8]  = 0;          // X origin lo
  header[9]  = 0;          // X origin hi
  header[10] = 0;          // Y origin lo
  header[11] = 0;          // Y origin hi
  header[12] = width  & 0xFF;
  header[13] = (width  >> 8) & 0xFF;
  header[14] = height & 0xFF;
  header[15] = (height >> 8) & 0xFF;
  header[16] = pixelDepth;
  header[17] = 0x20;       // Image descriptor: top-left origin

  const pixelData = new Uint8Array(pixelCount * pixelBytes);

  if (isGrayscale) {
    for (let i = 0; i < pixelCount; i++) {
      // Average RGB channels for grayscale
      pixelData[i] = Math.round((data[i * 4] + data[i * 4 + 1] + data[i * 4 + 2]) / 3);
    }
  } else {
    for (let i = 0; i < pixelCount; i++) {
      // TGA stores BGR
      pixelData[i * 3]     = data[i * 4 + 2]; // B
      pixelData[i * 3 + 1] = data[i * 4 + 1]; // G
      pixelData[i * 3 + 2] = data[i * 4];     // R
    }
  }

  const out = new Uint8Array(18 + pixelData.length);
  out.set(header, 0);
  out.set(pixelData, 18);
  return out.buffer;
}

export function downloadTGA(imageData, filename, mode = 'rgb') {
  const buf = encodeTGA(imageData, mode);
  const blob = new Blob([buf], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

/** Decode a loaded image (via canvas) into an ImageData object */
export function imageToImageData(img, w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}

/** Normalize a grayscale ImageData to 0-255 */
export function normalizeGrayscale(imageData) {
  const d = imageData.data;
  let min = 255, max = 0;
  for (let i = 0; i < d.length; i += 4) {
    const v = d[i];
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const range = max - min || 1;
  const out = new ImageData(imageData.width, imageData.height);
  for (let i = 0; i < d.length; i += 4) {
    const v = Math.round(((d[i] - min) / range) * 255);
    out.data[i] = out.data[i+1] = out.data[i+2] = v;
    out.data[i+3] = 255;
  }
  return out;
}

/** Validate region map: find duplicate RGB values */
export function validateRegionMap(imageData) {
  const seen = new Map();
  const duplicates = [];
  const { data, width, height } = imageData;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const key = `${data[i]},${data[i+1]},${data[i+2]}`;
      if (key === '0,0,0') continue; // skip black (sea)
      if (!seen.has(key)) seen.set(key, { x, y });
    }
  }
  return { valid: duplicates.length === 0, duplicates, regionCount: seen.size };
}