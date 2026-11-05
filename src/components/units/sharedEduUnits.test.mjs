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
    export { default as verifyEduOwnershipInheritance } from './src/components/units/verifyEduOwnershipInheritance';
    export { prepareEduOwnership, duplicateEduOwnership } from './src/components/factions/factionBulkDuplicate';
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

test('Faction duplication assigns the complete land, bodyguard, naval, siege and culture roster', async () => {
  const { a } = runtime();
  const source = '\uFEFF; Original file\r\n'
    + 'type Bodyguard\r\nattributes general_unit, general_unit_upgrade\r\nownership\tEngland, france ; untouched comment\r\nera 0 England\r\n'
    + 'type Foot Soldiers\ncategory infantry\nownership england\nera 1 england, france\n'
    + 'type Riders\rcategory cavalry\rownership france, england\rera 2 england\r'
    + 'type Ship\ncategory ship\nship heavy cog\nownership england\nera 0 england\n'
    + 'type Engine\ncategory siege\nengine huge_bombard\nownership england\nera 9 england\ncustom_extension preserve\n'
    + 'type Cultural Levy\nownership northern_european\nera 1 northern_european\n'
    + 'type Already Assigned\nownership england, new_faction\nera 0 england, new_faction\n'
    + 'type Unrelated\nownership england_other, france\nera 0 france\n'
    + 'type Universal\nownership all\n; ownership england\n';
  a.setFile('m2tw_units_file', source);
  const prepared = a.prepareEduOwnership('england', 'new_faction', 'northern_european');
  assert.equal(prepared.ownershipMatches, 7);
  assert.equal(prepared.ownershipAlready, 1);
  assert.equal(prepared.universalUnits, 1);
  const result = a.duplicateEduOwnership('england', 'new_faction', 'northern_european', prepared);
  assert.equal(result.ownershipLines, 6);
  assert.equal(result.eraLines, 6);
  const copied = a.parseEDU(a.readSharedEdu());
  for (const unit of copied.slice(0, 7)) assert.ok(unit.ownership.includes('new_faction'), unit.type);
  assert.equal(copied[7].ownership.join(','), 'england_other,france');
  assert.equal(copied[8].ownership.join(','), 'all');
  assert.ok(a.readSharedEdu().includes('ship heavy cog'));
  assert.ok(a.readSharedEdu().includes('engine huge_bombard'));
  assert.equal(a.getFile('m2tw_units_before_faction_patch'), source);
  assert.equal(a.getFile('m2tw_edu_raw'), prepared.out);
  await a.flushBigFiles();
});

test('Verification rejects a skipped ownership or era entry before any file is written', () => {
  const { a } = runtime();
  assert.throws(() => a.verifyEduOwnershipInheritance(original, original, 'england', 'new_faction'), /Could not copy ownership/);
  const onlyOwnership = original.replace('ownership england', 'ownership england, new_faction');
  assert.throws(() => a.verifyEduOwnershipInheritance(original, onlyOwnership, 'england', 'new_faction'), /Could not copy era/);
  const malformed = 'type Partial\nownership england, invalid-token\n';
  a.setFile('m2tw_units_file', malformed);
  assert.throws(() => a.prepareEduOwnership('england', 'new_faction'), /Could not copy ownership/);
  assert.equal(a.readSharedEdu(), malformed);
  assert.equal(a.getFile('m2tw_units_before_faction_patch'), null);
});

test('Prepared duplication refuses a stale EDU and repeated assignment is idempotent', async () => {
  const { a } = runtime();
  a.setFile('m2tw_units_file', original);
  const prepared = a.prepareEduOwnership('england', 'new_faction');
  a.setFile('m2tw_units_file', corrected);
  assert.throws(() => a.duplicateEduOwnership('england', 'new_faction', '', prepared), /changed during duplication/);
  assert.equal(a.readSharedEdu(), corrected);
  const first = a.duplicateEduOwnership('england', 'new_faction');
  const out = a.readSharedEdu();
  const second = a.duplicateEduOwnership('england', 'new_faction');
  assert.ok(first.count > 0);
  assert.equal(second.count, 0);
  assert.equal(second.ownershipMatches, 1);
  assert.equal(second.ownershipAlready, 1);
  assert.equal(a.readSharedEdu(), out);
  assert.equal(a.getFile('m2tw_units_before_faction_patch'), corrected);
  await a.flushBigFiles();
});

test('Era-only matches cannot pass the faction creation ownership guard', () => {
  const { a } = runtime();
  a.setFile('m2tw_units_file', 'type Other\nownership france\nera 0 england\n');
  const prepared = a.prepareEduOwnership('england', 'new_faction');
  assert.equal(prepared.ownershipMatches, 0);
  assert.equal(prepared.universalUnits, 0);
  const page = readFileSync(path.join(root, 'src/pages/FactionsEditor.jsx'), 'utf8');
  assert.match(page, /!preparedEdu\.ownershipMatches && !preparedEdu\.universalUnits/);
  assert.ok(page.indexOf('eduRes = duplicateEduOwnership') < page.indexOf('updated.splice(duplicateSourceIdx + 1'), 'Ownership is committed before the faction is created');
  assert.match(page, /unit ownerships verified/);
});