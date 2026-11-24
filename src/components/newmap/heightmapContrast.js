/**
 * Heightmap construction from raw Terrarium elevation.
 *
 * Terrarium encodes metres, not a picture: a bbox around the Low Countries
 * tops out at a few hundred metres while a Himalayan bbox reaches 8 000 m, so
 * dividing by a fixed range either washes a flat region out to near-black or
 * clips the peaks. This pass fixes both ends inside the fetched bbox:
 *
 *   lowest land pixel  → (1, 1, 1)      (pure black is reserved for sea)
 *   highest land pixel → (255, 255, 255)
 *   every sea pixel    → (0, 0, 255)
 *
 * ESA WorldCover decides land from water where the elevation data cannot: Dutch
 * polders sit metres below sea level and lagoon shores sit at 0 m, and would
 * otherwise be painted sea.
 */

import { ESA_CLASSES } from '@/lib/worldCover';

// Permanent water bodies only. Wetlands and mangroves count as land here.
const WATER_CLASSES = new Set([80]);
const LAND_CLASSES = new Set(ESA_CLASSES.map(c => c.code).filter(c => !WATER_CLASSES.has(c)));

/**
 * @param rawElev   ImageData of raw Terrarium tiles (RGB, uncropped values)
 * @param coverage  result of fetchCoverage() from @/lib/worldCover, or null
 * @param bbox      map bounding box
 * @returns {{imageData: ImageData, minElev: number, maxElev: number, seaPixels: number, landPixels: number}}
 */
export function buildHeightmap(rawElev, coverage, bbox) {
  const W = rawElev.width;
  const H = rawElev.height;
  const src = rawElev.data;
  const imageData = new ImageData(W, H);
  const out = imageData.data;

  // ── Land-cover lookup (column table once, row index per scanline) ──────────
  let cov = null, pxW = 0, pxH = 0, covWest = 0, covNorth = 0, res = 1, cxOf = null;
  if (coverage) {
    ({ data: cov, pxW, pxH, covWest, covNorth, res } = coverage);
    cxOf = new Int32Array(W);
    const dLng = bbox.east - bbox.west;
    for (let x = 0; x < W; x++) {
      const cx = Math.floor((bbox.west + (x / (W - 1)) * dLng - covWest) / res);
      cxOf[x] = cx >= 0 && cx < pxW ? cx : -1;
    }
  }

  const mercNorth = Math.log(Math.tan(Math.PI / 4 + bbox.north * Math.PI / 360));
  const mercSouth = Math.log(Math.tan(Math.PI / 4 + bbox.south * Math.PI / 360));
  const mercRange = mercNorth - mercSouth || 1;

  // Coverage row for a scanline, or -1 when it falls outside the coverage grid.
  const covRowOf = (y) => {
    if (!cov) return -1;
    const merc = mercNorth - (y / (H - 1)) * mercRange;
    const lat = (2 * Math.atan(Math.exp(merc)) - Math.PI / 2) * 180 / Math.PI;
    const cy = Math.floor((covNorth - lat) / res);
    return cy >= 0 && cy < pxH ? cy * pxW : -1;
  };

  const isLand = (elev, covRow, x) =>
    elev > 0 || (covRow >= 0 && cxOf[x] >= 0 && LAND_CLASSES.has(cov[covRow + cxOf[x]]));

  // ── Pass 1: the bbox's own land elevation range ───────────────────────────
  let minElev = Infinity;
  let maxElev = -Infinity;
  for (let y = 0; y < H; y++) {
    const covRow = covRowOf(y);
    const row = y * W;
    for (let x = 0; x < W; x++) {
      const i = (row + x) * 4;
      const elev = src[i] * 256 + src[i + 1] + src[i + 2] / 256 - 32768;
      if (!isLand(elev, covRow, x)) continue;
      if (elev < minElev) minElev = elev;
      if (elev > maxElev) maxElev = elev;
    }
  }

  const hasLand = maxElev >= minElev;
  const span = hasLand ? (maxElev - minElev) || 1 : 1;

  // ── Pass 2: stretch land to 1–255, paint sea blue ─────────────────────────
  let seaPixels = 0;
  let landPixels = 0;
  for (let y = 0; y < H; y++) {
    const covRow = covRowOf(y);
    const row = y * W;
    for (let x = 0; x < W; x++) {
      const i = (row + x) * 4;
      const elev = src[i] * 256 + src[i + 1] + src[i + 2] / 256 - 32768;
      if (isLand(elev, covRow, x)) {
        const v = Math.min(255, Math.max(1, Math.round(1 + ((elev - minElev) / span) * 254)));
        out[i] = v; out[i + 1] = v; out[i + 2] = v;
        landPixels++;
      } else {
        out[i] = 0; out[i + 1] = 0; out[i + 2] = 255;
        seaPixels++;
      }
      out[i + 3] = 255;
    }
  }

  return {
    imageData,
    minElev: hasLand ? minElev : 0,
    maxElev: hasLand ? maxElev : 0,
    seaPixels,
    landPixels,
  };
}