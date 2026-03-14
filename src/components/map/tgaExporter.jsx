/**
 * Export a Uint8ClampedArray (RGBA, top-to-bottom) as an uncompressed TGA file (Type 2).
 * Returns a Blob that can be downloaded.
 */
export function exportTGA(data, width, height) {
  const bytesPerPixel = 3;
  const pixelCount = width * height;
  const imageDataSize = pixelCount * bytesPerPixel;
  const buf = new ArrayBuffer(18 + imageDataSize);
  const view = new DataView(buf);
  const out = new Uint8Array(buf);

  view.setUint8(0, 0);
  view.setUint8(1, 0);
  view.setUint8(2, 2); // uncompressed true-color
  view.setUint16(3, 0, true);
  view.setUint16(5, 0, true);
  view.setUint8(7, 0);
  view.setUint16(8,  0, true);
  view.setUint16(10, 0, true);
  view.setUint16(12, width,  true);
  view.setUint16(14, height, true);
  view.setUint8(16, 24);
  view.setUint8(17, 0x20); // top-to-bottom

  let dst = 18;
  for (let i = 0; i < pixelCount; i++) {
    out[dst++] = data[i * 4 + 2]; // B
    out[dst++] = data[i * 4 + 1]; // G
    out[dst++] = data[i * 4 + 0]; // R
  }

  return new Blob([buf], { type: 'image/x-tga' });
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}