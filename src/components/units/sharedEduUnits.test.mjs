import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const built = await build({
  absWorkingDir: root,
  stdin: { resolveDir: root, sourcefile: 'shared-edu-test-entry.js', contents: `
    export * from './src/components/units/useSharedEduUnits';
    export * from './src/components/units/EDUParser';
    export * from './src/components/units/eduOwnershipPatch';
    export * from './src/lib/bigFileStore';
    export * from './src/lib/modFileRegistry';
  ` },
  bundle: true, write: false, format: 'iife', platform: 'browser', globalName: 'EduTest',
  alias: { '@': path.join(root, 'src') }, define: { 'process.env.NODE_ENV': '"test"' }, logLevel: 'silent',
});
class CustomEvent extends Event {
  constructor(type, options = {}) { super(type); this.detail = options.detail; }
}
function runtime() {
  const values = new Map(), window = new EventTarget();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  window.localStorage = storage; window.sessionStorage = storage;
  const context = vm.createContext({ window, localStorage: storage, CustomEvent, queueMicrotask, console, setTimeout, clearTimeout });
  vm.runInContext(built.outputFiles[0].text, context);
  return { a: context.EduTest, window };
}
const original = '; Preserve this source\r\ntype Bodyguard\r\ncategory cavalry\r\nattributes general_unit\r\nownership england\r\nera 0 england\r\ncustom_rule untouched\r\n';
const corrected = original.replaceAll('england', 'england, england_copy');
const owners = a => a.parseEDU(a.readSharedEdu())[0].ownership.join(',');

test('Current shared ownership beats both old parsed caches and original campaign files', async () => {
  const { a } = runtime();
  a.setFile('m2tw_units_file', corrected);
  a.setFile('m2tw_edu_units', JSON.stringify(a.parseEDU(original)));
  let read = false;
  await a.seedCampaignEdu({ text: async () => { read = true; return original; } });
  assert.equal(read, false);
  assert.equal(owners(a), 'england,england_copy');
  assert.equal(a.getFile('m2tw_units_file'), corrected);
});

test('A campaign can seed a genuinely missing EDU without replacing a newer import during its read', async () => {
  const { a } = runtime();
  await a.seedCampaignEdu({ text: async () => original });
  assert.equal(a.readSharedEdu(), original);
  a.removeFile('m2tw_units_file');
  let finish;
  const pending = a.seedCampaignEdu({ text: () => new Promise(resolve => { finish = resolve; }) });
  a.setFile('m2tw_units_file', corrected);
  finish(original); await pending;
  assert.equal(a.readSharedEdu(), corrected);
});

test('Faction ownership additions refresh mounted subscribers without rebuilding the EDU', async () => {
  const { a, window } = runtime();
  a.setFile('m2tw_units_file', original); await a.flushBigFiles();
  let changes = 0;
  const stop = a.subscribeSharedEdu(() => { changes++; });
  const patch = a.patchEduOwnership(a.readSharedEdu(), 'england', 'england_copy');
  a.verifyEduOwnershipPatch(original, patch);
  a.setFile('m2tw_units_file', patch.out); await a.flushBigFiles();
  assert.ok(changes > 0);
  assert.equal(owners(a), 'england,england_copy');
  assert.equal(patch.out.replaceAll(', england_copy', ''), original);
  const before = changes;
  a.setFile('unrelated_file', 'not EDU'); await a.flushBigFiles();
  assert.equal(changes, before);
  window.dispatchEvent(new CustomEvent('edu-file-loaded'));
  assert.equal(changes, before + 1);
  stop(); window.dispatchEvent(new CustomEvent('edu-file-loaded'));
  assert.equal(changes, before + 1);
});

test('Manual ownership corrections and both raw aliases are immediately visible', async () => {
  const { a } = runtime();
  a.setFile('m2tw_units_file', original);
  a.setFile('m2tw_edu_raw', corrected);
  assert.equal(a.readSharedEdu(), corrected);
  assert.equal(owners(a), 'england,england_copy');
  assert.equal(a.parseEDU(a.readSharedEdu())[0].attributes[0], 'general_unit');
  a.removeFile('m2tw_units_file');
  assert.equal(a.readSharedEdu(), '');
  await a.flushBigFiles();
});

test('Campaign restoration cannot reinstate saved unit lists, and missing ownership is not mislabeled as missing EDU', () => {
  const campaign = readFileSync(path.join(root, 'src/pages/CampaignMap.jsx'), 'utf8');
  assert.match(campaign, /const eduUnits = useSharedEduUnits\(\)/);
  assert.match(campaign, /await seedCampaignEdu\(file\)/);
  assert.doesNotMatch(campaign, /setEduUnits|saved\.eduUnits/);
  assert.doesNotMatch(campaign.match(/const campaignSnapshot = \{[^\n]+/)?.[0] || '', /\beduUnits\b/);
  const characters = readFileSync(path.join(root, 'src/components/map/CharactersTab.jsx'), 'utf8');
  assert.match(characters, /No general units owned by this faction/);
  assert.doesNotMatch(characters, /— load EDU|No general units in EDU \(load EDU\)/);
});