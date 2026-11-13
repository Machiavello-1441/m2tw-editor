import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import JSZip from 'jszip';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const built = await build({
  absWorkingDir: root, stdin: { resolveDir: root, contents: `
    export * from './src/components/export/sharedEditedFilesExport';
    export * from './src/components/export/currentCampaignFilesExport';
    export * from './src/components/export/sharedExportSources';
    export * from './src/lib/bigFileStore';
    export * from './src/lib/stringsBinStore';
    export * from './src/lib/modFolderStore';
    export * from './src/components/strings/stringsBinCodec';
  ` }, bundle: true, write: false, format: 'iife', platform: 'browser', globalName: 'Exports',
  alias: { '@': path.join(root, 'src') }, logLevel: 'silent',
});
class CustomEvent extends Event { constructor(type, options = {}) { super(type); this.detail = options.detail; } }
function runtime() {
  const values = new Map(), window = new EventTarget();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  window.localStorage = storage; window.sessionStorage = storage;
  const context = vm.createContext({ window, localStorage: storage, CustomEvent, queueMicrotask, console, setTimeout, clearTimeout, TextEncoder, TextDecoder, Uint8Array, ArrayBuffer, DataView });
  vm.runInContext(built.outputFiles[0].text, context);
  return context.Exports;
}
const plain = value => JSON.parse(JSON.stringify(value));
const text = async (zip, name) => zip.file(name).async('string');
const utf16 = async (zip, name) => new TextDecoder('utf-16le').decode(await zip.file(name).async('uint8array'));

for (const prefix of ['data', 'my_mod/data']) test(`${prefix}: every shared raw file is included, including files never opened in another editor`, async () => {
  const a = runtime(), zip = new JSZip(), folder = zip.folder(prefix);
  const sources = a.SHARED_EXPORT_SOURCES;
  for (const { key } of sources) a.setFile(key, key === 'm2tw_names_file' ? 'faction: edited\ncharacters\n Latest\n' : `; original comments\nLatest shared ${key}\n`);
  // Text-only dictionaries need valid keyed text for their generated binaries.
  for (const key of ['m2tw_edb_txt_file', 'm2tw_vnvs_file', 'm2tw_anctxt_file', 'm2tw_export_units_file']) a.setFile(key, '{LATEST}Latest edited text\n');
  a.addSharedEditedFilesToZip(folder);
  for (const { key, name } of sources) {
    const output = `${prefix}/${a.sharedExportPath(name, key)}`;
    assert.ok(zip.file(output), `${name} must be present`);
    const actual = /^text\//.test(a.sharedExportPath(name, key)) ? await utf16(zip, output) : await text(zip, output);
    assert.match(actual, /Latest/, output);
  }
  assert.ok(zip.file(`${prefix}/unit_models/battle_models.modeldb`));
  assert.ok(zip.file(`${prefix}/ui/strategy.sd.xml`));
});

test('Latest edits win over extras, old render snapshots and casing collisions, without touching other campaign folders', async () => {
  const a = runtime(), zip = new JSZip(), folder = zip.folder('my_mod/data');
  a.setFile('m2tw_edu_raw', 'old render snapshot');
  const countBefore = a.getSharedExportFileCount();
  zip.file('my_mod/data/EXPORT_DESCR_UNIT.TXT', 'old additional file');
  zip.file('my_mod/data/world/maps/campaign/other/descr_strat.txt', 'other campaign');
  a.setFile('m2tw_units_file', '; preserve comments\r\nlatest ownership and roster\r\n');
  a.addSharedEditedFilesToZip(folder);
  assert.equal(await text(zip, 'my_mod/data/export_descr_unit.txt'), '; preserve comments\r\nlatest ownership and roster\r\n');
  assert.equal(zip.file('my_mod/data/EXPORT_DESCR_UNIT.TXT'), null);
  assert.equal(await text(zip, 'my_mod/data/world/maps/campaign/other/descr_strat.txt'), 'other campaign');
  assert.equal(a.getSharedExportFileCount(), countBefore);
  // Exercise a real archive roundtrip, not just a file-list mock.
  const loaded = await JSZip.loadAsync(await zip.generateAsync({ type: 'uint8array' }));
  assert.match(await text(loaded, 'my_mod/data/export_descr_unit.txt'), /latest ownership/);
});

test('Shared dictionary entries and UTF-16 twins override cached text while preserving keyed lookup metadata', async () => {
  const a = runtime(), zip = new JSZip();
  a.setFile('m2tw_export_units_file', '{Soldier}Old cached name\n');
  a.updateStringsBinFile('EXPORT_UNITS.TXT.STRINGS.BIN', { magic1: 2, magic2: 2048, trailerKind: 'key-lookup', lookupTrailingZero: true, entries: [{ key: 'Soldier', value: 'Édited soldier' }, { key: 'Soldier_descr', value: 'First paragraph\nSecond paragraph' }] });
  zip.file('data/text/EXPORT_UNITS.TXT', 'old extra');
  a.addSharedEditedFilesToZip(zip.folder('data'));
  const decoded = a.decodeStringsBin(await zip.file('data/text/export_units.txt.strings.bin').async('uint8array'));
  assert.equal(decoded.trailerKind, 'key-lookup'); assert.equal(decoded.lookupTrailingZero, true);
  assert.equal(decoded.entries[0].value, 'Édited soldier');
  const twin = await utf16(zip, 'data/text/export_units.txt');
  assert.match(twin, /Édited soldier/); assert.match(twin, /First paragraph\r\nSecond paragraph/); assert.doesNotMatch(twin, /Old cached/);
  assert.equal(zip.file('data/text/EXPORT_UNITS.TXT'), null);
});

test('Ordered and unknown-trailer names binaries remain byte-exact and ordered dictionaries never generate fake keys', async () => {
  for (const ordered of [true, false]) {
    const a = runtime(), zip = new JSZip();
    let buffer = a.encodeStringsBin(ordered ? [{ key: '0', value: 'Only value', index: 0 }] : [{ key: 'Henry', value: 'Latest display name' }], ordered ? 1 : 2, 2048, { trailerKind: 'none' });
    if (!ordered) { const bytes = new Uint8Array(buffer.byteLength + 3); bytes.set(new Uint8Array(buffer)); bytes.set([7, 8, 9], buffer.byteLength); buffer = bytes; }
    const decoded = a.decodeStringsBin(buffer);
    a.updateStringsBinFile('names.txt.strings.bin', decoded);
    zip.file('data/text/NAMES.TXT', 'stale generated numeric keys');
    a.addSharedEditedFilesToZip(zip.folder('data'));
    const exported = await zip.file('data/text/names.txt.strings.bin').async('uint8array');
    assert.deepEqual([...exported], [...new Uint8Array(buffer.buffer || buffer)]);
    if (ordered) assert.equal(zip.file('data/text/names.txt'), null);
    else assert.match(await utf16(zip, 'data/text/names.txt'), /Latest display name/);
  }
});

test('An intentionally empty shared file and an empty dictionary are exported rather than replaced by older data', async () => {
  const a = runtime(), zip = new JSZip();
  a.setFile('m2tw_units_file', '');
  a.updateStringsBinFile('export_vnvs.txt.strings.bin', { magic1: 2, magic2: 2048, entries: [] });
  zip.file('data/export_descr_unit.txt', 'old units');
  a.addSharedEditedFilesToZip(zip.folder('data'));
  assert.equal(await text(zip, 'data/export_descr_unit.txt'), '');
  assert.equal(a.decodeStringsBin(await zip.file('data/text/export_vnvs.txt.strings.bin').async('uint8array')).entries.length, 0);
});

test('Original shared subfolders are preserved and duplicate model-strat aliases produce only one file', async () => {
  const a = runtime(), zip = new JSZip();
  a.indexFolder([{ name: 'battle_models.modeldb', webkitRelativePath: 'picked/data/unit_models/custom/battle_models.modeldb' }, { name: 'descr_models_strat.txt', webkitRelativePath: 'picked/data/descr_models_strat.txt' }]);
  a.setFile('m2tw_modeldb_file', 'latest model edits'); a.setFile('m2tw_descr_model_strat_raw', 'latest strat model edits');
  a.addSharedEditedFilesToZip(zip.folder('data'));
  assert.equal(await text(zip, 'data/unit_models/custom/battle_models.modeldb'), 'latest model edits');
  assert.equal(await text(zip, 'data/descr_models_strat.txt'), 'latest strat model edits');
  assert.equal(zip.file('data/descr_model_strat.txt'), null);
});

test('Full mod exports keep the active campaign edits and original base paths without replacing another campaign', async () => {
  const a = runtime(), zip = new JSZip();
  a.setFile('m2tw_campaign_source_paths', JSON.stringify({ campaignName: 'active_campaign', directory: 'data/world/maps/campaign/custom/active_campaign', paths: { 'descr_regions.txt': 'data/world/maps/base/descr_regions.txt' } }));
  a.setFile('m2tw_strat_raw', 'campaign active_campaign\nscript\ncustom_script.txt\n');
  a.setFile('m2tw_script_raw', 'latest script edits');
  a.setFile('m2tw_regions_raw', 'latest region edits');
  a.setFile('m2tw_campaign_disasters', '');
  zip.file('mod/data/world/maps/campaign/custom/active_campaign/CUSTOM_SCRIPT.TXT', 'old script');
  zip.file('mod/data/world/maps/campaign/other/campaign_script.txt', 'other campaign');
  a.addCurrentCampaignFilesToZip(zip.folder('mod'));
  assert.equal(await text(zip, 'mod/data/world/maps/campaign/custom/active_campaign/custom_script.txt'), 'latest script edits');
  assert.equal(zip.file('mod/data/world/maps/campaign/custom/active_campaign/CUSTOM_SCRIPT.TXT'), null);
  assert.equal(await text(zip, 'mod/data/world/maps/base/descr_regions.txt'), 'latest region edits');
  assert.equal(await text(zip, 'mod/data/world/maps/campaign/other/campaign_script.txt'), 'other campaign');
  assert.equal(await text(zip, 'mod/data/world/maps/campaign/custom/active_campaign/descr_disasters.txt'), '');
  assert.ok(a.getSharedExportFileCount() > 0, 'Campaign-only edits enable the export button');
});

test('All mod bundles apply shared sources after their other entries and immediately before packing', () => {
  for (const file of ['src/pages/Export.jsx', 'src/components/map/StratPanel.jsx', 'src/components/factions/FactionZipExport.jsx']) {
    const source = readFileSync(path.join(root, file), 'utf8');
    assert.match(source, /addSharedEditedFilesToZip\([^;]+;\s*const (?:blob|content) = await zip.generateAsync/, file);
  }
  const source = readFileSync(path.join(root, 'src/pages/Export.jsx'), 'utf8');
  assert.match(source, /useSharedExportFiles\(\)/);
  assert.match(source, /sharedFileCount === 0/);
});