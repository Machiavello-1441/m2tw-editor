/**
 * Generates the text files a new strat-map climate needs, per the TWC
 * "How-To: Add a New Climate Zone" tutorial:
 *   descr_climates.txt, descr_climates_lookup.txt, text/climates.txt and
 *   descr_aerial_map_ground_types.txt. Each custom climate is a copy of its
 *   source climate's block, renamed and given its own colour.
 */
import { descrName } from '@/lib/climateStore';
import { VANILLA_DESCR_CLIMATES, VANILLA_TEXT_CLIMATES } from '@/lib/vanillaDescrClimates';
import { hexToRgb } from '@/lib/mapLayerStore';
import { toUtf16leBytes } from '@/lib/utf16';

const BLOCK_RE = /climate\s+(\w+)\s*\{[\s\S]*?\n\}/g;

// name → full "climate name { … }" block text
export function parseClimateBlocks(text) {
  const blocks = {};
  for (const m of text.matchAll(BLOCK_RE)) blocks[m[1]] = m[0];
  return blocks;
}

function colourLine(hex) {
  const { r, g, b } = hexToRgb(hex);
  return `colour\t${r} ${g} ${b}`;
}

function duplicateBlock(src, newName, hex) {
  let block = src.replace(/^climate\s+\w+/, `climate ${newName}`);
  if (hex) block = block.replace(/colour\s+\d+\s+\d+\s+\d+/, colourLine(hex));
  return block;
}

/** descr_climates.txt — list entry + copied block for each custom climate. */
export function buildDescrClimates(sourceText, customs) {
  const text = sourceText || VANILLA_DESCR_CLIMATES;
  const blocks = parseClimateBlocks(text);
  const listMatch = text.match(/climates\s*\{([\s\S]*?)\}/);
  const names = listMatch
    ? listMatch[1].split(/\r?\n/).map(s => s.trim()).filter(s => s && !s.startsWith(';'))
    : Object.keys(blocks);

  const missing = [];
  const added = [];
  let extra = '';
  for (const c of customs) {
    if (blocks[c.id]) continue; // already defined in the source file
    const src = blocks[descrName(c.sourceId)];
    if (!src) { missing.push(c.id); continue; }
    extra += `\n${duplicateBlock(src, c.id, c.color)}\n`;
    added.push(c.id);
  }

  const allNames = [...names, ...added.filter(n => !names.includes(n))];
  const listBlock = `climates\n{\n${allNames.map(n => `\t${n}`).join('\n')}\n}`;
  let out = listMatch ? text.replace(listMatch[0], listBlock) : text;
  out = out.replace(/\s*$/, '\n') + extra;
  return { text: out, names: allNames, missing };
}

/** descr_climates_lookup.txt — one codename per line, same order as the list. */
export function buildLookup(names) {
  return names.join('\n') + '\n';
}

/** text/climates.txt — UTF-16LE with BOM, vanilla entries + the new ones. */
export function buildTextClimates(customs) {
  const lines = [...VANILLA_TEXT_CLIMATES, ...customs.map(c => `{${c.id}}${c.label}`)];
  return toUtf16leBytes(lines.join('\r\n') + '\r\n');
}

/** descr_aerial_map_ground_types.txt — needs the mod's file as source. */
export function buildAerialGroundTypes(sourceText, customs) {
  if (!sourceText) return null;
  const blocks = parseClimateBlocks(sourceText);
  let out = sourceText.replace(/\s*$/, '\n');
  const missing = [];
  for (const c of customs) {
    if (blocks[c.id]) continue;
    const src = blocks[descrName(c.sourceId)];
    if (!src) { missing.push(c.id); continue; }
    out += `\n${duplicateBlock(src, c.id, null)}\n`;
  }
  return { text: out, missing };
}