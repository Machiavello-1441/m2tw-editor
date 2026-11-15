import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const bundle = await build({
  absWorkingDir: root,
  stdin: { resolveDir: root, sourcefile: 'campaign-names-validation-regression.js', contents: `
    export { default as validate } from './src/components/map/validateCampaignNames';
    export { validateLayers } from './src/components/map/mapValidator';
  ` },
  bundle: true, write: false, format: 'esm', platform: 'node',
  alias: { '@': path.join(root, 'src') }, logLevel: 'silent',
});
const { validate, validateLayers } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const regionsData = [{ regionName: 'Nile_Province', settlementName: 'Alexandria' }, { regionName: 'Desert_Province', settlementName: 'Siwa' }];
const settlementNames = { Nile_Province: 'Nile Delta', Alexandria: 'Alexandria', Desert_Province: 'Western Desert', Siwa: 'Siwa Oasis' };
const settlements = [{ id: 'city-1', region: 'Nile_Province' }];
const context = { regionsData, settlementNames, settlements };

test('Complete campaign province and settlement localization passes without map layers', () => {
  assert.deepEqual(validate(context), []);
  assert.deepEqual(validateLayers({}), []);
  assert.deepEqual(validate(), []);
});

test('Missing province and settlement display names are errors, including unoccupied region definitions', () => {
  const issues = validate({ ...context, settlementNames: { Nile_Province: 'Nile Delta', Alexandria: 'Alexandria' } });
  assert.deepEqual(issues.map(issue => [issue.code, issue.key]), [['missing_province_name', 'Desert_Province'], ['missing_settlement_name', 'Siwa']]);
  assert.ok(issues.every(issue => issue.severity === 'error' && /\.txt \/ \.strings\.bin/.test(issue.message)));
});

test('Empty, whitespace-only, absent and wrong-case localization entries are errors', () => {
  for (const value of ['', ' \n\t ', undefined, null]) {
    assert.ok(validate({ ...context, settlementNames: { ...settlementNames, Nile_Province: value } }).some(issue => issue.code === 'missing_province_name'));
  }
  assert.equal(validate({ ...context, settlementNames: null }).length, 4);
  assert.equal(validate({ ...context, settlementNames: { nile_province: 'Nile', Alexandria: 'Alexandria', Desert_Province: 'Desert', Siwa: 'Siwa' } })[0].key, 'Nile_Province');
  assert.deepEqual(validate({ ...context, settlementNames: { ...settlementNames, Alexandria: 'الإسكندرية' } }), []);
});

test('Missing internal province and settlement identifiers are errors rather than silently skipped', () => {
  const issues = validate({ regionsData: [{ regionName: ' ', settlementName: '' }], settlementNames: {} });
  assert.deepEqual(issues.map(issue => issue.code), ['missing_region_identifier', 'missing_settlement_identifier']);
  assert.ok(issues.every(issue => issue.severity === 'error'));
});

test('Campaign settlements require loaded definitions and exact province references', () => {
  assert.ok(validate({ settlements }).some(issue => issue.code === 'missing_region_definitions'));
  assert.ok(validate({ ...context, settlements: [{ id: 'city-2', region: '' }] }).some(issue => issue.code === 'missing_region_reference'));
  const issues = validate({ ...context, settlements: [{ region: 'nile_province' }, { region: 'nile_province' }] });
  assert.equal(issues.filter(issue => issue.code === 'undefined_region').length, 1);
  assert.ok(issues.some(issue => issue.key === 'nile_province' && issue.code === 'missing_province_name'));
  assert.equal(new Set(issues.map(issue => issue.id)).size, issues.length);
});

test('M2EX wastelands require province localization, not a fictitious settlement name', () => {
  for (const region of [{ regionName: 'Sahara', settlementName: 'wasteland' }, { regionName: 'Sahara', wasteland: true }]) {
    assert.deepEqual(validate({ regionsData: [region], settlementNames: { Sahara: 'Sahara Desert' } }), []);
    assert.deepEqual(validate({ regionsData: [region], settlementNames: {} }).map(issue => issue.code), ['missing_province_name']);
  }
});

test('Validation reads current unsaved names and never changes the campaign', () => {
  const original = structuredClone(context);
  const names = { ...settlementNames, Alexandria: '' };
  assert.ok(validate({ ...context, settlementNames: names }).some(issue => issue.key === 'Alexandria'));
  names.Alexandria = 'New Alexandria';
  assert.deepEqual(validate({ ...context, settlementNames: names }), []);
  assert.deepEqual(context, original);
});

test('The campaign validation panel receives live names, counts them as errors, and works without TGAs', () => {
  const read = file => readFileSync(path.join(root, 'src', file), 'utf8');
  assert.match(read('pages/CampaignMap.jsx'), /<CampaignValidationTab\s+layers=\{layers\} regionsData=\{regionsData\} settlementNames=\{settlementNames\}/);
  assert.match(read('components/map/CampaignValidationTab.jsx'), /<MapValidationPanel[^>]+regionsData=\{regionsData\} settlementNames=\{settlementNames\} settlements=\{settlements\}/);
  const panel = read('components/map/MapValidationPanel.jsx');
  assert.match(panel, /\.\.\.layerIssues, \.\.\.validateCampaignNames\(\{ regionsData, settlementNames, settlements \}\)/);
  assert.match(panel, /regionsData\?\.length > 0 \|\| settlements\.length > 0/);
  assert.match(panel, /disabled=\{running \|\| !hasData\}/);
  assert.match(panel, /i\.severity === 'error'/);
});