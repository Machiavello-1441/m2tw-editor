import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const bundle = await build({
  absWorkingDir: root,
  stdin: { resolveDir: root, sourcefile: 'client-state-regression.js', contents: `
    export { default as clientStateRules } from './src/components/map/clientStateRules';
    export { parseDescrStrat, serializeDescrStrat } from './src/components/map/stratParser';
  ` },
  bundle: true, write: false, format: 'esm', platform: 'node',
  alias: { '@': path.join(root, 'src') }, logLevel: 'silent',
});
const { clientStateRules, parseDescrStrat, serializeDescrStrat } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const client = (faction, ...targets) => ({ faction, relation: 'client_of', targets });
const protectorate = (faction, target) => ({ faction, relation: 'protectorate_of', targets: [target] });
const raw = 'campaign imperial_campaign\nplayable\nnabataea\negypt\nend\nfaction nabataea, balanced smith\ndenari 1000\nfaction egypt, balanced smith\ndenari 2000\n';
const save = relationships => {
  const data = parseDescrStrat(raw);
  data.factionRelationships = relationships;
  return serializeDescrStrat(data, data.items);
};

test('M2EX client_of imports directionally and survives saving and reloading', () => {
  let data = parseDescrStrat(raw + 'faction_relationships nabataea, client_of egypt ; M2EX\r\n');
  assert.deepEqual(data.factionRelationships, [client('nabataea', 'egypt')]);
  for (let i = 0; i < 3; i++) data = parseDescrStrat(serializeDescrStrat(data, data.items));
  assert.deepEqual(data.factionRelationships, [client('nabataea', 'egypt')]);
});

test('Multiple clients may share a suzerain, and unrelated alliances/wars remain unchanged', () => {
  const relationships = [client('nabataea', 'egypt'), client('judea', 'egypt'),
    { faction: 'egypt', relation: 'allied_to', targets: ['rome'] },
    { faction: 'nabataea', relation: 'at_war_with', targets: ['carthage'] }];
  assert.deepEqual(clientStateRules(relationships), []);
  assert.deepEqual(parseDescrStrat(save(relationships)).factionRelationships, [...relationships,
    { faction: 'rome', relation: 'allied_to', targets: ['egypt'] },
    { faction: 'carthage', relation: 'at_war_with', targets: ['nabataea'] }]);
});

test('A client cannot have multiple suzerains in one row or across rows', () => {
  for (const relationships of [[client('nabataea', 'egypt', 'rome')], [client('nabataea', 'egypt'), client('nabataea', 'rome')]]) {
    assert.match(clientStateRules(relationships)[0].message, /multiple suzerains/);
    assert.throws(() => save(relationships), /A client can have only one/);
  }
  assert.deepEqual(clientStateRules([client('nabataea', 'egypt'), client('nabataea', 'egypt')]), []);
});

test('Clients cannot have clients, regardless of order, including cycles and self-client relationships', () => {
  const chain = [client('nabataea', 'egypt'), client('egypt', 'rome')];
  assert.match(clientStateRules(chain)[0].message, /egypt is already a client/);
  assert.match(clientStateRules([...chain].reverse())[0].message, /egypt is already a client/);
  assert.throws(() => save(chain), /cannot have nabataea as its client/);
  assert.throws(() => save([client('nabataea', 'egypt'), client('egypt', 'nabataea')]), /already a client/);
  assert.throws(() => save([client('nabataea', 'nabataea')]), /cannot be its own suzerain/);
});

test('A faction cannot be both a client and a protectorate, in either row order', () => {
  for (const relationships of [[client('nabataea', 'egypt'), protectorate('nabataea', 'rome')], [protectorate('nabataea', 'egypt'), client('nabataea', 'egypt')]]) {
    assert.match(clientStateRules(relationships)[0].message, /cannot be both a client and a protectorate/);
    assert.throws(() => save(relationships), /both a client and a protectorate/);
  }
  assert.deepEqual(clientStateRules([client('nabataea', 'egypt'), protectorate('judea', 'egypt')]), []);
  assert.deepEqual(clientStateRules([client('nabataea', 'egypt'), protectorate('egypt', 'rome')]), []);
});

test('Imported invalid relationships stay visible until repaired; removing or changing client status remains possible in setup', () => {
  const data = parseDescrStrat(raw + 'faction_relationships nabataea, client_of egypt, rome\n');
  assert.equal(data.factionRelationships[0].targets.length, 2);
  assert.equal(clientStateRules(data.factionRelationships).length, 1);
  data.factionRelationships[0].targets = ['egypt'];
  assert.deepEqual(parseDescrStrat(serializeDescrStrat(data, data.items)).factionRelationships, [client('nabataea', 'egypt')]);
  data.factionRelationships[0].relation = 'allied_to';
  assert.equal(parseDescrStrat(serializeDescrStrat(data, data.items)).factionRelationships[0].relation, 'allied_to');
  data.factionRelationships = [];
  assert.deepEqual(parseDescrStrat(serializeDescrStrat(data, data.items)).factionRelationships, []);
});

test('Client relationships require a suzerain and the validator never mutates supplied records', () => {
  const relationships = [client('nabataea')];
  const original = structuredClone(relationships);
  assert.throws(() => save(relationships), /must have one suzerain/);
  assert.deepEqual(relationships, original);
});

test('The editor offers client_of, explains gameplay, and rejects new invalid changes before updating campaign state', () => {
  const tab = readFileSync(path.join(root, 'src/components/map/FactionsCampaignTab.jsx'), 'utf8');
  const notice = readFileSync(path.join(root, 'src/components/map/ClientStateRulesNotice.jsx'), 'utf8');
  assert.match(tab, /<option value="client_of">client_of<\/option>/);
  assert.match(tab, /clientStateRules\(updated\)\.find\(issue => !previousIssues\.has\(issue\.id\)\)/);
  assert.match(tab, /if \(introduced\) \{[\s\S]*?return;[\s\S]*?onStratDataChange\(\{ \.\.\.stratData, factionRelationships: updated \}\)/);
  assert.match(tab, /<ClientStateRulesNotice issues=\{relationshipIssues\}/);
  assert.match(notice, /Clients join all suzerain wars and alliances; the suzerain can ignore client wars/);
  assert.match(notice, /In-game, clients can leave only through war/);
});