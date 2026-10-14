import { riverGrid, riverComponents } from '@/components/map/rivers/riverGrid';
import { riverLoopLocations } from '@/components/map/rivers/riverLoopLocations';
import { riverWater } from '@/components/map/rivers/riverWater';

export function analyzeRivers(image, options = {}) {
  const grid = riverGrid(image), { mask, neighbors, width: w, height: h } = grid;
  const { components, labels } = riverComponents(grid);
  const complete = components.map(nodes => nodes.some(n => mask[n] === 2 && neighbors(n).length === 1) && nodes.some(n => mask[n] !== 2 && neighbors(n).length === 1));
  const water = riverWater(options.heights, w, h);
  const issues = [], counts = {}, stats = { pixels: 0, sources: 0, outlets: 0, networks: components.length, blocks: 0, cycles: 0 };
  const emit = (type, desc, n, severity = 'error', amount = 1) => {
    counts[type] = (counts[type] || 0) + amount;
    issues.push({ type, desc, severity, x: n % w, y: Math.floor(n / w) });
  };
  for (let n = 0; n < mask.length; n++) {
    const i = n * 4, [r, g, b, a] = image.data.subarray(i, i + 4);
    if (!mask[n] && a && b > 100 && b > r + 20 && b > g + 20) emit('impure', `Impure river colour rgb(${r},${g},${b})`, n);
    if (!mask[n]) continue;
    const adj = neighbors(n); stats.pixels++;
    if (mask[n] === 2) {
      stats.sources++;
      if (adj.length !== 1 || mask[adj[0]] === 2) emit('source_position', 'White source must terminate a river with one edge-connected blue/ford neighbour', n);
      if (water?.at(n)) emit('source_water', 'Source is on blue heightmap water; prefer an inland head', n, 'warning');
    }
    if (!adj.length) emit('isolated', 'Isolated river/source pixel; no edge-connected channel', n);
    if (n % w < w - 1 && n + w < mask.length && mask[n + 1] && mask[n + w] && mask[n + w + 1]) { stats.blocks++; emit('block', 'Solid 2×2 river block (including source/ford pixels)', n); }
    // Interior pixels of separate nearby channels need not be connected.
    for (const dx of [-1, 1]) {
      const x = n % w + dx, other = n + w + dx;
      if (x >= 0 && x < w && other < mask.length && mask[other] && labels[n] !== labels[other] && !(complete[labels[n]] && complete[labels[other]]) && (adj.length <= 1 || neighbors(other).length <= 1)) emit('diagonal', 'River segments touch only at a diagonal corner', n);
    }
  }
  for (const nodes of components) {
    let edges = 0, sources = 0, outlets = 0;
    for (const n of nodes) { const degree = neighbors(n).length; edges += degree; if (mask[n] === 2) sources++; else if (degree === 1) outlets++; }
    const cycles = Math.max(0, edges / 2 - nodes.length + 1);
    stats.cycles += cycles; stats.outlets += outlets;
    if (nodes.length < 3) emit('short', `River fragment has ${nodes.length} pixel(s); minimum is 3: one source and two channel pixels`, nodes[0]);
    if (!sources) emit('missing_source', `River network (${nodes.length} pixels) has no white source`, nodes[0]);
    if (!outlets) emit('missing_outlet', 'River network has no unmarked terminal outlet', nodes[0]);
    if (water) for (const n of nodes) if (mask[n] !== 2 && neighbors(n).length === 1 && !grid.boundary(n) && !water.beside(n)) emit('inland_outlet', 'Outlet does not border blue heightmap water; inland outlets are allowed, but review the estuary', n, 'warning');
  }
  for (const n of riverLoopLocations(grid)) emit('loop', 'Fork/rejoin loop: retain a single route around this island', n);
  const errors = issues.filter(issue => issue.severity === 'error').length;
  return { issues, counts, total: issues.length, errors, warnings: issues.length - errors, stats };
}