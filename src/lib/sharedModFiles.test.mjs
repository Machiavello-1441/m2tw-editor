import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const built = await build({
  absWorkingDir: root,
  stdin: { resolveDir: root, sourcefile: 'all-shared-files-test.js', contents: `
    export * from './src/lib/sharedModFiles';
    export * from './src/lib/sharedDictionary';
    export * from './src/lib/bigFileStore';
    export * from './src/lib/modFileRegistry';
    export * from './src/lib/stringsBinStore';
    export * from './src/lib/characterNames';
    export * from './src/lib/modeldbStore';
    export * from './src/components/map/campaignSession';
    export * from './src/components/map/sharedCampaignScript';
    export * from './src/components/map/additionalParsers';
    export { CAMPAIGN_SHARED_REFERENCES } from './src/components/map/useSharedCampaignReferences';
    export { parseTextFile, serializeTextFile } from './src/components/edb/EDBParser';
    export * from './src/components/units/unitDescriptionsCodec';
    export { default as storeImportedUnitDescriptions } from './src/components/units/sharedUnitDescriptions';
    export { serializeModeldb } from './src/lib/modeldbCodec';
  ` },
  bundle: true, write: false, format: 'iife', platform: 'browser', globalName: 'SharedTest',
  alias: { '@': path.join(root, 'src') }, define: { 'process.env.NODE_ENV': '"test"' }, logLevel: 'silent',
});
class CustomEvent extends Event { constructor(type, options = {}) { super(type); this.detail = options.detail; } }
function runtime() {
  const values = new Map(), window = new EventTarget();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  window.localStorage = storage; window.sessionStorage = storage;
  const context = vm.createContext({ window, localStorage: storage, CustomEvent, queueMicrotask, console, setTimeout, clearTimeout, TextEncoder, TextDecoder });
  vm.runInContext(built.outputFiles[0].text, context);
  return { a: context.SharedTest, window };
}
const plain = value => JSON.parse(JSON.stringify(value));
const entries = map => Object.entries(map).map(([key, value]) => ({ key, value }));

test('Every raw-file alias refreshes mounted readers and a newly opened editor reads the latest content', async () => {
  const { a } = runtime();
  for (const group of a.FILE_KEY_GROUPS) {
    const binding = a.createSharedFileBinding(group[0], String, String, '');
    let refreshes = 0;
    const stop = binding.subscribe(() => { refreshes++; });
    a.setFile(group.at(-1), 'imported'); await a.flushBigFiles();
    assert.equal(binding.read(), 'imported', group[0]);
    binding.update('edited'); await a.flushBigFiles();
    for (const alias of group) assert.equal(a.getFile(alias), 'edited', alias);
    const nextEditor = a.createSharedFileBinding(group[0], String, String, '');
    assert.equal(nextEditor.read(), 'edited'); assert.ok(refreshes > 0);
    stop();
  }
});

test('Reading a shared file preserves original comments and formatting; only actual edits serialize it', async () => {
  const { a } = runtime();
  const raw = '; keep this comment\r\n{TITLE}Original\r\n';
  a.setFile('m2tw_edb_txt_file', raw);
  let serializations = 0;
  const b = a.createSharedFileBinding('m2tw_edb_txt_file', a.parseTextFile, value => { serializations++; return a.serializeTextFile(value); }, {});
  const before = b.read(); assert.strictEqual(b.read(), before);
  assert.equal(a.getFile('m2tw_edb_txt_file'), raw); assert.equal(serializations, 0);
  b.update(previous => ({ ...previous, TITLE: 'Updated' }));
  assert.equal(a.getFile('m2tw_edb_txt_file'), '{TITLE}Updated\n'); assert.equal(serializations, 1);
  await a.flushBigFiles(); assert.equal(b.read().TITLE, 'Updated');
});

test('A stale editor updater starts with the newest shared file and preserves local model metadata on its own writes', () => {
  const { a } = runtime();
  const first = a.createSharedFileBinding('m2tw_cultures_file', JSON.parse, JSON.stringify, []);
  const second = a.createSharedFileBinding('m2tw_cultures_raw', JSON.parse, JSON.stringify, []);
  first.update([{ name: 'original' }]); second.read();
  first.update(previous => [...previous, { name: 'added_elsewhere' }]);
  second.update(previous => [...previous, { name: 'added_here', draftSelection: true }]);
  assert.equal(second.read().length, 3); assert.equal(first.read().length, 3);
  assert.equal(second.read()[2].draftSelection, true);
  a.removeFile('m2tw_cultures_file'); assert.deepEqual(plain(first.read()), []);
});

test('Unrelated writes do not notify a file reader and unsubscribed editors stay detached', async () => {
  const { a } = runtime();
  const b = a.createSharedFileBinding('m2tw_banners_file', String, String, null);
  let refreshes = 0; const stop = b.subscribe(() => { refreshes++; });
  a.setFile('unrelated', 'value'); await a.flushBigFiles(); assert.equal(refreshes, 0);
  a.setFile('m2tw_banners_raw', '<Banners/>'); await a.flushBigFiles(); assert.equal(refreshes, 1);
  stop(); a.setFile('m2tw_banners_file', '<Updated/>'); await a.flushBigFiles(); assert.equal(refreshes, 1);
});

for (const [name, legacy] of [
  ['export_buildings.txt.strings.bin', 'm2tw_edb_txt_file'],
  ['export_vnvs.txt.strings.bin', 'm2tw_vnvs_file'],
  ['export_ancillaries.txt.strings.bin', 'm2tw_anctxt_file'],
  ['descr_religions.txt.strings.bin', 'm2tw_religion_display_names'],
  ['rebel_faction_descr.txt.strings.bin', 'm2tw_rebel_display_names'],
  ['strat.txt.strings.bin', 'm2tw_resource_display_names'],
]) test(`${name} shares edits in both directions and preserves metadata`, async () => {
  const { a } = runtime();
  const meta = { entries: entries({ TITLE: 'Original', UNRELATED: 'Keep' }), magic1: 2, magic2: 2048, customMetadata: 'retained' };
  a.updateStringsBinFile(name, meta);
  const b = a.createSharedDictionaryBinding(name, legacy, a.parseTextFile, a.serializeTextFile);
  assert.equal(b.read().TITLE, 'Original'); assert.strictEqual(b.read(), b.read());
  b.update(previous => ({ ...previous, TITLE: 'Édited' }));
  assert.equal(a.getSharedDictionaryFile(name)[1].entries[0].value, 'Édited');
  assert.equal(a.getSharedDictionaryFile(name)[1].customMetadata, 'retained');
  assert.match(a.getFile(legacy), /\{TITLE\}Édited/);
  a.updateStringsBinFile(name, { ...meta, entries: entries({ TITLE: 'Strings editor', UNRELATED: 'Keep' }) });
  await a.flushBigFiles(); assert.equal(b.read().TITLE, 'Strings editor'); assert.equal(b.read().UNRELATED, 'Keep');
});

test('Names dictionaries also refresh both legacy readers without an old session cache winning', () => {
  const { a } = runtime();
  a.setFile('m2tw_char_names_display', JSON.stringify({ Henry: 'Outdated' }));
  a.updateStringsBinFile('NAMES.TXT.STRINGS.BIN', { entries: entries({ Henry: 'Henri' }), magic1: 2, magic2: 2048 });
  assert.equal(a.getCharacterDisplayNames().Henry, 'Henri');
  assert.equal(JSON.parse(a.getFile('m2tw_names_bin_entries')).Henry, 'Henri');
  assert.equal(JSON.parse(a.getFile('m2tw_char_names_display')).Henry, 'Henri');
  const b = a.createSharedDictionaryBinding('names.txt.strings.bin', 'm2tw_names_bin_entries', JSON.parse, JSON.stringify);
  b.update({ Henry: 'Heinrich' }); assert.equal(a.getCharacterDisplayNames().Henry, 'Heinrich');
});

test('Identical dictionary writes emit no reload loop; ordered and opaque dictionaries cannot be silently rewritten', async () => {
  const { a, window } = runtime();
  const data = { entries: entries({ TITLE: 'Same' }), magic1: 2, magic2: 2048 };
  let events = 0; window.addEventListener('strings-bin-updated', () => { events++; });
  a.updateStringsBinFile('export_vnvs.txt.strings.bin', data);
  a.updateStringsBinFile('export_vnvs.txt.strings.bin', plain(data));
  assert.equal(events, 1);
  for (const locked of [{ ...data, readOnly: true }, { ...data, magic1: 1 }]) {
    a.updateStringsBinFile('locked.txt.strings.bin', locked);
    const b = a.createSharedDictionaryBinding('locked.txt.strings.bin', 'locked_legacy', a.parseTextFile, a.serializeTextFile);
    assert.throws(() => b.update({ TITLE: 'Not allowed' }), /not an editable keyed/);
    assert.equal(a.getFile('locked_legacy'), null);
    assert.equal(a.getSharedDictionaryFile('locked.txt.strings.bin')[1].entries[0].value, 'Same');
  }
  await a.flushBigFiles();
});

test('Original campaign files cannot overwrite any loaded global reference, including reads already in progress', async () => {
  const { a } = runtime();
  for (const key of Object.values(a.CAMPAIGN_SHARED_REFERENCES)) {
    a.setFile(key, 'current edit');
    let reads = 0;
    await a.seedSharedModFile({ text: async () => { reads++; return 'old original'; } }, key);
    assert.equal(reads, 0); assert.equal(a.getFile(key), 'current edit');
    a.removeFile(key);
    let finish;
    const pending = a.seedSharedModFile({ text: () => new Promise(resolve => { finish = resolve; }) }, key);
    a.setFile(key, 'edit during read'); finish('old original'); await pending;
    assert.equal(a.getFile(key), 'edit during read');
  }
  a.setFile('m2tw_music_types_raw', 'new music types');
  a.restoreCampaignStorage({ session: { m2tw_music_types_raw: 'outdated' } });
  assert.equal(a.getFile('m2tw_music_types_raw'), 'new music types');
});

test('Unit names and multiline descriptions stay synchronized with Strings and later explicit imports', () => {
  const { a } = runtime();
  const raw = '{Spearmen}Spearmen\n{Spearmen_descr}\nFirst paragraph\nSecond paragraph\n{Spearmen_descr_short}Short text\n';
  a.storeImportedUnitDescriptions(raw);
  const b = a.createSharedDictionaryBinding('export_units.txt.strings.bin', 'm2tw_export_units_file', a.parseUnitDescriptionStrings, a.serializeUnitDescriptionStrings);
  assert.equal(a.groupUnitDescriptions(b.read()).Spearmen.long, 'First paragraph\nSecond paragraph');
  b.update(previous => ({ ...previous, Spearmen: 'New display name' }));
  assert.match(a.getFile('m2tw_export_units_file'), /New display name/);
  a.storeImportedUnitDescriptions('{Spearmen}Replacement import\n');
  assert.equal(a.groupUnitDescriptions(b.read()).Spearmen.name, 'Replacement import');
  assert.equal(b.read().Spearmen_descr, undefined);
});

test('Script edits are immediately shared and remain tied to their active campaign', () => {
  const { a } = runtime();
  a.rememberEditedScript('campaign_a', 'declare_counter latest_counter');
  assert.equal(a.getFile('m2tw_script_raw'), 'declare_counter latest_counter');
  assert.equal(a.readEditedScript('campaign_a'), 'declare_counter latest_counter');
  assert.equal(a.readEditedScript('campaign_b'), null);
  a.rememberEditedScript('campaign_a', '');
  assert.equal(a.readEditedScript('campaign_a'), '', 'An intentional empty script is still an edit');
  a.setFile(a.SCRIPT_OWNER_KEY, '');
  assert.equal(a.readEditedScript('campaign_a'), null);
  const selection = readFileSync(path.join(root, 'src/components/map/useCampaignSelection.js'), 'utf8');
  assert.match(selection, /initial && id === library.active \? readEditedScript\(id\)/);
  assert.match(selection, /preserveScript: editedScript !== null/);
  const panel = readFileSync(path.join(root, 'src/components/map/ScriptingPanel.jsx'), 'utf8');
  assert.match(panel, /useSharedCampaignScript\(\)/);
  assert.doesNotMatch(panel, /saveTimer|2000/);
});

test('Model edits persist in the shared raw file and notify other model consumers', () => {
  const { a, window } = runtime();
  const db = { entries: [], byName: {}, totalEntries: 0 };
  const raw = a.serializeModeldb(db);
  a.modeldbStore.set(db, raw); assert.strictEqual(a.modeldbStore.get(), db);
  let events = 0; window.addEventListener('modeldb-loaded', () => { events++; });
  const changed = { ...db, entries: [{ name: 'test_model', scale: 1, meshes: [{ path: 'data/new.cas', dist: 100 }], factions: [], attachFactions: [], mountTypes: [], torchBoneIndex: -1, torch: [0, 0, 0, 0, 0, 0] }] };
  a.modeldbStore.update(changed);
  assert.match(a.getFile('m2tw_modeldb_file'), /data\/new\.cas/);
  assert.strictEqual(a.modeldbStore.get(), changed); assert.equal(events, 1);
});

test('Shared editor screens use synchronized setters and campaign snapshots exclude global reference caches', () => {
  for (const name of ['edb/EDBContext', 'traits/TraitsContext', 'ancillaries/AncillariesContext', 'minorfiles/ReligionsTab', 'minorfiles/RebelFactionsTab', 'minorfiles/ResourcesTab', 'minorfiles/CharacterNamesTab', 'minorfiles/banners/BannersTab', 'minorfiles/stratmap/StratMapCharTab', 'minorfiles/spritesheet/SpriteSheetEditor']) {
    const source = readFileSync(path.join(root, `src/components/${name}.jsx`), 'utf8');
    assert.match(source, /useSharedFileState\(/, name);
  }
  const campaign = readFileSync(path.join(root, 'src/pages/CampaignMap.jsx'), 'utf8');
  assert.match(campaign, /useSharedCampaignReferences\(\)/);
  assert.match(campaign, /seedSharedModFile\(file, CAMPAIGN_SHARED_REFERENCES\[name\]\)/);
  assert.doesNotMatch(campaign, /saved\.(rebelFactions|religions|naturalResources|cultures|traitsList|ancillariesList|musicTypes)/);
  const snapshot = campaign.match(/const campaignSnapshot = \{[^\n]+/)?.[0] || '';
  assert.doesNotMatch(snapshot, /\b(edbData|rebelFactions|religions|naturalResources|cultures|traitsList|ancillariesList|musicTypes)\b/);
});