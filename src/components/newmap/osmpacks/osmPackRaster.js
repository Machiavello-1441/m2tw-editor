const mercator = latitude => Math.log(Math.tan(Math.PI / 4 + Math.max(-85.051129, Math.min(85.051129, latitude)) * Math.PI / 360));
const masks = new Map();
export function clearMasks() { masks.clear(); }
function classMask(features, key, bbox, width, height) {
  const cacheKey = `${width}:${height}:${key}`;
  if (masks.has(cacheKey)) { const mask = masks.get(cacheKey); masks.delete(cacheKey); masks.set(cacheKey, mask); return mask; }
  const canvas = new OffscreenCanvas(width, height), ctx = canvas.getContext('2d', { willReadFrequently: true });
  const north = mercator(bbox.north), range = north - mercator(bbox.south);
  ctx.fillStyle = '#ffffff';
  for (const feature of features) {
    ctx.beginPath();
    for (const ring of feature.rings) {
      for (let n = 0; n < ring.length; n += 2) {
        const x = (ring[n] - bbox.west) / (bbox.east - bbox.west) * (width - 1);
        const y = (north - mercator(ring[n + 1])) / range * (height - 1);
        if (n === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
    }
    ctx.fill('evenodd');
  }
  const rgba = ctx.getImageData(0, 0, width, height).data, mask = new Uint8Array(width * height);
  for (let n = 0; n < mask.length; n++) mask[n] = rgba[n * 4 + 3] >= 128 ? 1 : 0;
  // Keep no more than 32 MiB of reusable masks.
  let cachedBytes = [...masks.values()].reduce((sum, value) => sum + value.byteLength, 0);
  while (masks.size && cachedBytes + mask.byteLength > 33554432) {
    const oldest = masks.keys().next().value; cachedBytes -= masks.get(oldest).byteLength; masks.delete(oldest);
  }
  if (mask.byteLength <= 33554432) masks.set(cacheKey, mask);
  return mask;
}
export default function paintOsmClasses(index, choices, bbox, pixels, width, height, progress) {
  if (pixels.length !== width * height * 4) throw new Error('Ground dimensions do not match the pixel buffer.');
  let painted = 0;
  const protectedSea = new Uint8Array(width * height);
  for (let n = 0; n < protectedSea.length; n++) {
    const p = n * 4, r = pixels[p], g = pixels[p + 1], b = pixels[p + 2];
    protectedSea[n] = (r === 0 && g === 0 && (b === 255 || b === 64)) || (g === 0 && b === 0 && (r === 64 || r === 128 || r === 196)) ? 1 : 0;
  }
  for (let c = 0; c < choices.length; c++) {
    const choice = choices[c], mask = classMask(index.get(choice.key) || [], choice.key, bbox, width, height);
    for (let n = 0; n < mask.length; n++) {
      const p = n * 4;
      if (!mask[n] || protectedSea[n]) continue;
      pixels[p] = choice.color[0]; pixels[p + 1] = choice.color[1]; pixels[p + 2] = choice.color[2]; pixels[p + 3] = 255; painted++;
    }
    progress(`Painting ${c + 1}/${choices.length} classes`, Math.round((c + 1) / choices.length * 100));
  }
  return { pixels, width, height, painted };
}