import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const bundle = await build({
  absWorkingDir: root,
  stdin: { resolveDir: root, sourcefile: 'diplomacy-regression.js', contents: `
    export { default as synchronize, editDiplomacyRelationship as edit } from './src/components/map/diplomacyRelationships';
    export { default as filter } from './src/components/map/filterDiplomacyRows';
    export { default as clientRules } from './src/components/map/clientStateRules';
    export { parseDescrStrat as parse, serializeDescrStrat as serialize } from './src/components/map/stratParser';
  ` },
  bundle: true, write: false, format: 'esm', platform: 'node',
  alias: { '@': path.join(root, 'src') }, logLevel: 'silent',
});
const { synchronize, edit, filter, clientRules, parse, serialize } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const war = (faction, ...targets) => ({ faction, relation: 'at_war_with', targets });
const ally = (faction, ...targets) => ({ faction, relation: 'allied_to', targets });
const client = (faction, ...targets) => ({ faction, relation: 'client_of', targets });
const protectorate = (faction, ...targets) => ({ faction, relation: 'protectorate_of', targets });
const header = 'campaign imperial_campaign\nplayable\nfrance\nslave\nend\nfaction france, balanced smith\ndenari 1000\nfaction slave, balanced smith\ndenari 1000\n';
const saved = data => parse(serialize(data, data.items));

test('France/slave war is automatically reciprocal on import and after repeated saves', () => {
  const raw = header + 'faction_relationships france, at_war_with slave\n';
  let data = parse(raw);
  assert.equal(data.raw, raw);
  const expected = [war('france', 'slave'), war('slave', 'france')];
  assert.deepEqual(data.factionRelationships, expected);
  for (let i = 0; i < 4; i++) data = saved(data);
  assert.deepEqual(data.factionRelationships, expected);
});

test('The grouped abbey example retains both targets and generates both reverse rows', () => {
  const raw = header + 'faction_relationships\tabbey_sankt_gallen, at_war_with\tcanton_appenzell, city_sankt_gallen ; grouped\r\n';
  const data = parse(raw);
  const expected = [war('abbey_sankt_gallen', 'canton_appenzell', 'city_sankt_gallen'), war('canton_appenzell', 'abbey_sankt_gallen'), war('city_sankt_gallen', 'abbey_sankt_gallen')];
  assert.deepEqual(data.factionRelationships, expected);
  const exported = serialize(data, data.items);
  assert.match(exported, /faction_relationships\s+abbey_sankt_gallen, at_war_with\s+canton_appenzell, city_sankt_gallen/);
  assert.deepEqual(parse(exported).factionRelationships, expected);
});

test('Alliances are reciprocal and existing reverse groups are extended without duplicate rows', () => {
  const rows = [ally('france', 'england', 'scotland'), ally('england', 'france'), ally('scotland', 'england')];
  const result = synchronize(rows);
  assert.deepEqual(result, [ally('france', 'england', 'scotland'), ally('england', 'france', 'scotland'), ally('scotland', 'england', 'france')]);
  assert.equal(synchronize(result), result);
  assert.deepEqual(rows, [ally('france', 'england', 'scotland'), ally('england', 'france'), ally('scotland', 'england')]);
});

test('Only wars/alliances are mirrored, not clients, protectorates, unknown relations, or standings', () => {
  const rows = [client('nabataea', 'egypt'), protectorate('judea', 'egypt'), { faction: 'a', relation: 'custom_status', targets: ['b'] }];
  assert.equal(synchronize(rows), rows);
  const data = parse(header + 'faction_standings france, 0.20 slave, england\n');
  assert.deepEqual(saved(data).factionStandings, [{ faction: 'france', value: 0.2, valueStr: '0.20', targets: ['slave', 'england'] }]);
  assert.deepEqual(saved(data).factionRelationships, []);
});

test('Save/export also repairs arrays restored from older snapshots without opening diplomacy', () => {
  const data = parse(header);
  data.factionRelationships = [war('france', 'slave'), ally('france', 'england', 'scotland')];
  assert.deepEqual(saved(data).factionRelationships, [war('france', 'slave'), ally('france', 'england', 'scotland'), war('slave', 'france'), ally('england', 'france'), ally('scotland', 'france')]);
});

test('Editing grouped targets removes stale reverse edges and adds new ones, preserving unrelated targets', () => {
  const rows = synchronize([war('france', 'slave', 'england'), war('slave', 'scotland')]);
  const original = structuredClone(rows);
  const result = edit(rows, 0, war('france', 'england', 'spain'));
  assert.deepEqual(result, [war('france', 'england', 'spain'), war('slave', 'scotland'), war('england', 'france'), war('scotland', 'slave'), war('spain', 'france')]);
  assert.deepEqual(rows, original);
  assert.equal(synchronize(result), result);
});

test('Changing war to alliance removes both old war directions rather than leaving contradictory reverses', () => {
  const rows = synchronize([war('france', 'slave', 'england')]);
  const result = edit(rows, 0, ally('france', 'slave', 'england'));
  assert.deepEqual(result, [ally('france', 'slave', 'england'), ally('slave', 'france'), ally('england', 'france')]);
});

test('Changing a source faction updates all reverse endpoints', () => {
  const rows = synchronize([ally('france', 'england', 'scotland')]);
  assert.deepEqual(edit(rows, 0, ally('spain', 'england', 'scotland')), [ally('spain', 'england', 'scotland'), ally('england', 'spain'), ally('scotland', 'spain')]);
});

test('Deleting from either direction removes only that pair, and repeated saves do not restore it', () => {
  const rows = synchronize([war('france', 'slave', 'england')]);
  assert.deepEqual(edit(rows, 0, null), []);
  const data = parse(header);
  data.factionRelationships = edit(rows, 1, null);
  const expected = [war('france', 'england'), war('england', 'france')];
  assert.deepEqual(saved(saved(data)).factionRelationships, expected);
});

test('Removing a pair also removes duplicate declarations that would otherwise recreate it', () => {
  const rows = synchronize([war('france', 'slave'), war('france', 'slave')]);
  assert.deepEqual(edit(rows, 0, null), []);
});

test('Editing a reverse group, adding a row, and switching to directional status remain valid', () => {
  let rows = synchronize([war('france', 'slave'), war('england', 'slave')]);
  rows = edit(rows, 2, war('slave', 'france'));
  assert.deepEqual(rows, [war('france', 'slave'), war('slave', 'france')]);
  rows = edit(rows, 0, client('france', 'slave'));
  assert.deepEqual(rows, [client('france', 'slave')]);
  rows = edit(rows, rows.length, ally('england', 'scotland'));
  assert.deepEqual(rows, [client('france', 'slave'), ally('england', 'scotland'), ally('scotland', 'england')]);
  assert.deepEqual(clientRules(rows), []);
  assert.equal(clientRules(edit(rows, rows.length, client('scotland', 'france'))).length, 1);
});

test('Faction search matches either side case-insensitively and preserves full target arrays and original indices', () => {
  const rows = [war('france', 'slave', 'england'), war('egypt', 'judea'), ally('spain', 'france')];
  const original = structuredClone(rows);
  assert.deepEqual(filter(rows, ' FRANCE '), [{ row: rows[0], index: 0 }, { row: rows[2], index: 2 }]);
  assert.deepEqual(filter(rows, 'JUDEA'), [{ row: rows[1], index: 1 }]);
  assert.deepEqual(filter(rows, 'missing'), []);
  assert.equal(filter(rows, '').length, 3);
  assert.deepEqual(rows, original);
  const standings = [{ faction: 'egypt', value: -0.2, targets: ['france', 'england'] }];
  assert.deepEqual(filter(standings, 'ENG'), [{ row: standings[0], index: 0 }]);
});

test('Both tabs wire independent search, original edit indices, and multi-target controls into campaign updates', () => {
  const tab = ['CampaignDiplomacyEditor.jsx', 'DiplomacyRows.jsx', 'useCampaignDiplomacy.js'].map(name => readFileSync(path.join(root, 'src/components/map', name), 'utf8')).join('\n');
  const control = readFileSync(path.join(root, 'src/components/map/DiplomacyTargets.jsx'), 'utf8');
  assert.match(tab, /useState\(\{ standings: '', relationships: '' \}\)/);
  assert.match(tab, /filterDiplomacyRows\(rows, search\[tab\]\)/);
  assert.match(tab, /entries\.map\(\(\{ row, index \}\)/);
  assert.match(tab, /onUpdate\(index, 'faction'/);
  assert.match(tab, /<DiplomacyTargets value=\{row.targets\}/);
  assert.match(tab, /single=\{!standing && row.relation === 'client_of'\}/);
  assert.match(tab, /editDiplomacyRelationship\(relationships, i, null\)/);
  assert.match(control, /type="search"/);
  assert.match(control, /value.join\(', '\)/);
  assert.match(control, /\[\.\.\.value, name\]/);
});