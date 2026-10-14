import { riverSquares } from '@/components/map/rivers/riverGrid';

// Delete only a simple 4-connected point: its neighbours must remain joined
// within the surrounding 3×3 ring without passing through the removed pixel.
function simplePoint(grid, n) {
  const targets = grid.neighbors(n);
  if (targets.length < 2) return false;
  const x = n % grid.width, y = Math.floor(n / grid.width), visited = new Set([targets[0]]), queue = [targets[0]];
  for (let j = 0; j < queue.length; j++) for (const next of grid.neighbors(queue[j])) {
    if (next === n || visited.has(next) || Math.abs(next % grid.width - x) > 1 || Math.abs(Math.floor(next / grid.width) - y) > 1) continue;
    visited.add(next); queue.push(next);
  }
  return targets.every(target => visited.has(target));
}
export function thinRiverBlocks(grid, protectedPixels, clear) {
  const queue = [], queued = new Uint8Array(grid.mask.length);
  const enqueue = n => { if (grid.mask[n] && !protectedPixels[n] && !queued[n] && riverSquares(grid, n).length) { queued[n] = 1; queue.push(n); } };
  for (let n = 0; n < grid.mask.length; n++) enqueue(n);
  let removed = 0;
  for (let j = 0; j < queue.length; j++) {
    const n = queue[j]; queued[n] = 0;
    if (!grid.mask[n] || protectedPixels[n] || !riverSquares(grid, n).length || !simplePoint(grid, n)) continue;
    clear(n); removed++;
    const x = n % grid.width, y = Math.floor(n / grid.width);
    for (let yy = Math.max(0, y - 1); yy <= Math.min(grid.height - 1, y + 1); yy++)
      for (let xx = Math.max(0, x - 1); xx <= Math.min(grid.width - 1, x + 1); xx++) enqueue(yy * grid.width + xx);
  }
  return removed;
}