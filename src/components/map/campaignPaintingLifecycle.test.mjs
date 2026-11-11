import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const bundle = await build({
  absWorkingDir: root,
  stdin: { resolveDir: root, contents: `
    export { default as queue } from './src/components/map/campaignPaintQueue';
    export { default as encoder } from './src/components/map/mapLayerPreviewEncoder';
  ` },
  bundle: true, write: false, format: 'iife', platform: 'browser', globalName: 'Painting',
  alias: { '@': path.join(root, 'src') }, define: { 'process.env.NODE_ENV': '"test"' }, logLevel: 'silent',
});
const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
function runtime() {
  let timerId = 0, urlId = 0;
  const timers = new Map(), uploads = [], encodes = [], writes = [], urls = new Set(), revoked = [], canvases = [];
  const context = vm.createContext({
    console, Uint8ClampedArray, Promise,
    setTimeout: fn => { timers.set(++timerId, fn); return timerId; }, clearTimeout: id => timers.delete(id),
    ImageData: class { constructor(data, width, height) { Object.assign(this, { data, width, height }); } },
    createImageBitmap: image => new Promise(resolve => {
      const bitmap = { width: image.width, height: image.height, pixels: image.data.slice(), closed: false,
        close() { this.closed = true; this.width = 0; this.height = 0; } };
      uploads.push({ bitmap, finish: () => resolve(bitmap) });
    }),
    URL: { createObjectURL() { const url = `blob:preview-${++urlId}`; urls.add(url); return url; },
      revokeObjectURL(url) { urls.delete(url); revoked.push(url); } },
    document: { createElement() {
      const canvas = { width: 0, height: 0, getContext: () => ({
        drawImage() { throw new Error('Detached sources must never reach drawImage'); },
        putImageData(image) { writes.push({ pixels: image.data.slice(), width: image.width, height: image.height }); },
      }), toBlob(callback) { encodes.push({ finish: () => callback({ png: true }) }); } };
      canvases.push(canvas); return canvas;
    } },
  });
  vm.runInContext(bundle.outputFiles[0].text, context);
  return { a: context.Painting, timers, uploads, encodes, writes, urls, revoked, canvases,
    tick() { const jobs = [...timers.values()]; timers.clear(); jobs.forEach(fn => fn()); } };
}
function layer() { return { width: 2, height: 1, data: new Uint8ClampedArray([0, 0, 0, 255, 80, 90, 100, 255]), bitmap: { width: 2, height: 1 } }; }

test('Continuous strokes do not postpone the timer, and GPU work never overlaps', async () => {
  const r = runtime(), ref = { current: { regions: layer() } }, updates = [];
  const queue = r.a.queue(ref, update => updates.push(update));
  queue.schedule('regions', ref.current.regions.data);
  const firstTimer = [...r.timers.keys()][0];
  for (let i = 0; i < 30; i++) queue.schedule('regions', ref.current.regions.data);
  assert.equal([...r.timers.keys()][0], firstTimer, 'Continuous moves must not restart the display timer');
  r.tick(); assert.equal(r.uploads.length, 1);
  ref.current.regions.data[0] = 120;
  for (let i = 0; i < 30; i++) queue.schedule('regions', ref.current.regions.data);
  assert.equal(r.uploads.length, 1); assert.equal(r.timers.size, 0);
  r.uploads[0].finish(); await settle();
  assert.equal(updates.length, 1);
  ref.current = updates.shift()(ref.current);
  assert.equal(r.timers.size, 1);
  r.tick(); assert.equal(r.uploads.length, 2);
  assert.equal(r.uploads[1].bitmap.pixels[0], 120);
  r.uploads[1].finish(); await settle();
  ref.current = updates.shift()(ref.current);
  queue.dispose();
  assert.equal(ref.current.regions.bitmap.closed, false, 'A campaign cache may still use this published bitmap');
});

test('Queued React commits and later renders never receive a bitmap closed by its producer', async () => {
  const r = runtime(), ref = { current: { regions: layer() } }, updates = [];
  const queue = r.a.queue(ref, update => updates.push(update));
  queue.schedule('regions', ref.current.regions.data); r.tick();
  r.uploads[0].finish(); await settle();
  queue.dispose(); queue.resume();
  const next = updates[0](ref.current);
  assert.equal(next.regions.bitmap.closed, false);
  const twice = updates[0](ref.current);
  assert.equal(twice.regions.bitmap.closed, false, 'React updater replay must be free of resource-closing side effects');
  queue.dispose();
});

test('Undo, campaign switches, and unmount discard only unpublished previews', async () => {
  const r = runtime(), ref = { current: { regions: layer() } }, updates = [];
  const original = ref.current.regions.bitmap;
  const queue = r.a.queue(ref, update => updates.push(update));
  queue.schedule('regions', ref.current.regions.data); r.tick();
  queue.cancel(); ref.current = { regions: layer() };
  r.uploads[0].finish(); await settle();
  assert.equal(r.uploads[0].bitmap.closed, true); assert.equal(updates.length, 0);
  assert.equal(original.width, 2);
  queue.schedule('regions', ref.current.regions.data); r.tick(); queue.dispose();
  r.uploads[1].finish(); await settle();
  assert.equal(r.uploads[1].bitmap.closed, true); assert.equal(updates.length, 0);
});

test('Save flush waits for active and newly queued strokes, retaining the final pixels', async () => {
  const r = runtime(), ref = { current: { regions: layer() } };
  const queue = r.a.queue(ref, update => { ref.current = update(ref.current); });
  queue.schedule('regions', ref.current.regions.data); r.tick();
  ref.current.regions.data[0] = 140; queue.schedule('regions', ref.current.regions.data);
  let complete = false;
  const flush = queue.flush().then(() => { complete = true; });
  r.uploads[0].finish(); await settle();
  assert.equal(complete, false); assert.equal(r.uploads.length, 2);
  r.uploads[1].finish(); await flush;
  assert.equal(complete, true); assert.equal(ref.current.regions.bitmap.pixels[0], 140);
  assert.equal(r.timers.size, 0); queue.dispose();
});

test('Pixel-backed overlay recovers even if the cached image is already detached', () => {
  const r = runtime(), seen = [], source = layer();
  source.bitmap = { width: 0, height: 0, closed: true };
  const encoder = r.a.encoder(url => seen.push(url));
  encoder.update(source);
  assert.deepEqual([...r.writes[0].pixels], [...source.data]);
  r.encodes.shift().finish(); assert.equal(seen[0], 'blob:preview-1');
  encoder.dispose(); assert.equal(r.urls.size, 0);
  assert.equal(r.canvases[0].width, 0);
});

test('PNG work stays bounded and renders progress during an uninterrupted stroke', () => {
  const r = runtime(), seen = [], source = layer();
  const encoder = r.a.encoder(url => seen.push(url));
  encoder.update(source);
  for (let i = 0; i < 100; i++) { source.data[0] = i; encoder.update(source); }
  assert.equal(r.encodes.length, 1); assert.equal(r.writes.length, 1);
  r.encodes.shift().finish();
  assert.equal(seen.length, 1, 'An intermediate frame should still be shown while strokes continue');
  assert.equal(r.encodes.length, 1); assert.equal(r.writes.length, 2);
  assert.equal(r.writes[1].pixels[0], 99);
  r.encodes.shift().finish();
  assert.equal(seen.length, 2); assert.equal(r.urls.size, 1); assert.equal(r.canvases.length, 1);
  encoder.dispose(); assert.equal(r.urls.size, 0);
});

test('Changing campaign or transparency discards obsolete output and preserves source pixels', () => {
  const r = runtime(), seen = [], source = layer(), before = source.data.slice();
  const encoder = r.a.encoder(url => seen.push(url));
  encoder.update(source); encoder.update(source, 'features');
  r.encodes.shift().finish(); assert.equal(seen.length, 0);
  assert.equal(r.writes[1].pixels[3], 0);
  assert.deepEqual(source.data, before);
  r.encodes.shift().finish(); assert.equal(seen.length, 1);
  encoder.update(layer(), 'citiesports'); encoder.dispose();
  r.encodes.shift().finish(); assert.equal(seen.length, 1);
  assert.equal(r.urls.size, 0); assert.equal(r.canvases[0].width, 0);
});

test('Overlay does not draw bitmaps; dimensions and painting tooltips do not depend on their lifetime', () => {
  const source = readFileSync(path.join(root, 'src/components/map/MapCanvas.jsx'), 'utf8');
  const hook = readFileSync(path.join(root, 'src/components/map/useTransparentMapBitmap.js'), 'utf8');
  const page = readFileSync(path.join(root, 'src/pages/CampaignMap.jsx'), 'utf8');
  assert.doesNotMatch(source, /drawImage\(|useTransparentMapBitmap\(/);
  assert.match(source, /if \(reg\?\.width && reg\?\.height\)/);
  assert.match(source, /!isPainting\.current && showTooltip/);
  assert.match(source, /let gx = firstX/); assert.match(source, /let gy = firstY/);
  assert.doesNotMatch(hook, /owned|previous\.close/);
  assert.doesNotMatch(page, /bitmap\.close\(\)/);
});