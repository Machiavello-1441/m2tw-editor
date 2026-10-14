import { selectHydroReaches, upstreamEndpoint } from '@/components/newmap/hydrorivers/network';
import { hydroProjection, clipPixelSegment, paintRiverSegment } from '@/components/newmap/hydrorivers/pixelGeometry';

export function rasterizeHydroRivers(reaches, bbox, width, height, minOrder) {
  const selected = selectHydroReaches(reaches, minOrder), all = new Map(reaches.map(r => [r.HYRIV_ID, r]));
  const incoming = new Map(), selectedIncoming = new Set();
  for (const reach of reaches) {
    if (!incoming.has(reach.NEXT_DOWN)) incoming.set(reach.NEXT_DOWN, []);
    incoming.get(reach.NEXT_DOWN).push(reach);
  }
  for (const reach of selected.values()) selectedIncoming.add(reach.NEXT_DOWN);
  const mask = new Uint8Array(width * height), project = hydroProjection(bbox, width, height);
  let painted = 0, unresolved = 0;
  const sources = [];
  for (const reach of selected.values()) {
    let visible = false;
    for (const part of reach.parts) for (let i = 1; i < part.length; i++) {
      const segment = clipPixelSegment(project(part[i - 1]), project(part[i]), width, height);
      if (segment) { paintRiverSegment(mask, width, ...segment); visible = true; }
    }
    if (!visible) continue;
    painted++;
    if (selectedIncoming.has(reach.HYRIV_ID)) continue;
    const head = upstreamEndpoint(reach, all, incoming);
    if (!head) { unresolved++; continue; }
    if (head[0] < bbox.west || head[0] > bbox.east || head[1] < bbox.south || head[1] > bbox.north) continue;
    const [x, y] = project(head).map(Math.round);
    const neighbors = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]].filter(([a, b]) => a >= 0 && a < width && b >= 0 && b < height && mask[b * width + a]).length;
    sources.push({ x, y, neighbors });
  }
  // Resolve markers after every reach is rasterized; only mark endpoint pixels.
  let origins = 0, blocks = 0;
  for (const { x, y } of sources) {
    const count = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]].filter(([a, b]) => a >= 0 && a < width && b >= 0 && b < height && mask[b * width + a]).length;
    if (count === 1 && mask[y * width + x] === 1) { mask[y * width + x] = 2; origins++; } else unresolved++;
  }
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const n = y * width + x, i = n * 4;
    if (mask[n]) { pixels[i + 2] = 255; pixels[i + 3] = 255; if (mask[n] === 2) { pixels[i] = 255; pixels[i + 1] = 255; } }
    if (x + 1 < width && y + 1 < height && mask[n] && mask[n + 1] && mask[n + width] && mask[n + width + 1]) blocks++;
  }
  return { pixels, stats: { selected: painted, available: reaches.length, origins, unresolved, blocks }, width, height };
}