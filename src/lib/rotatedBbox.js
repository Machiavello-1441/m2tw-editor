/**
 * Rotated bounding-box support for the New Map Editor.
 *
 * Strategy: when the selection box has a rotation, all layers are generated
 * and edited on the axis-aligned Mercator ENVELOPE of the rotated rectangle
 * (so fetching/painting stays aligned with the OSM basemap). At export time,
 * each layer is rotate-resampled from envelope space into the true rotated
 * rectangle, producing a rectangular map whose geography is rotated.
 *
 * All rotation math is done in Mercator space (conformal → shape-preserving
 * on screen). Convention matches SelectionBox: positive angle = clockwise.
 */

/** Degree-scaled Mercator Y for a latitude. */
export function mercY(lat) {
  return Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) * (180 / Math.PI);
}

/** Inverse of mercY. */
export function invMercY(y) {
  return (2 * Math.atan(Math.exp((y * Math.PI) / 180)) - Math.PI / 2) * (180 / Math.PI);
}

/**
 * Rotates a lat/lng point around a center, shape-preserving on a Mercator map.
 * Positive angle rotates clockwise on screen (matches SelectionBox handles).
 */
export function rotatePointMerc(centerLat, centerLng, lat, lng, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  const cy = mercY(centerLat);
  const dx = lng - centerLng;
  const dy = mercY(lat) - cy;
  return {
    lng: centerLng + dx * cos + dy * sin,
    lat: invMercY(cy + dy * cos - dx * sin),
  };
}

const EPS = 0.01;

/**
 * Computes the axis-aligned work area (envelope) for a possibly-rotated box.
 * Returns { workBbox, workWidth, workHeight, rotated }.
 * When rotation ≈ 0 the work area is identical to the box itself.
 * workWidth/workHeight scale the target resolution so pixel density is
 * preserved across the larger envelope.
 */
export function computeWorkArea(box, mapWidth, mapHeight) {
  if (!box) return { workBbox: null, workWidth: mapWidth, workHeight: mapHeight, rotated: false };
  const rot = box.rotation ?? 0;
  const base = { north: box.north, south: box.south, west: box.west, east: box.east, rotation: 0 };
  if (Math.abs(rot) < EPS) {
    return { workBbox: base, workWidth: mapWidth, workHeight: mapHeight, rotated: false };
  }
  const cLat = (box.north + box.south) / 2;
  const cLng = (box.east + box.west) / 2;
  const corners = [
    [box.north, box.west], [box.north, box.east],
    [box.south, box.east], [box.south, box.west],
  ].map(([la, lo]) => rotatePointMerc(cLat, cLng, la, lo, rot));

  const north = Math.max(...corners.map(c => c.lat));
  const south = Math.min(...corners.map(c => c.lat));
  const east  = Math.max(...corners.map(c => c.lng));
  const west  = Math.min(...corners.map(c => c.lng));

  const scaleX = (east - west) / (box.east - box.west);
  const scaleY = (mercY(north) - mercY(south)) / (mercY(box.north) - mercY(box.south));

  return {
    workBbox: { north, south, west, east, rotation: 0 },
    workWidth:  Math.max(1, Math.round(mapWidth * scaleX)),
    workHeight: Math.max(1, Math.round(mapHeight * scaleY)),
    rotated: true,
  };
}

/**
 * Rotate-resamples an envelope-space ImageData into the rotated rectangle,
 * producing a targetW×targetH image (nearest-neighbor, hard edges).
 * Each target pixel maps to its rotated geographic position, then samples
 * the corresponding envelope pixel.
 */
export function rotateResampleImageData(src, workBbox, box, targetW, targetH) {
  const rot = box.rotation ?? 0;
  if (Math.abs(rot) < EPS) return src;
  const out = new ImageData(targetW, targetH);
  const od = out.data, sd = src.data;
  const sW = src.width, sH = src.height;

  const cLat = (box.north + box.south) / 2;
  const cLng = (box.east + box.west) / 2;
  const cy = mercY(cLat);
  const rad = (rot * Math.PI) / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);

  const boxMercN = mercY(box.north), boxMercS = mercY(box.south);
  const envMercN = mercY(workBbox.north), envMercS = mercY(workBbox.south);
  const envMercSpan = envMercN - envMercS;
  const envLngSpan = workBbox.east - workBbox.west;

  for (let y = 0; y < targetH; y++) {
    // Unrotated rect Mercator Y for this row
    const my = boxMercN - (y / (targetH - 1)) * (boxMercN - boxMercS);
    const dy = my - cy;
    for (let x = 0; x < targetW; x++) {
      const lng = box.west + (x / (targetW - 1)) * (box.east - box.west);
      const dx = lng - cLng;
      // Rotate forward (same convention as the displayed box)
      const rx = cLng + dx * cos + dy * sin;
      const ry = cy + dy * cos - dx * sin;
      // Map into envelope pixel space (clamped)
      let sx = Math.round(((rx - workBbox.west) / envLngSpan) * (sW - 1));
      let sy = Math.round(((envMercN - ry) / envMercSpan) * (sH - 1));
      sx = Math.max(0, Math.min(sW - 1, sx));
      sy = Math.max(0, Math.min(sH - 1, sy));
      const si = (sy * sW + sx) * 4;
      const oi = (y * targetW + x) * 4;
      od[oi] = sd[si]; od[oi + 1] = sd[si + 1]; od[oi + 2] = sd[si + 2]; od[oi + 3] = sd[si + 3];
    }
  }
  return out;
}

/**
 * Maps a pixel coordinate in envelope (work) space to its coordinate in the
 * rotated target rectangle. Returns { px, py } or null if outside the rect.
 * Used to transform settlement/feature coordinates at export.
 */
export function mapWorkPixelToTarget(px, py, workBbox, box, srcW, srcH, targetW, targetH) {
  const rot = box.rotation ?? 0;
  if (Math.abs(rot) < EPS) return { px, py };
  const envMercN = mercY(workBbox.north), envMercS = mercY(workBbox.south);
  // Work pixel → geographic Mercator coords
  const lng = workBbox.west + (px / (srcW - 1)) * (workBbox.east - workBbox.west);
  const my = envMercN - (py / (srcH - 1)) * (envMercN - envMercS);

  const cLat = (box.north + box.south) / 2;
  const cLng = (box.east + box.west) / 2;
  const cy = mercY(cLat);
  // Un-rotate around center (inverse of forward rotation)
  const rad = (-rot * Math.PI) / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  const dx = lng - cLng;
  const dy = my - cy;
  const ux = cLng + dx * cos + dy * sin;
  const uy = cy + dy * cos - dx * sin;

  const boxMercN = mercY(box.north), boxMercS = mercY(box.south);
  const tx = Math.round(((ux - box.west) / (box.east - box.west)) * (targetW - 1));
  const ty = Math.round(((boxMercN - uy) / (boxMercN - boxMercS)) * (targetH - 1));
  if (tx < 0 || ty < 0 || tx >= targetW || ty >= targetH) return null;
  return { px: tx, py: ty };
}