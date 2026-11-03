import JSZip from 'jszip';
import readOsmAreas from '@/components/newmap/osmpacks/osmPackShapefile';

const MAX_ZIP = 1288490188, MAX_LAYER = 402653184;
export default async function importOsmPack(file, bbox, progress) {
  if (!/\.zip$/i.test(file.name)) throw new Error('Choose a Geofabrik shapefile ZIP, not a raw PBF or GeoPackage.');
  if (file.size > MAX_ZIP) throw new Error('This archive exceeds the 1.2 GiB browser import limit. Download smaller Geofabrik subregions.');
  progress(`Opening ${file.name}`, 0);
  const zip = await JSZip.loadAsync(await file.arrayBuffer()), entries = Object.values(zip.files).filter(entry => !entry.dir);
  const shapes = entries.filter(entry => /\.shp$/i.test(entry.name));
  if (!shapes.length) throw new Error(entries.some(entry => /\.gpkg$/i.test(entry.name)) ? 'This is a GeoPackage ZIP. Download the .shp.zip version; GeoPackage import is not included in this release.' : 'The ZIP contains no shapefiles. Keep the official Geofabrik shapefile ZIP intact.');
  const areaShapes = shapes.filter(entry => /_a(?:_|\.)|landuse|polygon/i.test(entry.name) && !/buildings/i.test(entry.name));
  if (!areaShapes.length) throw new Error('No Geofabrik area layers found. Point and line layers cannot paint ground areas.');
  const features = [], classes = new Map(), skipped = shapes.filter(entry => !areaShapes.includes(entry)).map(entry => entry.name.split('/').pop());
  let archiveDate = '', geometryBytes = 0;
  for (let n = 0; n < areaShapes.length; n++) {
    const shape = areaShapes[n], base = shape.name.replace(/\.shp$/i, '');
    const find = extension => entries.find(entry => entry.name.toLowerCase() === `${base}.${extension}`.toLowerCase());
    const dbf = find('dbf'), prj = find('prj'), cpg = find('cpg');
    if (!dbf || !prj) throw new Error(`${base}: missing .dbf or .prj companion file.`);
    const expandedBytes = (shape._data?.uncompressedSize || 0) + (dbf._data?.uncompressedSize || 0);
    if (expandedBytes > MAX_LAYER) throw new Error(`${base.split('/').pop()} expands beyond the 384 MiB per-layer limit. Choose smaller subregions.`);
    const projection = await prj.async('string');
    if (/PROJCS|PROJCRS/i.test(projection) || !/WGS[_ ]?(?:19)?84|WGS 84/i.test(projection)) throw new Error('Use an official WGS84 Geofabrik pack, not reprojected data.');
    const cpgText = cpg ? (await cpg.async('string')).trim().replace(/^\uFEFF/, '') : 'utf-8';
    const encoding = /^(65001|utf[- ]?8)$/i.test(cpgText) ? 'utf-8' : /^125\d$/.test(cpgText) ? `windows-${cpgText}` : cpgText;
    const layer = base.split('/').pop();
    progress(`Reading ${layer} (${n + 1}/${areaShapes.length})`, Math.round(n / areaShapes.length * 100));
    const geometry = await shape.async('arraybuffer'), attributes = await dbf.async('arraybuffer');
    const result = readOsmAreas(geometry, attributes, layer, bbox, encoding, pct => progress(`Reading ${layer}`, Math.round((n + pct / 100) / areaShapes.length * 100)));
    if (result.skipped) { skipped.push(shape.name); continue; }
    for (const feature of result.features) {
      geometryBytes += feature.rings.reduce((sum, ring) => sum + ring.byteLength, 0);
      if (geometryBytes > 201326592) throw new Error('This map retains too much polygon data. Use smaller map areas.');
      features.push(feature);
    }
    result.classes.forEach(item => classes.set(item.key, item));
    if (shape.date && (!archiveDate || shape.date.toISOString() > archiveDate)) archiveDate = shape.date.toISOString();
  }
  const packId = file.name.toLowerCase().replace(/-(?:latest|\d{6}|\d{8})(?=-free\.shp\.zip$)/, '');
  return { features, classes: [...classes.values()], pack: { id: packId, name: file.name, bytes: file.size, archiveDate, importedAt: new Date().toISOString(), layers: [...new Set([...classes.values()].map(item => item.layer))], skipped } };
}