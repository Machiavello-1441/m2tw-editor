import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const bundle = await build({
  absWorkingDir: root,
  stdin: { resolveDir: root, sourcefile: 'protectorate-regression.js', contents: `
    export { parseDescrStrat, serializeDescrStrat } from './src/components/map/stratParser';
    export { editDiplomacyRelationship } from './src/components/map/diplomacyRelationships';
  ` },
  bundle: true, write: false, format: 'esm', platform: 'node',
  alias: { '@': path.join(root, 'src') }, logLevel: 'silent',
});
const { parseDescrStrat, serializeDescrStrat, editDiplomacyRelationship } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const protectorate = { faction: 'nabataea', relation: 'protectorate_of', targets: ['egypt'] };
const header = 'campaign imperial_campaign\nplayable\nnabataea\negypt\nend\n\nfaction nabataea, balanced smith\ndenari 1000\n\nfaction egypt, balanced smith\ndenari 2000\n\n';
const tail = 'region Nile_Province\n{\nwatchtower 1, 2\n}\n\nscript\ncampaign_script.txt\n';
const campaign = (diplomacy = '') => header + diplomacy + '\n' + tail;
const save = data => serializeDescrStrat(data, data.items);
const savedProtectorate = /faction_relationships\s+nabataea,\s+protectorate_of\s+egypt\s*$/m;

test('The M2EX example imports directionally, including comments and CRLF files', () => {
  const text = campaign('faction_relationships nabataea, protectorate_of egypt ; M2EX');
  assert.deepEqual(parseDescrStrat(text.replace(/\n/g, '\r\n')).factionRelationships, [protectorate]);
});

test('The relation selector offers protectorate_of and explains its M2EX direction', () => {
  const source = ['CampaignDiplomacyEditor.jsx', 'DiplomacyRows.jsx'].map(name => readFileSync(path.join(root, 'src/components/map', name), 'utf8')).join('\n');
  assert.match(source, /<option value="protectorate_of">protectorate_of<\/option>/);
  assert.match(source, /protectorate_of \(requires M2EX\)/);
  assert.match(source, /left faction is the protectorate and the right faction is its overlord/);
});

test('Changing a relationship to protectorate saves without any standings entries', () => {
  const data = parseDescrStrat(campaign('faction_relationships nabataea, at_war_with egypt'));
  data.factionRelationships = editDiplomacyRelationship(data.factionRelationships, 0, protectorate);
  const exported = save(data);
  assert.match(exported, savedProtectorate);
  assert.doesNotMatch(exported, /at_war_with/);
  assert.deepEqual(parseDescrStrat(exported).factionRelationships, [protectorate]);
});

test('A new protectorate is inserted before regions and script when no diplomacy existed', () => {
  const data = parseDescrStrat(campaign());
  data.factionRelationships = [protectorate];
  const exported = save(data);
  assert.match(exported, savedProtectorate);
  assert.ok(exported.indexOf('faction_relationships') < exported.indexOf('region Nile_Province'));
  assert.ok(exported.indexOf('faction_relationships') < exported.indexOf('\nscript\n'));
  assert.deepEqual(parseDescrStrat(exported).factionRelationships, [protectorate]);
  assert.match(exported, /watchtower 1, 2/);
});

test('Existing standings precision, wars, alliances, multiple targets and comments remain intact', () => {
  const data = parseDescrStrat(campaign('faction_standings egypt, 0.20 nabataea\n; diplomacy note\nfaction_relationships egypt, allied_to rome, carthage\nfaction_relationships rome, at_war_with carthage'));
  const standings = structuredClone(data.factionStandings);
  data.factionRelationships.push(protectorate);
  const exported = save(data);
  const loaded = parseDescrStrat(exported);
  assert.match(exported, /faction_standings\s+egypt,\s+0\.20\s+nabataea/);
  assert.match(exported, /; diplomacy note/);
  assert.deepEqual(loaded.factionStandings, standings);
  assert.deepEqual(loaded.factionRelationships, data.factionRelationships);
});

test('Editing the overlord and repeated saves neither reverse nor duplicate the relation', () => {
  let data = parseDescrStrat(campaign('faction_relationships nabataea, protectorate_of rome'));
  data.factionRelationships[0].targets = ['egypt'];
  for (let i = 0; i < 3; i++) data = parseDescrStrat(save(data));
  assert.deepEqual(data.factionRelationships, [protectorate]);
  assert.equal((save(data).match(/protectorate_of/g) || []).length, 1);
});

test('Removing the final protectorate persists even without standings', () => {
  const data = parseDescrStrat(campaign('faction_relationships nabataea, protectorate_of egypt'));
  data.factionRelationships = [];
  const exported = save(data);
  assert.doesNotMatch(exported, /protectorate_of/);
  assert.deepEqual(parseDescrStrat(exported).factionRelationships, []);
});