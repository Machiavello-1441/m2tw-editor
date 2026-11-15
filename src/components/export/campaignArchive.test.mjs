import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import JSZip from 'jszip';
import { webcrypto } from 'node:crypto';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const built = await build({ absWorkingDir: root, stdin: { resolveDir: root, contents: `
  export { default as campaignArchive } from './src/components/export/campaignArchive';
  export * from './src/components/export/campaignNamesExport';
  export * from './src/components/export/exportOriginals';
  export * from './src/components/export/sharedEditedFilesExport';
  export * from './src/components/map/settlementNamesIO';
  export * from './src/components/map/campaignSourcePaths';
  export * from './src/lib/bigFileStore';
  export * from './src/lib/stringsBinStore';
  export * from './src/components/strings/stringsBinCodec';
  export * from './src/components/map/stratParser';
  export * from './src/components/map/tgaExporter';
  export * from './src/lib/stringsTxtFile';
` }, bundle: true, write: false, format: 'iife', platform: 'browser', globalName: 'App', alias: { '@': path.join(root, 'src') }, logLevel: 'silent' });
class CustomEvent extends Event { constructor(type, options = {}) { super(type); this.detail = options.detail; } }
function runtime() {
  const values = new Map(), window = new EventTarget();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  window.localStorage = storage; window.sessionStorage = storage;
  const context = vm.createContext({ window, localStorage: storage, CustomEvent, queueMicrotask, console, setTimeout, clearTimeout, setImmediate, TextEncoder, TextDecoder, Uint8Array, Uint8ClampedArray, ArrayBuffer, DataView, Blob, crypto: webcrypto });
  vm.runInContext(built.outputFiles[0].text, context);
  return { a: context.App, snapshot: () => ({ ...window.__m2twBigFileStore }) };
}
const campaignName = 'imperial_campaign', stem = `${campaignName}_regions_and_settlement_names.txt`;
const directory = 'data/world/maps/campaign/custom/imperial_campaign';
const strat = 'campaign imperial_campaign\nplayable\nengland\nfrance\nend\nstart_date 1080 summer\nend_date 1530 winter\ntimescale 2\nfaction england, balanced smith\ndenari 1000\nsettlement\n{\nlevel town\nregion York_Province\nyear_founded 0\npopulation 1000\nplan_set default_set\nfaction_creator england\n}\nfaction france, balanced smith\ndenari 2000\n';
const regions = 'York_Province\nYork\nengland\nBritons\n1 2 3\nnone\n5\n5\nreligions { catholic 100 }\n';
const oldNames = { York_Province: 'Old province', York: 'Old city', Other_Province: 'Keep this name' };
const editedNames = { ...oldNames, York_Province: 'Île-de-France', York: 'Saint-Étienne' };
function sourceFile(path, content) {
  const bytes = typeof content === 'string' ? new TextEncoder().encode(content) : new Uint8Array(content);
  return { name: path.split('/').pop(), webkitRelativePath: `picked/${path}`, arrayBuffer: async () => bytes.slice().buffer, text: async () => new TextDecoder().decode(bytes) };
}
function prepare(a, extras = []) {
  const entries = Object.entries(oldNames).map(([key, value]) => ({ key, value }));
  const binary = a.encodeStringsBin(entries, 2, 2048, { trailerKind: 'key-lookup', lookupTrailingZero: true });
  const files = [sourceFile(`${directory}/descr_strat.txt`, strat), sourceFile('data/world/maps/base/descr_regions.txt', regions),
    sourceFile(`data/text/${stem}`, a.entriesToTextBytes(entries)), sourceFile(`data/text/${stem}.strings.bin`, binary),
    sourceFile('data/export_descr_unit.txt', '; untouched units\n'), sourceFile('data/descr_sm_factions.txt', 'faction england\nculture northern_european\nreligion catholic\n'), ...extras];
  a.rememberCampaignSourceFiles(files, campaignName, true);
  a.setFile('m2tw_campaign_strat', strat); a.setFile('m2tw_regions_raw', regions);
  a.setFile('m2tw_units_file', '; untouched units\n'); a.setFile('m2tw_factions_file', 'faction england\nculture northern_european\nreligion catholic\n');
  a.updateStringsBinFile(`${stem}.strings.bin`, a.decodeStringsBin(binary));
  const data = a.parseDescrStrat(strat);
  return { stratData: data, regionsData: a.parseDescrRegions(regions), settlementNames: oldNames, overlayItems: data.items, editedSettlements: {}, campaignDetails: {} };
}
const paths = zip => Object.values(zip.files).filter(file => !file.dir).map(file => file.name).sort();
async function unpack(zip) { return JSZip.loadAsync(await zip.generateAsync({ type: 'uint8array' })); }
async function namesFrom(a, zip, prefix = 'data') {
  const binary = await zip.file(`${prefix}/text/${stem}.strings.bin`).async('uint8array');
  const decoded = a.decodeStringsBin(binary);
  const textBytes = await zip.file(`${prefix}/text/${stem}`).async('uint8array');
  assert.deepEqual([...textBytes.slice(0, 2)], [255, 254]);
  const plain = new TextDecoder('utf-16le').decode(textBytes);
  assert.match(plain, /^¬\r\n/);
  return { map: Object.fromEntries(decoded.entries.map(entry => [entry.key, entry.value])), decoded, plain };
}

test('Campaign ZIP keeps current province/city names over old shared binaries and omits untouched loaded files', async () => {
  const { a } = runtime(), options = prepare(a);
  options.settlementNames = editedNames;
  a.setFile('m2tw_names_raw', a.namesToText(editedNames));
  const zip = await unpack(await a.campaignArchive(options));
  const unexpectedStrat = zip.file(`${directory}/descr_strat.txt`);
  assert.deepEqual(paths(zip), [`data/text/${stem}`, `data/text/${stem}.strings.bin`], unexpectedStrat ? await unexpectedStrat.async('string') : undefined);
  const result = await namesFrom(a, zip);
  assert.deepEqual(result.map, editedNames);
  assert.equal(result.decoded.trailerKind, 'key-lookup');
  assert.equal(result.decoded.lookupTrailingZero, true);
  assert.match(result.plain, /Île-de-France/); assert.match(result.plain, /Saint-Étienne/);
  assert.doesNotMatch(result.plain, /Old province|Old city/);
});

test('An untouched campaign exports no regenerated data or localization twins', async () => {
  const { a } = runtime(), options = prepare(a);
  a.setFile('m2tw_names_raw', a.namesToText(oldNames));
  const zip = await a.campaignArchive(options);
  assert.deepEqual(paths(zip), []);
});

test('Real shared edits are included but unchanged shared references are excluded', async () => {
  const { a } = runtime(), options = prepare(a);
  a.setFile('m2tw_units_file', '; latest roster edit\n');
  const zip = await unpack(await a.campaignArchive(options));
  assert.deepEqual(paths(zip), ['data/export_descr_unit.txt']);
  assert.equal(await zip.file('data/export_descr_unit.txt').async('string'), '; latest roster edit\n');
});

test('Full-mod export also writes current campaign names last, including edits never saved manually', async () => {
  for (const prefix of ['data', 'my_mod/data']) {
    const { a } = runtime(); prepare(a);
    a.setFile('m2tw_names_raw', a.namesToText(editedNames));
    const zip = new JSZip(); zip.file(`${prefix}/text/${stem.toUpperCase()}`, 'old extra');
    a.addSharedEditedFilesToZip(zip.folder(prefix));
    const loaded = await unpack(zip), result = await namesFrom(a, loaded, prefix);
    assert.deepEqual(result.map, editedNames);
    assert.equal(loaded.file(`${prefix}/text/${stem.toUpperCase()}`), null);
  }
});

test('Name edits synchronize to shared binaries and survive navigation or reload without resetting original fingerprints', async () => {
  const first = runtime(), a = first.a, options = prepare(a);
  a.persistNames(editedNames, campaignName);
  assert.equal(a.getStringsBinStore()[`${stem}.strings.bin`].entries.find(entry => entry.key === 'York').value, 'Saint-Étienne');
  await a.campaignArchive({ ...options, settlementNames: editedNames });
  const second = runtime(), b = second.a;
  for (const [key, value] of Object.entries(first.snapshot())) b.setFile(key, value);
  const data = b.parseDescrStrat(b.getFile('m2tw_campaign_strat'));
  const zip = await unpack(await b.campaignArchive({ ...options, stratData: data, overlayItems: data.items, settlementNames: b.parseSettlementNames(b.getFile('m2tw_names_raw')) }));
  assert.deepEqual(paths(zip), [`data/text/${stem}`, `data/text/${stem}.strings.bin`]);
  assert.deepEqual((await namesFrom(b, zip)).map, editedNames);
});

test('New internal province and city identifiers are exported with both localized name files and original source directories', async () => {
  const { a } = runtime(), options = prepare(a);
  const item = options.overlayItems.find(item => item.category === 'settlement');
  const updated = { ...options, settlementNames: { ...oldNames, New_Province: 'New province', New_City: 'New city' },
    editedSettlements: { [item.id]: { region: 'New_Province' } },
    regionsData: options.regionsData.map(region => ({ ...region, regionName: 'New_Province', settlementName: 'New_City' })) };
  const zip = await unpack(await a.campaignArchive(updated));
  assert.match(await zip.file('data/world/maps/base/descr_regions.txt').async('string'), /New_Province\r\nNew_City/);
  assert.match(await zip.file(`${directory}/descr_strat.txt`).async('string'), /region\s+New_Province/);
  const { map } = await namesFrom(a, zip);
  assert.equal(map.New_Province, 'New province'); assert.equal(map.New_City, 'New city');
  assert.equal(zip.file(`${directory}/descr_regions.txt`), null);
});

test('Saving or clearing dirty flags does not hide changed TGA pixels; unchanged TGA headers do not count as edits', async () => {
  const { a } = runtime();
  const original = new Uint8Array(22); original[2] = 2; original[12] = 1; original[14] = 1; original[16] = 32; original.set([3, 2, 1, 255], 18);
  const options = prepare(a, [sourceFile('data/world/maps/base/map_ground_types.tga', original)]);
  const layer = { data: new Uint8ClampedArray([1, 2, 3, 255]), width: 1, height: 1 };
  assert.deepEqual(paths(await a.campaignArchive({ ...options, layers: { ground: layer }, dirtyLayers: new Set() })), []);
  layer.data[0] = 25;
  const zip = await unpack(await a.campaignArchive({ ...options, layers: { ground: layer }, dirtyLayers: new Set() }));
  assert.deepEqual(paths(zip), ['data/world/maps/base/map_ground_types.tga']);
  assert.equal((await zip.file('data/world/maps/base/map_ground_types.tga').async('uint8array'))[20], 25);
});

test('Deleting all disasters exports an empty replacement instead of resurrecting original entries', async () => {
  const { a } = runtime(), disaster = 'event earthquake\nfrequency 20\n';
  const options = prepare(a, [sourceFile(`${directory}/descr_disasters.txt`, disaster)]);
  a.setFile('m2tw_campaign_disasters', disaster);
  const zip = await unpack(await a.campaignArchive({ ...options, campaignDetails: { disasters: [] } }));
  assert.ok(zip.file(`${directory}/descr_disasters.txt`));
  assert.equal(await zip.file(`${directory}/descr_disasters.txt`).async('string'), '');
});

test('Other campaigns localization is not mixed into the active campaign archive', async () => {
  const { a } = runtime(), options = prepare(a);
  a.updateStringsBinFile('other_regions_and_settlement_names.txt.strings.bin', { magic1: 2, magic2: 2048, entries: [{ key: 'Other', value: 'Unrelated edit' }] });
  const zip = await a.campaignArchive({ ...options, settlementNames: editedNames });
  assert.ok(!paths(zip).some(path => path.includes('other_regions_and_settlement_names')));
});

test('Exporting cannot clear edits, and unsupported binary trailers abort rather than silently discard work', async () => {
  const { a } = runtime(), options = prepare(a);
  const original = a.encodeStringsBin(Object.entries(oldNames).map(([key, value]) => ({ key, value })), 2, 2048, { trailerKind: 'none' });
  const opaque = new Uint8Array(original.byteLength + 3); opaque.set(new Uint8Array(original)); opaque.set([7, 8, 9], original.byteLength);
  a.updateStringsBinFile(`${stem}.strings.bin`, a.decodeStringsBin(opaque));
  a.setFile('m2tw_names_raw', a.namesToText(editedNames));
  const beforeNames = a.getFile('m2tw_names_raw'), beforeBin = JSON.stringify(a.getStringsBinStore());
  await assert.rejects(a.campaignArchive({ ...options, settlementNames: editedNames }), /unknown binary trailer/);
  assert.equal(a.getFile('m2tw_names_raw'), beforeNames);
  assert.equal(JSON.stringify(a.getStringsBinStore()), beforeBin);
});

test('Unedited serialization never invents a script or AI label, but explicit script and faction flag changes are retained', () => {
  const { a } = runtime(), data = a.parseDescrStrat(strat);
  const unchanged = a.serializeDescrStrat(data, data.items);
  assert.doesNotMatch(unchanged, /^script\s*$/m);
  assert.doesNotMatch(unchanged, /^\s*ai_label\b/m);
  data.scriptFile = 'custom_script.txt';
  data.factions[0].undiscovered = true;
  const changed = a.serializeDescrStrat(data, data.items);
  assert.match(changed, /script\ncustom_script.txt$/);
  assert.match(changed, /undiscovered/);
  assert.doesNotMatch(changed, /ai_label/);
});

test('Unknown original files are retained rather than guessed unchanged', async () => {
  const { a } = runtime(), zip = new JSZip();
  zip.file(`${directory}/campaign_script.txt`, 'unsaved changes with no original available');
  await a.removeUnchangedCampaignFiles(zip);
  assert.ok(zip.file(`${directory}/campaign_script.txt`));
});