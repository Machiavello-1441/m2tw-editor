const merc = lat => Math.log(Math.tan(Math.PI / 4 + Math.max(-85.051128, Math.min(85.051128, lat)) * Math.PI / 360));
export function hydroProjection(bbox, width, height) {
  const north = merc(bbox.north), span = north - merc(bbox.south);
  return ([lon, lat]) => [(lon - bbox.west) / (bbox.east - bbox.west) * (width - 1), (north - merc(lat)) / span * (height - 1)];
}
// Liang–Barsky clipping prevents off-map endpoints being snapped onto borders.
export function clipPixelSegment(a, b, width, height) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  let low = 0, high = 1;
  const p = [-dx, dx, -dy, dy], q = [a[0], width - 1 - a[0], a[1], height - 1 - a[1]];
  for (let n = 0; n < 4; n++) {
    if (p[n] === 0) { if (q[n] < 0) return null; continue; }
    const t = q[n] / p[n];
    if (p[n] < 0) low = Math.max(low, t); else high = Math.min(high, t);
    if (low > high) return null;
  }
  return [[Math.round(a[0] + low * dx), Math.round(a[1] + low * dy)], [Math.round(a[0] + high * dx), Math.round(a[1] + high * dy)]];
}
// Orthogonal staircase: diagonal-only contact is not sufficient in M2TW.
export function paintRiverSegment(mask, width, a, b) {
  let [x, y] = a;
  const dx = Math.abs(b[0] - x), dy = Math.abs(b[1] - y);
  const sx = Math.sign(b[0] - x), sy = Math.sign(b[1] - y);
  let nx = 0, ny = 0;
  mask[y * width + x] = 1;
  while (nx < dx || ny < dy) {
    if (nx < dx && (ny === dy || (nx + 0.5) * dy <= (ny + 0.5) * dx)) { x += sx; nx++; }
    else { y += sy; ny++; }
    mask[y * width + x] = 1;
  }
}