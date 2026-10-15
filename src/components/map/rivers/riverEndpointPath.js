export function terminalBranch(grid, start) {
  const nodes = [start];
  if (grid.neighbors(start).length !== 1) return nodes;
  let previous = start, next = grid.neighbors(start)[0];
  while (next != null && !nodes.includes(next)) {
    nodes.push(next);
    const adjacent = grid.neighbors(next).filter(n => n !== previous);
    if (adjacent.length !== 1) break;
    previous = next; next = adjacent[0];
  }
  return nodes;
}

// A one-pixel, edge-connected staircase along the clicked direction.
export function endpointPath(start, end, width) {
  let x = start % width, y = Math.floor(start / width);
  const tx = end % width, ty = Math.floor(end / width), dx = Math.abs(tx - x), dy = Math.abs(ty - y);
  const sx = Math.sign(tx - x), sy = Math.sign(ty - y), nodes = [start];
  let ix = 0, iy = 0;
  while (ix < dx || iy < dy) {
    if (ix < dx && (iy === dy || (ix + 0.5) * dy <= (iy + 0.5) * dx)) { x += sx; ix++; }
    else { y += sy; iy++; }
    nodes.push(y * width + x);
  }
  return nodes;
}