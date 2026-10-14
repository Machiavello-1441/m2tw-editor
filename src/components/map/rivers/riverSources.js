import { writeRiverPixel } from '@/components/map/rivers/riverGrid';

export function placeRiverSources(grid, data, components, anchors, labels, outletHints = [], water = null) {
  let inferred = 0, relocated = 0, merged = 0;
  const byComponent = new Map(), outlets = new Map();
  for (const n of anchors) { const id = labels[n]; if (id < 0) continue; if (!byComponent.has(id)) byComponent.set(id, []); byComponent.get(id).push(n); }
  for (const n of outletHints) { const id = labels[n]; if (id >= 0) { if (!outlets.has(id)) outlets.set(id, []); outlets.get(id).push(n); } }
  const distance = (a, b) => (a % grid.width - b % grid.width) ** 2 + (Math.floor(a / grid.width) - Math.floor(b / grid.width)) ** 2;
  const nearest = (list, n) => list.reduce((best, p) => best == null || distance(p, n) < distance(best, n) ? p : best, null);
  for (let id = 0; id < components.length; id++) {
    const nodes = components[id].filter(n => grid.mask[n]);
    const leaves = nodes.filter(n => grid.neighbors(n).length === 1);
    if (leaves.length < 2) continue;
    const sourceAnchors = byComponent.get(id) || [];
    const outletCandidates = leaves.filter(n => grid.mask[n] !== 2 && !sourceAnchors.includes(n));
    const pool = outletCandidates.length ? outletCandidates : leaves;
    const hints = outlets.get(id);
    const coastal = water ? leaves.filter(n => water.beside(n)) : [];
    let outlet = coastal.length ? (hints?.length ? nearest(coastal,hints[0]) : coastal[0]) : hints?.length ? nearest(pool,hints[0]) : pool.find(grid.boundary);
    if (outlet == null) {
      outlet = sourceAnchors.length ? pool.reduce((best, n) => distance(n, sourceAnchors[0]) > distance(best, sourceAnchors[0]) ? n : best, pool[0]) : pool[pool.length - 1];
      if (!outletCandidates.length || !sourceAnchors.length) inferred++;
    }
    if (grid.mask[outlet] !== 1) { grid.mask[outlet] = 1; writeRiverPixel(data, outlet, 1); inferred++; }
    const otherLeaves = leaves.filter(n => n !== outlet), inland = water ? otherLeaves.filter(n => !water.at(n)) : [];
    const available = inland.length ? inland : otherLeaves, used = new Set();
    for (const anchor of sourceAnchors) {
      const leaf = nearest(available, anchor);
      if (used.has(leaf)) { merged++; continue; }
      used.add(leaf);
      if (leaf !== anchor) relocated++;
      grid.mask[leaf] = 2; writeRiverPixel(data, leaf, 2);
    }
    if (!used.size) {
      const head = available[0]; used.add(head); grid.mask[head] = 2; writeRiverPixel(data, head, 2); inferred++;
    }
    for (const n of nodes) if (grid.mask[n] === 2 && (!used.has(n) && used.size || grid.neighbors(n).length !== 1)) {
      grid.mask[n] = 1; writeRiverPixel(data, n, 1);
    }
  }
  return { inferred, relocated, merged };
}