import { riverComponents, writeRiverPixel } from '@/components/map/rivers/riverGrid';

export function removeShortRivers(grid, clear) {
  let fragments = 0, pixels = 0;
  for (const nodes of riverComponents(grid).components) if (nodes.length < 3) {
    fragments++; pixels += nodes.length; nodes.forEach(clear);
  }
  return { fragments, pixels };
}
export function restoreRiverFords(grid, data, originalFords) {
  let moved = 0, removed = 0;
  const { labels, components } = riverComponents(grid);
  for (const old of originalFords) {
    if (grid.mask[old] === 3) continue;
    // Only relocate along the same surviving channel, never onto another river.
    let id = labels[old];
    if (id < 0) id = grid.neighbors(old).map(n => labels[n]).find(value => value >= 0) ?? -1;
    const candidates = id < 0 ? [] : components[id].filter(n => grid.mask[n] === 1 && grid.neighbors(n).length === 2);
    const distance = n => Math.abs(n % grid.width - old % grid.width) + Math.abs(Math.floor(n / grid.width) - Math.floor(old / grid.width));
    const target = candidates.reduce((best,n) => best == null || distance(n) < distance(best) ? n : best, null);
    if (target == null) { removed++; continue; }
    grid.mask[target] = 3; writeRiverPixel(data,target,3); moved++;
  }
  return { fordsMoved: moved, fordsRemoved: removed };
}