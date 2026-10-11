/**
 * Regression tests for Home -> editor handoff. No account or mod data is used.
 * Run: node tests/shared-file-loading.mjs
 * Dependencies: esbuild, jsdom, fake-indexeddb. A temporary test-only install can
 * be selected with M2TW_TEST_DEPS=/path/to/test-dependencies.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const localRequire = createRequire(import.meta.url);
const testRequire = process.env.M2TW_TEST_DEPS
  ? createRequire(path.resolve(process.env.M2TW_TEST_DEPS, 'package.json')) : localRequire;
const { JSDOM } = testRequire('jsdom');
const { IDBFactory } = testRequire('fake-indexeddb');
const result = await build({
  absWorkingDir: root,
  stdin: { contents: `
    export * from './src/lib/bigFileStore';
    export * from './src/lib/editorStorage';
    export * from './src/lib/stringsBinStore';
    export * from './src/lib/modFileRegistry';
    export * from './src/components/factions/factionBulkDuplicate';
    export * from './src/components/minorfiles/banners/bannersParser';
    export * from './src/components/strings/stringsBinCodec';
    export { categorizeFile } from './src/components/home/DataFolderPicker';
  `, resolveDir: root, sourcefile: 'file-loading-regression-entry.js' },
  bundle: true, write: false, format: 'iife', platform: 'browser', globalName: 'M2TWTest',
  alias: { '@': path.join(root, 'src') },
  define: { 'process.env.NODE_ENV': '"test"' }, logLevel: 'silent',
});
const bundle = result.outputFiles[0].text;
const runtimes = [];
function runtime({ database = new IDBFactory(), seed = {}, sessionSeed = {}, quota = false } = {}) {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', {
    url: 'https://m2tw-regression.invalid/', runScripts: 'outside-only',
  });
  const w = dom.window;
  w.indexedDB = database;
  w.TextEncoder = TextEncoder;
  w.TextDecoder = TextDecoder;
  w.structuredClone = structuredClone;
  for (const [key, value] of Object.entries(seed)) w.localStorage.setItem(key, value);
  for (const [key, value] of Object.entries(sessionSeed)) w.sessionStorage.setItem(key, value);
  if (quota) w.Storage.prototype.setItem = function () { throw new w.DOMException('Simulated full browser storage', 'QuotaExceededError'); };
  w.eval(bundle);
  runtimes.push(dom);
  return { api: w.M2TWTest, window: w, database };
}
const bin = value => ({ entries: [{ key: 'ENGLAND', value }], magic1: 2, magic2: 2048 });
let passed = 0;
async function test(name, fn) {
  await fn();
  passed++;
  console.log(`PASS ${name}`);
}

try {
  await test('All aliases read the same file even when native local/session storage is full', async () => {
    const { api: a } = runtime({ quota: true });
    await a.hydrateBigFiles();
    for (const group of a.FILE_KEY_GROUPS) {
      const original = `raw ${group[0]}\n${'x'.repeat(1000)}`;
      a.editorStorage.setItem(group[0], original);
      for (const alias of group) assert.equal(a.getFile(alias), original, alias);
      const lastAlias = group[group.length - 1];
      a.editorSessionStorage.setItem(lastAlias, 'newer');
      for (const alias of group) assert.equal(a.getFile(alias), 'newer', alias);
    }
    assert.equal((await a.flushBigFiles()).warning, '');
  });

  await test('Expanded/menu files are shared in both directions and case-insensitive', async () => {
    const { api: a } = runtime({ quota: true });
    await a.hydrateBigFiles();
    a.setStringsBinStore({ 'DATA\\TEXT\\EXPANDED.TXT.STRINGS.BIN': bin('Home'), 'MENU_ENGLISH.TXT.STRINGS.BIN': bin('Menu') });
    assert.equal(JSON.parse(a.getFile('m2tw_strings_bin_global')).entries[0].value, 'Home');
    assert.equal(JSON.parse(a.getFile('m2tw_menu_strings_bin')).entries[0].value, 'Menu');
    a.setFile('m2tw_strings_bin_global', JSON.stringify(bin('Faction editor')));
    assert.equal(a.getStringsBinStore()['expanded.txt.strings.bin'].entries[0].value, 'Faction editor');
    a.updateStringsBinFile('EXPANDED.TXT.STRINGS.BIN', bin('Strings editor'));
    assert.equal(JSON.parse(a.getFile('m2tw_strings_bin_global')).entries[0].value, 'Strings editor');
    assert.equal(Object.keys(a.getStringsBinStore()).length, 2);
    await a.flushBigFiles();
  });

  await test('Legacy local, session-only, and faction-specific strings migrate before editors mount', async () => {
    const { api: a } = runtime({
      seed: { m2tw_banners_xml_global: '<legacy/>', m2tw_strings_bin_global: JSON.stringify(bin('Legacy description')) },
      sessionSeed: { m2tw_descr_character_raw: 'legacy character file', m2tw_descr_names_raw: 'legacy names file' },
      quota: true,
    });
    await a.hydrateBigFiles();
    assert.equal(a.getFile('m2tw_banners_file'), '<legacy/>');
    assert.equal(a.getFile('m2tw_descr_character'), 'legacy character file');
    assert.equal(a.getFile('m2tw_names_file'), 'legacy names file');
    assert.equal(a.getStringsBinStore()['expanded.txt.strings.bin'].entries[0].value, 'Legacy description');
  });

  await test('Large text and binary strings survive a fresh page with empty native caches', async () => {
    const first = runtime({ quota: true });
    await first.api.hydrateBigFiles();
    const large = 'large-file-record\n'.repeat(400000);
    first.api.setFile('m2tw_banners_file', large);
    first.api.setFile('m2tw_descr_character', 'character after reload');
    first.api.setStringsBinStore({ 'expanded.txt.strings.bin': bin('Saved description') });
    await first.api.flushBigFiles();
    const next = runtime({ database: first.database, quota: true });
    await next.api.hydrateBigFiles();
    assert.equal(next.api.getFile('m2tw_banners_xml_global'), large);
    assert.equal(next.api.editorSessionStorage.getItem('m2tw_descr_character_raw'), 'character after reload');
    assert.equal(next.api.getStringsBinStore()['expanded.txt.strings.bin'].entries[0].value, 'Saved description');
  });

  await test('Replacing a file overrides stale values and deleting an alias does not resurrect them', async () => {
    const first = runtime({ seed: { m2tw_banners_file: 'old Home', m2tw_banners_xml_global: 'old Factions' } });
    await first.api.hydrateBigFiles();
    first.api.setFile('m2tw_banners_file', 'new Home');
    assert.equal(first.api.getFile('m2tw_banners_xml_global'), 'new Home');
    first.api.removeFile('m2tw_banners_xml_global');
    await first.api.flushBigFiles();
    assert.equal(first.api.getFile('m2tw_banners_file'), null);
    const next = runtime({ database: first.database });
    await next.api.hydrateBigFiles();
    assert.equal(next.api.getFile('m2tw_banners_file'), null);
  });

  await test('File changes are batched and include Faction string dependencies', async () => {
    const { api: a, window: w } = runtime();
    await a.hydrateBigFiles();
    const events = [];
    w.addEventListener(a.FILES_CHANGED_EVENT, e => events.push(e.detail.keys));
    a.setFile('m2tw_descr_character', 'new');
    a.setFile('m2tw_banners_raw', '<updated/>');
    a.updateStringsBinFile('expanded.txt.strings.bin', bin('Event'));
    await a.flushBigFiles();
    const keys = new Set(events.flat());
    assert.ok(keys.has('m2tw_descr_character'));
    assert.ok(keys.has('m2tw_banners_file'));
    assert.ok(keys.has('m2tw_strings_bin_global'));
  });

  await test('Picker includes registered files and accepts standalone strings binaries', () => {
    const { api: a } = runtime();
    for (const name of Object.keys(a.DATA_FILE_DEFINITIONS)) {
      assert.ok(a.categorizeFile({ name, webkitRelativePath: `data/${name}` }), name);
    }
    assert.equal(a.categorizeFile({ name: 'EXPANDED.TXT.STRINGS.BIN' }), 'strings_bin');
    assert.equal(a.categorizeFile({ name: 'grass.tga', webkitRelativePath: 'data/terrain/aerial_map/ground_types/grass.tga' }), 'images_terrain');
  });

  await test('Banner paths containing forward slashes survive parsing and faction duplication', async () => {
    const { api: a } = runtime();
    await a.hydrateBigFiles();
    const xml = '<Banners><FactionBanners><Banner Name="faction"><Textures><Texture Faction="england" DiffuseMap="data/banners/england.tga" TranslucencyMap="data/banners/alpha.tga"/></Textures></Banner></FactionBanners><RoyalBanner Name="royal"><MeshAndTexture Faction="england" Mesh="data/banners/royal.cas" DiffuseMap="data/banners/royal.tga"/></RoyalBanner></Banners>';
    const parsed = a.parseBannersXml(xml);
    assert.equal(parsed.factionBanners[0].textures.length, 1);
    assert.equal(parsed.factionBanners[0].textures[0].diffuseMap, 'data/banners/england.tga');
    assert.equal(parsed.royalBanner.meshesAndTextures[0].mesh, 'data/banners/royal.cas');
    a.setFile('m2tw_banners_file', xml);
    a.copyBannerEntries('england', 'england_copy');
    const copied = a.parseBannersXml(a.getFile('m2tw_banners_file'));
    assert.equal(copied.factionBanners[0].textures.find(t => t.faction === 'england_copy').diffuseMap, 'data/banners/england.tga');
    await a.flushBigFiles();
  });

  await test('Truncated string binaries are rejected instead of loading a partial dictionary', () => {
    const { api: a } = runtime();
    const entries = [{ key: 'ENGLAND', value: 'Émilie and Henry' }, { key: 'EMPTY', value: '' }];
    const valid = a.encodeStringsBin(entries);
    assert.equal(JSON.stringify(a.parseStringsBin(valid).entries), JSON.stringify(entries));
    assert.equal(a.parseStringsBin(valid.slice(0, 9)), null);
    assert.equal(a.parseStringsBin(valid.slice(0, valid.byteLength - 3)), null);
  });

  await test('Faction duplicate reads character, strat-model, names and EDU dependencies without re-upload', async () => {
    const { api: a } = runtime({ quota: true });
    await a.hydrateBigFiles();
    a.setFile('m2tw_descr_character', 'starting_action_points 80\ntype named character\nactions moving_normal\nwage_base 100\nfaction england\ndictionary 2\nstrat_model general\nbattle_model General\n');
    a.setFile('m2tw_descr_model_strat', 'type general\nskeleton strat_named_with_army\nscale 0.7\nindiv_range 40\ntexture england, models_strat/textures/general_england.tga\nmodel_flexi_m models_strat/general.CAS, max\n');
    a.setFile('m2tw_names_file', 'faction: england\n\tcharacters\n\t\tHenry\n\tsurnames\n\t\tYork\n\twomen\n\t\tMary\n');
    a.setFile('m2tw_units_file', 'type Test Spearmen\ndictionary Test_Spearmen\ncategory infantry\nclass spearmen\nownership england\nera 0 england\n');
    const character = a.duplicateStratmapCharacters('england', 'england_copy');
    assert.equal(character.charLoaded, true);
    assert.equal(character.stratLoaded, true);
    assert.equal(character.charTypes, 1);
    assert.equal(character.stratTextures, 1);
    const names = a.duplicateFactionNames('england', 'england_copy');
    assert.equal(names.loaded, true); assert.equal(names.ok, true);
    const units = a.duplicateEduOwnership('england', 'england_copy');
    assert.equal(units.loaded, true); assert.ok(units.count > 0);
    assert.match(a.getFile('m2tw_descr_character'), /england_copy/);
    assert.match(a.getFile('m2tw_names_file'), /faction: england_copy/);
    await a.flushBigFiles();
  });

  await test('IndexedDB unavailability keeps files readable and reports the persistence failure', async () => {
    const { api: a } = runtime({ database: undefined, quota: true });
    // Use a separate runtime whose indexedDB.open fails explicitly.
    const broken = runtime({ database: { open() { throw new Error('Simulated IndexedDB unavailable'); } }, quota: true });
    await broken.api.hydrateBigFiles();
    broken.api.setFile('m2tw_descr_character', 'readable in this tab');
    const status = await broken.api.flushBigFiles();
    assert.equal(broken.api.getFile('m2tw_descr_character'), 'readable in this tab');
    assert.match(status.warning, /could not be saved for reload/);
    await a.flushBigFiles();
  });

  await test('Explicit clear removes persistent editor files but not unrelated browser data', async () => {
    const first = runtime();
    first.window.localStorage.setItem('unrelated_setting', 'keep');
    await first.api.hydrateBigFiles();
    first.api.setFile('m2tw_descr_character', 'remove');
    await first.api.clearBigFiles();
    assert.equal(first.window.localStorage.getItem('unrelated_setting'), 'keep');
    assert.equal(first.api.getFile('m2tw_descr_character'), null);
    const next = runtime({ database: first.database });
    await next.api.hydrateBigFiles();
    assert.equal(next.api.getFile('m2tw_descr_character'), null);
  });
  console.log(`\n${passed} shared-file regression tests passed.`);
} finally {
  for (const dom of runtimes) dom.window.close();
}
