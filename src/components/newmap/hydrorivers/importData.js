import JSZip from 'jszip';
import { readHydroShapes } from '@/components/newmap/hydrorivers/shpReader';

export async function importHydroFile(file, bbox) {
  if (/\.zip$/i.test(file.name)) {
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const shapes = Object.values(zip.files).filter(entry => !entry.dir && /\.shp$/i.test(entry.name));
    if (!shapes.length) throw new Error('This ZIP contains no shapefile. Download the Shapefile version, not Geodatabase.');
    const result = [];
    for (const shape of shapes) {
      const base = shape.name.replace(/\.shp$/i, '');
      const entries = Object.values(zip.files);
      const dbf = entries.find(entry => entry.name.toLowerCase() === `${base}.dbf`.toLowerCase());
      const prj = entries.find(entry => entry.name.toLowerCase() === `${base}.prj`.toLowerCase());
      if (!dbf) throw new Error('The shapefile ZIP is missing its .dbf attribute table.');
      if (prj) {
        const projection = await prj.async('string');
        if (/PROJCS|PROJCRS/i.test(projection) || !/WGS[_ ]?84|WGS[_ ]?1984/i.test(projection)) throw new Error('Use the official WGS84 HydroRIVERS regional data.');
      }
      const [geometry, attrs] = await Promise.all([shape.async('arraybuffer'), dbf.async('arraybuffer')]);
      for (const reach of readHydroShapes(geometry, attrs, bbox)) result.push(reach);
    }
    return result;
  }
  if (!/\.(geojson|json)$/i.test(file.name)) throw new Error('Import a regional HydroRIVERS shapefile ZIP or GeoJSON.');
  const json = JSON.parse(await file.text());
  if (json.type !== 'FeatureCollection' || !Array.isArray(json.features)) throw new Error('Expected a GeoJSON FeatureCollection.');
  if (json.crs && !/4326|CRS84/i.test(JSON.stringify(json.crs))) throw new Error('GeoJSON coordinates must use WGS84 longitude/latitude.');
  const result = [];
  for (const feature of json.features) {
    const props = Object.fromEntries(Object.entries(feature.properties || {}).map(([key, value]) => [key.toUpperCase(), value]));
    for (const key of ['HYRIV_ID', 'NEXT_DOWN', 'ORD_STRA']) if (props[key] == null || !Number.isFinite(Number(props[key]))) throw new Error(`Missing HydroRIVERS attribute ${key}.`);
    const g = feature.geometry;
    if (!g || !['LineString', 'MultiLineString'].includes(g.type)) throw new Error('HydroRIVERS GeoJSON must contain lines.');
    const parts = g.type === 'LineString' ? [g.coordinates] : g.coordinates;
    let west = Infinity, east = -Infinity, south = Infinity, north = -Infinity;
    for (const part of parts) for (const [lon, lat] of part) {
      if (!Number.isFinite(lon) || !Number.isFinite(lat) || Math.abs(lon) > 180 || Math.abs(lat) > 90) throw new Error('Invalid WGS84 river coordinates.');
      west = Math.min(west, lon); east = Math.max(east, lon); south = Math.min(south, lat); north = Math.max(north, lat);
    }
    if (east >= bbox.west && west <= bbox.east && north >= bbox.south && south <= bbox.north) result.push({ ...props, HYRIV_ID: Number(props.HYRIV_ID), NEXT_DOWN: Number(props.NEXT_DOWN), ORD_STRA: Number(props.ORD_STRA), parts });
  }
  return result;
}