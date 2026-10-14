import { riverComponents, writeRiverPixel } from '@/components/map/rivers/riverGrid';

export function joinRiverDiagonals(grid, data) {
  const { labels, components } = riverComponents(grid), parents = components.map((_, id) => id);
  const complete = components.map(nodes => nodes.some(n => grid.mask[n] === 2 && grid.neighbors(n).length === 1) && nodes.some(n => grid.mask[n] !== 2 && grid.neighbors(n).length === 1));
  const root = id => { while (parents[id] !== id) { parents[id] = parents[parents[id]]; id = parents[id]; } return id; };
  const background = n => { const i = n * 4; return !data[i + 3] || !(data[i] || data[i + 1] || data[i + 2]); };
  let joined = 0;
  for (let n = 0; n < grid.mask.length; n++) {
    if (!grid.mask[n]) continue;
    for (const dx of [-1, 1]) {
      const x = n % grid.width + dx, other = n + grid.width + dx;
      if (x < 0 || x >= grid.width || other >= grid.mask.length || !grid.mask[other]) continue;
      if (root(labels[n]) === root(labels[other]) || (complete[root(labels[n])] && complete[root(labels[other])]) || (grid.neighbors(n).length > 1 && grid.neighbors(other).length > 1)) continue;
      const bridge = [n + dx, n + grid.width].find(candidate => {
        if (grid.mask[candidate] || !background(candidate)) return false;
        const neighbors = grid.neighbors(candidate), roots = neighbors.map(p => root(labels[p]));
        return new Set(roots).size === roots.length; // Never introduce a cycle.
      });
      if (bridge == null) continue;
      const neighbors = grid.neighbors(bridge), id = root(labels[n]);
      for (const p of neighbors) { const otherRoot = root(labels[p]); complete[id] = complete[id] || complete[otherRoot]; parents[otherRoot] = id; }
      labels[bridge] = id; grid.mask[bridge] = 1; writeRiverPixel(data, bridge, 1); joined++;
    }
  }
  return joined;
}