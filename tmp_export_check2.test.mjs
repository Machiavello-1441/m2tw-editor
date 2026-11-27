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
  export * from './src/components/map/campaignSourcePaths';
  export * from './src/components/export/exportOriginals';
  export * from './src/lib/bigFileStore';
  export * from './src/components/strings/stringsBinCodec';
  export * from './src/components/map/stratParser';
  export * from './src/lib/stringsTxtFile';
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
const strat = 'campaign imperial_campaign\nplayable\nengland\nend\nstart_date 1080 summer\nend_date 1530 winter\ntimescale 2\nfaction england, balanced smith\ndenari 1000\nsettlement\n{\nlevel town\nregion York_Province\nyear_founded 0\npopulation 1000\nplan_set default_set\nfaction_creator england\n}\n';
const regions = 'York_Province\nYork\nengland\nBritons\n1 2 3\nnone\n5\n5\nreligions { catholic 100 }\n';
function sourceFile(p, content) {
  const bytes = typeof content === 'string' ? new TextEncoder().encode(content) : new Uint8Array(content);
  return { name: p.split('/').pop(), webkitRelativePath: `picked/${p}`, arrayBuffer: async () => bytes.slice().buffer, text: async () => new TextDecoder().decode(bytes) };
}

test('an unreadable imported file must not break the campaign export', async () => {
  const { a } = runtime();
  const files = [sourceFile(`${directory}/descr_strat.txt`, strat), sourceFile('data/world/maps/base/descr_regions.txt', regions),
    // A .strings.bin that is not a strings binary at all (common in mods).
    sourceFile('data/text/some_mod_file.txt.strings.bin', new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9]))];
  a.rememberCampaignSourceFiles(files, campaignName, true);
  a.setFile('m2tw_campaign_strat', strat);
  const data = a.parseDescrStrat(strat);
  const options = { stratData: data, regionsData: a.parseDescrRegions(regions), settlementNames: { York_Province: 'Yorkshire' },
    layers: {}, overlayItems: data.items, editedSettlements: {}, campaignDetails: {}, religionList: ['catholic'] };
  await new Promise(resolve => setTimeout(resolve, 30));
  try {
    const zip = await a.campaignArchive(options);
    console.log('OK, files:', Object.values(zip.files).filter(f => !f.dir).map(f => f.name));
  } catch (error) {
    console.log('EXPORT FAILED:', error.message);
    throw error;
  }
});
