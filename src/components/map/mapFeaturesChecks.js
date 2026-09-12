/**
 * map_features.tga topology checks — ported from map_features_checker.py.
 * Colours are matched exactly (the engine requires exact values).
 */
const BLACK = 0x000000, BLUE = 0x0000ff, CYAN = 0x00ffff, WHITE = 0xffffff;
const YELLOW = 0xffff00, RED = 0xff0000, GREEN = 0x00ff00;
const VALID = new Set([BLACK, BLUE, CYAN, WHITE, YELLOW, RED, GREEN]);
const CARDINAL = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const MAX_PER_CATEGORY = 150;

export function checkMapFeatures(features, push) {
  const { data, width: w, height: h } = features;
  const rgb = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return -1;
    const i = (y * w + x) * 4;
    return (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
  };
  const isRiver = (x, y) => { const c = rgb(x, y); return c === BLUE || c === CYAN; };
  const degree = (x, y) => CARDINAL.reduce((n, [dx, dy]) => n + (isRiver(x + dx, y + dy) ? 1 : 0), 0);
  const adj = (x, y, pred) => CARDINAL.some(([dx, dy]) => pred(x + dx, y + dy));

  const counts = {};
  const emit = (key, severity, message, x, y) => {
    counts[key] = (counts[key] || 0) + 1;
    if (counts[key] <= MAX_PER_CATEGORY) push(severity, 'features', message, x, y);
  };

  const invalidSeen = new Map();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = rgb(x, y);
      if (!VALID.has(c)) {
        const n = (invalidSeen.get(c) || 0) + 1;
        invalidSeen.set(c, n);
        if (n <= 5) push('error', 'features',
          `Invalid colour rgb(${c >> 16},${(c >> 8) & 255},${c & 255}) at (${x},${y}) — not a map_features colour`, x, y);
      }
      if (c === WHITE && !adj(x, y, isRiver))
        emit('orphan', 'error', `Orphan white river source at (${x},${y}) — no adjacent river pixel`, x, y);
      if (c === BLUE && degree(x, y) > 3)
        emit('cross', 'error', `Blue river crossroads (4-way junction) at (${x},${y})`, x, y);
      if (isRiver(x, y) && degree(x, y) === 0)
        emit('isolated', 'error', `Isolated river/ford pixel at (${x},${y})`, x, y);
      if (x < w - 1 && y < h - 1 && isRiver(x, y) && isRiver(x + 1, y) && isRiver(x, y + 1) && isRiver(x + 1, y + 1))
        emit('block', 'error', `2×2 river block at (${x},${y})`, x, y);
    }
  }
  for (const c of invalidSeen.keys()) {
    const n = invalidSeen.get(c);
    if (n > 5) push('error', 'features',
      `Invalid colour rgb(${c >> 16},${(c >> 8) & 255},${c & 255}): ${n} pixels total`, null, null);
  }

  // Connected river components (4-neighbour) without a white source
  const seen = new Uint8Array(w * h);
  let sourceFree = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (seen[y * w + x] || !isRiver(x, y)) continue;
      const queue = [[x, y]];
      seen[y * w + x] = 1;
      let size = 0, hasSource = false;
      for (let qi = 0; qi < queue.length; qi++) {
        const [px, py] = queue[qi];
        size++;
        if (!hasSource && adj(px, py, (nx, ny) => rgb(nx, ny) === WHITE)) hasSource = true;
        for (const [dx, dy] of CARDINAL) {
          const nx = px + dx, ny = py + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          if (!seen[ny * w + nx] && isRiver(nx, ny)) { seen[ny * w + nx] = 1; queue.push([nx, ny]); }
        }
      }
      if (!hasSource) {
        sourceFree++;
        if (sourceFree <= MAX_PER_CATEGORY)
          push('error', 'features', `River network (${size} px) has no white source pixel — starts at (${x},${y})`, x, y);
      }
    }
  }

  for (const [key, label] of [['cross', 'crossroads'], ['block', '2×2 blocks'], ['orphan', 'orphan sources'], ['isolated', 'isolated pixels']]) {
    if (counts[key] > MAX_PER_CATEGORY)
      push('warning', 'features', `${counts[key]} ${label} in total — showing first ${MAX_PER_CATEGORY}`, null, null);
  }
}