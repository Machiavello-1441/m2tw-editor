import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SourceTextModule, SyntheticModule, createContext } from 'node:vm';
import { File } from 'node:buffer';
import JSZip from 'jszip';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const context = createContext({ console, TextDecoder, DataView, Uint8Array, Float64Array, Map, Set });
const modules = new Map();
async function load(path) {
  if (modules.has(path)) return modules.get(path);
  if (path === 'jszip') {
    const module = new SyntheticModule(['default'], function() { this.setExport('default', JSZip); }, { context });
    modules.set(path, module); return module;
  }
  const module = new SourceTextModule(await readFile(path, 'utf8'), { context, identifier: path });
  modules.set(path, module);
  await module.link(specifier => load(specifier === 'jszip' ? specifier : resolve(root, specifier.replace(/^@\//, '') + '.js')));
  return module;
}
const importer = await load(resolve(root, 'components/newmap/osmpacks/osmPackImport.js'));
await importer.evaluate();
const importPack = importer.namespace.default;
const bbox = { west: 0, east: 10, south: 0, north: 10 };
const rectangle = (west, south, east, north) => [[west, south], [west, north], [east, north], [east, south], [west, south]];
function geometry(records) {
  const sizes = records.map(rings => 44 + rings.length * 4 + rings.flat().length * 16);
  const buffer = new ArrayBuffer(100 + sizes.reduce((sum, size) => sum + size + 8, 0)), view = new DataView(buffer);
  view.setInt32(0, 9994); view.setInt32(24, buffer.byteLength / 2); view.setInt32(28, 1000, true); view.setInt32(32, 5, true);
  let pos = 100;
  records.forEach((rings, index) => {
    const points = rings.flat(), xs = points.map(point => point[0]), ys = points.map(point => point[1]);
    view.setInt32(pos, index + 1); view.setInt32(pos + 4, sizes[index] / 2); const start = pos + 8;
    view.setInt32(start, 5, true);
    [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)].forEach((value, n) => view.setFloat64(start + 4 + n * 8, value, true));
    view.setInt32(start + 36, rings.length, true); view.setInt32(start + 40, points.length, true);
    let offset = 0; rings.forEach((ring, n) => { view.setInt32(start + 44 + n * 4, offset, true); offset += ring.length; });
    points.forEach((point, n) => { view.setFloat64(start + 44 + rings.length * 4 + n * 16, point[0], true); view.setFloat64(start + 52 + rings.length * 4 + n * 16, point[1], true); });
    pos = start + sizes[index];
  });
  return buffer;
}
function attributes(names) {
  const fields = [['osm_id', 20], ['fclass', 30]], header = 32 + fields.length * 32 + 1, length = 51;
  const buffer = new ArrayBuffer(header + names.length * length + 1), bytes = new Uint8Array(buffer), view = new DataView(buffer), encoder = new TextEncoder();
  bytes[0] = 3; view.setUint32(4, names.length, true); view.setUint16(8, header, true); view.setUint16(10, length, true);
  fields.forEach(([name, size], n) => { bytes.set(encoder.encode(name), 32 + n * 32); bytes[32 + n * 32 + 11] = 67; bytes[32 + n * 32 + 16] = size; });
  bytes[header - 1] = 13;
  names.forEach((name, n) => { const start = header + n * length; bytes.fill(32, start, start + length); bytes.set(encoder.encode(String(n + 1).padEnd(20)), start + 1); bytes.set(encoder.encode(name.padEnd(30)), start + 21); });
  return buffer;
}
async function pack(records, names, projection = 'GEOGCS["GCS_WGS_1984"]', name = 'sample-261102-free.shp.zip') {
  const zip = new JSZip(), base = 'gis_osm_landuse_a_free_1';
  zip.file(`${base}.shp`, geometry(records)); zip.file(`${base}.dbf`, attributes(names)); zip.file(`${base}.prj`, projection); zip.file(`${base}.cpg`, 'UTF-8');
  return new File([await zip.generateAsync({ type: 'nodebuffer' })], name);
}
test('imports official-style area layers, clips boundaries and discovers zero-match classes', async () => {
  const file = await pack([[rectangle(-2, -2, 12, 12), rectangle(3, 3, 7, 7).reverse()], [rectangle(20, 20, 21, 21)]], ['forest', 'marsh']);
  const result = await importPack(file, bbox, () => {});
  assert.equal(result.features.length, 1); assert.equal(result.features[0].rings.length, 2);
  assert.equal(result.classes.length, 2); assert.equal(result.pack.id, 'sample-free.shp.zip');
  for (const ring of result.features[0].rings) for (const value of ring) assert.ok(value >= 0 && value <= 10);
});
test('a map entirely inside a polygon hole contains no matching area', async () => {
  const file = await pack([[rectangle(-5, -5, 15, 15), rectangle(-1, -1, 11, 11).reverse()]], ['water']);
  const result = await importPack(file, bbox, () => {});
  assert.equal(result.features.length, 0); assert.equal(result.classes[0].classification, 'water');
});
test('rejects reprojected data instead of placing it incorrectly', async () => {
  await assert.rejects(importPack(await pack([[rectangle(1, 1, 2, 2)]], ['forest'], 'PROJCS["WGS_1984_UTM"]'), bbox, () => {}), /WGS84/);
});
test('explains unsupported GeoPackage archives', async () => {
  const zip = new JSZip(); zip.file('region.gpkg', 'not a shapefile');
  const file = new File([await zip.generateAsync({ type: 'nodebuffer' })], 'region.gpkg.zip');
  await assert.rejects(importPack(file, bbox, () => {}), /GeoPackage/);
});