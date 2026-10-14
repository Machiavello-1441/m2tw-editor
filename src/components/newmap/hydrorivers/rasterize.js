import { selectHydroReaches, upstreamEndpoint, hydroEndpoints } from '@/components/newmap/hydrorivers/network';
import { repairRivers } from '@/components/map/rivers/riverRepair';
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
  let painted = 0, directionAmbiguities = 0;
  const sources = [], outlets = [];
  const inside = point => point[0] >= bbox.west && point[0] <= bbox.east && point[1] >= bbox.south && point[1] <= bbox.north;
  for (const reach of selected.values()) {
    let visible = false;
    for (const part of reach.parts) for (let i = 1; i < part.length; i++) {
      const segment = clipPixelSegment(project(part[i - 1]), project(part[i]), width, height);
      if (segment) { paintRiverSegment(mask, width, ...segment); visible = true; }
    }
    if (!visible) continue;
    painted++;
    const head = upstreamEndpoint(reach, all, incoming);
    if (head && !selected.has(reach.NEXT_DOWN)) {
      const ends = hydroEndpoints(reach), tail = head === ends[0] ? ends[1] : ends[0];
      if (inside(tail)) outlets.push(project(tail));
    }
    if (selectedIncoming.has(reach.HYRIV_ID)) continue;
    if (!head) { directionAmbiguities++; continue; }
    if (inside(head)) sources.push(project(head));
  }
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let n = 0; n < mask.length; n++) if (mask[n]) pixels.set([0,0,255,255], n * 4);
  const repaired = repairRivers({ data: pixels, width, height }, { sourceHints: sources, outletHints: outlets, transparentBackground: true });
  const result = repaired.result;
  return { pixels: repaired.data, stats: {
    selected: painted, available: reaches.length, origins: result.stats.sources,
    unresolved: (result.counts.source_position || 0) + (result.counts.missing_source || 0),
    blocks: result.stats.blocks, loops: result.stats.cycles, issues: result.total,
    directionAmbiguities, repairs: repaired.repairs,
  }, width, height };
}