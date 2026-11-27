import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { webcrypto } from 'node:crypto';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));
const built = await build({ absWorkingDir: root, stdin: { resolveDir: root, contents: `
  export { default as campaignArchive } from './src/components/export/campaignArchive';
  export * from './src/components/export/exportValidation';
  export * from './src/components/map/campaignSourcePaths';
  export * from './src/lib/bigFileStore';
  export * from './src/lib/stringsBinStore';
  export * from './src/components/strings/stringsBinCodec';
  export * from './src/components/map/stratParser';
  export * from './src/components/map/tgaExporter';
  export * from './src/lib/stringsTxtFile';
  export * from './src/components/map/settlementNamesIO';
` }, bundle: true, write: false, format: 'iife', platform: 'browser', globalName: 'App', alias: { '@': path.join(root, 'src') }, resolveExtensions: ['.js', '.jsx', '.mjs', '.json'], logLevel: 'silent' });

class CustomEvent extends Event { constructor(type, options = {}) { super(type); this.detail = options.detail; } }
function runtime() {
  const values = new Map(), window = new EventTarget();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  window.localStorage = storage; window.sessionStorage = storage;
  const context = vm.createContext({ window, localStorage: storage, sessionStorage: storage, CustomEvent, queueMicrotask, console, setTimeout, clearTimeout, setImmediate, TextEncoder, TextDecoder, Uint8Array, Uint8ClampedArray, ArrayBuffer, DataView, Blob, crypto: webcrypto });
  vm.runInContext(built.outputFiles[0].text, context);
  return { a: context.App };
}

const campaignName = 'imperial_campaign';
const directory = 'data/world/maps/campaign/custom/imperial_campaign';
const strat = 'campaign imperial_campaign\nplayable\nengland\nfrance\nend\nstart_date 1080 summer\nend_date 1530 winter\ntimescale 2\nfaction england, balanced smith\ndenari 1000\nsettlement\n{\nlevel town\nregion York_Province\nyear_founded 0\npopulation 1000\nplan_set default_set\nfaction_creator england\n}\nfaction france, balanced smith\ndenari 2000\n';
const regions = 'York_Province\nYork\nengland\nBritons\n1 2 3\nnone\n5\n5\nreligions { catholic 100 }\n';
const names = { York_Province: 'Yorkshire', York: 'York' };

const W = 60, H = 60;
function layer(width, height, paint) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const [r, g, b, a = 255] = paint(x, y) || [0, 0, 0, 0];
    const i = (y * width + x) * 4;
    data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = a;
  }
  return { data, width, height, visible: true, opacity: 1 };
}
const layers = () => ({
  heights: layer(W, H, (x, y) => (y < 8 ? [0, 0, 255] : [40, 40, 40])),
  ground: layer(W, H, (x, y) => (y < 8 ? [64, 0, 0] : [0, 128, 0])),
  climates: layer(W, H, () => [0, 255, 0]),
  regions: layer(W, H, (x, y) => (x === 20 && y === 20 ? [0, 0, 0] : [10, 200, 10])),
  features: layer(W, H, (x, y) => (x >= 30 && x <= 34 && y === 25 ? [0, 0, 255] : [0, 0, 0])),
  fog: layer(W, H, () => [0, 0, 0]),
});

function sourceFile(p, content) {
  const bytes = typeof content === 'string' ? new TextEncoder().encode(content) : new Uint8Array(content);
  return { name: p.split('/').pop(), webkitRelativePath: `picked/${p}`, arrayBuffer: async () => bytes.slice().buffer, text: async () => new TextDecoder().decode(bytes) };
}
function prepare(a) {
  const entries = Object.entries(names).map(([key, value]) => ({ key, value }));
  const binary = a.encodeStringsBin(entries, 2, 2048, { trailerKind: 'key-lookup', lookupTrailingZero: true });
  const files = [sourceFile(`${directory}/descr_strat.txt`, strat), sourceFile('data/world/maps/base/descr_regions.txt', regions),
    sourceFile(`data/text/${campaignName}_regions_and_settlement_names.txt`, a.entriesToTextBytes(entries)),
    sourceFile(`data/text/${campaignName}_regions_and_settlement_names.txt.strings.bin`, binary)];
  a.rememberCampaignSourceFiles(files, campaignName, true);
  a.setFile('m2tw_campaign_strat', strat); a.setFile('m2tw_regions_raw', regions);
  a.updateStringsBinFile(`${campaignName}_regions_and_settlement_names.txt.strings.bin`, a.decodeStringsBin(binary));
  const data = a.parseDescrStrat(strat);
  return { stratData: data, regionsData: a.parseDescrRegions(regions), settlementNames: names, overlayItems: data.items, editedSettlements: {}, campaignDetails: {} };
}

test('campaign panel export path with layers', async () => {
  const { a } = runtime();
  const options = { ...prepare(a), layers: layers(), regionsLayer: null, religionList: ['catholic'] };
  options.regionsLayer = options.layers.regions;
  const validation = a.runExportValidation({ edbData: null, layers: options.layers });
  console.log('validation:', validation.errors.length, 'errors', validation.warnings.length, 'warnings', validation.errors.slice(0, 4).map(e => e.title));
  let zip;
  try {
    zip = await a.campaignArchive(options);
  } catch (error) {
    assert.fail(`campaignArchive threw: ${error && error.stack}`);
  }
  const files = Object.values(zip.files).filter(f => !f.dir).map(f => f.name).sort();
  console.log('zip files:', files);
  assert.ok(files.length > 0, 'zip should contain files');
});