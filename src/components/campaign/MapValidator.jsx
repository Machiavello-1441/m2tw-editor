/**
 * Campaign Map Validation
 * Scans loaded layers for common modding errors.
 */

function getPixel(data, width, x, y) {
  const i = (y * width + x) * 4;
  return [data[i], data[i+1], data[i+2]];
}

function rgbMatch(a, b) {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

const RIVER      = [0,   0,   255];
const FORD       = [0,   255, 255];
const RIVER_ORIG = [255, 255, 255];

// Cardinal neighbours only
function cardinalNeighbours(x, y, w, h) {
  return [
    [x-1, y], [x+1, y], [x, y-1], [x, y+1],
  ].filter(([nx, ny]) => nx >= 0 && ny >= 0 && nx < w && ny < h);
}

// Returns true if pixel at (x,y) is a river / ford / origin pixel
function isRiverFamily(rgb) {
  return rgbMatch(rgb, RIVER) || rgbMatch(rgb, FORD) || rgbMatch(rgb, RIVER_ORIG);
}

export function validateMap(layers) {
  const results = [];

  // ─── Heights ───
  const heights = layers.heights;
  if (heights) {
    let blackPixels = 0;
    for (let i = 0; i < heights.width * heights.height; i++) {
      const idx = i * 4;
      const r = heights.edited[idx], g = heights.edited[idx+1], b = heights.edited[idx+2];
      if (r === 0 && g === 0 && b === 0) blackPixels++;
    }
    if (blackPixels > 100) {
      results.push({
        severity: 'warning',
        layer: 'heights',
        message: `${blackPixels} pure black (0,0,0) land pixels detected. Large black areas without a .hgt file can cause graphical issues.`
      });
    }
  }

  // ─── Features (river validation) ───
  const features = layers.features;
  if (features) {
    const { width, height, edited } = features;

    // --- 2×2 river blocks (CTD) ---
    let riverBlockCount = 0;
    for (let y = 0; y < height - 1; y++) {
      for (let x = 0; x < width - 1; x++) {
        if (
          rgbMatch(getPixel(edited, width, x,   y),   RIVER) &&
          rgbMatch(getPixel(edited, width, x+1, y),   RIVER) &&
          rgbMatch(getPixel(edited, width, x,   y+1), RIVER) &&
          rgbMatch(getPixel(edited, width, x+1, y+1), RIVER)
        ) {
          riverBlockCount++;
        }
      }
    }
    if (riverBlockCount > 0) {
      results.push({
        severity: 'error',
        layer: 'features',
        message: `${riverBlockCount} 2×2 river pixel block(s) detected! This will cause a CTD. Rivers must be exactly 1 pixel wide.`
      });
    }

    // --- Collect all river / ford / origin pixel positions ---
    const riverPixels   = []; // pure blue
    const fordPixels    = []; // cyan
    const originPixels  = []; // white (within river context)
    let anyRiverFamily  = false;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const px = getPixel(edited, width, x, y);
        if (rgbMatch(px, RIVER))      { riverPixels.push([x, y]);  anyRiverFamily = true; }
        else if (rgbMatch(px, FORD))  { fordPixels.push([x, y]);   anyRiverFamily = true; }
        else if (rgbMatch(px, RIVER_ORIG)) { originPixels.push([x, y]); anyRiverFamily = true; }
      }
    }

    if (anyRiverFamily) {
      // --- Origin must connect to a river pixel ---
      let orphanOrigins = 0;
      for (const [ox, oy] of originPixels) {
        const hasRiverNeighbour = cardinalNeighbours(ox, oy, width, height).some(
          ([nx, ny]) => rgbMatch(getPixel(edited, width, nx, ny), RIVER)
        );
        if (!hasRiverNeighbour) orphanOrigins++;
      }
      if (orphanOrigins > 0) {
        results.push({
          severity: 'error',
          layer: 'features',
          message: `${orphanOrigins} river origin pixel(s) (255,255,255) not connected to a river (0,0,255). An origin must touch a river pixel on a cardinal side.`
        });
      }

      // --- No origin at all while river pixels exist ---
      if (riverPixels.length > 0 && originPixels.length === 0) {
        results.push({
          severity: 'warning',
          layer: 'features',
          message: 'River pixels detected but no river origin (255,255,255) found. Each river must have at least one origin pixel.'
        });
      }

      // --- Isolated river-family pixels (no cardinal river-family neighbour) ---
      // An isolated single pixel is almost certainly a misplaced ford or origin
      let isolatedRiver  = 0;
      let isolatedFord   = 0;

      for (const [rx, ry] of riverPixels) {
        const hasNeighbour = cardinalNeighbours(rx, ry, width, height).some(
          ([nx, ny]) => isRiverFamily(getPixel(edited, width, nx, ny))
        );
        if (!hasNeighbour) isolatedRiver++;
      }
      for (const [fx, fy] of fordPixels) {
        const hasRiverNeighbour = cardinalNeighbours(fx, fy, width, height).some(
          ([nx, ny]) => rgbMatch(getPixel(edited, width, nx, ny), RIVER)
        );
        if (!hasRiverNeighbour) isolatedFord++;
      }

      if (isolatedRiver > 0) {
        results.push({
          severity: 'error',
          layer: 'features',
          message: `${isolatedRiver} isolated river pixel(s) (0,0,255) found with no cardinal river/ford/origin neighbour. Rivers must form connected lines.`
        });
      }
      if (isolatedFord > 0) {
        results.push({
          severity: 'error',
          layer: 'features',
          message: `${isolatedFord} isolated ford pixel(s) (0,255,255) found not adjacent to a river pixel. Fords must sit on a river.`
        });
      }

      // --- Diagonal-only river connections (river flows diagonally = error) ---
      // A river pixel that only connects diagonally (no cardinal river neighbours)
      // but DOES have diagonal river neighbours is the diagonal-corner error.
      let diagonalConnections = 0;
      for (const [rx, ry] of riverPixels) {
        const cardinalRiver = cardinalNeighbours(rx, ry, width, height).some(
          ([nx, ny]) => isRiverFamily(getPixel(edited, width, nx, ny))
        );
        if (cardinalRiver) continue; // already covered by isolated check

        // Check diagonals
        const diagNeighbours = [
          [rx-1, ry-1],[rx+1, ry-1],[rx-1, ry+1],[rx+1, ry+1]
        ].filter(([nx, ny]) => nx >= 0 && ny >= 0 && nx < width && ny < height);
        const hasDiagonalRiver = diagNeighbours.some(
          ([nx, ny]) => isRiverFamily(getPixel(edited, width, nx, ny))
        );
        if (hasDiagonalRiver) diagonalConnections++;
      }
      if (diagonalConnections > 0) {
        results.push({
          severity: 'error',
          layer: 'features',
          message: `${diagonalConnections} river pixel(s) connected only diagonally. Rivers can only flow top/bottom/left/right – diagonal corners cause flow breaks.`
        });
      }

      // --- Summary info ---
      results.push({
        severity: 'info',
        layer: 'features',
        message: `River pixels: ${riverPixels.length} river, ${fordPixels.length} ford(s), ${originPixels.length} origin(s).`
      });
    }
  }

  // ─── Regions ───
  const regions = layers.regions;
  if (regions) {
    const { width, height, edited } = regions;

    const colorSet = new Set();
    let cityCount = 0;
    let portCount = 0;
    for (let i = 0; i < width * height; i++) {
      const idx = i * 4;
      const r = edited[idx], g = edited[idx+1], b = edited[idx+2];
      if (r === 0 && g === 0 && b === 0) { cityCount++; continue; }
      if (r === 255 && g === 255 && b === 255) { portCount++; continue; }
      if (r === 41 && g === 140) continue; // sea variants
      colorSet.add(`${r},${g},${b}`);
    }
    const uniqueRegions = colorSet.size;
    if (uniqueRegions > 200) {
      results.push({
        severity: 'error',
        layer: 'regions',
        message: `${uniqueRegions} unique region colors found. Maximum is 200 (including sea variants). Reduce region count to avoid crashes.`
      });
    } else {
      results.push({
        severity: 'info',
        layer: 'regions',
        message: `${uniqueRegions} unique region color(s). ${cityCount} city pixel(s) (0,0,0). ${portCount} port pixel(s) (255,255,255).`
      });
    }

    if (cityCount === 0 && uniqueRegions > 0) {
      results.push({
        severity: 'warning',
        layer: 'regions',
        message: 'No city pixels (0,0,0) found. Each land region should have exactly one city pixel.'
      });
    }

    // Ground types size cross-check: must be 2×regions + 1 on each axis
    if (layers.ground_types) {
      const gt = layers.ground_types;
      const expectedW = width * 2 + 1;
      const expectedH = height * 2 + 1;
      if (gt.width !== expectedW || gt.height !== expectedH) {
        results.push({
          severity: 'error',
          layer: 'ground_types',
          message: `map_ground_types.tga size mismatch. Expected ${expectedW}×${expectedH} (regions×2+1) but got ${gt.width}×${gt.height}.`
        });
      } else {
        results.push({
          severity: 'info',
          layer: 'ground_types',
          message: `map_ground_types.tga size correct (${gt.width}×${gt.height} = regions×2+1).`
        });
      }
    }
  }

  // ─── Ground Types impassable check ───
  if (layers.ground_types) {
    const gt = layers.ground_types;
    let impassCount = 0;
    for (let i = 0; i < gt.width * gt.height; i++) {
      const idx = i * 4;
      if (gt.edited[idx] === 64 && gt.edited[idx+1] === 64 && gt.edited[idx+2] === 64) impassCount++;
    }
    if (impassCount > 0) {
      results.push({
        severity: 'info',
        layer: 'ground_types',
        message: `${impassCount} Impassable Land (64,64,64) pixels found. Ensure no city or port is placed on impassable terrain.`
      });
    }
  }

  // ─── Fog ───
  if (layers.fog) {
    const { width, height, edited } = layers.fog;
    let invalid = 0;
    for (let i = 0; i < width * height; i++) {
      const idx = i * 4;
      const r = edited[idx], g = edited[idx+1], b = edited[idx+2];
      if (!(r === 0 && g === 0 && b === 0) && !(r === 255 && g === 255 && b === 255)) invalid++;
    }
    if (invalid > 0) {
      results.push({
        severity: 'warning',
        layer: 'fog',
        message: `${invalid} non-black/non-white pixel(s) in map_fog.tga. This file should only contain pure black (hidden) or white (visible) pixels.`
      });
    }
  }

  if (results.filter(r => r.severity !== 'info').length === 0 && Object.keys(layers).length > 0) {
    results.push({ severity: 'success', layer: 'all', message: 'No errors or warnings detected across loaded layers.' });
  }

  return results;
}