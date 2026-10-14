// Remove a redundant fork-to-rejoin arm in one piece, rather than punching
// a hole in it and leaving two artificial dead-end branches.
export function riverLoopCorridor(grid, cycle, protectedPixels) {
  const junctions = cycle.filter(n => grid.neighbors(n).length !== 2);
  if (!junctions.length) {
    const n = cycle.find(p => !protectedPixels[p]);
    return n == null ? null : [n];
  }
  let best = null;
  const visited = new Set();
  for (let i = 0; i < cycle.length; i++) {
    const start = cycle[i];
    if (visited.has(start) || grid.neighbors(start).length !== 2) continue;
    const run = [start]; visited.add(start);
    for (const direction of [-1, 1]) {
      let next = (i + direction + cycle.length) % cycle.length;
      while (!visited.has(cycle[next]) && grid.neighbors(cycle[next]).length === 2) {
        run.push(cycle[next]); visited.add(cycle[next]); next = (next + direction + cycle.length) % cycle.length;
      }
    }
    const cost = run.reduce((sum,n) => sum + 1 + (grid.mask[n] === 3 ? 10000 : grid.mask[n] === 2 ? 1000 : 0),0);
    if (!best || cost < best.cost) best = { nodes: run, cost };
  }
  return best?.nodes || null;
}