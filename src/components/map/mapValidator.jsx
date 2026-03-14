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
        if (!isRiver(fr, fg, fb) && !isFord(fr, fg, fb)) continue;
        const hx = Math.round(x * (heights.width / w));
        const hy = Math.round(y * (heights.height / h));
        const [hr, hg, hb] = getPixel(heights.data, heights.width, hx, hy);
        if (isSeaHeight(hr, hg, hb)) {
          push('error', 'features', `River/ford on sea height at (${x},${y})`, x, y);
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

  return issues;
}