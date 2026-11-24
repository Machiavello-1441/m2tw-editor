/**
 * TileRasterizer — rasterizes web map tile layers into an ImageData at a target resolution.
 *
 * Strategy:
 *  - Compute which tiles cover the bbox at a chosen zoom level (bounded tile budget)
 *  - Fetch each tile as an <img> (CORS: anonymous), with retries
 *  - Assemble the output in BLOCKS: a small reusable scratch canvas is filled
 *    with the tiles covering that block, read back, and copied into the final
 *    pixel buffer. No full-size canvas is ever created, so map size is not
 *    limited by the browser's per-canvas pixel/side caps.
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
// Assembly block size in pixels. Blocks are stitched into the final buffer, so
// this only bounds the scratch canvas (4096² ≈ 16.7 MP works everywhere).
const BLOCK = 4096;

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

  const cols = xMax - xMin + 1;
  const rows = yMax - yMin + 1;
  const total = cols * rows;

  // ── Fetch every tile once (bounded by MAX_TILES, so memory stays flat) ─────
  const tiles = new Array(total);
  const failures = [];
  let fetched = 0;

  const BATCH = 8;
  for (let i = 0; i < total; i += BATCH) {
    const batch = [];
    for (let k = i; k < Math.min(i + BATCH, total); k++) batch.push(k);
    await Promise.all(batch.map(async (index) => {
      const tx = xMin + (index % cols);
      const ty = yMin + Math.floor(index / cols);
      const url = buildUrl(urlTemplate, tx, ty, zoom);
      let img = null;
      for (let attempt = 0; attempt < 3 && !img; attempt++) {
        try {
          img = await loadImage(url);
        } catch (e) {
          if (attempt === 2) failures.push(url);
        }
      }
      tiles[index] = img;
      fetched++;
      onProgress?.(fetched, total);
    }));
  }

  // Missing tiles leave transparent holes, which would silently read as sea
  // level — refuse to hand back a broken layer instead.
  if (failures.length) {
    throw new Error(`${failures.length} of ${total} tiles failed to load (zoom ${zoom}) — check the connection and try again.`);
  }

  // ── Assemble block by block straight into the final pixel buffer ───────────
  const imageData = new ImageData(width, height);
  const out = imageData.data;
  const scratch = document.createElement('canvas');
  const scratchCtx = scratch.getContext('2d', { willReadFrequently: true });

  for (let by = 0; by < height; by += BLOCK) {
    const bh = Math.min(BLOCK, height - by);
    for (let bx = 0; bx < width; bx += BLOCK) {
      const bw = Math.min(BLOCK, width - bx);

      // Resizing clears the scratch canvas for the next block.
      scratch.width = bw;
      scratch.height = bh;
      scratchCtx.imageSmoothingEnabled = false;

      for (let row = 0; row < rows; row++) {
        const top = yEdges[row] - by;
        const bottom = yEdges[row + 1] - by;
        if (bottom <= 0 || top >= bh) continue;
        for (let col = 0; col < cols; col++) {
          const left = xEdges[col] - bx;
          const right = xEdges[col + 1] - bx;
          if (right <= 0 || left >= bw) continue;
          const img = tiles[row * cols + col];
          if (!img) continue;
          // The canvas clips whatever falls outside the block, so a tile
          // straddling a block edge lands correctly in every block it touches.
          scratchCtx.drawImage(img, 0, 0, TILE_SIZE, TILE_SIZE, left, top, right - left, bottom - top);
        }
      }

      const block = scratchCtx.getImageData(0, 0, bw, bh);
      const rowBytes = bw * 4;
      for (let r = 0; r < bh; r++) {
        out.set(block.data.subarray(r * rowBytes, (r + 1) * rowBytes), ((by + r) * width + bx) * 4);
      }
    }
  }

  if (options?.grayscale) {
    // Terrarium tiles encode elevation as: elevation = (R*256 + G + B/256) - 32768
    // elevation <= 0  → sea  → (0, 0, 255)
    // elevation >  0  → land → grayscale 1–255 (normalised to max land elevation)
    // Two passes over the buffer (no extra elevation array) so huge maps stay
    // within memory.
    const len = out.length;
    let maxElev = 0;
    for (let i = 0; i < len; i += 4) {
      const elev = out[i] * 256 + out[i + 1] + out[i + 2] / 256 - 32768;
      if (elev > maxElev) maxElev = elev;
    }
    const range = maxElev || 1;

    for (let i = 0; i < len; i += 4) {
      const elev = out[i] * 256 + out[i + 1] + out[i + 2] / 256 - 32768;
      if (elev <= 0) {
        out[i] = 0; out[i + 1] = 0; out[i + 2] = 255;
      } else {
        const v = Math.max(1, Math.round(elev / range * 255));
        out[i] = v; out[i + 1] = v; out[i + 2] = v;
      }
      out[i + 3] = 255;
    }
  }

  return imageData;
}