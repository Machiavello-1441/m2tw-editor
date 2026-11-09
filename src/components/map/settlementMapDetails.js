const cache = new WeakMap();
const EMPTY = Object.freeze({ city: null, port: null });
const NEIGHBORS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const colorKey = (r, g, b) => r * 65536 + g * 256 + b;

function buildMarkerIndex(data, width, height) {
  const index = new Map();
  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      const i = (py * width + px) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const kind = r < 5 && g < 5 && b < 5 ? 'city' : r > 250 && g > 250 && b > 250 ? 'port' : null;
      if (!kind) continue;
      for (const [dx, dy] of NEIGHBORS) {
        const nx = px + dx, ny = py + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const ni = (ny * width + nx) * 4;
        const key = colorKey(data[ni], data[ni + 1], data[ni + 2]);
        let markers = index.get(key);
        if (!markers) { markers = { city: null, port: null }; index.set(key, markers); }
        markers[kind] ||= { px, py, stratY: height - 1 - py };
      }
    }
  }
  return index;
}

/** Collapsed search results do no pixel work; open details share one scan per layer revision. */
export default function settlementMapDetails(region, layer, expanded) {
  if (!expanded || !region || !layer?.data) return EMPTY;
  const { data, width, height } = layer;
  let saved = cache.get(layer);
  if (!saved || saved.data !== data || saved.width !== width || saved.height !== height) {
    saved = { data, width, height, index: buildMarkerIndex(data, width, height) };
    cache.set(layer, saved);
  }
  return saved.index.get(colorKey(region.r, region.g, region.b)) || EMPTY;
}