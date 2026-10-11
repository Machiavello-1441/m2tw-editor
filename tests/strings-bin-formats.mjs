/** Independent binary fixtures for the ordered/keyed strings regression. */
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const built = await build({ absWorkingDir: root, stdin: {
  contents: `export * from './src/components/strings/stringsBinCodec'; export * from './src/lib/importReport';`,
  resolveDir: root, sourcefile: 'formats-entry.js',
}, bundle: true, write: false, format: 'iife', globalName: 'Formats', alias: { '@': path.join(root, 'src') }, logLevel: 'silent' });
const sandbox = { ArrayBuffer, DataView, Uint8Array, console };
vm.runInNewContext(built.outputFiles[0].text, sandbox);
const a = sandbox.Formats;
const bytes = value => Buffer.from(value);
const record = value => {
  const text = Buffer.from(value, 'utf16le');
  const header = Buffer.alloc(2); header.writeUInt16LE(value.length);
  return Buffer.concat([header, text]);
};
const fixture = (type, records, tail = Buffer.alloc(0)) => {
  const header = Buffer.alloc(8); header.writeUInt16LE(type); header.writeUInt16LE(2048, 2); header.writeUInt32LE(records.length, 4);
  return Buffer.concat([header, ...records.flatMap(row => type === 1 ? [record(row.value)] : [record(row.key), record(row.value)]), tail]);
};
// Hard-coded bytes are not produced by the app encoder.
const ordered = Uint8Array.from([1,0,0,8,3,0,0,0,3,0,79,0,110,0,101,0,0,0,5,0,84,0,104,0,114,0,101,0,101,0]);
const keyed = Uint8Array.from([2,0,0,8,2,0,0,0,1,0,65,0,1,0,88,0,1,0,66,0,0,0]);
let passed = 0;
function test(name, fn) { fn(); passed++; console.log(`PASS ${name}`); }

test('Reads value-only type 1 with empty records and no footer', () => {
  const parsed = a.decodeStringsBin(ordered);
  assert.equal(parsed.format, 'ordered'); assert.equal(parsed.entryCount, 3);
  assert.equal(JSON.stringify(parsed.entries.map(e => e.value)), JSON.stringify(['One', '', 'Three']));
  assert.equal(parsed.entries[0].syntheticKey, true); assert.equal(parsed.entries[2].index, 2);
  assert.deepEqual(bytes(a.encodeStoredStringsBin(parsed)), bytes(ordered));
});
test('Reads keyed type 2 without requiring an invented footer', () => {
  const parsed = a.decodeStringsBin(keyed);
  assert.equal(parsed.format, 'keyed'); assert.equal(parsed.entries[1].key, 'B');
  assert.equal(parsed.entries[1].value, '');
  assert.deepEqual(bytes(a.encodeStoredStringsBin(parsed)), bytes(keyed));
});
test('Detects layout from bytes for all five reported filenames', () => {
  for (const name of ['battle', 'battle_ed', 'shared', 'strat', 'tooltips']) {
    const parsed = a.decodeStringsBin(fixture(1, [{ value: `${name} text` }, { value: '' }]));
    assert.equal(parsed.format, 'ordered'); assert.equal(parsed.entries[0].value, `${name} text`);
  }
});
test('Uses a uint32 count above 65535 for both layouts', () => {
  for (const type of [1, 2]) {
    const input = Buffer.alloc(8 + 65536 * (type === 1 ? 2 : 4));
    input.writeUInt16LE(type); input.writeUInt16LE(2048, 2); input.writeUInt32LE(65536, 4);
    const parsed = a.decodeStringsBin(input);
    assert.equal(parsed.entries.length, 65536);
    const output = bytes(a.encodeStoredStringsBin(parsed));
    assert.equal(output.readUInt32LE(4), 65536); assert.deepEqual(output, input);
  }
});
test('Ordered value edits preserve record identities and never write synthetic keys', () => {
  const parsed = a.decodeStringsBin(ordered);
  parsed.entries[1].value = 'Edited § %S — Zürich';
  const output = a.encodeStoredStringsBin(parsed);
  const readBack = a.decodeStringsBin(output);
  assert.equal(readBack.magic1, 1); assert.equal(readBack.entries.length, 3);
  assert.equal(readBack.entries[1].value, parsed.entries[1].value);
  assert.deepEqual(bytes(output), fixture(1, parsed.entries));
});
test('Ordered record count and position changes are blocked', () => {
  const parsed = a.decodeStringsBin(ordered);
  assert.throws(() => a.encodeStoredStringsBin({ ...parsed, entries: parsed.entries.slice(1) }), /number of records/);
  assert.throws(() => a.encodeStoredStringsBin({ ...parsed, entries: [...parsed.entries].reverse() }), /record positions/);
});
test('UTF-16 code units round-trip, including BOMs, surrogates, nulls and long fields', () => {
  const value = '\ufeffÉ\u0000😀\ud800\udc01\ud800' + 'Long'.repeat(14000);
  const input = fixture(2, [{ key: '\ufeffKEY', value }]);
  const parsed = a.decodeStringsBin(input);
  assert.equal(parsed.entries[0].value, value); assert.equal(parsed.entries[0].key, '\ufeffKEY');
  assert.deepEqual(bytes(a.encodeStoredStringsBin(parsed)), input);
});
test('Existing trailing zero is preserved in either layout', () => {
  for (const type of [1, 2]) {
    const input = fixture(type, [{ key: 'K', value: 'V' }], Buffer.alloc(2));
    const parsed = a.decodeStringsBin(input);
    assert.equal(parsed.trailerKind, 'zero'); assert.deepEqual(bytes(a.encodeStoredStringsBin(parsed)), input);
  }
});
test('Recognised keyed lookup trailer is regenerated when keys change', () => {
  const count = Buffer.alloc(4); count.writeUInt32LE(2);
  const input = Buffer.concat([bytes(keyed), count, record('A'), record('B')]);
  const parsed = a.decodeStringsBin(input);
  assert.equal(parsed.trailerKind, 'key-lookup');
  assert.deepEqual(bytes(a.encodeStoredStringsBin(parsed)), input);
  parsed.entries[0].key = 'LONGER_KEY';
  const edited = a.decodeStringsBin(a.encodeStoredStringsBin(parsed));
  assert.equal(edited.trailerKind, 'key-lookup'); assert.equal(edited.entries[0].key, 'LONGER_KEY');
});
test('Unknown trailers remain readable and byte-exact but cannot be edited unsafely', () => {
  const input = Buffer.concat([bytes(ordered), Buffer.from([0xAB, 0xCD, 0xEF])]);
  const parsed = a.decodeStringsBin(input);
  assert.equal(parsed.readOnly, true); assert.equal(parsed.trailerKind, 'opaque');
  assert.deepEqual(bytes(a.encodeStoredStringsBin(parsed)), input);
  parsed.entries[0].value = 'Changed';
  assert.throws(() => a.encodeStoredStringsBin(parsed), /unknown binary trailer/);
});
test('Truncation and impossible counts are still rejected without partial dictionaries', () => {
  assert.equal(a.parseStringsBin(ordered.slice(0, -1)), null);
  assert.throws(() => a.decodeStringsBin(ordered.slice(0, -1)), /Truncated.*byte/);
  const impossible = Buffer.from(ordered); impossible.writeUInt32LE(0xffffffff, 4);
  assert.equal(a.parseStringsBin(impossible), null);
  assert.throws(() => a.decodeStringsBin(impossible), /header declares/);
});
test('Unknown signatures produce an actionable error rather than guessing the layout', () => {
  const input = Buffer.from(ordered); input[0] = 3;
  assert.equal(a.parseStringsBin(input), null);
  assert.throws(() => a.decodeStringsBin(input), /Unsupported.*03 00 00 08/);
});
test('UTF-16 length overflow is blocked rather than wrapping', () => {
  assert.throws(() => a.encodeStringsBin([{ key: 'K', value: 'x'.repeat(65536) }]), /65535/);
});
test('Typed-array subviews are decoded using their own offset and length', () => {
  const surrounding = Buffer.concat([Buffer.alloc(17), bytes(ordered), Buffer.alloc(3)]);
  assert.deepEqual(bytes(a.encodeStoredStringsBin(a.decodeStringsBin(surrounding.subarray(17, -3)))), bytes(ordered));
});
test('The reported totals explicitly account for the six skipped files', () => {
  assert.equal(a.formatImportSummary({ ok: 3025, errors: Array(5), skipped: Array(6) }, 3036), 'Loaded 3025/3036, failed 5, skipped 6');
});
console.log(`\n${passed} strings-format regression tests passed.`);
