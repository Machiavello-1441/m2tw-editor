// One actual cycle-edge location per independent cycle, not a network's first pixel.
export function riverLoopLocations(grid) {
  const active = new Uint8Array(grid.mask.length), parent = new Int32Array(grid.mask.length); parent.fill(-1);
  const locations = [];
  for (let root = 0; root < grid.mask.length; root++) {
    if (!grid.mask[root] || active[root]) continue;
    const stack = [{ n: root, adjacent: grid.neighbors(root), index: 0 }]; active[root] = 1;
    while (stack.length) {
      const frame = stack[stack.length - 1];
      if (frame.index === frame.adjacent.length) { active[frame.n] = 2; stack.pop(); continue; }
      const next = frame.adjacent[frame.index++];
      if (next === parent[frame.n]) continue;
      if (!active[next]) { parent[next] = frame.n; active[next] = 1; stack.push({ n: next, adjacent: grid.neighbors(next), index: 0 }); }
      else if (active[next] === 1) locations.push(frame.n);
    }
  }
  return locations;
}