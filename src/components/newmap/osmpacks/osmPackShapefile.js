import openOsmDbf from '@/components/newmap/osmpacks/osmPackDbf';
import { overlaps, clipRings, geometryHash, ringsHaveArea } from '@/components/newmap/osmpacks/osmPackGeometry';

export default function readOsmAreas(shp, dbf, layer, bbox, encoding, progress) {
  const view = new DataView(shp), table = openOsmDbf(dbf, encoding), features = [], classes = new Map();
  if (shp.byteLength < 100 || view.getInt32(0) !== 9994 || view.getInt32(28, true) !== 1000) throw new Error('Invalid shapefile header.');
  if (![5, 15, 25].includes(view.getInt32(32, true))) return { features, classes: [], skipped: true };
  const declaredLength = view.getInt32(24) * 2;
  if (declaredLength > shp.byteLength || declaredLength < 100) throw new Error('The shapefile is truncated.');
  let index = 0, keptBytes = 0;
  for (let pos = 100; pos < declaredLength; index++) {
    if (pos + 8 > declaredLength) throw new Error('Incomplete geometry record.');
    const size = view.getInt32(pos + 4) * 2, start = pos + 8, end = start + size;
    if (size < 4 || end > declaredLength) throw new Error('Truncated geometry record.');
    pos = end;
    const props = table.read(index);
    if (!props || view.getInt32(start, true) === 0) continue;
    if (size < 44 || ![5, 15, 25].includes(view.getInt32(start, true))) throw new Error('Invalid area geometry.');
    const classification = props.fclass || '(unclassified)', key = `${layer}:${classification}`;
    classes.set(key, { key, layer, classification });
    const bounds = { west: view.getFloat64(start + 4, true), south: view.getFloat64(start + 12, true), east: view.getFloat64(start + 20, true), north: view.getFloat64(start + 28, true) };
    if (!Object.values(bounds).every(Number.isFinite) || bounds.west < -180 || bounds.east > 180 || bounds.south < -90 || bounds.north > 90) throw new Error('Expected WGS84 longitude/latitude coordinates.');
    if (!overlaps(bounds, bbox)) continue;
    const partCount = view.getInt32(start + 36, true), pointCount = view.getInt32(start + 40, true), pointStart = start + 44 + partCount * 4;
    if (partCount < 1 || pointCount < 3 || pointStart + pointCount * 16 > end) throw new Error('Invalid polygon vertices.');
    const rings = [];
    for (let p = 0; p < partCount; p++) {
      const a = view.getInt32(start + 44 + p * 4, true), b = p + 1 < partCount ? view.getInt32(start + 48 + p * 4, true) : pointCount;
      if (a < 0 || b > pointCount || b <= a || (p === 0 && a !== 0)) throw new Error('Invalid polygon ring boundaries.');
      const ring = new Float64Array((b - a) * 2);
      for (let n = a; n < b; n++) {
        const x = view.getFloat64(pointStart + n * 16, true), y = view.getFloat64(pointStart + n * 16 + 8, true);
        if (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > 180 || Math.abs(y) > 90) throw new Error('Invalid polygon coordinates.');
        ring[(n - a) * 2] = x; ring[(n - a) * 2 + 1] = y;
      }
      rings.push(ring);
    }
    const clipped = clipRings(rings, bbox);
    if (clipped.length && ringsHaveArea(clipped)) {
      keptBytes += clipped.reduce((sum, ring) => sum + ring.byteLength, 0);
      if (keptBytes > 201326592) throw new Error('Too much geometry overlaps this map. Import smaller regional packs.');
      features.push({ id: `${key}:${props.osm_type || ''}:${props.osm_id || ''}:${geometryHash(clipped)}`, key, rings: clipped });
    }
    if (index % 10000 === 0) progress(Math.round(pos / declaredLength * 100));
  }
  if (index !== table.count) throw new Error('Geometry and attribute record counts do not match.');
  return { features, classes: [...classes.values()] };
}