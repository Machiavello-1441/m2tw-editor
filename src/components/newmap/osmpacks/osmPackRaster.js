const mercator = latitude => Math.log(Math.tan(Math.PI / 4 + Math.max(-85.051129, Math.min(85.051129, latitude)) * Math.PI / 360));
const masks = new Map();
export function clearMasks() { masks.clear(); }
// A mask covers one horizontal band of the layer: full width, `rows` tall,
// starting at row `y0` of the full `fullHeight`-row layer.
function classMask(features, key, bbox, width, fullHeight, y0, rows) {
  const cacheKey = `${width}:${fullHeight}:${y0}:${rows}:${key}`;
  if (masks.has(cacheKey)) { const mask = masks.get(cacheKey); masks.delete(cacheKey); masks.set(cacheKey, mask); return mask; }
  const canvas = new OffscreenCanvas(width, rows), ctx = canvas.getContext('2d', { willReadFrequently: true });
  const north = mercator(bbox.north), range = north - mercator(bbox.south);
  ctx.fillStyle = '#ffffff';
  for (const feature of features) {
    ctx.beginPath();
    for (const ring of feature.rings) {
      for (let n = 0; n < ring.length; n += 2) {
        const x = (ring[n] - bbox.west) / (bbox.east - bbox.west) * (width - 1);
        const y = (north - mercator(ring[n + 1])) / range * (fullHeight - 1) - y0;
        if (n === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
    }
    ctx.fill('evenodd');
  }
  const rgba = ctx.getImageData(0, 0, width, rows).data, mask = new Uint8Array(width * rows);
  for (let n = 0; n < mask.length; n++) mask[n] = rgba[n * 4 + 3] >= 128 ? 1 : 0;
  // Keep no more than 32 MiB of reusable masks.
  let cachedBytes = [...masks.values()].reduce((sum, value) => sum + value.byteLength, 0);
  while (masks.size && cachedBytes + mask.byteLength > 33554432) {
    const oldest = masks.keys().next().value; cachedBytes -= masks.get(oldest).byteLength; masks.delete(oldest);
  }
  if (mask.byteLength <= 33554432) masks.set(cacheKey, mask);
  return mask;
}
// `pixels` holds one band of the layer (`height` rows starting at row `y0` of
// `fullHeight`), so a large ground layer can be painted a band at a time.
export default function paintOsmClasses(index, choices, bbox, pixels, width, height, progress, y0 = 0, fullHeight = height) {
  if (pixels.length !== width * height * 4) throw new Error('Ground dimensions do not match the pixel buffer.');
  let painted = 0;
  const protectedSea = new Uint8Array(width * height);
  for (let n = 0; n < protectedSea.length; n++) {
    const p = n * 4, r = pixels[p], g = pixels[p + 1], b = pixels[p + 2];
    protectedSea[n] = (r === 0 && g === 0 && (b === 255 || b === 64)) || (g === 0 && b === 0 && (r === 64 || r === 128 || r === 196)) ? 1 : 0;
  }
  for (let c = 0; c < choices.length; c++) {
    const choice = choices[c], mask = classMask(index.get(choice.key) || [], choice.key, bbox, width, fullHeight, y0, height);
    for (let n = 0; n < mask.length; n++) {
      const p = n * 4;
      if (!mask[n] || protectedSea[n]) continue;
      pixels[p] = choice.color[0]; pixels[p + 1] = choice.color[1]; pixels[p + 2] = choice.color[2]; pixels[p + 3] = 255; painted++;
    }
    progress(`Painting ${c + 1}/${choices.length} classes`, Math.round((c + 1) / choices.length * 100));
  }
  return { pixels, width, height, painted };
}