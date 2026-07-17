/**
 * M2TW Campaign Map Validator
 */

function getPixel(data, width, x, y) {
  const i = (y * width + x) * 4;
  return [data[i], data[i+1], data[i+2]];
}

function colorDist(r1, g1, b1, r2, g2, b2) {
  return Math.abs(r1-r2) + Math.abs(g1-g2) + Math.abs(b1-b2);
}

function isSeaHeight(r, g, b) { return r < 10 && g < 10 && b > 200; }
function isRiver(r, g, b) { return r < 15 && g < 15 && b > 200; }
function isFord(r, g, b)  { return r < 15 && g > 200 && b > 200; }
function isFeatureBg(r, g, b) { return r < 12 && g < 12 && b < 12; }
function isRegionCity(r, g, b) { return r < 12 && g < 12 && b < 12; }
function isRegionPort(r, g, b) { return r > 243 && g > 243 && b > 243; }

const KNOWN_FEATURE_COLORS = [
  [0, 0, 255], [0, 255, 255], [255, 255, 255],
  [255, 255, 0], [0, 255, 0], [255, 0, 0],
];

// Impassable map_ground_types.tga tiles — a city (black) or port (white) marker
// must never sit on one of these.
const IMPASSABLE_GROUND = [
  [0, 64, 0],       // Forest Dense        — Dark Green
  [196, 128, 128],  // Mountains High      — Light Brown
  [98, 65, 65],     // Mountains Low       — Brown
  [64, 64, 64],     // Impassable Land     — Medium Grey
  [0, 0, 64],       // Impassable Sea      — Dark Blue
];

// Navigable water tiles on map_ground_types.tga — a port must partially overlap
// one of these AND a land ground tile (so it isn't completely inland or stranded).
const SEA_GROUND = [
  [64, 0, 0],       // Ocean      — Dark Maroon
  [128, 0, 0],      // Sea Deep   — Dark Red
  [196, 0, 0],      // Sea Shallow— Red
];

function matchesAny(r, g, b, list, tol = 18) {
  for (const [cr, cg, cb] of list) {
    if (colorDist(r, g, b, cr, cg, cb) <= tol) return true;
  }
  return false;
}
function isImpassableGround(r, g, b) { return matchesAny(r, g, b, IMPASSABLE_GROUND); }
function isSeaGround(r, g, b) { return matchesAny(r, g, b, SEA_GROUND); }

export function validateLayers(layers, step = 4) {
  const issues = [];
  let issueId = 0;
  const push = (severity, layer, message, x, y) =>
    issues.push({ id: issueId++, severity, layer, message, x, y });

  const heights  = layers['heights'];
  const ground   = layers['ground'];
  const features = layers['features'];
  const regions  = layers['regions'];

  // Check 1: Rivers/fords on sea heights
  if (heights?.data && features?.data) {
    const w = features.width, h = features.height;
    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        const [fr, fg, fb] = getPixel(features.data, w, x, y);
        const isR = isRiver(fr, fg, fb);
        const isF = isFord(fr, fg, fb);
        if (!isR && !isF) continue;
        const hx = Math.round(x * (heights.width / w));
        const hy = Math.round(y * (heights.height / h));
        const [hr, hg, hb] = getPixel(heights.data, heights.width, hx, hy);
        if (isSeaHeight(hr, hg, hb)) {
          // Fords crossing the sea are invalid; rivers often legitimately run
          // into the sea, so those stay a warning.
          if (isF) push('error', 'features', `Ford on sea height at (${x},${y})`, x, y);
          else     push('warning', 'features', `River on sea height at (${x},${y})`, x, y);
        }
      }
    }
  }

  // Check 2: Unknown feature colours
  if (features?.data) {
    const w = features.width, h = features.height;
    const unknownSet = new Set();
    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        const [r, g, b] = getPixel(features.data, w, x, y);
        if (isFeatureBg(r, g, b)) continue;
        const isKnown = KNOWN_FEATURE_COLORS.some(([kr,kg,kb]) => colorDist(r,g,b,kr,kg,kb) < 20);
        if (!isKnown) {
          const key = `${r},${g},${b}`;
          if (!unknownSet.has(key)) {
            unknownSet.add(key);
            push('warning', 'features', `Unknown feature colour rgb(${r},${g},${b}) at (${x},${y})`, x, y);
          }
        }
      }
    }
  }

  // Check 3: City/port markers in sea region
  if (regions?.data && heights?.data) {
    const rw = regions.width, rh = regions.height;
    for (let y = 0; y < rh; y += step) {
      for (let x = 0; x < rw; x += step) {
        const [rr, rg, rb] = getPixel(regions.data, rw, x, y);
        if (!isRegionCity(rr, rg, rb) && !isRegionPort(rr, rg, rb)) continue;
        const hx = Math.round(x * (heights.width / rw));
        const hy = Math.round(y * (heights.height / rh));
        const [hr, hg, hb] = getPixel(heights.data, heights.width, hx, hy);
        if (isSeaHeight(hr, hg, hb)) {
          const type = isRegionCity(rr, rg, rb) ? 'City' : 'Port';
          push('warning', 'regions', `${type} marker appears to be in sea at (${x},${y})`, x, y);
        }
      }
    }
  }

  // Check 4: Mismatched map sizes
  if (ground?.data && regions?.data) {
    const expectedGroundW = regions.width * 2 + 1;
    const expectedGroundH = regions.height * 2 + 1;
    if (Math.abs(ground.width - expectedGroundW) > 2 || Math.abs(ground.height - expectedGroundH) > 2) {
      push('error', 'ground',
        `Ground types size (${ground.width}×${ground.height}) doesn't match expected ${expectedGroundW}×${expectedGroundH} (2×regions+1)`,
        null, null);
    }
  }

  // Check 5: Features/regions size mismatch
  if (features?.data && regions?.data) {
    if (features.width !== regions.width || features.height !== regions.height) {
      push('error', 'features',
        `Features (${features.width}×${features.height}) and regions (${regions.width}×${regions.height}) must be the same size`,
        null, null);
    }
  }

  // Check 6: City (black) / Port (white) markers on impassable ground tiles.
  // Scanned at full resolution — markers are single pixels that step-sampling misses.
  if (regions?.data && ground?.data) {
    const rw = regions.width, rh = regions.height;
    for (let y = 0; y < rh; y++) {
      for (let x = 0; x < rw; x++) {
        const [rr, rg, rb] = getPixel(regions.data, rw, x, y);
        const isCity = isRegionCity(rr, rg, rb);
        if (!isCity && !isRegionPort(rr, rg, rb)) continue;
        const gx = Math.min(ground.width - 1, Math.round(x * ground.width / rw));
        const gy = Math.min(ground.height - 1, Math.round(y * ground.height / rh));
        const [gr, gg, gb] = getPixel(ground.data, ground.width, gx, gy);
        if (isImpassableGround(gr, gg, gb)) {
          const name = isCity ? 'City' : 'Port';
          push('error', 'regions',
            `${name} marker sits on impassable ground rgb(${gr},${gg},${gb}) at (${x},${y})`,
            x, y);
        }
      }
    }
  }

  // Check 7: Ports must not be completely inland — they must partially overlap a
  // land ground tile AND one of the navigable sea types (Ocean/Sea Deep/Sea Shallow).
  if (regions?.data && ground?.data) {
    const rw = regions.width, rh = regions.height;
    for (let y = 0; y < rh; y++) {
      for (let x = 0; x < rw; x++) {
        const [rr, rg, rb] = getPixel(regions.data, rw, x, y);
        if (!isRegionPort(rr, rg, rb)) continue;
        const gx = Math.min(ground.width - 1, Math.round(x * ground.width / rw));
        const gy = Math.min(ground.height - 1, Math.round(y * ground.height / rh));
        let seaCount = 0, landCount = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = gx + dx, ny = gy + dy;
            if (nx < 0 || ny < 0 || nx >= ground.width || ny >= ground.height) continue;
            const [gr, gg, gb] = getPixel(ground.data, ground.width, nx, ny);
            if (isSeaGround(gr, gg, gb)) seaCount++;
            else if (!isImpassableGround(gr, gg, gb)) landCount++;
          }
        }
        if (seaCount === 0) {
          push('error', 'regions',
            `Port at (${x},${y}) is completely inland — does not overlap Ocean/Sea ground tile`,
            x, y);
        } else if (landCount === 0) {
          push('warning', 'regions',
            `Port at (${x},${y}) does not partially overlap a land ground tile`,
            x, y);
        }
      }
    }
  }

  return issues;
}