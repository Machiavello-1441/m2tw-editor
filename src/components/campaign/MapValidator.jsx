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

export function validateMap(layers) {
  const results = [];

  // ─── Heights ───
  const heights = layers.heights;
  if (heights) {
    let seaPixels = 0;
    let blackPixels = 0;
    for (let i = 0; i < heights.width * heights.height; i++) {
      const idx = i * 4;
      const r = heights.edited[idx], g = heights.edited[idx+1], b = heights.edited[idx+2];
      if (r === 0 && g === 0 && b === 253) seaPixels++;
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

  // ─── Features ───
  const features = layers.features;
  if (features) {
    const { width, height, edited } = features;

    // Check for 2x2 river blocks (causes CTD)
    let riverBlockCount = 0;
    const RIVER = [0, 0, 255];
    for (let y = 0; y < height - 1; y++) {
      for (let x = 0; x < width - 1; x++) {
        if (
          rgbMatch(getPixel(edited, width, x, y), RIVER) &&
          rgbMatch(getPixel(edited, width, x+1, y), RIVER) &&
          rgbMatch(getPixel(edited, width, x, y+1), RIVER) &&
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
        message: `${riverBlockCount} 2×2 river pixel block(s) detected! This will cause a CTD when generating map.rwm. Rivers must be exactly 1 pixel wide.`
      });
    }

    // Check for rivers with no origin (white pixel)
    const RIVER_ORIGIN = [255, 255, 255];
    let riverPixelFound = false;
    let originFound = false;
    for (let i = 0; i < width * height; i++) {
      const idx = i * 4;
      const r = edited[idx], g = edited[idx+1], b = edited[idx+2];
      if (r === 0 && g === 0 && b === 255) riverPixelFound = true;
      if (r === 255 && g === 255 && b === 255) originFound = true;
    }
    if (riverPixelFound && !originFound) {
      results.push({
        severity: 'warning',
        layer: 'features',
        message: 'River pixels detected but no river origin (white pixel, 255,255,255) found. Each river should have at least one origin.'
      });
    }
  }

  // ─── Regions ───
  const regions = layers.regions;
  if (regions) {
    const { width, height, edited } = regions;

    // Count unique region colors (excluding known sea colors, city, port)
    const knownColors = new Set([
      '0,0,0',        // city
      '255,255,255',  // port
      '41,140,233',   // sea default
    ]);
    const colorSet = new Set();
    let cityCount = 0;
    let portCount = 0;
    for (let i = 0; i < width * height; i++) {
      const idx = i * 4;
      const r = edited[idx], g = edited[idx+1], b = edited[idx+2];
      const key = `${r},${g},${b}`;
      if (r === 0 && g === 0 && b === 0) { cityCount++; continue; }
      if (r === 255 && g === 255 && b === 255) { portCount++; continue; }
      if (r === 41 && g === 140) continue; // sea variants
      colorSet.add(key);
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
        message: `${uniqueRegions} unique region color(s) detected. ${cityCount} city pixel(s), ${portCount} port pixel(s).`
      });
    }

    if (cityCount === 0 && uniqueRegions > 0) {
      results.push({
        severity: 'warning',
        layer: 'regions',
        message: 'No city pixels (0,0,0) detected in map_regions.tga. Each land region should have exactly one city pixel.'
      });
    }
  }

  // ─── Ground Types vs Heights cross-check ───
  if (heights && layers.ground_types) {
    const gt = layers.ground_types;
    // Ground types is 2x+1 size relative to regions, skip deep cross-check for now
    // Check for impassable land pixels placed on region city/port locations (proxy check)
    const IMPASS = [64, 64, 64];
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
      const isBlack = r === 0 && g === 0 && b === 0;
      const isWhite = r === 255 && g === 255 && b === 255;
      if (!isBlack && !isWhite) invalid++;
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