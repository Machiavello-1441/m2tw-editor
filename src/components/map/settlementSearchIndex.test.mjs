import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import settlementSearchIndex, { searchSettlements, groupSettlementMatches } from './settlementSearchIndex.js';
import settlementSearchWindow, { SETTLEMENT_SEARCH_PAGE_SIZE } from './settlementSearchWindow.js';

const items = [
  { id: 'a', region: 'London_Province', faction: 'england' },
  { id: 'b', region: 'York_Province', faction: 'england' },
  { id: 'c', region: 'Paris_Province', faction: 'france' },
  { id: 'd', region: 'Muenchen_Province', faction: 'hre' },
];
const regions = new Map([
  ['London_Province', { settlementName: 'London', resources: ['timber', 'iron'] }],
  ['York_Province', { settlementName: 'Eboracum', resources: ['timber'] }],
  ['Paris_Province', { settlementName: 'Paris', resources: ['wine'] }],
  ['Muenchen_Province', { settlementName: 'Munich', resources: ['iron'] }],
]);
const names = { London_Province: 'Greater London', Eboracum: 'York City', england: 'Kingdom of England', Muenchen_Province: 'München' };
const ids = records => records.map(item => item.id);

test('Partial, mixed-case, short, internal, city, localized, and faction-name lookups use the same index', () => {
  const index = settlementSearchIndex(items, regions, names);
  for (const [search, expected] of [
    ['LONDON', ['a']], ['ork', ['b']], ['York City', ['b']], ['eborac', ['b']],
    ['kingdom', ['a', 'b']], ['MÜN', ['d']], ['munich', ['d']], ['province', ['a', 'b', 'c', 'd']],
    ['o', ['a', 'b', 'c', 'd']], ['pa', ['c']], ['nonexistent', []], ['  london  ', ['a']],
  ]) assert.deepEqual(ids(searchSettlements(index, { search })), expected, search);
  assert.equal(searchSettlements(index), items, 'Clearing the search must reuse the original collection');
});

test('Faction and hidden-resource filters intersect text results without losing source order or capitals', () => {
  const index = settlementSearchIndex(items, regions, names);
  assert.deepEqual(ids(searchSettlements(index, { faction: 'england', resource: 'timber' })), ['a', 'b']);
  assert.deepEqual(ids(searchSettlements(index, { search: 'province', resource: 'iron' })), ['a', 'd']);
  assert.deepEqual(ids(searchSettlements(index, { search: 'york', faction: 'england', resource: 'timber' })), ['b']);
  assert.deepEqual(ids(searchSettlements(index, { faction: 'france', resource: 'iron' })), []);
  assert.deepEqual(ids(searchSettlements(index, { faction: 'missing' })), []);
  assert.deepEqual(ids(searchSettlements(index, { resource: 'missing' })), []);
  assert.equal(index.capitals.get('england'), 'a');
  assert.deepEqual(groupSettlementMatches([items[2], items[1], items[0]]).map(([f, list]) => [f, ids(list)]), [['england', ['b', 'a']], ['france', ['c']]]);
});

test('Substring verification rejects gram collisions and cross-field matches, without duplicate results', () => {
  const records = [
    { id: 'a', region: 'abaxxbab', faction: 'f' },
    { id: 'b', region: 'abababab', faction: 'f' },
    { id: 'c', region: 'new', faction: 'castle' },
  ];
  const index = settlementSearchIndex(records);
  assert.deepEqual(ids(searchSettlements(index, { search: 'abab' })), ['b']);
  assert.deepEqual(ids(searchSettlements(index, { search: 'newcastle' })), []);
  assert.deepEqual(ids(searchSettlements(index, { search: 'aba' })), ['a', 'b']);
});

test('Indexed results match reference substring filtering across literal punctuation and combined filters', () => {
  const records = Array.from({ length: 1200 }, (_, i) => ({ id: String(i), region: `province_[${i}]_x.y`, faction: `faction_${i % 7}` }));
  const regionMap = new Map(records.map((item, i) => [item.region, { settlementName: `city_${i}`, resources: [`resource_${i % 5}`] }]));
  const index = settlementSearchIndex(records, regionMap);
  for (const search of ['', 'p', 'pr', 'province', '[15]', 'x.y', 'city_78', '_1', 'not-found']) {
    for (const faction of ['', 'faction_1']) for (const resource of ['', 'resource_3']) {
      const expected = records.filter(item => (!search || [item.region, item.faction, regionMap.get(item.region).settlementName].some(value => value.toLowerCase().includes(search))) &&
        (!faction || item.faction === faction) && (!resource || regionMap.get(item.region).resources.includes(resource)));
      assert.deepEqual(ids(searchSettlements(index, { search, faction, resource })), ids(expected));
    }
  }
});

test('A location query on 25,000 settlements reads only indexed candidates, not every record or any pixels', () => {
  const records = Array.from({ length: 25000 }, (_, i) => ({ id: String(i), region: `province_${i}`, faction: `faction_${i % 20}` }));
  records[12345] = { ...records[12345], region: 'astral_xyqz_12345' };
  const index = settlementSearchIndex(records);
  let visited = 0;
  index.entries = new Proxy(index.entries, { get(target, key) {
    if (typeof key === 'string' && /^\d+$/.test(key)) visited++;
    return Reflect.get(target, key);
  } });
  assert.deepEqual(ids(searchSettlements(index, { search: 'astral_xyqz_12345' })), ['12345']);
  assert.equal(visited, 1, 'A selective location lookup should inspect only its indexed candidate');
  visited = 0;
  assert.deepEqual(ids(searchSettlements(index, { search: 'totally_missing_qzx' })), []);
  assert.equal(visited, 0);
  assert.equal(searchSettlements(index), records); assert.equal(visited, 0);
});

test('Rebuilding after edits or a campaign switch replaces outdated names, resources, owners, and capitals', () => {
  const before = settlementSearchIndex(items, regions, names);
  const edited = items.map(item => item.id === 'a' ? { ...item, region: 'New_London', faction: 'france' } : item);
  const afterRegions = new Map(regions); afterRegions.set('New_London', { settlementName: 'Londinium', resources: ['gold'] });
  const after = settlementSearchIndex(edited, afterRegions, { ...names, Londinium: 'New City' });
  assert.deepEqual(ids(searchSettlements(before, { search: 'london', faction: 'england' })), ['a']);
  assert.deepEqual(ids(searchSettlements(after, { search: 'london', faction: 'england' })), []);
  assert.deepEqual(ids(searchSettlements(after, { search: 'new city', resource: 'gold' })), ['a']);
  assert.equal(after.capitals.get('england'), 'b');
  const otherCampaign = settlementSearchIndex([{ id: 'z', region: 'Elsewhere', faction: 'other' }]);
  assert.deepEqual(searchSettlements(otherCampaign, { search: 'london' }), []);
});

test('Broad searches mount only one page, allow more results, and keep map-selected settlements accessible', () => {
  const matches = Array.from({ length: 20000 }, (_, i) => ({ id: String(i) }));
  const first = settlementSearchWindow(matches, true, SETTLEMENT_SEARCH_PAGE_SIZE);
  assert.equal(first.length, 100); assert.equal(first[99], matches[99]);
  assert.equal(settlementSearchWindow(matches, true, 200).length, 200);
  const selected = settlementSearchWindow(matches, true, 100, matches[19000]);
  assert.equal(selected.length, 101); assert.equal(selected[100], matches[19000]);
  assert.equal(settlementSearchWindow(matches, true, 100, matches[1]).length, 100);
  assert.equal(settlementSearchWindow(matches, false, 100), matches);
  assert.equal(matches.length, 20000, 'Paging must not truncate bulk-action matches');
});

test('The live search is memoized by campaign metadata, and bulk selection still uses every match', () => {
  const hook = readFileSync(new URL('./useSettlementSearch.js', import.meta.url), 'utf8');
  const source = readFileSync(new URL('./StratPanel.jsx', import.meta.url), 'utf8');
  assert.match(hook, /settlementSearchIndex\(settlements, regionsByName, settlementNames\)/);
  assert.match(hook, /\[settlements, regionsByName, settlementNames\]/);
  assert.doesNotMatch(hook, /regionsLayer|ImageData|\.data/);
  assert.match(source, /useSettlementSearch\(/);
  assert.doesNotMatch(source, /settlements\.filter\(item =>|settlements\.find\(item => item\.faction/);
  assert.match(source, /visibleByFaction\.map/);
  assert.match(source, /setBulkIds\(new Set\(filteredSettlements\.map/);
  assert.match(source, /capitalIds\.get\(factionName\)/);
  assert.match(hook, /settlementSearchWindow\(ordered, true, limit, selected\)/);
  assert.match(hook, /expandedFactions\.has\(name\)/);
  assert.match(hook, /hasMore: visible\.length < ordered\.length/);
  assert.match(source, /factionSetts\.indexOf\(shown\[source\.index\]\)/);
});