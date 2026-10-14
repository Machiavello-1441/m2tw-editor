export function selectHydroReaches(reaches, minOrder) {
  const byId = new Map(reaches.map(reach => [reach.HYRIV_ID, reach]));
  const selected = new Map();
  for (const seed of reaches) {
    if (seed.ORD_STRA < minOrder) continue;
    let reach = seed;
    while (reach && !selected.has(reach.HYRIV_ID)) {
      selected.set(reach.HYRIV_ID, reach);
      reach = byId.get(reach.NEXT_DOWN);
    }
  }
  return selected;
}
export function hydroEndpoints(reach) {
  const first = reach.parts[0], last = reach.parts[reach.parts.length - 1];
  return [first[0], last[last.length - 1]];
}
const distance = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
export function upstreamEndpoint(reach, all, incoming) {
  const ends = hydroEndpoints(reach), next = all.get(reach.NEXT_DOWN);
  if (next) {
    const target = hydroEndpoints(next);
    const distances = ends.map(pt => Math.min(...target.map(other => distance(pt, other))));
    if (Math.abs(distances[0] - distances[1]) > 1e-16) return distances[0] < distances[1] ? ends[1] : ends[0];
  }
  const previous = incoming.get(reach.HYRIV_ID);
  if (previous?.length) {
    const target = previous.flatMap(hydroEndpoints);
    const distances = ends.map(pt => target.reduce((min, other) => Math.min(min, distance(pt, other)), Infinity));
    if (Math.abs(distances[0] - distances[1]) > 1e-16) return distances[0] < distances[1] ? ends[0] : ends[1];
  }
  // No inferred direction: never guess that the first vertex is a source.
  return null;
}