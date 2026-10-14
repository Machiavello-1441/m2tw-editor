import { riverGrid, riverComponents, writeRiverPixel } from '@/components/map/rivers/riverGrid';
import { thinRiverBlocks } from '@/components/map/rivers/riverThin';
import { openRiverLoops } from '@/components/map/rivers/riverCycles';
import { placeRiverSources } from '@/components/map/rivers/riverSources';
import { analyzeRivers } from '@/components/map/rivers/riverAnalysis';
import { joinRiverDiagonals } from '@/components/map/rivers/riverDiagonals';

export function repairRivers(image, options = {}) {
  const data = new Uint8ClampedArray(image.data), output = { data, width: image.width, height: image.height };
  let normalized = 0;
  for (let i = 0; i < data.length; i += 4) {
    const [r,g,b,a] = data.subarray(i, i + 4);
    if (a && b > 100 && b > r + 20 && b > g + 20 && !(r === 0 && g === 0 && b === 255)) { data.set([0,0,255,255], i); normalized++; }
  }
  const grid = riverGrid(output);
  const diagonalsJoined = joinRiverDiagonals(grid, data);
  const original = riverComponents(grid), protectedPixels = new Uint8Array(grid.mask.length);
  const anchors = [];
  for (let n = 0; n < grid.mask.length; n++) {
    if (!grid.mask[n]) continue;
    if (grid.mask[n] === 2) anchors.push(n);
    if (grid.neighbors(n).length <= 1 || grid.mask[n] === 3) protectedPixels[n] = 1;
  }
  const index = ([x,y]) => Math.max(0, Math.min(grid.height - 1, Math.round(y))) * grid.width + Math.max(0, Math.min(grid.width - 1, Math.round(x)));
  for (const hint of options.sourceHints || []) anchors.push(index(hint));
  const clear = n => { grid.mask[n] = 0; data.set([0,0,0,options.transparentBackground ? 0 : 255], n * 4); };
  const blocksThinned = thinRiverBlocks(grid, protectedPixels, clear);
  const loopsOpened = openRiverLoops(grid, original.components, protectedPixels, clear);
  // White interior markers are relocated, never collapsed to one global source.
  for (let n = 0; n < grid.mask.length; n++) if (grid.mask[n] === 2 && grid.neighbors(n).length !== 1) { grid.mask[n] = 1; writeRiverPixel(data, n, 1); }
  const sources = placeRiverSources(grid, data, original.components, [...new Set(anchors)], original.labels, (options.outletHints || []).map(index));
  const result = analyzeRivers(output);
  return { ...output, result, repairs: { blocksThinned, loopsOpened, diagonalsJoined, normalized, ...sources } };
}