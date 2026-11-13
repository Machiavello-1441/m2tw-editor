import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const built = await build({
  absWorkingDir: root,
  stdin: { resolveDir: root, sourcefile: 'shared-character-names-test.js', contents: `
    export * from './src/components/map/useSharedCharacterNames';
    export { default as seedCampaignCharacterNames, seedCampaignCharacterDisplayNames } from './src/components/map/seedCampaignCharacterNames';
    export * from './src/components/map/campaignUndoStorage';
    export * from './src/components/map/campaignSession';
    export * from './src/components/factions/factionNamesDuplicate';
    export * from './src/lib/characterNames';
    export * from './src/lib/bigFileStore';
    export * from './src/lib/stringsBinStore';
    export * from './src/lib/modFileRegistry';
    export { encodeStringsBin } from './src/components/strings/stringsBinCodec';
  ` },
  bundle: true, write: false, format: 'iife', platform: 'browser', globalName: 'NameSyncTest',
  alias: { '@': path.join(root, 'src') }, define: { 'process.env.NODE_ENV': '"test"' }, logLevel: 'silent',
});
class CustomEvent extends Event {
  constructor(type, options = {}) { super(type); this.detail = options.detail; }
}
function runtime() {
  const values = new Map(), window = new EventTarget();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  window.localStorage = storage; window.sessionStorage = storage;
  const context = vm.createContext({ window, localStorage: storage, CustomEvent, queueMicrotask, console, setTimeout, clearTimeout, TextEncoder, TextDecoder });
  vm.runInContext(built.outputFiles[0].text, context);
  return { a: context.NameSyncTest, window };
}
const original = 'faction: england\ncharacters\nHenry\nsurnames\nYork\nwomen\nMary\nend\n';
const displays = { Henry: 'Henri', York: 'York', Mary: 'Marie' };
const model = { stratData: null, overlayItems: [], regionsData: null, layers: {} };
const entries = map => Object.entries(map).map(([key, value]) => ({ key, value }));
const pool = (a, faction = 'england_copy') => a.readSharedCharacterNames().descrNames?.male[faction]?.join(',');

function seed(a) {
  a.setFile('m2tw_names_file', original);
  a.setStringsBinStore({ 'names.txt.strings.bin': { entries: entries(displays), magic1: 2, magic2: 2048 } });
}

test('Returning to an old campaign keeps duplicated faction names, including an old recovery storage snapshot', async () => {
  const { a } = runtime();
  seed(a);
  const oldNames = a.readSharedCharacterNames();
  const storage = a.captureUndoStorage();
  storage.extra.m2tw_char_names_display = JSON.stringify({ Henry: 'Outdated display' });
  a.duplicateFactionNames('england', 'england_copy');
  const copiedRaw = a.getCharacterNamesRaw();
  a.restoreUndoStorage(storage, model, true, { preserveSharedNames: true });
  assert.equal(a.getCharacterNamesRaw(), copiedRaw);
  assert.equal(pool(a), 'Henry');
  assert.equal(a.readSharedCharacterNames().descrNames.female.england_copy.join(','), 'Mary');
  assert.equal(a.readSharedCharacterNames().descrNames._surnames.england_copy.join(','), 'York');
  assert.equal(a.readSharedCharacterNames().namesDisplayMap.Henry, 'Henri');
  assert.equal(oldNames.descrNames.male.england_copy, undefined);
  await a.flushBigFiles();
});

test('Original campaign folders cannot overwrite newly copied names or display dictionaries', async () => {
  const { a } = runtime();
  seed(a);
  a.duplicateFactionNames('england', 'england_copy');
  let reads = 0;
  await a.seedCampaignCharacterNames({ text: async () => { reads++; return original; } });
  await a.seedCampaignCharacterDisplayNames({ name: 'names.txt.strings.bin', arrayBuffer: async () => { reads++; return a.encodeStringsBin(entries({ Henry: 'Old display' })); } });
  assert.equal(reads, 0);
  assert.equal(pool(a), 'Henry');
  assert.equal(a.readSharedCharacterNames().namesDisplayMap.Henry, 'Henri');
});

test('Mounted name readers refresh for shared edits, alias writes, dictionary changes, and removal', async () => {
  const { a } = runtime();
  seed(a); await a.flushBigFiles();
  let changes = 0;
  const stop = a.subscribeSharedCharacterNames(() => { changes++; });
  const first = a.readSharedCharacterNames();
  assert.strictEqual(a.readSharedCharacterNames(), first, 'External-store snapshots must be stable');
  a.duplicateFactionNames('england', 'england_copy'); await a.flushBigFiles();
  assert.ok(changes > 0); assert.equal(pool(a), 'Henry');
  const second = a.readSharedCharacterNames();
  assert.notStrictEqual(second, first);
  assert.strictEqual(a.readSharedCharacterNames(), second);
  a.updateStringsBinFile('names.txt.strings.bin', { entries: entries({ ...displays, Henry: 'Updated display' }), magic1: 2, magic2: 2048 });
  await a.flushBigFiles();
  assert.equal(a.readSharedCharacterNames().namesDisplayMap.Henry, 'Updated display');
  assert.strictEqual(a.readSharedCharacterNames().descrNames, second.descrNames);
  a.setFile('m2tw_descr_names_raw', a.getCharacterNamesRaw().replaceAll('Henry', 'Edward'));
  await a.flushBigFiles(); assert.equal(pool(a), 'Edward');
  const beforeUnrelated = changes;
  a.setFile('unrelated', 'unchanged names'); await a.flushBigFiles();
  assert.equal(changes, beforeUnrelated);
  a.removeFile('m2tw_names_file'); await a.flushBigFiles();
  assert.equal(a.readSharedCharacterNames().descrNames, null);
  stop();
  const stopped = changes;
  a.setFile('m2tw_names_file', original); await a.flushBigFiles();
  assert.equal(changes, stopped);
});

test('Missing names can be seeded, without losing edits made while the original file is still reading', async () => {
  const { a } = runtime();
  await a.seedCampaignCharacterNames({ text: async () => original });
  assert.equal(pool(a, 'england'), 'Henry');
  a.removeFile('m2tw_names_file');
  let finish;
  const pending = a.seedCampaignCharacterNames({ text: () => new Promise(resolve => { finish = resolve; }) });
  const newer = original + '\nfaction: england_copy\ncharacters\nEdward\nend\n';
  a.setFile('m2tw_names_file', newer);
  finish(original); await pending;
  assert.equal(a.getCharacterNamesRaw(), newer); assert.equal(pool(a), 'Edward');
});

test('Missing display names seed into the shared dictionary but a newer import wins an in-flight read', async () => {
  const { a } = runtime();
  await a.seedCampaignCharacterDisplayNames({ name: 'names.txt.strings.bin', arrayBuffer: async () => a.encodeStringsBin(entries(displays)) });
  assert.equal(a.readSharedCharacterNames().namesDisplayMap.Mary, 'Marie');
  const { a: b } = runtime();
  let finish;
  const pending = b.seedCampaignCharacterDisplayNames({ name: 'names.txt.strings.bin', arrayBuffer: () => new Promise(resolve => { finish = resolve; }) });
  b.updateStringsBinFile('names.txt.strings.bin', { entries: entries({ Henry: 'New import' }), magic1: 2, magic2: 2048 });
  finish(b.encodeStringsBin(entries(displays))); await pending;
  assert.equal(b.readSharedCharacterNames().namesDisplayMap.Henry, 'New import');
});

test('Recovery still restores genuinely missing names, while normal in-campaign undo can intentionally restore name edits', () => {
  const { a } = runtime();
  a.setFile('m2tw_names_file', original);
  a.setFile('m2tw_char_names_display', JSON.stringify(displays));
  const storage = a.captureUndoStorage();
  a.removeFile('m2tw_names_file'); a.removeFile('m2tw_char_names_display');
  a.restoreUndoStorage(storage, model, true, { preserveSharedNames: true });
  assert.equal(pool(a, 'england'), 'Henry');
  assert.equal(a.readSharedCharacterNames().namesDisplayMap.Mary, 'Marie');
  a.duplicateFactionNames('england', 'england_copy');
  assert.equal(pool(a), 'Henry');
  a.restoreUndoStorage(storage, model);
  assert.equal(pool(a), undefined); assert.equal(a.getCharacterNamesRaw(), original);
});

test('Adding a new character name after switching editors preserves the newly duplicated faction pools', () => {
  const { a } = runtime();
  seed(a);
  const storage = a.captureUndoStorage();
  a.duplicateFactionNames('england', 'england_copy');
  a.restoreUndoStorage(storage, model, true, { preserveSharedNames: true });
  const shared = a.readSharedCharacterNames();
  a.addCharacterName({ faction: 'england_copy', section: 'male', internalName: 'Edward', displayName: 'Édouard', ...shared });
  assert.equal(pool(a), 'Henry,Edward');
  assert.equal(pool(a, 'england'), 'Henry');
  assert.equal(a.readSharedCharacterNames().namesDisplayMap.Edward, 'Édouard');
});

test('Campaign Map uses shared names for character menus and exports, never cached parsed campaign names', () => {
  const source = readFileSync(path.join(root, 'src/pages/CampaignMap.jsx'), 'utf8');
  const selection = readFileSync(path.join(root, 'src/components/map/useCampaignSelection.js'), 'utf8');
  assert.match(source, /const \{ descrNames, namesDisplayMap \} = useSharedCharacterNames\(\)/);
  assert.match(source, /await seedCampaignCharacterNames\(file\)/);
  assert.match(source, /await seedCampaignCharacterDisplayNames\(file\)/);
  assert.doesNotMatch(source, /setDescrNames|setNamesDisplayMap|saved\.descrNames|saved\.namesDisplayMap|restored\.descrNames|restored\.namesDisplayMap/);
  const snapshot = source.match(/const campaignSnapshot = \{[^\n]+/)?.[0] || '';
  assert.doesNotMatch(snapshot, /\bdescrNames\b|\bnamesDisplayMap\b/);
  assert.match(source, /descrNames=\{descrNames\}/); assert.match(source, /namesDisplayMap=\{namesDisplayMap\}/);
  assert.match(selection, /preserveSharedNames: true/);
});