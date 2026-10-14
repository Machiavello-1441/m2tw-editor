export function riverGrid(image) {
  const { width, height, data } = image, mask = new Uint8Array(width * height);
  for (let n = 0; n < mask.length; n++) {
    const i = n * 4;
    if (!data[i + 3]) continue;
    if (data[i] === 255 && data[i + 1] === 255 && data[i + 2] === 255) mask[n] = 2;
    else if (data[i] === 0 && data[i + 2] === 255 && (data[i + 1] === 0 || data[i + 1] === 255)) mask[n] = data[i + 1] ? 3 : 1;
  }
  const neighbors = n => {
    const list = [], x = n % width;
    if (n >= width && mask[n - width]) list.push(n - width);
    if (x < width - 1 && mask[n + 1]) list.push(n + 1);
    if (n + width < mask.length && mask[n + width]) list.push(n + width);
    if (x && mask[n - 1]) list.push(n - 1);
    return list;
  };
  const boundary = n => n < width || n >= mask.length - width || n % width === 0 || n % width === width - 1;
  return { mask, neighbors, boundary, width, height };
}
export function riverComponents(grid) {
  const labels = new Int32Array(grid.mask.length); labels.fill(-1);
  const components = [];
  for (let n = 0; n < labels.length; n++) {
    if (!grid.mask[n] || labels[n] !== -1) continue;
    const nodes = [n], id = components.length;
    labels[n] = id;
    for (let j = 0; j < nodes.length; j++) for (const next of grid.neighbors(nodes[j])) {
      if (labels[next] === -1) { labels[next] = id; nodes.push(next); }
    }
    components.push(nodes);
  }
  return { labels, components };
}
export function riverSquares(grid, n) {
  const { width: w, height: h, mask } = grid, x = n % w, y = Math.floor(n / w), squares = [];
  for (const yy of [y - 1, y]) for (const xx of [x - 1, x]) {
    if (xx < 0 || yy < 0 || xx + 1 >= w || yy + 1 >= h) continue;
    const a = yy * w + xx;
    if (mask[a] && mask[a + 1] && mask[a + w] && mask[a + w + 1]) squares.push(a);
  }
  return squares;
}
export function writeRiverPixel(data, n, kind) {
  data.set(kind === 2 ? [255,255,255,255] : kind === 3 ? [0,255,255,255] : [0,0,255,255], n * 4);
}