/**
 * Operations on whole faction blocks in descr_strat.txt raw text:
 * inserting a new faction block and moving a block (with all its
 * settlements, characters and family relationships) up/down.
 */
function cl(l) { return l.replace(/;.*$/, '').trim(); }

// Find top-level faction blocks: [{ name, start, end }] (end exclusive).
// A block runs from its "faction <name>" header to the next faction header
// or the diplomacy/regions/script section. Brace depth is tracked so
// "region"/"faction_creator" lines inside settlement blocks are ignored.
export function findFactionBlocks(lines) {
  const blocks = [];
  let depth = 0;
  let current = null;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const c = cl(raw);
    if (depth === 0) {
      const m = c.match(/^faction[\s\t]+(\w+)/);
      const isTerminator =
        /^(faction_standings|faction_relationships|action_relationships)\b/i.test(c) ||
        /^region[\s\t]+\S/i.test(c) ||
        /^script\s*$/i.test(c);
      if (m) {
        if (current) { current.end = i; blocks.push(current); }
        current = { name: m[1], start: i };
      } else if (isTerminator && current) {
        current.end = i;
        blocks.push(current);
        current = null;
      }
    }
    for (const ch of raw) {
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
    }
  }
  if (current) { current.end = lines.length; blocks.push(current); }
  return blocks;
}

// Insert a minimal new faction block after the last existing faction block,
// and register the faction in the nonplayable list if it isn't listed yet.
export function insertFactionIntoStrat(raw, name) {
  const lines = raw.split('\n');
  const blocks = findFactionBlocks(lines);
  const blockLines = [
    ';--------------------------------------------------------------------------------------------',
    '',
    `faction\t${name}, balanced smith`,
    '\tai_label\tdefault',
    '\tdenari\t5000',
    '\tdenari_kings_purse\t1500',
    '',
  ];
  let insertIdx;
  if (blocks.length > 0) {
    insertIdx = blocks[blocks.length - 1].end;
  } else {
    insertIdx = lines.findIndex(l =>
      /^(faction_standings|faction_relationships|action_relationships)\b/i.test(cl(l)) ||
      /^script\s*$/i.test(cl(l))
    );
    if (insertIdx < 0) insertIdx = lines.length;
  }
  lines.splice(insertIdx, 0, ...blockLines);

  // Add to nonplayable unless already in playable/unlockable/nonplayable
  let listed = false;
  for (const kw of ['playable', 'unlockable', 'nonplayable']) {
    const si = lines.findIndex(l => cl(l).toLowerCase() === kw);
    if (si < 0) continue;
    for (let i = si + 1; i < lines.length; i++) {
      const c = cl(lines[i]);
      if (c.toLowerCase() === 'end') break;
      if (c === name) { listed = true; break; }
    }
    if (listed) break;
  }
  if (!listed) {
    const npIdx = lines.findIndex(l => cl(l).toLowerCase() === 'nonplayable');
    if (npIdx >= 0) {
      const endIdx = lines.findIndex((l, i) => i > npIdx && cl(l).toLowerCase() === 'end');
      if (endIdx >= 0) lines.splice(endIdx, 0, `\t${name}`);
    }
  }
  return lines.join('\n');
}

// Move a faction's whole block (data, settlements, characters, relatives)
// one position up (dir=-1) or down (dir=+1) within descr_strat.txt.
export function moveFactionInStrat(raw, name, dir) {
  const lines = raw.split('\n');
  const blocks = findFactionBlocks(lines);
  const idx = blocks.findIndex(b => b.name === name);
  const j = idx + dir;
  if (idx < 0 || j < 0 || j >= blocks.length) return raw;
  const order = blocks.map((_, k) => k);
  [order[idx], order[j]] = [order[j], order[idx]];
  const head = lines.slice(0, blocks[0].start);
  const tail = lines.slice(blocks[blocks.length - 1].end);
  const body = order.flatMap(k => lines.slice(blocks[k].start, blocks[k].end));
  return [...head, ...body, ...tail].join('\n');
}