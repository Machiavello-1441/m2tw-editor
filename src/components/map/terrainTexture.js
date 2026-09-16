/**
 * Composes the 3D terrain's colour map.
 *
 * For every map_ground_types pixel we cross two source maps:
 *   map_climates.tga     → climate codename (236,0,140 = mediterranean)
 *   map_ground_types.tga → ground type      (0,128,0   = forest_sparse)
 * and the (climate × ground) pair resolves, through
 * descr_aerial_map_ground_types.txt, to one ground tile texture
 * (mediterranean_summer_forest_sparse.tga / mediterranean_winter_...).
 * The tile repeats every `span` ground pixels (texture_density).
 * Pairs with no texture fall back to a flat ground-type colour.
 */
import { parseAerialGroundTypes, spanForDensity, resolveGroundTexture } from '@/lib/aerialGroundTypes';
import { parseDescrClimatesColours, DESCR_CLIMATES_KEY, AERIAL_RAW_KEY } from '@/lib/modClimates';
import { CLIMATE_PALETTE, GROUND_TYPE_PALETTE, hexToRgb } from '@/lib/mapLayerStore';
import { getCustomClimates, descrName } from '@/lib/climateStore';

function loadImageData(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const id = ctx.getImageData(0, 0, img.width, img.height);
      resolve({ data: id.data, w: img.width, h: img.height });
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

const texKey = (name) => name.replace(/\\/g, '/').split('/').pop().replace(/\.tga$/i, '').toLowerCase();
const norm = (s) => String(s).replace(/[_\s]/g, '').toLowerCase();

/** map_climates pixel colour → candidate climate codenames, best first. */
function buildClimateColourMap(climatesRaw) {
  const map = {};
  const add = (r, g, b, names) => {
    const k = `${r},${g},${b}`;
    map[k] = [...new Set([...(map[k] || []), ...names.filter(Boolean)])];
  };
  for (const c of CLIMATE_PALETTE) {
    const { r, g, b } = hexToRgb(c.color);
    add(r, g, b, [c.id, descrName(c.id)]);
  }
  for (const c of getCustomClimates()) {
    const { r, g, b } = hexToRgb(c.color);
    add(r, g, b, [c.id, c.sourceId]);
  }
  // The mod's own descr_climates.txt colours take precedence.
  for (const c of parseDescrClimatesColours(climatesRaw)) {
    const k = `${c.r},${c.g},${c.b}`;
    map[k] = [...new Set([c.id, ...(map[k] || [])])];
  }
  return map;
}

/** map_ground_types pixel colour → ground type id (forest_sparse, hills, …). */
function buildGroundColourMap() {
  const map = {};
  for (const g of GROUND_TYPE_PALETTE) {
    const { r, g: gg, b } = hexToRgb(g.color);
    map[`${r},${gg},${b}`] = g.id;
  }
  return map;
}

/** Find the aerial block for a climate: exact codename first, then fuzzy. */
function findClimateBlock(climates, candidates) {
  const keys = Object.keys(climates);
  for (const c of candidates) if (climates[c]) return [c, climates[c]];
  for (const c of candidates) {
    const hit = keys.find(k => norm(k) === norm(c))
             || keys.find(k => norm(k).includes(norm(c)) || norm(c).includes(norm(k)));
    if (hit) return [hit, climates[hit]];
  }
  return [null, null];
}

/**
 * Climate colour under a given ground pixel. The climates map may have its own
 * resolution, so coordinates are rescaled instead of reusing the ground index —
 * that mismatch is what shifted the tiles across the map.
 */
export function climateKeyAt(cache, gx, gy) {
  const { climatesData, cW, cH, gW, gH } = cache;
  if (!climatesData || !cW || !cH) return '';
  const cx = Math.min(cW - 1, Math.floor(gx * cW / gW));
  const cy = Math.min(cH - 1, Math.floor(gy * cH / gH));
  const b = (cy * cW + cx) * 4;
  return `${climatesData[b]},${climatesData[b + 1]},${climatesData[b + 2]}`;
}

/**
 * Builds the (climate × ground) → tile image cache for every combination that
 * actually occurs on the maps.
 */
export async function buildTileCache({ groundData, gW, gH, climatesData, cW, cH, season, groundTextures }) {
  let aerialRaw = '', climatesRaw = '';
  try {
    aerialRaw   = localStorage.getItem(AERIAL_RAW_KEY) || '';
    climatesRaw = localStorage.getItem(DESCR_CLIMATES_KEY) || '';
  } catch {}
  if (!aerialRaw || !groundTextures || !groundData) return null;

  const { density, climates } = parseAerialGroundTypes(aerialRaw);
  const climateByColour = buildClimateColourMap(climatesRaw);
  const groundByColour  = buildGroundColourMap();
  const dims = { climatesData, cW, cH, gW, gH };

  const pairs = new Set();
  for (let y = 0; y < gH; y++) {
    for (let x = 0; x < gW; x++) {
      const b = (y * gW + x) * 4;
      const gKey = `${groundData[b]},${groundData[b + 1]},${groundData[b + 2]}`;
      pairs.add(`${climateKeyAt(dims, x, y)}|${gKey}`);
    }
  }

  const tiles = {};
  const byFile = {};
  let matched = 0;
  for (const pair of pairs) {
    const [cKey, gKey] = pair.split('|');
    const groundId = groundByColour[gKey];
    if (!groundId) continue;
    const [blockName, block] = findClimateBlock(climates, climateByColour[cKey] || []);
    if (!block) continue;

    // Preferred: the filename the aerial file lists on this ground row.
    const texName = resolveGroundTexture(block, gKey, season, groundId);
    let url = texName ? groundTextures[texKey(texName)] : null;
    // Fallback: the engine's own naming convention <climate>_<season>_<ground>.tga
    if (!url) url = groundTextures[`${blockName}_${season}_${groundId}`.toLowerCase()];
    if (!url) continue;

    byFile[url] = byFile[url] || loadImageData(url);
    const img = await byFile[url];
    if (img) { tiles[pair] = img; matched++; }
  }

  return { ...dims, span: spanForDensity(density), tiles, density, matched };
}

/**
 * Per-pixel lookup while filling the terrain canvas.
 * `gx`/`gy` are the integer ground pixel; `i`/`j` are the (fractional)
 * supersampled coordinates used to walk across the tile.
 */
export function sampleTile(cache, groundKey, gx, gy, i, j) {
  const tile = cache.tiles[`${climateKeyAt(cache, gx, gy)}|${groundKey}`];
  if (!tile) return null;
  const span = cache.span;
  const u = (i % span + span) % span / span;
  const v = (j % span + span) % span / span;
  const tx = Math.min(tile.w - 1, Math.floor(u * tile.w));
  const ty = Math.min(tile.h - 1, Math.floor(v * tile.h));
  const t = (ty * tile.w + tx) * 4;
  return [tile.data[t], tile.data[t + 1], tile.data[t + 2]];
}