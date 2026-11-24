/**
 * TileRasterizer — rasterizes web map tile layers into an ImageData at a target resolution.
 *
 * Strategy:
 *  - Compute which tiles cover the bbox at a chosen zoom level
 *  - Fetch each tile as an <img> (CORS: anonymous)
 *  - Draw each tile straight into the output canvas at its own destination rect
 *    (no giant intermediate canvas — one that exceeds the browser's canvas area
 *    limit is silently blank, which turned whole heightmaps into sea)
 *  - Nearest-neighbor scaling (imageSmoothingEnabled = false)
 *
 * All standard slippy-map tile sources (OSM, OpenTopoMap, Terrarium, OHM) use
 * EPSG:3857 Web Mercator, so bboxes in WGS84 lat/lon map correctly.
 */

// Web Mercator helpers
function lon2tile(lon, zoom) {
  return Math.floor((lon + 180) / 360 * Math.pow(2, zoom));
}
function lat2tile(lat, zoom) {
  return Math.floor(
    (1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI)
    / 2 * Math.pow(2, zoom)
  );
}
function tile2lon(x, zoom) {
  return x / Math.pow(2, zoom) * 360 - 180;
}
function tile2lat(y, zoom) {
  const n = Math.PI - 2 * Math.PI * y / Math.pow(2, zoom);
  return 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}
function latToMercN(lat) {
  return Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 180 / 2));
}

const TILE_SIZE = 256;
// Tiles fetched per rasterization — keeps large bboxes responsive instead of
// requesting thousands of tiles at a zoom the output cannot use anyway.
const MAX_TILES = 400;

async function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load tile: ${url}`));
    img.src = url;
  });
}

function buildUrl(urlTemplate, x, y, z) {
  const subdomains = ['a', 'b', 'c'];
  const s = subdomains[(x + y) % 3];
  return urlTemplate
    .replace('{z}', z)
    .replace('{x}', x)
    .replace('{y}', y)
    .replace('{s}', s);
}

/**
 * Highest zoom whose tile grid stays within the tile budget, aiming for about
 * twice the target resolution so the output has enough detail.
 */
function pickZoom(bbox, width, height) {
  let best = 3;
  for (let z = 3; z <= 15; z++) {
    const tilesX = lon2tile(bbox.east, z) - lon2tile(bbox.west, z) + 1;
    const tilesY = lat2tile(bbox.south, z) - lat2tile(bbox.north, z) + 1;
    if (tilesX * tilesY > MAX_TILES) break;
    best = z;
    if (tilesX * TILE_SIZE >= width * 2 && tilesY * TILE_SIZE >= height * 2) break;
  }
  return best;
}

/**
 * Rasterize a tile URL template for the given bbox into an ImageData of width×height.
 * Uses nearest-neighbor scaling (no anti-aliasing).
 *
 * @param {string} urlTemplate  Leaflet-style URL with {z}/{x}/{y} and optional {s}
 * @param {{south,north,west,east}} bbox
 * @param {number} width        Target pixel width
 * @param {number} height       Target pixel height
 * @param {function} [onProgress]  Called with (fetched, total)
 * @returns {Promise<ImageData>}
 */
export async function rasterizeTiles(urlTemplate, bbox, width, height, onProgress, options) {
  const zoom = pickZoom(bbox, width, height);

  const xMin = lon2tile(bbox.west, zoom);
  const xMax = lon2tile(bbox.east, zoom);
  const yMin = lat2tile(bbox.north, zoom); // note: y increases southward
  const yMax = lat2tile(bbox.south, zoom);

  // Output canvas at target resolution — tiles are drawn straight into it.
  const outCanvas = document.createElement('canvas');
  outCanvas.width = width;
  outCanvas.height = height;
  const outCtx = outCanvas.getContext('2d');
  outCtx.imageSmoothingEnabled = false; // nearest-neighbor

  // Destination pixel edges of every tile column/row. Shared edges keep the
  // tiles gap- and overlap-free at any scale factor.
  const mercNorth = latToMercN(bbox.north);
  const mercSouth = latToMercN(bbox.south);
  const mercRange = mercNorth - mercSouth || 1;
  const xEdges = [];
  for (let tx = xMin; tx <= xMax + 1; tx++) {
    xEdges.push(Math.round((tile2lon(tx, zoom) - bbox.west) / (bbox.east - bbox.west) * width));
  }
  const yEdges = [];
  for (let ty = yMin; ty <= yMax + 1; ty++) {
    yEdges.push(Math.round((mercNorth - latToMercN(tile2lat(ty, zoom))) / mercRange * height));
  }

  const tasks = [];
  for (let tx = xMin; tx <= xMax; tx++) {
    for (let ty = yMin; ty <= yMax; ty++) {
      tasks.push({ tx, ty });
    }
  }

  const total = tasks.length;
  let fetched = 0;
  const failures = [];

  // Fetch tiles in parallel batches of 8
  const BATCH = 8;
  for (let i = 0; i < tasks.length; i += BATCH) {
    const batch = tasks.slice(i, i + BATCH);
    await Promise.all(batch.map(async ({ tx, ty }) => {
      const url = buildUrl(urlTemplate, tx, ty, zoom);
      let img = null;
      for (let attempt = 0; attempt < 3 && !img; attempt++) {
        try {
          img = await loadImage(url);
        } catch (e) {
          if (attempt === 2) failures.push(url);
        }
      }
      if (img) {
        const col = tx - xMin;
        const row = ty - yMin;
        const dx = xEdges[col];
        const dy = yEdges[row];
        const dw = Math.max(1, xEdges[col + 1] - dx);
        const dh = Math.max(1, yEdges[row + 1] - dy);
        outCtx.drawImage(img, 0, 0, TILE_SIZE, TILE_SIZE, dx, dy, dw, dh);
      }
      fetched++;
      onProgress?.(fetched, total);
    }));
  }

  // Missing tiles leave transparent holes, which would silently read as sea
  // level — refuse to hand back a broken layer instead.
  if (failures.length) {
    throw new Error(`${failures.length} of ${total} tiles failed to load (zoom ${zoom}) — check the connection and try again.`);
  }

  const imageData = outCtx.getImageData(0, 0, width, height);

  if (options?.grayscale) {
    // Terrarium tiles encode elevation as: elevation = (R*256 + G + B/256) - 32768
    // elevation <= 0  → sea  → (0, 0, 255)
    // elevation >  0  → land → grayscale 1–255 (normalised to max land elevation)
    const d = imageData.data;
    const len = d.length;

    // Decode all elevations first
    const elevs = new Float32Array(len / 4);
    for (let i = 0; i < len; i += 4) {
      elevs[i / 4] = d[i] * 256 + d[i + 1] + d[i + 2] / 256 - 32768;
    }

    // Find max land elevation for normalisation
    let maxElev = 0;
    for (let j = 0; j < elevs.length; j++) {
      if (elevs[j] > maxElev) maxElev = elevs[j];
    }
    const range = maxElev || 1;

    // Write output: sea pixels → blue, land → grayscale 1–255
    for (let i = 0; i < len; i += 4) {
      const elev = elevs[i / 4];
      if (elev <= 0) {
        d[i] = 0; d[i + 1] = 0; d[i + 2] = 255; d[i + 3] = 255;
      } else {
        const v = Math.max(1, Math.round(elev / range * 255));
        d[i] = v; d[i + 1] = v; d[i + 2] = v; d[i + 3] = 255;
      }
    }
  }

  return imageData;
}