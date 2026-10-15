import { riverGrid, riverSquares, writeRiverPixel } from '@/components/map/rivers/riverGrid';
import { riverWater } from '@/components/map/rivers/riverWater';
import { terminalBranch, endpointPath } from '@/components/map/rivers/riverEndpointPath';

export function editRiverIssue(image, issue, target = null, heights = null) {
  if (!image || !['source_water', 'inland_outlet'].includes(issue?.type)) throw new Error('Select a source-on-water or inland-outlet warning first.');
  const { width, height } = image, grid = riverGrid(image), start = issue.y * width + issue.x;
  if (!grid.mask[start]) throw new Error('This river pixel has changed. Check Rivers again.');
  const output = { width, height, data: new Uint8ClampedArray(image.data) };
  const clear = n => output.data.set([0,0,0,255],n * 4);
  if (!target) { clear(start); return output; }
  if (!Number.isInteger(target.x) || !Number.isInteger(target.y) || target.x < 0 || target.y < 0 || target.x >= width || target.y >= height) throw new Error('Click inside the Features map.');
  const end = target.y * width + target.x, kind = issue.type === 'source_water' ? 2 : 1;
  if (end === start) throw new Error('Choose a different pixel for the replacement.');
  if (grid.neighbors(start).length !== 1) throw new Error('Replacement requires a terminal river pixel; this source is also a junction.');
  const water = riverWater(heights,width,height);
  if (kind === 2 && water?.at(end)) throw new Error('Choose an inland pixel for the source, not blue heightmap water.');
  if (kind === 1 && water && !water.beside(end) && !grid.boundary(end)) throw new Error('Choose an outlet beside blue heightmap water or on the map edge.');
  const branch = terminalBranch(grid,start), position = branch.indexOf(end);
  let changed;
  if (position > 0) { changed = branch.slice(0,position); changed.forEach(clear); }
  else {
    changed = endpointPath(start,end,width);
    for (const n of changed.slice(1)) {
      const i = n * 4, d = image.data;
      if (grid.mask[n] || (d[i+3] && (d[i] || d[i+1] || d[i+2]))) throw new Error('The connection crosses another river or feature. Choose a clear route from this endpoint.');
    }
    changed.forEach(n => writeRiverPixel(output.data,n,1));
  }
  writeRiverPixel(output.data,end,kind);
  const next = riverGrid(output);
  if (next.neighbors(end).length !== 1 || (kind === 2 && next.mask[next.neighbors(end)[0]] === 2)) throw new Error('Choose a terminal position, not a junction or a pixel beside another source.');
  if (changed.some(n => next.mask[n] && (riverSquares(next,n).length || (position < 0 && n !== end && next.neighbors(n).length !== 2)))) throw new Error('That connection would create a block or unwanted junction. Choose another position.');
  const nodes = [end], seen = new Set(nodes);
  for (let j = 0; j < nodes.length && nodes.length < 3; j++) for (const n of next.neighbors(nodes[j])) if (!seen.has(n)) { nodes.push(n); seen.add(n); }
  if (nodes.length < 3) throw new Error('Keep at least three connected river pixels.');
  return output;
}