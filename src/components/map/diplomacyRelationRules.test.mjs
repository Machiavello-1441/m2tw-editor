import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const bundle = await build({
  absWorkingDir: root,
  stdin: { resolveDir: root, sourcefile: 'diplomacy-relation-rules-regression.js', contents: `
    export { default as rules } from './src/components/map/diplomacyRelationRules';
    export { default as validate } from './src/components/map/validateCampaignDiplomacy';
    export { default as synchronize } from './src/components/map/diplomacyRelationships';
    export { parseDescrStrat } from './src/components/map/stratParser';
  ` }, bundle: true, write: false, format: 'esm', platform: 'node',
  alias: { '@': path.join(root, 'src') }, logLevel: 'silent',
});
const { rules, validate, synchronize, parseDescrStrat } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const relation = (faction, type, ...targets) => ({ faction, relation: type, targets });
const context = { factionNames: ['a', 'b', 'c', 'd'], metadata: Object.fromEntries(['a', 'b', 'c', 'd'].map(name => [name, { religion: 'catholic', culture: 'northern_european' }])) };
const check = relationships => validate({ ...context, relationships });

test('A faction cannot be both a protectorate and client, regardless of overlord or row order', () => {
  for (const targets of [['b', 'b'], ['b', 'c']]) {
    const rows = [relation('a', 'client_of', targets[0]), relation('a', 'protectorate_of', targets[1])];
    for (const relationships of [rows, [...rows].reverse()]) {
      assert.ok(check(relationships).some(issue => issue.severity === 'error' && /a cannot be both a client and a protectorate/.test(issue.message)));
    }
  }
});

test('Self-war, self-alliance, self-protectorate and self-client relations receive explicit errors', () => {
  for (const [type, expression] of [
    ['at_war_with', /a cannot be at war with itself/], ['allied_to', /a cannot be allied to itself/],
    ['protectorate_of', /a cannot be its own overlord/], ['client_of', /a cannot be its own suzerain/],
  ]) {
    const issues = check(synchronize([relation('a', type, 'a')]));
    assert.ok(issues.some(issue => issue.severity === 'error' && expression.test(issue.message)));
  }
});

test('A grouped self-war is still reported after loading and reciprocal synchronization', () => {
  const campaign = parseDescrStrat('campaign imperial_campaign\nplayable\na\nb\nend\nfaction a, balanced smith\ndenari 1000\nfaction b, balanced smith\ndenari 1000\nfaction_relationships a, at_war_with b, a\n');
  assert.ok(check(campaign.factionRelationships).some(issue => /a cannot be at war with itself/.test(issue.message)));
});

test('Both war/alliance orientations and war with an overlord are contradictions', () => {
  for (const rows of [
    [relation('a', 'at_war_with', 'b'), relation('b', 'allied_to', 'a')],
    [relation('b', 'at_war_with', 'a'), relation('a', 'allied_to', 'b')],
  ]) assert.ok(check(rows).some(issue => /both allied and at war/.test(issue.message)));
  for (const type of ['client_of', 'protectorate_of']) {
    assert.ok(check([relation('a', type, 'b'), relation('b', 'at_war_with', 'a')]).some(issue => /also at war/.test(issue.message)));
  }
});

test('Protectorates cannot have several overlords, including declarations split across rows', () => {
  for (const rows of [
    [relation('a', 'protectorate_of', 'b', 'c')],
    [relation('a', 'protectorate_of', 'b'), relation('a', 'protectorate_of', 'c')],
  ]) assert.ok(check(rows).some(issue => issue.severity === 'error' && /a has multiple overlords \(b, c\)/.test(issue.message)));
  assert.deepEqual(rules([relation('a', 'protectorate_of', 'b'), relation('a', 'protectorate_of', 'b')]), []);
});

test('Protectorate and mixed subject cycles are identified with the participating factions', () => {
  for (const rows of [
    [relation('a', 'protectorate_of', 'b'), relation('b', 'protectorate_of', 'a')],
    [relation('a', 'client_of', 'b'), relation('b', 'protectorate_of', 'c'), relation('c', 'protectorate_of', 'a')],
    [relation('a', 'protectorate_of', 'b'), relation('b', 'protectorate_of', 'c'), relation('c', 'protectorate_of', 'd'), relation('d', 'protectorate_of', 'b')],
  ]) {
    const original = structuredClone(rows), issues = check(rows);
    assert.ok(issues.some(issue => issue.severity === 'error' && /Subject relationship cycle: .* → .* →/.test(issue.message)));
    assert.deepEqual(rows, original);
  }
});

test('Separate subject groups, shared overlords and acyclic subject chains remain valid', () => {
  for (const relationships of [
    [relation('a', 'client_of', 'b'), relation('c', 'protectorate_of', 'b')],
    [relation('a', 'client_of', 'b'), relation('c', 'client_of', 'b')],
    [relation('a', 'client_of', 'b'), relation('b', 'protectorate_of', 'c')],
    [relation('a', 'protectorate_of', 'b'), relation('b', 'protectorate_of', 'c')],
    synchronize([relation('a', 'allied_to', 'b', 'c'), relation('b', 'at_war_with', 'd')]),
  ]) assert.deepEqual(check(relationships), []);
  assert.deepEqual(check([]), []);
});

test('Existing client limits still catch multiple suzerains and nested clients', () => {
  assert.ok(check([relation('a', 'client_of', 'b', 'c')]).some(issue => /only one/.test(issue.message)));
  assert.ok(check([relation('a', 'client_of', 'b'), relation('b', 'client_of', 'c')]).some(issue => /already a client/.test(issue.message)));
});

test('Validation does not mislabel empty faction selections as self-relations', () => {
  const issues = check([relation('', 'at_war_with', '')]);
  assert.ok(issues.some(issue => /source faction/.test(issue.message)));
  assert.ok(issues.some(issue => /target faction is empty/.test(issue.message)));
  assert.ok(!issues.some(issue => /with itself/.test(issue.message)));
});

test('The validation button checks all current relations, not the searched subset, and reports errors without edits', () => {
  const source = readFileSync(path.join(root, 'src/components/map/CampaignDiplomacyEditor.jsx'), 'utf8');
  const report = readFileSync(path.join(root, 'src/components/map/DiplomacyCheckResults.jsx'), 'utf8');
  assert.match(source, /onClick=\{\(\) => setChecked\(true\)\}[^>]*>Validate all relations</);
  assert.match(source, /validateCampaignDiplomacy\(\{ standings, relationships, factionNames: allFactionNames, metadata \}\)/);
  assert.match(source, /checked && <DiplomacyCheckResults issues=\{diagnostics\}/);
  assert.match(report, /including hidden search results/);
  assert.match(report, /does not change data/);
});