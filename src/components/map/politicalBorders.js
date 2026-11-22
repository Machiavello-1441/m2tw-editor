/**
 * Hairline province borders for the political map view.
 *
 * The border is a thin stroke drawn along the edges *between* map_regions pixels,
 * instead of colouring a whole pixel, so it no longer eats into either province.
 * Geometry comes out in normalised image space and is projected exactly like the
 * raster overlay (linear in spherical-Mercator space), which keeps every line on
 * its pixel edge at any zoom level.
 */

const colourKey = (r, g, b) => (r << 16) | (g << 8) | b;

const MERCATOR_RADIUS = 6378137;
const MAX_LATITUDE = 85.05112878;

const mercatorY = lat => {
  const clamped = Math.max(-MAX_LATITUDE, Math.min(MAX_LATITUDE, lat));
  return MERCATOR_RADIUS * Math.log(Math.tan(Math.PI / 4 + (clamped * Math.PI) / 360));
};

const latitudeFromMercatorY = y =>
  (2 * Math.atan(Math.exp(y / MERCATOR_RADIUS)) - Math.PI / 2) * (180 / Math.PI);

/** Region index per pixel (-1 = no region), plus the matching style palette. */
function regionGrid(data, width, height, styles) {
  const palette = [];
  const indexByKey = new Map();
  for (const [key, style] of styles) {
    indexByKey.set(key, palette.length);
    palette.push(style);
  }
  const ids = new Int32Array(width * height);
  for (let p = 0; p < ids.length; p++) {
    const i = p * 4;
    const index = indexByKey.get(colourKey(data[i], data[i + 1], data[i + 2]));
    ids[p] = index === undefined ? -1 : index;
  }
  return { ids, palette };
}

const pushEdge = (map, key, value) => {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
};

/**
 * Border segments as { colour, u1, v1, u2, v2 } in normalised image space.
 * A segment either separates two provinces or outlines a province against the sea.
 * Each shared segment is emitted once, by the province with the lower index.
 */
export function politicalBorderRuns(data, width, height, styles) {
  const { ids, palette } = regionGrid(data, width, height, styles);
  const horizontal = new Map(); // `${gridLine}|${colour}` → x positions
  const vertical = new Map();   // `${gridLine}|${colour}` → y positions

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const id = ids[y * width + x];
      if (id < 0) continue;
      const border = palette[id].border;
      const key = colourKey(border[0], border[1], border[2]);
      const owns = neighbour => neighbour < 0 || id < neighbour;

      if (x > 0) {
        const left = ids[y * width + x - 1];
        if (left !== id && owns(left)) pushEdge(vertical, `${x}|${key}`, y);
      }
      if (x + 1 < width) {
        const right = ids[y * width + x + 1];
        if (right !== id && owns(right)) pushEdge(vertical, `${x + 1}|${key}`, y);
      }
      if (y > 0) {
        const above = ids[(y - 1) * width + x];
        if (above !== id && owns(above)) pushEdge(horizontal, `${y}|${key}`, x);
      }
      if (y + 1 < height) {
        const below = ids[(y + 1) * width + x];
        if (below !== id && owns(below)) pushEdge(horizontal, `${y + 1}|${key}`, x);
      }
    }
  }

  // Consecutive edges on the same grid line become one stroke.
  const runs = [];
  const collect = (map, verticalLine) => {
    for (const [edgeKey, positions] of map) {
      const separator = edgeKey.indexOf('|');
      const line = Number(edgeKey.slice(0, separator));
      const colour = Number(edgeKey.slice(separator + 1));
      positions.sort((a, b) => a - b);
      let start = positions[0];
      for (let i = 1; i <= positions.length; i++) {
        const continues = i < positions.length && positions[i] === positions[i - 1] + 1;
        if (continues) continue;
        const end = positions[i - 1] + 1;
        runs.push(verticalLine
          ? { colour, u1: line / width, v1: start / height, u2: line / width, v2: end / height }
          : { colour, u1: start / width, v1: line / height, u2: end / width, v2: line / height });
        if (i < positions.length) start = positions[i];
      }
    }
  };
  collect(vertical, true);
  collect(horizontal, false);
  return runs;
}

const cssColour = packed => `rgb(${(packed >> 16) & 255}, ${(packed >> 8) & 255}, ${packed & 255})`;

/** Runs grouped per border colour, as lat/lng positions ready for a polyline. */
export function borderLatLngGroups(runs, bounds) {
  const { north, south, east, west } = bounds;
  const top = mercatorY(north);
  const bottom = mercatorY(south);
  const lat = v => latitudeFromMercatorY(top + v * (bottom - top));
  const lng = u => west + u * (east - west);

  const groups = new Map();
  for (const run of runs) {
    let group = groups.get(run.colour);
    if (!group) {
      group = { key: run.colour, color: cssColour(run.colour), positions: [] };
      groups.set(run.colour, group);
    }
    group.positions.push([[lat(run.v1), lng(run.u1)], [lat(run.v2), lng(run.u2)]]);
  }
  return [...groups.values()];
}