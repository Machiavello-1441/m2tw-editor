/** Independent source-preservation tests; no user files or account access. */
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { readFileSync } from 'node:fs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(process.env.M2TW_TEST_DEPS ? path.resolve(process.env.M2TW_TEST_DEPS, 'package.json') : import.meta.url);
const { JSDOM } = require('jsdom');
const { IDBFactory } = require('fake-indexeddb');
const built = await build({ absWorkingDir: root, stdin: { resolveDir: root, sourcefile: 'edu-tests.js', contents: `
  export * from './src/components/units/eduOwnershipPatch';
  export * from './src/components/units/EDUParser';
  export * from './src/components/factions/factionBulkDuplicate';
  export * from './src/lib/bigFileStore';
` }, alias: { '@': path.join(root, 'src') }, bundle: true, write: false,
  format: 'iife', platform: 'browser', globalName: 'EDUTests', define: { 'process.env.NODE_ENV': '"test"' }, logLevel: 'silent' });
const dom = new JSDOM('<!doctype html>', { url: 'https://edu-test.invalid', runScripts: 'outside-only' });
const w = dom.window;
w.indexedDB = new IDBFactory(); w.structuredClone = structuredClone;
w.eval(built.outputFiles[0].text);
const a = w.EDUTests;
const original = '\uFEFF; EDU master — keep every character\r\n'
  + '; ownership england ; comment only\r\n'
  + 'type\tHeavy Cog\r\n'
  + 'dictionary\tHeavy_Cog   ; naval entry\r\n'
  + 'category    ship\r\n'
  + 'ship\t\theavy cog ; REQUIRED SHIP REFERENCE\r\n'
  + 'attributes sea_faring, no_custom\r\n'
  + 'ownership\tfrance , England\t, moors  ; England in comment stays\r\n'
  + 'era\t0\tEngland, turks\t; old spacing\r\n'
  + 'era 1 moors\r\n'
  + 'stat_cost 1, 3500, 250, 0, 0, 0, 0, 0\r\n'
  + 'naval_custom_option 1, 9, exotic\r\n\r\n'
  + 'type     Great Bombard\n'
  + 'dictionary Great_Bombard\n'
  + 'category siege\n'
  + 'engine  huge_bombard ; REQUIRED ENGINE REFERENCE\n'
  + 'soldier Bombard_Crew, 12, 2, 1.0\n'
  + 'stat_pri_ex 31, 0, 200 ; M2EX extension\n'
  + 'unknown_future_directive arbitrary, untouched\n'
  + 'ownership  england\n'
  + 'era 2  england,france ; no comma spacing change\n'
  + '; era 2 england — this is not an active line\n'
  + '\t; final comment without final newline';
const expected = original
  .replace('france , England\t, moors', 'france , England, england_copy\t, moors')
  .replace('0\tEngland, turks', '0\tEngland, england_copy, turks')
  .replace('ownership  england\n', 'ownership  england, england_copy\n')
  .replace('era 2  england,france', 'era 2  england, england_copy,france');
let passed = 0;
async function test(name, fn) { await fn(); passed++; console.log(`PASS ${name}`); }
try {
  await a.hydrateBigFiles();
  await test('Faction patch changes only the expected ownership/era insertions', () => {
    const patch = a.patchEduOwnership(original, 'england', 'england_copy');
    assert.equal(patch.out, expected); assert.equal(patch.count, 4);
    assert.equal(patch.ownershipLines, 2); assert.equal(patch.eraLines, 2);
    assert.equal(a.verifyEduOwnershipPatch(original, patch), true);
    assert.deepEqual(Buffer.from(patch.out.replaceAll(', england_copy', '')), Buffer.from(original));
  });
  await test('Ships, siege engines, extensions, comments, BOM, spacing and mixed line endings survive', () => {
    const out = a.patchEduOwnership(original, 'england', 'england_copy').out;
    const protectedLines = text => text.split(/\r\n|\r|\n/).filter(line => !/^[\t \uFEFF]*(ownership|era[\t ]+\d+)[\t ]/i.test(line));
    assert.deepEqual(protectedLines(out), protectedLines(original));
    assert.equal(out.match(/\r\n|\r|\n/g).join(''), original.match(/\r\n|\r|\n/g).join(''));
    assert.ok(out.includes('ship\t\theavy cog')); assert.ok(out.includes('engine  huge_bombard'));
  });
  await test('Repeated duplication is a no-op with no duplicated faction tokens', () => {
    const second = a.patchEduOwnership(expected, 'england', 'england_copy');
    assert.equal(second.out, expected); assert.equal(second.count, 0); assert.equal(second.already, 4);
  });
  await test('Only whole source tokens match; commented and unrelated lines remain unchanged', () => {
    const text = '; ownership england\nownership england_copy, new_england\nera 0 france ; england\nengine england\n';
    const out = a.patchEduOwnership(text, 'england', 'new_faction');
    assert.equal(out.out, text); assert.equal(out.count, 0);
  });
  await test('Culture ownership is matched explicitly without rewriting the culture token', () => {
    const text = 'ownership northern_european,france\nera 9 NORTHERN_EUROPEAN\n';
    const out = a.patchEduOwnership(text, 'england', 'new_faction', 'northern_european');
    assert.equal(out.out, 'ownership northern_european, new_faction,france\nera 9 NORTHERN_EUROPEAN, new_faction\n');
  });
  await test('LF, CRLF, CR and missing-final-newline inputs all preserve their original endings', () => {
    for (const ending of ['\n', '\r\n', '\r']) {
      const input = `type\tShip${ending}ship galley${ending}ownership\tengland${ending}era 1 england`;
      assert.equal(a.patchEduOwnership(input, 'england', 'new').out, input.replace(/england/g, 'england, new'));
      assert.equal(a.serializeEDU(a.parseEDU(input)), input);
    }
  });
  await test('Invalid identifiers are rejected without permitting line/comment injection', () => {
    for (const target of ['bad,name', 'bad;name', 'bad\nera 0 france', 'bad name', '']) {
      assert.throws(() => a.patchEduOwnership(original, 'england', target), /identifier/);
    }
  });
  await test('Runtime verification rejects any extra mutation of ship or engine records', () => {
    const patch = a.patchEduOwnership(original, 'england', 'england_copy');
    patch.out = patch.out.replace('engine  huge_bombard', 'engine  removed');
    assert.throws(() => a.verifyEduOwnershipPatch(original, patch), /outside/);
  });
  await test('No-edit parser/serializer round trip preserves the complete original text', () => {
    const units = a.parseEDU(original);
    assert.equal(units.length, 2); assert.equal(units[0].type, 'Heavy Cog'); assert.equal(units[0].category, 'ship');
    assert.equal(a.serializeEDU(units), original);
    assert.equal(a.serializeEDU(a.parseEDU(expected)), expected);
  });
  await test('Raw source metadata survives JSON cache persistence', () => {
    const cached = JSON.parse(JSON.stringify(a.parseEDU(expected)));
    assert.equal(a.serializeEDU(cached), expected);
  });
  await test('Explicit edit of one supported stat keeps unknown directives and untouched units verbatim', () => {
    const units = a.parseEDU(expected);
    units[0].stat_cost = '2, 4000, 275, 0, 0, 0, 0, 0';
    assert.equal(a.serializeEDU(units), expected.replace('stat_cost 1, 3500, 250, 0, 0, 0, 0, 0', 'stat_cost 2, 4000, 275, 0, 0, 0, 0, 0'));
  });
  await test('Unknown ship/engine directives survive explicit ownership edits in Unit Editor data', () => {
    const units = a.parseEDU(original);
    units[1].ownership = ['england', 'venice'];
    assert.equal(a.serializeEDU(units), original.replace('ownership  england\n', 'ownership  england, venice\n'));
  });
  await test('No source matches never rebuild from a stale parsed cache', () => {
    const text = 'type Ship\nship galley\nownership france\n';
    a.setFile('m2tw_units_file', text);
    a.setFile('m2tw_edu_units', JSON.stringify([{ ...a.createDefaultUnit(), ownership: ['england'] }]));
    const result = a.duplicateEduOwnership('england', 'new_faction');
    assert.equal(result.count, 0); assert.equal(result.loaded, true);
    assert.equal(a.getFile('m2tw_units_file'), text);
  });
  await test('Parsed-only cache is not accepted as an original EDU', () => {
    a.removeFile('m2tw_units_file');
    const result = a.duplicateEduOwnership('england', 'new_faction');
    assert.equal(result.loaded, false); assert.equal(a.getFile('m2tw_units_file'), null);
    assert.match(result.error, /original/);
  });
  await test('Workflow stores only the patched raw file and an exact pre-change backup', () => {
    a.setFile('m2tw_units_file', original);
    const result = a.duplicateEduOwnership('england', 'england_copy');
    assert.equal(result.count, 4); assert.equal(a.getFile('m2tw_units_file'), expected);
    assert.equal(a.getFile('m2tw_units_before_faction_patch'), original);
    a.duplicateEduOwnership('england', 'england_copy');
    assert.equal(a.getFile('m2tw_units_before_faction_patch'), original, 'No-op must not replace the backup');
  });
  await test('Faction workflow source has no parsed-cache or whole-EDU serializer fallback', () => {
    const code = readFileSync(path.join(root, 'src/components/factions/factionBulkDuplicate.js'), 'utf8');
    assert.doesNotMatch(code, /\b(?:serializeEDU|parseEDU|m2tw_edu_units)\b/);
  });
  await a.flushBigFiles();
  console.log(`\n${passed} EDU source-preservation tests passed.`);
} finally { dom.window.close(); }
