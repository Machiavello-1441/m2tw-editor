/**
 * Coastline refinement for generated heightmaps.
 *
 * Terrarium elevation alone cannot tell the sea from low-lying land: Dutch
 * polders sit several metres below sea level and lagoon shores sit at 0 m, so
 * they were painted sea-blue and the coastline drifted inland.
 *
 * ESA WorldCover classifies every 10 m cell and knows land from water, so this
 * pass trusts it for the land/water decision: cells WorldCover calls land are
 * kept as land (never sea), which puts the coast back where it really is.
 */

import { ESA_CLASSES } from '@/lib/worldCover';

// Permanent water bodies only. Wetlands and mangroves count as land here.
const WATER_CLASSES = new Set([80]);
const LAND_CLASSES = new Set(ESA_CLASSES.map(c => c.code).filter(c => !WATER_CLASSES.has(c)));

/**
 * Turn sea-coloured pixels back into land wherever ESA WorldCover says land.
 *
 * @param imageData  grayscale heightmap from rasterizeTiles (sea = 0,0,255)
 * @param coverage   result of fetchCoverage() from @/lib/worldCover
 * @param bbox       map bounding box
 * @returns {{restored:number}} pixels switched from sea back to land
 */
export function applyCoastlineMask(imageData, coverage, bbox) {
  const { data: cov, pxW, pxH, covWest, covNorth, res } = coverage;
  const W = imageData.width;
  const H = imageData.height;
  const d = imageData.data;

  const mercNorth = Math.log(Math.tan(Math.PI / 4 + bbox.north * Math.PI / 360));
  const mercSouth = Math.log(Math.tan(Math.PI / 4 + bbox.south * Math.PI / 360));
  const mercRange = mercNorth - mercSouth || 1;
  const dLng = bbox.east - bbox.west;

  // Column → land-cover column, computed once (longitude is linear).
  const cxOf = new Int32Array(W);
  for (let x = 0; x < W; x++) {
    cxOf[x] = Math.floor((bbox.west + (x / (W - 1)) * dLng - covWest) / res);
  }

  let restored = 0;

  for (let y = 0; y < H; y++) {
    const merc = mercNorth - (y / (H - 1)) * mercRange;
    const lat = (2 * Math.atan(Math.exp(merc)) - Math.PI / 2) * 180 / Math.PI;
    const cy = Math.floor((covNorth - lat) / res);
    if (cy < 0 || cy >= pxH) continue;
    const covRow = cy * pxW;

    for (let x = 0; x < W; x++) {
      const cx = cxOf[x];
      if (cx < 0 || cx >= pxW) continue;

      if (!LAND_CLASSES.has(cov[covRow + cx])) continue;

      const i = (y * W + x) * 4;
      // Sea pixels were painted (0,0,255) by the grayscale elevation pass.
      if (d[i] === 0 && d[i + 1] === 0 && d[i + 2] === 255) {
        d[i] = 1;
        d[i + 1] = 1;
        d[i + 2] = 1;
        d[i + 3] = 255;
        restored++;
      }
    }
  }

  return { restored };
}