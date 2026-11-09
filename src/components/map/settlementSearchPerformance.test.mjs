import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import settlementMapDetails from './settlementMapDetails.js';

const red = { r: 100, g: 20, b: 30 }, green = { r: 20, g: 100, b: 30 };
function raster(width = 12, height = 8) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const color = x < width / 2 ? red : green;
    data.set([color.r, color.g, color.b, 255], (y * width + x) * 4);
  }
  return { data, width, height };
}
function pixel(layer, x, y, value) { layer.data.set([...value, 255], (y * layer.width + x) * 4); }
function originalMarkers(region, { data, width, height }) {
  let city = null, port = null;
  for (let py = 0; py < height && (!city || !port); py++) {
    for (let px = 0; px < width && (!city || !port); px++) {
      const idx = (py * width + px) * 4;
      const r = data[idx], g = data[idx + 1], b = data[idx + 2];
      const black = r < 5 && g < 5 && b < 5;
      const white = r > 250 && g > 250 && b > 250;
      if (!black && !white) continue;
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nx = px + dx, ny = py + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const ni = (ny * width + nx) * 4;
        if (data[ni] === region.r && data[ni + 1] === region.g && data[ni + 2] === region.b) {
          if (black && !city) city = { px, py, stratY: height - 1 - py };
          if (white && !port) port = { px, py, stratY: height - 1 - py };
          break;
        }
      }
    }
  }
  return { city, port };
}

test('Searching or clearing filters with hundreds of collapsed results reads no map pixels', () => {
  const layer = { width: 8192, height: 8192, data: new Proxy({}, { get() { throw new Error('Collapsed result scanned the map'); } }) };
  for (let i = 0; i < 1000; i++) {
    assert.deepEqual(settlementMapDetails(red, layer, false), { city: null, port: null });
  }
});

test('City, port, first-marker order, and game Y coordinates match the original scan', () => {
  const layer = raster();
  pixel(layer, 1, 1, [0, 0, 0]); pixel(layer, 2, 3, [255, 255, 255]);
  pixel(layer, 3, 4, [0, 0, 0]); pixel(layer, 9, 0, [4, 4, 4]);
  pixel(layer, 11, 7, [251, 252, 254]);
  assert.deepEqual(settlementMapDetails(red, layer, true), originalMarkers(red, layer));
  assert.deepEqual(settlementMapDetails(green, layer, true), originalMarkers(green, layer));
  assert.deepEqual(settlementMapDetails(red, layer, true).city, { px: 1, py: 1, stratY: 6 });
});

test('All expanded results share one scan, including landlocked regions without ports', () => {
  const raw = raster(64, 64); pixel(raw, 2, 2, [0, 0, 0]);
  let reads = 0;
  const data = new Proxy(raw.data, { get(target, key) {
    if (typeof key === 'string' && /^\d+$/.test(key)) reads++;
    return Reflect.get(target, key, target);
  } });
  const layer = { ...raw, data };
  assert.equal(settlementMapDetails(red, layer, true).port, null);
  const firstScanReads = reads;
  assert.ok(firstScanReads >= raw.width * raw.height * 3);
  for (let i = 0; i < 500; i++) settlementMapDetails(i % 2 ? red : green, layer, true);
  assert.equal(reads, firstScanReads, 'Opening another settlement must not rescan the full map');
});

test('New painted layer revisions refresh positions even when the pixel buffer was mutated in place', () => {
  const layer = raster(); pixel(layer, 1, 1, [0, 0, 0]);
  assert.equal(settlementMapDetails(red, layer, true).city.px, 1);
  pixel(layer, 1, 1, [red.r, red.g, red.b]); pixel(layer, 3, 2, [0, 0, 0]);
  const painted = { ...layer, bitmap: {} };
  assert.deepEqual(settlementMapDetails(red, painted, true).city, { px: 3, py: 2, stratY: 5 });
});

test('No marker is invented for missing regions, absent layers, or diagonal-only adjacency', () => {
  assert.deepEqual(settlementMapDetails(null, raster(), true), { city: null, port: null });
  assert.deepEqual(settlementMapDetails(red, null, true), { city: null, port: null });
  const layer = raster(3, 3);
  layer.data.fill(50); pixel(layer, 0, 0, [0, 0, 0]); pixel(layer, 1, 1, [red.r, red.g, red.b]);
  assert.deepEqual(settlementMapDetails(red, layer, true), { city: null, port: null });
});

test('Mixed rasters preserve adjacency semantics for every region', () => {
  const colors = [red, green, { r: 20, g: 40, b: 130 }, { r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 }];
  const layer = raster(31, 19);
  for (let y = 0; y < layer.height; y++) for (let x = 0; x < layer.width; x++) {
    const c = colors[(x * 7 + y * 3 + x * y) % colors.length];
    pixel(layer, x, y, [c.r, c.g, c.b]);
  }
  for (const color of colors.slice(0, 3)) assert.deepEqual(settlementMapDetails(color, layer, true), originalMarkers(color, layer));
});

test('Search rows defer map and building work and reuse the shared region/resource lookups', () => {
  const source = readFileSync(new URL('./StratPanel.jsx', import.meta.url), 'utf8');
  const row = source.slice(source.indexOf('function SettlementRow('), source.indexOf('// ─── Main'));
  assert.match(row, /settlementMapDetails\(regionInfo, regionsLayer, expanded && !editing\)/);
  assert.match(row, /if \(!expanded \|\| !regionInfo/);
  assert.match(row, /editing \? availableSettlementBuildings/);
  assert.doesNotMatch(row, /extractHiddenResourcesFromEDB\(|regionsData\.find\(|for \(let py/);
  assert.match(source, /regionInfo=\{regionsByName\.get\(s\.region\)\}/);
  assert.match(source, /hiddenResourceMasterList=\{settlementHiddenResources\}/);
});