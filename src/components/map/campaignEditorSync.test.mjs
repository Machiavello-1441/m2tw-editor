import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const bundle = await build({
  absWorkingDir: root,
  stdin: { resolveDir: root, sourcefile: 'campaign-sync-regression.js', contents: `
    export * from './src/components/map/useSharedFactionColors';
    export * from './src/components/map/stratParser';
    export * from './src/lib/bigFileStore';
    export * from './src/lib/editorStorage';
    export * from './src/lib/modFileRegistry';
    export * from './src/components/map/campaignSession';
    export { default as observePaintCanvasSize } from './src/components/map/observePaintCanvasSize';
    export { default as CampaignUndoHistory } from './src/components/map/campaignUndoHistory';
    export { transparentMapPixels } from './src/components/map/useTransparentMapBitmap';
  ` },
  bundle: true, write: false, format: 'iife', platform: 'browser', globalName: 'CampaignTest',
  alias: { '@': path.join(root, 'src') }, define: { 'process.env.NODE_ENV': '"test"' }, logLevel: 'silent',
});
class CustomEvent extends Event {
  constructor(type, options = {}) { super(type); this.detail = options.detail; }
}
function runtime() {
  const values = new Map(), window = new EventTarget(), frames = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  window.localStorage = storage; window.sessionStorage = storage;
  let frameId = 0, observerCallback;
  const context = vm.createContext({
    window, CustomEvent, localStorage: storage, queueMicrotask, console, setTimeout, clearTimeout, structuredClone,
    requestAnimationFrame: fn => { const id = ++frameId; frames.set(id, fn); return id; },
    cancelAnimationFrame: id => frames.delete(id),
    ResizeObserver: class { constructor(fn) { observerCallback = fn; } observe() {} disconnect() {} },
    ImageData: class { constructor(data, width, height) { Object.assign(this, { data, width, height }); } },
    createImageBitmap: async image => ({ width: image.width, height: image.height, close() {} }),
  });
  vm.runInContext(bundle.outputFiles[0].text, context);
  return { a: context.CampaignTest, window, frames, resize: () => observerCallback(),
    runFrames() { const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn()); } };
}
const oldFactions = 'faction england\nprimary_colour red 10, green 20, blue 30\n';
const savedFactions = oldFactions + 'faction new_faction\nprimary_colour red 40, green 50, blue 60\n';

test('Saving factions refreshes mounted readers and both raw aliases', async () => {
  const { a } = runtime();
  a.setFile('m2tw_factions_file', oldFactions); await a.flushBigFiles();
  let changes = 0;
  const stop = a.subscribeSharedFactions(() => { changes++; });
  a.setFile('m2tw_factions_file', savedFactions); await a.flushBigFiles();
  assert.equal(changes, 1);
  assert.equal(a.readSharedFactions(), savedFactions);
  assert.equal(a.editorSessionStorage.getItem('m2tw_factions_raw'), savedFactions);
  assert.equal(a.parseDescrSmFactions(a.readSharedFactions()).new_faction.primaryColor.r, 40);
  a.setFile('unrelated', 'not factions'); await a.flushBigFiles();
  assert.equal(changes, 1);
  stop();
});

test('Campaign folder restoration cannot replace newly saved factions', async () => {
  const { a } = runtime();
  a.setFile('m2tw_factions_file', savedFactions);
  let read = false;
  await a.seedCampaignFactions({ text: async () => { read = true; return oldFactions; } });
  assert.equal(read, false);
  a.restoreCampaignStorage({ session: { m2tw_factions_raw: oldFactions }, local: { m2tw_factions_file: oldFactions } });
  assert.equal(a.readSharedFactions(), savedFactions);
  assert.ok(a.parseDescrSmFactions(a.readSharedFactions()).new_faction);
  await a.flushBigFiles();
});

test('A missing faction file can be seeded without overwriting edits during its read', async () => {
  const { a } = runtime();
  let finish;
  const pending = a.seedCampaignFactions({ text: () => new Promise(resolve => { finish = resolve; }) });
  a.setFile('m2tw_factions_file', savedFactions);
  finish(oldFactions); await pending;
  assert.equal(a.readSharedFactions(), savedFactions);
  a.removeFile('m2tw_factions_file');
  await a.seedCampaignFactions({ text: async () => oldFactions });
  assert.equal(a.readSharedFactions(), oldFactions);
  await a.flushBigFiles();
});

test('Canvas resizing is deferred, coalesced, and cannot loop on unchanged size', () => {
  const r = runtime(), callbacks = {}, container = { clientWidth: 500, clientHeight: 400 };
  let invalidations = 0, draws = 0;
  const map = {
    getContainer: () => container,
    on: (event, fn) => { callbacks[event] = fn; }, off: event => { delete callbacks[event]; },
    invalidateSize: () => { invalidations++; callbacks.resize?.(); r.resize(); },
  };
  const canvas = { current: { width: 0, height: 0 } };
  const stop = r.a.observePaintCanvasSize(map, canvas, { current: () => { draws++; } });
  r.resize(); r.resize();
  assert.equal(invalidations, 0);
  assert.equal(r.frames.size, 1);
  r.runFrames(); r.runFrames();
  assert.equal(invalidations, 1);
  assert.equal(r.frames.size, 0);
  assert.equal(canvas.current.width, 500);
  container.clientHeight = 360;
  r.resize(); r.runFrames(); r.runFrames();
  assert.equal(invalidations, 2);
  assert.equal(canvas.current.height, 360);
  assert.equal(draws, 2);
  r.resize(); stop(); r.runFrames();
  assert.equal(invalidations, 2);
  assert.equal(Object.keys(callbacks).length, 0);
});

test('Transparent previews do not mutate paint buffers', () => {
  const { a } = runtime();
  const source = new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255, 0, 0, 255, 255]);
  const before = source.slice();
  assert.equal(a.transparentMapPixels(source, 'features')[3], 0);
  assert.equal(a.transparentMapPixels(source, 'fog')[7], 0);
  const cities = a.transparentMapPixels(source, 'citiesports');
  assert.equal(cities[3], 255); assert.equal(cities[7], 255); assert.equal(cities[11], 0);
  assert.deepEqual(source, before);
});

test('Repeated in-place paint strokes stay undoable and bitmap-only redraws add no changes', async () => {
  const { a } = runtime();
  let publishes = 0;
  const history = new a.CampaignUndoHistory(() => { publishes++; });
  let state = { layers: { regions: { width: 2, height: 2, data: new Uint8ClampedArray(16), bitmap: null } },
    dirtyLayers: new Set(), overlayDirty: false, overlayItems: [], campaignDetails: {}, stratData: null };
  history.record(state);
  for (let stroke = 0; stroke < 2; stroke++) {
    history.begin(state);
    state.layers.regions.data[stroke * 4] = 50 + stroke;
    state = { ...state, dirtyLayers: new Set(['regions']) };
    history.record(state);
    history.end(state);
  }
  assert.equal(history.entries.length, 2);
  assert.equal(publishes, 2);
  state = { ...state, layers: { regions: { ...state.layers.regions, bitmap: { width: 2, height: 2 } } } };
  history.record(state);
  assert.equal(publishes, 2);
  await history.undo(1, state, restored => { state = restored; });
  assert.equal(state.layers.regions.data[0], 50);
  assert.equal(state.layers.regions.data[4], 0);
  await history.redo(state, restored => { state = restored; });
  assert.equal(state.layers.regions.data[4], 51);
});

test('Campaign restoration ignores cached factions and cancels pending paint redraws', () => {
  const source = readFileSync(path.join(root, 'src/pages/CampaignMap.jsx'), 'utf8');
  assert.match(source, /const factionColors = useSharedFactionColors\(\)/);
  assert.match(source, /await seedCampaignFactions\(file\)/);
  assert.doesNotMatch(source, /setFactionColorsRaw|saved\.factionColors|restored\.factionColors/);
  assert.match(source, /onFactionsLoad=\{text => setFile\('m2tw_factions_file', text\)\}/);
  assert.match(source, /await paintBitmaps\.flush\(\)/);
  assert.doesNotMatch(source, /bitmapTimerRef|pendingBitmapRef|scheduleBitmapFlush/);
});