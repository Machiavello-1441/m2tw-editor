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
import { parseAerialGroundTypes, resolveGroundTexture, GROUND_ALIASES } from '@/lib/aerialGroundTypes';
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
    // Fallback: the engine's own naming convention <climate>_<season>_<ground>.tga,
    // trying the palette id and every known alias for this ground colour.
    if (!url) {
      const aliases = [groundId, ...(GROUND_ALIASES[gKey] || [])].filter(Boolean);
      for (const a of aliases) {
        url = groundTextures[`${blockName}_${season}_${a}`.toLowerCase()];
        if (url) break;
      }
    }
    if (!url) continue;

    byFile[url] = byFile[url] || loadImageData(url);
    const img = await byFile[url];
    if (img) { tiles[pair] = img; matched++; }
  }

  return { ...dims, tiles, density, matched };
}

/**
 * Per-pixel lookup while filling the terrain canvas.
 * `gx`/`gy` are the integer ground pixel; `i`/`j` are the (fractional)
 * supersampled coordinates inside that pixel.
 *
 * Each map pixel selects the TGA for its climate × ground pair, while global
 * map coordinates provide continuous UVs. This repeats each TGA seamlessly
 * across the whole matching area instead of restarting it in every pixel.
 */
export function sampleTile(cache, groundKey, gx, gy, i, j, tileSize = 8) {
  const tile = cache.tiles[`${climateKeyAt(cache, gx, gy)}|${groundKey}`];
  if (!tile) return null;
  const size = Math.max(1, tileSize);
  const u = ((i / size) % 1 + 1) % 1;
  const v = ((j / size) % 1 + 1) % 1;
  // Bilinear filtering keeps the source TGA looking like a surface texture
  // when it is minified onto the terrain instead of exposing individual texels.
  const x = u * tile.w;
  const y = v * tile.h;
  const x0 = Math.floor(x) % tile.w;
  const y0 = Math.floor(y) % tile.h;
  const x1 = (x0 + 1) % tile.w;
  const y1 = (y0 + 1) % tile.h;
  const fx = x - Math.floor(x);
  const fy = y - Math.floor(y);
  const at = (px, py, channel) => tile.data[(py * tile.w + px) * 4 + channel];
  return [0, 1, 2].map(channel => {
    const top = at(x0, y0, channel) * (1 - fx) + at(x1, y0, channel) * fx;
    const bottom = at(x0, y1, channel) * (1 - fx) + at(x1, y1, channel) * fx;
    return Math.round(top * (1 - fy) + bottom * fy);
  });
}