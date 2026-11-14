import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const bundle = await build({
  absWorkingDir: root,
  stdin: { resolveDir: root, sourcefile: 'victory-regression.js', contents: `
    export { default as autoVictoryConditions } from './src/components/map/autoVictoryConditions';
    export { parseWinConditions, serializeWinConditions } from './src/components/map/stratParser';
  ` },
  bundle: true, write: false, format: 'esm', platform: 'node',
  alias: { '@': path.join(root, 'src') }, logLevel: 'silent',
});
const { autoVictoryConditions, parseWinConditions, serializeWinConditions } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const settlement = (region, faction) => ({ category: 'settlement', region, faction });
const settlements = [settlement('London_Province', 'england'), settlement('Paris_Province', 'france'), settlement('York_Province', 'england')];

 test('Defaults apply 5× and 3× settlement counts, holding only the capital in both campaigns', () => {
  const updated = autoVictoryConditions({ factionNames: ['england', 'france'], settlements });
  assert.equal(updated.england.takeRegions, 10);
  assert.equal(updated.england.short.takeRegions, 6);
  assert.deepEqual(updated.england.holdRegions, ['London_Province']);
  assert.deepEqual(updated.england.short.holdRegions, ['London_Province']);
  assert.equal(updated.france.takeRegions, 5);
  assert.equal(updated.france.short.takeRegions, 3);
  assert.deepEqual(updated.france.holdRegions, ['Paris_Province']);
});

test('Custom multipliers preserve outlive conditions and leave the input unchanged', () => {
  const winConditions = { england: { takeRegions: 99, holdRegions: ['Old_Province'], outlive: ['scotland'], extra: 'keep',
    short: { takeRegions: 88, holdRegions: ['Other_Province'], outlive: ['france'], extra: 'also keep' } } };
  const before = structuredClone(winConditions);
  const updated = autoVictoryConditions({ winConditions, settlements, longMultiplier: 8, shortMultiplier: 2 });
  assert.equal(updated.england.takeRegions, 16);
  assert.equal(updated.england.short.takeRegions, 4);
  assert.deepEqual(updated.england.outlive, ['scotland']);
  assert.deepEqual(updated.england.short.outlive, ['france']);
  assert.equal(updated.england.extra, 'keep');
  assert.equal(updated.england.short.extra, 'also keep');
  assert.deepEqual(winConditions, before);
  assert.notStrictEqual(updated.england.holdRegions, updated.england.short.holdRegions);
});

test('All factions are covered, including missing entries and landless factions without invented capitals', () => {
  const updated = autoVictoryConditions({ winConditions: { dormant: { holdRegions: ['Former_Capital'], outlive: ['france'] } },
    factionNames: ['england', 'mongols', 'slave'], settlements });
  assert.deepEqual(Object.keys(updated).sort(), ['dormant', 'england', 'france', 'mongols', 'slave']);
  for (const name of ['dormant', 'mongols', 'slave']) {
    assert.equal(updated[name].takeRegions, 0);
    assert.equal(updated[name].short.takeRegions, 0);
    assert.deepEqual(updated[name].holdRegions, []);
    assert.deepEqual(updated[name].short.holdRegions, []);
  }
  assert.deepEqual(updated.dormant.outlive, ['france']);
});

test('Repeating the action uses current ownership and capital order, never multiplying the previous target', () => {
  const first = autoVictoryConditions({ settlements });
  const transferred = [settlement('York_Province', 'england'), settlement('London_Province', 'france'), settlement('Paris_Province', 'france')];
  const second = autoVictoryConditions({ winConditions: first, settlements: transferred });
  assert.equal(second.england.takeRegions, 5);
  assert.equal(second.england.short.takeRegions, 3);
  assert.deepEqual(second.england.holdRegions, ['York_Province']);
  assert.equal(second.france.takeRegions, 10);
  assert.deepEqual(second.france.holdRegions, ['London_Province']);
  assert.deepEqual(autoVictoryConditions({ winConditions: second, settlements: transferred }), second);
});

test('Generated long and short targets survive saving, export and reloading', () => {
  const updated = autoVictoryConditions({ settlements, factionNames: ['landless'] });
  const text = serializeWinConditions(updated);
  assert.match(text, /short_campaign hold_regions London_Province\ntake_regions 6/);
  assert.deepEqual(parseWinConditions(text), updated);
  const multiline = text.replace(/short_campaign hold_regions/g, 'short_campaign\nhold_regions');
  assert.deepEqual(parseWinConditions(multiline.replace(/\n/g, '\r\n')), updated);
});

test('The top action receives live settlements and uses the existing persistence callback', () => {
  const parent = readFileSync(path.join(root, 'src/components/map/StratPanel.jsx'), 'utf8');
  const tab = readFileSync(path.join(root, 'src/components/map/FactionsCampaignTab.jsx'), 'utf8');
  const toolbar = readFileSync(path.join(root, 'src/components/map/VictoryAutoUpdate.jsx'), 'utf8');
  assert.match(parent, /<FactionsCampaignTab[\s\S]*?settlements=\{settlements\}/);
  assert.match(parent, /onWinConditionsChange=\{\(wc\) => \{[\s\S]*?setWinConditions\(wc\)[\s\S]*?serializeWinConditions\(wc\)/);
  assert.ok(tab.indexOf('<VictoryAutoUpdate') < tab.indexOf('<WinConditionsEditor\n'));
  assert.match(tab, /<VictoryAutoUpdate[\s\S]*?onWinConditionsChange=\{onWinConditionsChange\}[\s\S]*?settlements=\{settlements\}/);
  assert.match(toolbar, /disabled=\{!valid \|\| !hasFactions\}/);
});