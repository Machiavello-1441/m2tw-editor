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
  stdin: { resolveDir: root, sourcefile: 'faction-names-regression.js', contents: `
    export { prepareFactionNames, duplicateFactionNames } from './src/components/factions/factionBulkDuplicate';
    export * from './src/lib/descrNamesCodec';
    export * from './src/lib/characterNames';
    export * from './src/lib/bigFileStore';
    export * from './src/lib/stringsBinStore';
    export { addCharacterNamesToZip } from './src/components/export/characterNamesExport';
    export { parseStringsBin } from './src/components/strings/stringsBinCodec';
  ` },
  bundle: true, write: false, format: 'iife', platform: 'browser', globalName: 'NamesTest',
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
  return { a: context.NamesTest, window };
}
const plain = value => JSON.parse(JSON.stringify(value));
const source = '; Original comment\r\nfaction: england\r\n\tcharacters\r\n\t\tHenry\r\n\tsurnames\r\n\t\tYork\r\n\twomen\r\n\t\tMary\r\nend\r\n';
const pool = { characters: ['Henry'], surnames: ['York'], females: ['Mary'] };
const dictionary = { Henry: 'Henri', York: 'd’York', Mary: 'Émilie', Unrelated: 'Keep me' };
const entries = Object.entries(dictionary).map(([key, value]) => ({ key, value }));

function exported(a) {
  const files = new Map();
  a.addCharacterNamesToZip({
    root: '', files: {},
    file(name, value) { this.files[name] = {}; files.set(name, value); },
    remove(name) { delete this.files[name]; files.delete(name); },
  });
  return files;
}

test('Default duplication copies all name sections, keeps global name IDs, and refreshes both lists and display values', () => {
  const { a, window } = runtime();
  a.setFile('m2tw_names_file', source);
  a.setStringsBinStore({ 'DATA\\TEXT\\NAMES.TXT.STRINGS.BIN': { entries, magic1: 2, magic2: 2048, customMetadata: 'preserve' } });
  const events = [];
  window.addEventListener('load-character-names', event => events.push(event.detail));
  const result = a.duplicateFactionNames('england', 'england_copy');
  assert.equal(result.ok, true); assert.equal(result.count, 3);
  const raw = a.getCharacterNamesRaw();
  assert.ok(raw.startsWith(source));
  assert.deepEqual(plain(a.parseDescrNames(raw).england_copy), pool);
  assert.deepEqual(plain(a.parseDescrNames(raw).england), pool);
  assert.equal(a.getFile('m2tw_descr_names_raw'), raw);
  assert.deepEqual(plain(a.getCharacterDisplayNames()), dictionary);
  assert.equal(events.length, 1); assert.equal(events[0].raw, raw);
  assert.deepEqual(plain(events[0].namesDisplayMap), dictionary);
  const stored = a.getCharacterNamesFile()[1];
  assert.equal(stored.customMetadata, 'preserve');
  assert.deepEqual(plain(stored.entries), entries);
});

test('Names loaded only through the names editor are promoted into the shared dictionary and exported as both text and binary', () => {
  const { a } = runtime();
  a.setFile('m2tw_names_file', source);
  a.setFile('m2tw_names_bin_entries', JSON.stringify(dictionary));
  a.duplicateFactionNames('england', 'new_faction');
  assert.ok(a.getCharacterNamesFile(), 'Cached names must reach the shared Strings editor too');
  const files = exported(a);
  assert.ok(files.get('descr_names.txt').includes('faction: new_faction'));
  const text = new TextDecoder('utf-16le').decode(files.get('text/names.txt'));
  assert.match(text, /\{Henry\}Henri/); assert.match(text, /\{Mary\}Émilie/);
  assert.match(text, /\{Unrelated\}Keep me/);
  assert.deepEqual(plain(a.parseStringsBin(files.get('text/names.txt.strings.bin')).entries), entries);
  const parsed = a.parseDescrNames(files.get('descr_names.txt'));
  for (const key of Object.values(plain(parsed.new_faction)).flat()) assert.ok(text.includes(`{${key}}`), key);
});

test('An existing empty names block does not silently prevent the default copy', () => {
  const { a } = runtime();
  const raw = source + '\r\nfaction england_copy\r\ncharacters\r\nsurnames\r\nwomen\r\nend\r\n';
  const result = a.duplicateDescrNames(raw, 'England', 'england_copy');
  assert.equal(result.ok, true); assert.equal(result.count, 3);
  assert.deepEqual(plain(a.parseDescrNames(result.out).england_copy), pool);
  assert.ok(result.out.startsWith(raw));
});

test('Incomplete pre-existing pools gain missing names without removing custom target entries or changing other factions', () => {
  const { a } = runtime();
  const raw = source + '\r\nfaction england_copy\r\ncharacters\r\nHenry\r\nCustom_King\r\nsurnames\r\nCustom_House\r\nwomen\r\nend\r\n\r\nfaction france\r\ncharacters\r\nLouis\r\nend\r\n';
  const result = a.duplicateDescrNames(raw, 'england', 'england_copy');
  assert.equal(result.count, 2);
  const parsed = plain(a.parseDescrNames(result.out));
  assert.deepEqual(parsed.england_copy, { characters: ['Henry', 'Custom_King'], surnames: ['Custom_House', 'York'], females: ['Mary'] });
  assert.deepEqual(parsed.england, pool);
  assert.deepEqual(parsed.france.characters, ['Louis']);
  assert.ok(result.out.includes('faction france\r\ncharacters\r\nLouis\r\nend\r\n'));
  const repeated = a.duplicateDescrNames(result.out, 'england', 'england_copy');
  assert.equal(repeated.already, true); assert.equal(repeated.out, result.out);
});

test('Grouped factions, mixed-case headers, repeated source blocks, comments, and female aliases remain supported', () => {
  const { a } = runtime();
  const raw = '; untouched\nfaction: ENGLAND, france ; shared\ncharacters\nHenry\nend\nfaction england\nfemales\nMary\nsurnames\nYork\nend\nfaction spain\ncharacters\nJuan\nend\n';
  const result = a.duplicateDescrNames(raw, 'england', 'copy');
  assert.equal(result.blocks, 2); assert.equal(result.count, 3);
  const parsed = plain(a.parseDescrNames(result.out));
  assert.deepEqual(parsed.copy, pool);
  assert.deepEqual(parsed.france.characters, ['Henry']);
  assert.deepEqual(parsed.spain.characters, ['Juan']);
  assert.ok(result.out.startsWith('; untouched\n'));
});

test('Repeated duplication is idempotent and an absent display dictionary is not replaced with invented translations', () => {
  const { a } = runtime();
  a.setFile('m2tw_names_file', source);
  const first = a.duplicateFactionNames('england', 'copy');
  const second = a.duplicateFactionNames('england', 'copy');
  assert.equal(first.ok, true); assert.equal(second.already, true);
  assert.equal(a.getCharacterNamesRaw(), first.out);
  assert.equal(a.getCharacterNamesFile(), undefined);
  assert.deepEqual(plain(a.getCharacterDisplayNames()), {});
  assert.deepEqual(plain(a.parseDescrNames(first.out).copy), pool);
});

test('Missing source pools and stale preparation fail before touching names or translations', () => {
  const { a } = runtime();
  a.setFile('m2tw_names_file', source);
  a.setFile('m2tw_names_bin_entries', JSON.stringify(dictionary));
  assert.throws(() => a.prepareFactionNames('missing', 'copy'), /No names block/);
  assert.equal(a.getFile('m2tw_names_file'), source);
  assert.equal(a.getCharacterNamesFile(), undefined);
  const prepared = a.prepareFactionNames('england', 'copy');
  const changed = source + '; New edit\r\n';
  a.setFile('m2tw_names_file', changed);
  assert.throws(() => a.duplicateFactionNames('england', 'copy', prepared), /changed during duplication/);
  assert.equal(a.getFile('m2tw_names_file'), changed);
  assert.equal(a.getCharacterNamesFile(), undefined);
});

test('Faction confirmation still copies names unconditionally and the faction ZIP includes the shared name pair', () => {
  const editor = readFileSync(path.join(root, 'src/pages/FactionsEditor.jsx'), 'utf8');
  const zip = readFileSync(path.join(root, 'src/components/factions/FactionZipExport.jsx'), 'utf8');
  assert.match(editor, /preparedNames = prepareFactionNames\(src\.name, newFactionName\)/);
  assert.match(editor, /duplicateFactionNames\(src\.name, newFactionName, preparedNames\)/);
  assert.match(zip, /addSharedEditedFilesToZip\(zip\.folder\('data'\)\)/);
  const shared = readFileSync(path.join(root, 'src/components/export/sharedEditedFilesExport.js'), 'utf8');
  assert.match(shared, /addCharacterNamesToZip\(dataFolder\)/);
});