// Shared tile computation for OSM data fetching.
// Tiles are sub-divisions of the bbox used to keep Overpass queries small.

export const TILE_THRESHOLD_DEG2 = 9; // ~3°×3° tile before splitting
export const MAX_TILES_PER_AXIS = 6;

/**
 * Split a bbox into a grid of sub-tiles, each ≤ TILE_THRESHOLD_DEG2 sq degrees.
 * Returns an array of { south, north, west, east } objects.
 */
export function computeTiles(bbox) {
  if (!bbox) return [];
  const dLat = bbox.north - bbox.south;
  const dLon = bbox.east - bbox.west;
  const area = dLat * dLon;
  if (area <= TILE_THRESHOLD_DEG2) return [bbox]; // small enough — single fetch
  const nSide = Math.ceil(Math.sqrt(area / TILE_THRESHOLD_DEG2));
  const n = Math.min(nSide, MAX_TILES_PER_AXIS);
  const tiles = [];
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      tiles.push({
        south: bbox.south + (dLat / n) * row,
        north: bbox.south + (dLat / n) * (row + 1),
        west:  bbox.west  + (dLon / n) * col,
        east:  bbox.west  + (dLon / n) * (col + 1),
      });
    }
  }
  return tiles;
}