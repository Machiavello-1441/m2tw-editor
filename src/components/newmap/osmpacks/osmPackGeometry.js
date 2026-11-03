export const overlaps = (a, b) => a.east >= b.west && a.west <= b.east && a.north >= b.south && a.south <= b.north;
export const bboxKey = bbox => JSON.stringify([bbox?.west, bbox?.south, bbox?.east, bbox?.north]);

// Clip every ring independently; their even-odd relationship is retained at rasterisation.
export function clipRings(rings, bbox) {
  const edges = [[0, bbox.west, 1], [0, bbox.east, -1], [1, bbox.south, 1], [1, bbox.north, -1]];
  const result = [];
  for (const ring of rings) {
    let points = [];
    for (let n = 0; n < ring.length; n += 2) points.push([ring[n], ring[n + 1]]);
    for (const [axis, bound, direction] of edges) {
      const input = points; points = [];
      if (!input.length) break;
      let previous = input[input.length - 1], before = (previous[axis] - bound) * direction >= 0;
      for (const current of input) {
        const inside = (current[axis] - bound) * direction >= 0;
        if (inside !== before) {
          const ratio = (bound - previous[axis]) / (current[axis] - previous[axis]);
          points.push(axis === 0 ? [bound, previous[1] + ratio * (current[1] - previous[1])] : [previous[0] + ratio * (current[0] - previous[0]), bound]);
        }
        if (inside) points.push(current);
        previous = current; before = inside;
      }
    }
    if (points.length > 2) result.push(new Float64Array(points.flat()));
  }
  return result;
}

export function ringsHaveArea(rings) {
  let twiceArea = 0;
  for (const ring of rings) for (let n = 0, previous = ring.length - 2; n < ring.length; previous = n, n += 2) twiceArea += ring[previous] * ring[n + 1] - ring[n] * ring[previous + 1];
  return Math.abs(twiceArea) > 1e-14;
}

export function geometryHash(rings) {
  let hash = 2166136261;
  for (const ring of rings) for (const value of new Uint8Array(ring.buffer, ring.byteOffset, ring.byteLength)) hash = Math.imul(hash ^ value, 16777619);
  return (hash >>> 0).toString(36);
}