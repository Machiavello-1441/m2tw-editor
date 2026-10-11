/** Synthetic Home import and React navigation smoke test. No account data or network access. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { build } from 'esbuild';
import JSZip from 'jszip';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const testRequire = createRequire(process.env.M2TW_TEST_DEPS ? path.join(process.env.M2TW_TEST_DEPS, 'package.json') : import.meta.url);
const { JSDOM } = testRequire('jsdom');
const { IDBFactory } = testRequire('fake-indexeddb');
const bundle = await build({
  absWorkingDir: root, stdin: { sourcefile: 'editor-smoke-entry.jsx', loader: 'jsx', resolveDir: root, contents: `
    import React from 'react';
    import { createRoot } from 'react-dom/client';
    import { MemoryRouter } from 'react-router-dom';
    import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
    import Layout from './src/Layout';
    import Home from './src/pages/Home';
    import FactionsEditor from './src/pages/FactionsEditor';
    import StringsBinEditor from './src/pages/StringsBinEditor';
    import UnitEditor from './src/pages/UnitEditor';
    export { act } from 'react';
    export * from './src/lib/bigFileStore';
    export * from './src/lib/stringsBinStore';
    export * from './src/components/strings/stringsBinCodec';
    export * from './src/components/export/sharedStringsExport';
    const pages = { Home, FactionsEditor, StringsBinEditor, UnitEditor };
    let root;
    const query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    export function show(page) {
      root ||= createRoot(document.getElementById('root'));
      const Page = pages[page];
      root.render(<QueryClientProvider client={query}><MemoryRouter><Layout currentPageName={page}><Page /></Layout></MemoryRouter></QueryClientProvider>);
    }
    export function stop() { root?.unmount(); query.clear(); }
  ` },
  bundle: true, write: false, format: 'iife', platform: 'browser', globalName: 'EditorSmoke',
  alias: { '@': path.join(root, 'src') }, define: { 'process.env.NODE_ENV': '"test"', 'import.meta.env': '{}' }, logLevel: 'silent',
});
const dom = new JSDOM('<!doctype html><div id="root"></div>', {
  url: 'https://m2tw-regression.invalid/', runScripts: 'outside-only', pretendToBeVisual: true,
});
const w = dom.window;
w.indexedDB = new IDBFactory();
w.TextEncoder = TextEncoder; w.TextDecoder = TextDecoder; w.structuredClone = structuredClone;
w.IS_REACT_ACT_ENVIRONMENT = true;
// jsdom does not supply MessageChannel, used by React's async test scheduler.
w.MessageChannel = class {
  constructor() {
    this.port1 = { onmessage: null };
    this.port2 = { postMessage: () => setTimeout(() => this.port1.onmessage?.(), 0) };
  }
};
w.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
w.matchMedia = query => ({ media: query, matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; } });
w.fetch = async () => { throw new Error('Unexpected network request in synthetic UI test'); };
const exportedBlobs = [];
w.URL.createObjectURL = blob => { exportedBlobs.push(blob); return 'blob:synthetic-test'; }; w.URL.revokeObjectURL = () => {};
w.HTMLAnchorElement.prototype.click = () => {};
const errors = [];
w.addEventListener('error', event => errors.push(event.error?.message || event.message));
w.eval(bundle.outputFiles[0].text);
const a = w.EditorSmoke;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const assertNoCrash = () => {
  assert.deepEqual(errors, []);
  assert.ok(!w.document.body.textContent.includes('Render Error'), 'No editor render crash');
};
function file(name, content, directory = 'data') {
  const bytes = typeof content === 'string' ? new TextEncoder().encode(content) : new Uint8Array(content);
  const f = new w.File([bytes], name);
  Object.defineProperty(f, 'webkitRelativePath', { value: `${directory}/${name}` });
  f.arrayBuffer = async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return f;
}

const orderedNames = ['battle', 'battle_ed', 'shared', 'strat', 'tooltips'].map(name => `${name}.txt.strings.bin`);
// An independent fixture builder; intentionally does not use the app encoder.
function orderedFixture(values) {
  const header = Buffer.alloc(8); header.writeUInt16LE(1); header.writeUInt16LE(2048, 2); header.writeUInt32LE(values.length, 4);
  return Buffer.concat([header, ...values.map(value => {
    const length = Buffer.alloc(2); length.writeUInt16LE(value.length);
    return Buffer.concat([length, Buffer.from(value, 'utf16le')]);
  })]);
}
const readBlob = blob => new Promise((resolve, reject) => {
  const reader = new w.FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(reader.error); reader.readAsArrayBuffer(blob);
});

try {
  await a.hydrateBigFiles();
  // Simulate the full native cache that caused the original Home/editor handoff failure.
  w.Storage.prototype.setItem = function () { throw new w.DOMException('Simulated full cache', 'QuotaExceededError'); };
  await a.act(async () => { a.show('Home'); await pause(30); });
  assertNoCrash();
  const source = [
    file('broken.txt.strings.bin', new Uint8Array([1, 2, 3]), 'data/text'),
    file('descr_sm_factions.txt', 'faction england\n culture northern_european\n religion catholic\n primary_colour red 200, green 20, blue 20\n secondary_colour red 240, green 240, blue 240\n'),
    file('descr_cultures.txt', 'culture northern_european\n'),
    file('descr_religions.txt', 'catholic\n'),
    file('descr_character.txt', 'starting_action_points 80\ntype named character\nactions moving_normal\nwage_base 100\nfaction england\ndictionary 2\nstrat_model general\n'),
    file('descr_model_strat.txt', 'type general\nskeleton strat_named_with_army\nscale 0.7\ntexture england, models_strat/textures/general_england.tga\n'),
    file('descr_names.txt', 'faction: england\n\tcharacters\n\t\tHenry\n\tsurnames\n\t\tYork\n'),
    file('descr_offmap_models.txt', 'type navy_england\n'),
    file('descr_banners_new.xml', '<Banners><FactionBanners><Banner Name="faction"><Textures><Texture Faction="england" DiffuseMap="banner.tga" TranslucencyMap="alpha.tga"/></Textures></Banner></FactionBanners></Banners>'),
    file('export_descr_unit.txt', 'type Test Spearmen\ndictionary Test_Spearmen\ncategory infantry\nclass spearmen\nownership england\nera 0 england\n'),
    file('EXPANDED.TXT.STRINGS.BIN', a.encodeStringsBin([{ key: 'ENGLAND', value: 'England test description' }]), 'data/text'),
    file('menu_english.txt.strings.bin', a.encodeStringsBin([{ key: 'UI_FACTION_ENGLAND', value: 'England menu' }]), 'data/text'),
    ...orderedNames.map(name => file(name, orderedFixture([`${name} first value`, '', 'Zürich %S']), 'data/text')),
    file('unsupported_test.txt', 'Not a supported map file', 'data/world/maps/base'),
  ];
  const picker = w.document.querySelector('input[type="file"][webkitdirectory]');
  assert.ok(picker, 'Home has a directory picker');
  await a.act(async () => {
    Object.defineProperty(picker, 'files', { configurable: true, value: source });
    picker.dispatchEvent(new w.Event('change', { bubbles: true }));
    await pause(30);
  });
  const buttons = [...w.document.querySelectorAll('button')];
  const load = buttons.find(button => /load\s+(?:\d+\s+)?selected files/i.test(button.textContent) && !button.disabled);
  assert.ok(load, `Load selected files button present. Buttons: ${buttons.map(b => b.textContent.trim()).join(' | ')}`);
  await a.act(async () => { load.click(); await pause(300); await a.flushBigFiles(); });
  assertNoCrash();
  for (const key of ['m2tw_factions_file', 'm2tw_descr_character', 'm2tw_descr_model_strat', 'm2tw_names_file', 'm2tw_banners_file', 'm2tw_units_file', 'm2tw_strings_bin_global']) {
    assert.ok(a.getFile(key), `Home imported ${key} despite a preceding bad file and a full native cache`);
  }
  assert.match(w.document.body.textContent, /broken\.txt\.strings\.bin/);
  assert.ok(!a.getStringsBinStore()['broken.txt.strings.bin']);
  console.log('PASS Home import isolates an unreadable binary and still loads later faction dependencies with full browser storage');
  for (const name of orderedNames) {
    const stored = a.getStringsBinStore()[name];
    assert.equal(stored.magic1, 1); assert.equal(stored.format, 'ordered'); assert.equal(stored.entries.length, 3);
    assert.equal(stored.trailerKind, 'none');
  }
  assert.match(w.document.body.textContent, /Loaded 16\/18, failed 1, skipped 1/);
  assert.match(w.document.body.textContent, /unsupported_test\.txt/);
  console.log('PASS Home imports all five ordered UI dictionaries and reports skipped files separately');

  await a.act(async () => { a.show('FactionsEditor'); await pause(30); });
  assertNoCrash();
  assert.match(w.document.body.textContent, /Faction file availability: 11\/11 available/);
  console.log('PASS Factions Editor renders all 11 shared dependencies after Home, without re-uploading');

  await a.act(async () => { a.show('StringsBinEditor'); await pause(30); });
  assertNoCrash();
  assert.match(w.document.body.textContent, /expanded\.txt\.strings\.bin/);
  assert.match(w.document.body.textContent, /menu_english\.txt\.strings\.bin/);
  console.log('PASS Strings Editor reads the same expanded and menu files after navigation');

  const orderedTab = [...w.document.querySelectorAll('button')].find(button => button.textContent.trim() === orderedNames[0]);
  assert.ok(orderedTab);
  await a.act(async () => { orderedTab.click(); await pause(20); });
  assert.match(w.document.body.textContent, /Ordered \/ index-based strings/);
  assert.ok([...w.document.querySelectorAll('button')].find(button => button.textContent.trim() === 'New Entry').disabled);
  assert.equal(w.document.querySelectorAll('#strings-entry-list button').length, 0, 'Ordered rows have no move/delete actions');
  await a.act(async () => { w.document.querySelector('#strings-entry-list > div').click(); await pause(10); });
  assert.ok(w.document.querySelector('input[placeholder="KEY_NAME"]').readOnly);
  const textInput = w.document.querySelector('textarea');
  assert.equal(textInput.readOnly, false);
  const updatedValue = 'Changed ordered battle value — %S';
  await a.act(async () => {
    Object.getOwnPropertyDescriptor(w.HTMLTextAreaElement.prototype, 'value').set.call(textInput, updatedValue);
    textInput.dispatchEvent(new w.Event('input', { bubbles: true }));
    await pause(10);
  });
  await a.act(async () => {
    [...w.document.querySelectorAll('button')].find(button => button.textContent.trim() === 'Save Changes').click();
    await a.flushBigFiles();
  });
  assert.equal(a.getStringsBinStore()[orderedNames[0]].entries[0].value, updatedValue);
  await a.act(async () => { [...w.document.querySelectorAll('button')].find(button => button.textContent.trim() === 'Export .bin').click(); });
  const emitted = a.decodeStringsBin(await readBlob(exportedBlobs.at(-1)));
  assert.equal(emitted.magic1, 1); assert.equal(emitted.entries.length, 3);
  assert.equal(emitted.entries[0].value, updatedValue); assert.equal(emitted.trailerKind, 'none');
  console.log('PASS Ordered UI locks positions and count while saving and exporting edited text correctly');

  const zip = new JSZip();
  a.addSharedStringsToZip(zip.folder('data'));
  for (const name of orderedNames) {
    const data = await zip.file(`data/text/${name}`).async('uint8array');
    assert.equal(a.decodeStringsBin(data).magic1, 1);
    assert.equal(zip.file(`data/text/${name.replace('.strings.bin', '')}`), null, 'Do not invent keyed text twins for ordered files');
  }
  console.log('PASS Shared ZIP export includes all five ordered binaries without fabricated text keys');

  await a.act(async () => { a.show('UnitEditor'); await pause(30); });
  assertNoCrash();
  assert.match(w.document.body.textContent, /Test Spearmen/);
  console.log('PASS Unit Editor reads the EDU loaded on Home');

  await a.act(async () => { a.show('Home'); await pause(30); });
  assertNoCrash();
  assert.ok(a.getFile('m2tw_names_file'));
  console.log('PASS Returning to Home retains the shared files');
  await a.act(async () => {
    w.dispatchEvent(new w.Event('beforeunload'));
    await a.flushBigFiles();
    w.__m2twBigFileStore = {};
    await a.hydrateBigFiles();
  });
  for (const key of ['m2tw_factions_file', 'm2tw_names_file', 'm2tw_units_file', 'm2tw_banners_file']) {
    assert.ok(a.getFile(key), `Page unload must not erase ${key}`);
  }
  console.log('PASS Page-unload handlers do not erase the imported files before a reload');
  for (const name of orderedNames) {
    const restored = a.getStringsBinStore()[name];
    assert.equal(restored.magic1, 1); assert.equal(restored.sourceEntryCount, 3);
    assert.equal(a.decodeStringsBin(a.encodeStoredStringsBin(restored)).entries.length, 3);
  }
  console.log('PASS All five ordered files retain their layout metadata after persistent restoration');
  console.log('\n10 editor loading smoke tests passed.');
} finally {
  await a.act(async () => { a.stop(); });
  dom.window.close();
}
