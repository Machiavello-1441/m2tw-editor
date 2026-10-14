import { chooseLoopCut } from '@/components/map/rivers/riverLoopFallback';
import { riverLoopCorridor } from '@/components/map/rivers/riverLoopCorridor';

function cycleIn(grid, nodes) {
  const visited = new Set(), active = new Set(), parent = new Map();
  for (const root of nodes) {
    if (!grid.mask[root] || visited.has(root)) continue;
    const stack = [{ n: root, adjacent: grid.neighbors(root), index: 0 }];
    visited.add(root); active.add(root); parent.set(root, -1);
    while (stack.length) {
      const frame = stack[stack.length - 1];
      if (frame.index === frame.adjacent.length) { active.delete(frame.n); stack.pop(); continue; }
      const next = frame.adjacent[frame.index++];
      if (next === parent.get(frame.n)) continue;
      if (!visited.has(next)) {
        visited.add(next); active.add(next); parent.set(next, frame.n); stack.push({ n: next, adjacent: grid.neighbors(next), index: 0 });
      } else if (active.has(next)) {
        const chain = [frame.n]; let n = frame.n;
        while (n !== next && parent.get(n) !== -1) { n = parent.get(n); chain.push(n); }
        if (n === next) return chain;
      }
    }
  }
  return null;
}
function safeRemoval(grid, n) {
  const adjacent = grid.neighbors(n);
  if (adjacent.length < 2) return false;
  const remaining = new Set(adjacent.slice(1)), seen = new Set([n, adjacent[0]]), queue = [adjacent[0]];
  for (let j = 0; j < queue.length && remaining.size; j++) for (const next of grid.neighbors(queue[j])) {
    if (seen.has(next)) continue;
    seen.add(next); queue.push(next); remaining.delete(next);
  }
  return !remaining.size;
}
export function openRiverLoops(grid, components, protectedPixels, clear) {
  let removed = 0, pruned = 0;
  for (const nodes of components) {
    for (;;) {
      const cycle = cycleIn(grid, nodes);
      if (!cycle) break;
      const corridor = riverLoopCorridor(grid,cycle,protectedPixels);
      if (corridor?.length) { corridor.forEach(clear); removed += corridor.length; continue; }
      const candidates = cycle.filter(n => !protectedPixels[n]).sort((a,b) => grid.neighbors(a).length - grid.neighbors(b).length);
      const n = candidates.find(candidate => safeRemoval(grid,candidate));
      if (n != null) { clear(n); removed++; continue; }
      const fallback = chooseLoopCut(grid,cycle);
      if (!fallback) break;
      fallback.discarded.forEach(clear); removed += fallback.discarded.length; pruned += fallback.detached;
    }
  }
  return { removed, pruned };
}