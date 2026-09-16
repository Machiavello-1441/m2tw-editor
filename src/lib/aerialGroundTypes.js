/**
 * descr_aerial_map_ground_types.txt parser.
 *
 * File shape (one block per climate, ground-type rows inside):
 *
 *   texture_density 4          ; optional M2EX root directive, 0.25 – 8, default 1
 *
 *   temperate_grassland
 *   {
 *      fertile_low    grass_summer.tga   grass_winter.tga
 *      hills          hills_summer.tga
 *   }
 *
 * texture_density says how many ground-type pixels one texture spans:
 * 8 = the whole texture fits in a single pixel, lower values stretch it over
 * more pixels before it tiles again. Span in pixels = 8 / density.
 */

const DENSITY_RE = /^[ \t]*texture_density[ \t]+([\d.]+)/mi;

export function parseAerialGroundTypes(text) {
  const climates = {};
  const dm = text.match(DENSITY_RE);
  const density = dm ? Math.min(8, Math.max(0.25, parseFloat(dm[1]) || 1)) : 1;

  const lines = text.split(/\r?\n/);
  let current = null, pending = null;
  for (const raw of lines) {
    const line = raw.replace(/;.*$/, '').trim();
    if (!line) continue;
    if (line === '{') { current = pending ? (climates[pending] = climates[pending] || {}) : null; continue; }
    if (line === '}') { current = null; pending = null; continue; }
    if (current) {
      const parts = line.split(/\s+/).filter(Boolean);
      if (parts.length >= 2) {
        const tgas = parts.slice(1).filter(p => /\.tga$/i.test(p));
        if (tgas.length) current[parts[0].toLowerCase()] = { summer: tgas[0], winter: tgas[1] || null };
      }
      continue;
    }
    if (/^texture_density/i.test(line)) continue;
    pending = line.split(/\s+/)[0].toLowerCase();
  }
  return { density, climates };
}

/** How many ground-type pixels one texture tile covers. */
export const spanForDensity = (density) => Math.max(1, 8 / (density || 1));

// map_ground_types pixel colour → the ground-type row names it may appear under
export const GROUND_ALIASES = {
  '0,128,128':   ['cultivated_low', 'fertile_low', 'farmland_low'],
  '96,160,64':   ['cultivated_medium', 'fertile_medium', 'farmland_medium'],
  '101,124,0':   ['cultivated_high', 'fertile_high', 'farmland_high'],
  '0,0,0':       ['wilderness', 'scrub', 'grass'],
  '64,64,64':    ['impassable_land', 'impassable'],
  '0,64,0':      ['forest_dense', 'dense_forest'],
  '0,128,0':     ['forest_sparse', 'sparse_forest', 'forest'],
  '128,128,64':  ['hills'],
  '196,128,128': ['mountains_high', 'high_mountains', 'mountain_high'],
  '98,65,65':    ['mountains_low', 'low_mountains', 'mountain_low'],
  '0,255,128':   ['swamp'],
  '255,255,255': ['beach', 'sand'],
};

const norm = (s) => s.replace(/[_\s]/g, '');

/** Resolve one ground colour inside one climate block to its texture filename. */
export function resolveGroundTexture(block, colourKey, season, groundId) {
  if (!block) return null;
  const aliases = [groundId, ...(GROUND_ALIASES[colourKey] || [])].filter(Boolean);
  let entry = null;
  for (const a of aliases) {
    if (block[a]) { entry = block[a]; break; }
  }
  if (!entry) {
    const keys = Object.keys(block);
    for (const a of aliases) {
      const hit = keys.find(k => norm(k).includes(norm(a)) || norm(a).includes(norm(k)));
      if (hit) { entry = block[hit]; break; }
    }
  }
  if (!entry) return null;
  return (season === 'winter' && entry.winter) ? entry.winter : entry.summer;
}