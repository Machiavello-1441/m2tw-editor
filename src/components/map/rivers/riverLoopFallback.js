// At coarse resolution a loop can have a tributary on EVERY vertex. No vertex
// can then be removed while preserving every tip. Keep the main connected
// channel and explicitly account for discarded minor stubs rather than stop.
export function chooseLoopCut(grid, cycle) {
  let best = null;
  for (const cut of cycle) {
    const seen = new Set([cut]), parts = [];
    for (const start of grid.neighbors(cut)) {
      if (seen.has(start)) continue;
      const nodes = [start]; seen.add(start);
      for (let j = 0; j < nodes.length; j++) for (const next of grid.neighbors(nodes[j])) if (!seen.has(next)) { seen.add(next); nodes.push(next); }
      parts.push(nodes);
    }
    parts.sort((a,b) => b.length - a.length);
    const discarded = [cut, ...parts.slice(1).flat()];
    const cost = discarded.reduce((sum,n) => sum + 1 + (grid.mask[n] === 3 ? 10000 : grid.mask[n] === 2 ? 1000 : 0), 0);
    if (!best || cost < best.cost) best = { discarded, cost, detached: discarded.length - 1 };
  }
  return best;
}