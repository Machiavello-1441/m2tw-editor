import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const bundle = await build({
  absWorkingDir: root,
  stdin: { resolveDir: root, sourcefile: 'diplomacy-tools-regression.js', contents: `
    export { default as calculate } from './src/components/map/diplomacyStandings';
    export { default as validate } from './src/components/map/validateCampaignDiplomacy';
    export { default as readMetadata } from './src/components/map/factionDiplomacyMetadata';
    export { default as synchronize } from './src/components/map/diplomacyRelationships';
    export { parseDescrStrat, serializeDescrStrat } from './src/components/map/stratParser';
  ` }, bundle: true, write: false, format: 'esm', platform: 'node',
  alias: { '@': path.join(root, 'src') }, logLevel: 'silent',
});
const { calculate, validate, readMetadata, synchronize, parseDescrStrat, serializeDescrStrat } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const war = (faction, ...targets) => ({ faction, relation: 'at_war_with', targets });
const ally = (faction, ...targets) => ({ faction, relation: 'allied_to', targets });
const standing = (faction, value, ...targets) => ({ faction, value, targets });
const pairValue = (rows, a, b) => rows.find(row => row.faction === a && row.targets.includes(b))?.value;
const same = { a: { religion: 'catholic', culture: 'northern_european' }, b: { religion: 'catholic', culture: 'northern_european' } };
const different = { a: same.a, b: { religion: 'orthodox', culture: 'eastern_european' } };
const source = name => readFileSync(path.join(root, 'src/components/map', name), 'utf8');

test('Faction metadata comes from live faction definitions, retaining identifiers and ignoring comments', () => {
  const metadata = readMetadata('faction a, spawned_on_event\r\nculture northern_european ; note\r\nreligion catholic\r\nprimary_colour red 1 green 2 blue 3\r\nfaction b, shadowing a\r\nreligion orthodox\r\nculture eastern_european\r\n');
  assert.deepEqual(metadata, different);
  assert.deepEqual(readMetadata(''), {});
  assert.match(source('useCampaignDiplomacy.js'), /useSharedModFile\('m2tw_factions_file'\)/);
});

test('Recalculate adds the specified religion, culture, alliance and war modifiers exactly once per pair', () => {
  for (const [metadata, relationships, expected] of [
    [same, [], 0.25], [different, [], -0.25],
    [same, [ally('a', 'b')], 0.45], [different, [ally('a', 'b')], -0.05],
    [same, [war('a', 'b')], -0.25], [different, [war('a', 'b')], -0.75],
    [same, [ally('a', 'b'), ally('b', 'a'), ally('a', 'b')], 0.45],
  ]) {
    const rows = calculate({ factionNames: ['a', 'b'], metadata, relationships });
    assert.equal(pairValue(rows, 'a', 'b'), expected);
    assert.equal(pairValue(rows, 'b', 'a'), expected);
  }
});

test('Religion and culture are independent, and missing attributes are neutral rather than assumed equal or different', () => {
  assert.equal(pairValue(calculate({ factionNames: ['a', 'b'], metadata: { a: same.a, b: { religion: 'catholic', culture: 'eastern_european' } } }), 'a', 'b'), 0.05);
  assert.equal(pairValue(calculate({ factionNames: ['a', 'b'], metadata: { a: same.a, b: { religion: 'orthodox', culture: 'northern_european' } } }), 'a', 'b'), -0.05);
  assert.equal(pairValue(calculate({ factionNames: ['a', 'b'], metadata: { a: { religion: 'catholic' }, b: { religion: 'catholic' } } }), 'a', 'b'), 0.15);
  assert.equal(pairValue(calculate({ factionNames: ['a', 'b'], metadata: {} }), 'a', 'b'), 0);
  assert.equal(pairValue(calculate({ factionNames: ['a', 'b'], relationships: [war('b', 'a')] }), 'a', 'b'), -0.5);
});

test('Add mode uses each directional baseline; recalculate replaces it, and absent pairs start at zero', () => {
  const standings = [standing('a', 0.2, 'b')];
  const options = { factionNames: ['a', 'b'], standings, metadata: same, relationships: [ally('a', 'b')] };
  const added = calculate({ ...options, mode: 'add' });
  assert.equal(pairValue(added, 'a', 'b'), 0.65);
  assert.equal(pairValue(added, 'b', 'a'), 0.45);
  const replaced = calculate({ ...options, mode: 'recalculate' });
  assert.equal(pairValue(replaced, 'a', 'b'), 0.45);
  assert.equal(pairValue(replaced, 'b', 'a'), 0.45);
  assert.deepEqual(calculate({ ...options, standings: replaced, mode: 'recalculate' }), replaced);
});

test('Both limits are enforced, repeated Add clicks accumulate, and values never overflow or drift', () => {
  let added = calculate({ factionNames: ['a', 'b'], standings: [standing('a', 0.9, 'b'), standing('b', -0.9, 'a')], mode: 'add', metadata: same });
  assert.equal(pairValue(added, 'a', 'b'), 1);
  assert.equal(pairValue(added, 'b', 'a'), -0.65);
  const hostile = calculate({ factionNames: ['a', 'b'], standings: [standing('a', -0.8, 'b')], mode: 'add', metadata: different, relationships: [war('a', 'b')] });
  assert.equal(pairValue(hostile, 'a', 'b'), -1);
  for (let i = 0; i < 10; i++) added = calculate({ factionNames: ['a', 'b'], standings: added, mode: 'add', metadata: same });
  assert.ok(added.every(row => row.value >= -1 && row.value <= 1));
  assert.equal(pairValue(added, 'b', 'a'), 1);
});

test('Grouped targets split when needed, identical values regroup, and unrelated records are not lost or mutated', () => {
  const standings = [standing('a', 0.1, 'b', 'c', 'outside'), standing('outside', -0.4, 'a')];
  const options = { factionNames: ['a', 'b', 'c'], standings, mode: 'add', metadata: { ...same, c: same.a }, relationships: [war('a', 'b')] };
  const original = structuredClone(options);
  const rows = calculate(options);
  assert.equal(pairValue(rows, 'a', 'b'), -0.15);
  assert.equal(pairValue(rows, 'a', 'c'), 0.35);
  assert.equal(pairValue(rows, 'a', 'outside'), 0.1);
  assert.equal(pairValue(rows, 'outside', 'a'), -0.4);
  assert.deepEqual(options, original);
  const grouped = calculate({ factionNames: ['a', 'b', 'c'], metadata: { ...same, c: same.a } });
  assert.deepEqual(grouped.find(row => row.faction === 'a').targets, ['b', 'c']);
  assert.ok(grouped.every(row => !row.targets.includes(row.faction)));
  assert.deepEqual(calculate({ factionNames: [] }), []);
});

test('Generated standings and numeric strings persist through the campaign save/export/reload path', () => {
  let data = parseDescrStrat('campaign imperial_campaign\nplayable\na\nb\nend\nfaction a, balanced smith\ndenari 1000\nfaction b, balanced smith\ndenari 1000\nfaction_standings a, 0.20 b\nfaction_relationships a, allied_to b\n');
  data.factionStandings = calculate({ factionNames: ['a', 'b'], standings: data.factionStandings, relationships: data.factionRelationships, metadata: same, mode: 'add' });
  for (let i = 0; i < 3; i++) data = parseDescrStrat(serializeDescrStrat(data, data.items));
  assert.equal(pairValue(data.factionStandings, 'a', 'b'), 0.65);
  assert.equal(pairValue(data.factionStandings, 'b', 'a'), 0.45);
  assert.equal(data.factionStandings.find(row => row.faction === 'a').valueStr, '0.65');
});

test('Check detects war/alliance conflicts, missing reverses, duplicates, unknown factions and bad numeric values without changing data', () => {
  const input = { factionNames: ['a', 'b'], metadata: same,
    standings: [standing('a', 2, 'b'), standing('a', 0.2, 'b'), standing('a', 0.2, 'a'), standing('a', NaN, 'outside')],
    relationships: [war('a', 'b'), ally('b', 'a'), war('a', 'b')] };
  const original = structuredClone(input), issues = validate(input);
  for (const expression of [/both allied and at war/, /missing reverse/, /duplicate at_war_with/, /not declared/, /between −1 and \+1/, /conflicting standing/, /cannot target itself/]) {
    assert.ok(issues.some(issue => expression.test(issue.message)), String(expression));
  }
  assert.deepEqual(input, original);
});

test('Validation upgrades a duplicate warning to an error if a later entry conflicts', () => {
  const issues = validate({ factionNames: ['a', 'b'], metadata: same, standings: [standing('a', 0.1, 'b'), standing('a', 0.1, 'b'), standing('a', 0.2, 'b')] });
  assert.equal(issues.find(issue => /standing entries/.test(issue.message)).severity, 'error');
});

test('Check retains M2EX client limits, detects empty rows and overlord wars, and warns about skipped metadata', () => {
  const issues = validate({ factionNames: ['a', 'b', 'c'], relationships: [
    { faction: 'a', relation: 'client_of', targets: ['b', 'c'] },
    { faction: 'a', relation: 'protectorate_of', targets: ['b'] }, war('a', 'b'),
    { faction: '', relation: '', targets: [] },
  ] });
  for (const expression of [/only one/, /both a client and a protectorate/, /also at war/, /source faction/, /at least one target/, /relationship type/, /missing religion and culture/]) {
    assert.ok(issues.some(issue => expression.test(issue.message)), String(expression));
  }
});

test('Legal reverse relationships and asymmetric standings do not produce false errors', () => {
  const input = { factionNames: ['a', 'b'], metadata: same, standings: [standing('a', 0.1, 'b'), standing('b', -0.1, 'a')], relationships: synchronize([ally('a', 'b')]) };
  assert.deepEqual(validate(input), []);
});

test('The Add flow starts blank, enforces source → type/value → targets, and commits only after explicit submission', () => {
  const form = source('DiplomacyEntryForm.jsx'), type = source('DiplomacyEntryType.jsx'), main = source('CampaignDiplomacyEditor.jsx');
  assert.match(form, /useState\(\{ faction: '', kind: '', value: '', targets: \[\] \}\)/);
  assert.match(form, /1\. Source faction/);
  assert.match(type, /disabled=\{!faction\}/);
  assert.match(form, /disabled=\{!draft.faction \|\| !draft.kind \|\| !validValue\}/);
  assert.match(form, /const rejected = onAdd\(entry\)/);
  assert.match(form, /type="submit" disabled=\{!valid\}/);
  assert.match(main, /onClick=\{\(\) => setAdding\(true\)\}/);
  assert.match(main, /onAdd=\{entry => data.addEntry\(tab, entry\)\}/);
  assert.match(source('useCampaignDiplomacy.js'), /return commitRelationships\(editDiplomacyRelationship\(relationships, relationships.length, entry\)\)/);
});

test('Both update modes and read-only full-campaign checks are wired to the existing save state', () => {
  const updater = source('DiplomacyStandingUpdater.jsx'), main = source('CampaignDiplomacyEditor.jsx');
  assert.match(updater, /value="recalculate"/);
  assert.match(updater, /value="add"/);
  assert.match(updater, /onApply\(diplomacyStandings\(\{ factionNames, standings, relationships, metadata, mode \}\)\)/);
  assert.match(main, /validateCampaignDiplomacy\(\{ standings, relationships, factionNames: allFactionNames, metadata \}\)/);
  assert.match(main, /onApply=\{data.applyStandings\}/);
  assert.match(source('useCampaignDiplomacy.js'), /onStratDataChange\(\{ \.\.\.stratData, factionStandings: updated \}\)/);
  assert.match(source('FactionsCampaignTab.jsx'), /<CampaignDiplomacyEditor/);
});