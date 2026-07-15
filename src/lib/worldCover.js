/**
 * ESA WorldCover 2021 land-cover fetcher.
 *
 * The Esri Living Atlas "European_Space_Agency_WorldCover_2021_Land_Cover_WGS84_7"
 * service is a TilesOnly cached ImageServer in WGS84 (EPSG:4326). Every tile is a
 * LERC2-compressed single-band raster whose pixel VALUE is the ESA land-cover
 * class (10, 20, 30, … 100) — not a rendered colour. We decode those tiles in the
 * browser with the official Esri `lerc` package to recover the exact class grid,
 * then composite it onto the M2TW ground layer by mapping each class to a ground
 * type colour.
 */

import * as Lerc from 'lerc';
import { GT } from '@/lib/autoGroundTypes';

// The lerc package ships its decoder as JS + a separate lerc-wasm.wasm. Vite
// can't bundle the wasm as an import (it tries to parse it as JS), so we pull
// the wasm from the unpkg CDN via Lerc.load's locateFile hook.
const LERC_VERSION = '4.1.2';
const LERC_WASM_URL = `https://unpkg.com/lerc@${LERC_VERSION}/lerc-wasm.wasm`;

// Service root (TilesOnly ImageServer, WGS84 cached).
export const ESA_WORLDCOVER_BASE =
  'https://tiledimageservices.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/European_Space_Agency_WorldCover_2021_Land_Cover_WGS84_7/ImageServer';

// Level resolutions (deg / pixel) from the service tileInfo LODs (level 0 → 13).
export const ESA_LEVEL_RES = [
  0.682666666666667, 0.341333333333333, 0.170666666666667, 0.0853333333333333,
  0.0426666666666667, 0.0213333333333333, 0.0106666666666667, 0.00533333333333333,
  0.00266666666666667, 0.00133333333333333, 0.000666666666666667, 0.000333333333333333,
  0.000166666666666667, 8.33333333333333e-5,
];

const TILE_PX = 256;        // each tile is 256×256 px
const ORIGIN_X = -180;      // tileInfo.origin.x
const ORIGIN_Y = 84;        // tileInfo.origin.y (top)
const MAX_TILES = 64;       // cap concurrent-tile footprint so a huge bbox stays fast

const CONCURRENCY = 8;

// ESA WorldCover 2021 class legend + sensible M2TW ground-type defaults.
export const ESA_CLASSES = [
  { code: 10,  label: 'Tree cover',                 group: 'Vegetation',   defaultGt: 'forest_sparse' },
  { code: 20,  label: 'Shrubland',                  group: 'Vegetation',   defaultGt: 'wilderness' },
  { code: 30,  label: 'Grassland',                  group: 'Vegetation',   defaultGt: 'fertile_medium' },
  { code: 40,  label: 'Cropland',                   group: 'Agricultural', defaultGt: 'fertile_high' },
  { code: 50,  label: 'Built-up',                   group: 'Human',        defaultGt: 'fertile_low' },
  { code: 60,  label: 'Bare / sparse vegetation',   group: 'Barren',       defaultGt: 'mountains_low' },
  { code: 70,  label: 'Snow and ice',               group: 'Barren',       defaultGt: 'mountains_high' },
  { code: 80,  label: 'Permanent water bodies',     group: 'Water',        defaultGt: 'swamp' },
  { code: 90,  label: 'Herbaceous wetland',         group: 'Water',        defaultGt: 'swamp' },
  { code: 95,  label: 'Mangroves',                  group: 'Water',        defaultGt: 'swamp' },
  { code: 100, label: 'Lichen / moss',              group: 'Vegetation',   defaultGt: 'wilderness' },
];

export const ESA_CLASS_GROUPS = [...new Set(ESA_CLASSES.map(c => c.group))];

/** Pick the finest level whose native resolution is not finer than the map
 *  pixel size, coarsening until the tile count stays within MAX_TILES. */
export function chooseLevel(bbox, mapW, mapH) {
  const mapPix = Math.max(
    (bbox.east - bbox.west) / mapW,
    (bbox.north - bbox.south) / mapH
  );
  let level = 0;
  for (let l = 0; l < ESA_LEVEL_RES.length; l++) if (ESA_LEVEL_RES[l] >= mapPix) level = l;

  const tileCount = (l) => {
    const tw = ESA_LEVEL_RES[l] * TILE_PX;
    const cols = Math.floor((bbox.east - ORIGIN_X) / tw) - Math.floor((bbox.west - ORIGIN_X) / tw) + 1;
    const rows = Math.floor((ORIGIN_Y - bbox.south) / tw) - Math.floor((ORIGIN_Y - bbox.north) / tw) + 1;
    return Math.max(1, cols) * Math.max(1, rows);
  };
  while (level > 0 && tileCount(level) > MAX_TILES) level--;
  return level;
}

/** Row/col ranges of the cached tiles that overlap the bbox at a level. */
function tileBounds(bbox, level) {
  const tw = ESA_LEVEL_RES[level] * TILE_PX;
  let colMin = Math.floor((bbox.west - ORIGIN_X) / tw);
  let colMax = Math.floor((bbox.east - ORIGIN_X) / tw);
  let rowMin = Math.floor((ORIGIN_Y - bbox.north) / tw);
  let rowMax = Math.floor((ORIGIN_Y - bbox.south) / tw);
  if (colMin < 0) colMin = 0;
  if (rowMin < 0) rowMin = 0;
  return { colMin, colMax, rowMin, rowMax, tileDeg: tw };
}

let _wasmLoaded = false;
async function ensureLerc() {
  if (_wasmLoaded && (!(Lerc.isLoaded) || Lerc.isLoaded())) return;
  await Lerc.load({ locateFile: () => LERC_WASM_URL });
  _wasmLoaded = true;
}

/** Fetch + decode one LERC2 tile into a single-band class raster + mask. */
export async function fetchLercTile(level, row, col) {
  await ensureLerc();
  const res = await fetch(`${ESA_WORLDCOVER_BASE}/tile/${level}/${row}/${col}`);
  if (!res.ok) return null;
  const buf = await res.arrayBuffer();
  if (!buf || buf.byteLength < 20) return null;
  let block;
  try { block = Lerc.decode(buf); } catch { return null; }
  if (!block || !block.width || !block.height) return null;
  const band = block.pixels && block.pixels[0];
  if (!band) return null;
  return { width: block.width, height: block.height, pixels: band, mask: block.mask };
}

/**
 * Fetch every cached tile overlapping the bbox at a resolution matching the map,
 * decode the LERC2 classes, and composite them into a single native-resolution
 * class grid.
 *
 * @returns {Promise<{data:Uint8Array, pxW, pxH, covWest, covNorth, res, level, cols, rows}>}
 */
export async function fetchCoverage(bbox, mapW, mapH, onProgress) {
  const level = chooseLevel(bbox, mapW, mapH);
  const { colMin, colMax, rowMin, rowMax, tileDeg } = tileBounds(bbox, level);
  const cols = colMax - colMin + 1;
  const rows = rowMax - rowMin + 1;
  const pxW = cols * TILE_PX;
  const pxH = rows * TILE_PX;
  const data = new Uint8Array(pxW * pxH);
  const covWest = ORIGIN_X + colMin * tileDeg;
  const covNorth = ORIGIN_Y - rowMin * tileDeg;
  const total = cols * rows;

  const cells = [];
  for (let r = rowMin; r <= rowMax; r++)
    for (let c = colMin; c <= colMax; c++) cells.push({ r, c });

  let done = 0;
  for (let i = 0; i < cells.length; i += CONCURRENCY) {
    const batch = cells.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map(({ r, c }) => fetchLercTile(level, r, c)));
    results.forEach((tile, idx) => {
      if (!tile) return;
      const { r, c } = batch[idx];
      const ox = (c - colMin) * TILE_PX;
      const oy = (r - rowMin) * TILE_PX;
      for (let y = 0; y < tile.height && oy + y < pxH; y++) {
        const srcRow = y * tile.width;
        const dstRow = (oy + y) * pxW + ox;
        for (let x = 0; x < tile.width && ox + x < pxW; x++) {
          if (tile.mask && !tile.mask[srcRow + x]) continue;
          data[dstRow + x] = tile.pixels[srcRow + x];
        }
      }
    });
    done += batch.length;
    if (onProgress) onProgress(Math.round((done / total) * 100));
  }

  return { data, pxW, pxH, covWest, covNorth, res: ESA_LEVEL_RES[level], level, cols, rows };
}

// M2TW sea ground-type colours (keyed as "r,g,b") — never overwritten by land cover.
const _SEA_KEYS = new Set(
  [GT.impassable_sea, GT.ocean, GT.sea_deep, GT.sea_shallow].map(rgb => `${rgb[0]},${rgb[1]},${rgb[2]}`)
);

/**
 * Composite the ESA coverage grid onto the ground layer, mapping each class to
 * a ground-type colour. Existing sea pixels are preserved; hidden classes and
 * nodata (0) are skipped. Uses Web Mercator projection for the map↔geo mapping.
 *
 * @param coverage   result of fetchCoverage()
 * @param groundData ImageData of the current ground layer
 * @param bbox       map bounding box
 * @param classColor { [esaClass]: [r,g,b] }
 * @param hidden     Set of ESA classes to skip
 */
export function compositeLandCover(coverage, groundData, bbox, classColor, hidden) {
  const { data: cov, pxW, pxH, covWest, covNorth, res } = coverage;
  const gW = groundData.width, gH = groundData.height;
  const out = new ImageData(new Uint8ClampedArray(groundData.data), gW, gH);
  const od = out.data;

  const mercNorth = Math.log(Math.tan(Math.PI / 4 + bbox.north * Math.PI / 360));
  const mercSouth = Math.log(Math.tan(Math.PI / 4 + bbox.south * Math.PI / 360));
  const dLng = bbox.east - bbox.west;

  let painted = 0;
  for (let gy = 0; gy < gH; gy++) {
    const merc = mercNorth - (gy / (gH - 1)) * (mercNorth - mercSouth);
    const lat = (2 * Math.atan(Math.exp(merc)) - Math.PI / 2) * 180 / Math.PI;
    const cy = Math.floor((covNorth - lat) / res);
    if (cy < 0 || cy >= pxH) continue;
    const lngBase = bbox.west;
    for (let gx = 0; gx < gW; gx++) {
      const i = (gy * gW + gx) * 4;
      if (_SEA_KEYS.has(`${od[i]},${od[i + 1]},${od[i + 2]}`)) continue;
      const lng = lngBase + (gx / (gW - 1)) * dLng;
      const cx = Math.floor((lng - covWest) / res);
      if (cx < 0 || cx >= pxW) continue;
      const cls = cov[cy * pxW + cx] | 0;
      if (cls === 0 || hidden.has(cls)) continue;
      const c = classColor[cls];
      if (!c) continue;
      od[i] = c[0]; od[i + 1] = c[1]; od[i + 2] = c[2]; od[i + 3] = 255;
      painted++;
    }
  }
  return { imageData: out, painted };
}