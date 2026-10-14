import { openHydroDbf } from '@/components/newmap/hydrorivers/dbfReader';

export function readHydroShapes(shp, dbf, bbox) {
  const view = new DataView(shp), table = openHydroDbf(dbf), reaches = [];
  if (shp.byteLength < 100 || view.getInt32(0) !== 9994) throw new Error('Invalid shapefile geometry.');
  const type = view.getInt32(32, true);
  if (![3, 13, 23].includes(type)) throw new Error('Expected HydroRIVERS line geometry, not polygons or points.');
  let index = 0;
  for (let pos = 100; pos + 8 <= shp.byteLength; index++) {
    const size = view.getInt32(pos + 4) * 2, start = pos + 8, end = start + size;
    if (size < 4 || end > shp.byteLength) throw new Error('The shapefile is truncated.');
    pos = end;
    if (view.getInt32(start, true) === 0) continue;
    if (size < 44) throw new Error('Invalid river record.');
    const west = view.getFloat64(start + 4, true), south = view.getFloat64(start + 12, true);
    const east = view.getFloat64(start + 20, true), north = view.getFloat64(start + 28, true);
    if (west < -180 || east > 180 || south < -90 || north > 90) throw new Error('River coordinates must be WGS84 longitude/latitude.');
    if (east < bbox.west || west > bbox.east || north < bbox.south || south > bbox.north) continue;
    const props = table.read(index);
    if (!props) continue;
    const partsCount = view.getInt32(start + 36, true), pointsCount = view.getInt32(start + 40, true);
    const pointsStart = start + 44 + partsCount * 4;
    if (partsCount < 1 || pointsCount < 2 || pointsStart + pointsCount * 16 > end) throw new Error('Invalid river vertices.');
    const parts = [];
    for (let p = 0; p < partsCount; p++) {
      const a = view.getInt32(start + 44 + p * 4, true);
      const b = p + 1 < partsCount ? view.getInt32(start + 48 + p * 4, true) : pointsCount;
      if (a < 0 || b > pointsCount || b < a) throw new Error('Invalid river part boundaries.');
      const points = [];
      for (let n = a; n < b; n++) points.push([view.getFloat64(pointsStart + n * 16, true), view.getFloat64(pointsStart + n * 16 + 8, true)]);
      if (points.length > 1) parts.push(points);
    }
    if (parts.length) reaches.push({ ...props, parts });
  }
  if (index !== table.count) throw new Error('River geometry and attribute record counts do not match.');
  return reaches;
}