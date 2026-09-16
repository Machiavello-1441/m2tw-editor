/**
 * Composes the 3D terrain's colour map: for every ground-types pixel it picks
 * the texture that its (climate × ground type) pair resolves to in
 * descr_aerial_map_ground_types.txt, tiled at the file's texture_density.
 * Pixels with no texture fall back to a flat ground-type colour.
 */
import { parseAerialGroundTypes, spanForDensity, resolveGroundTexture } from '@/lib/aerialGroundTypes';
import { parseDescrClimatesColours, DESCR_CLIMATES_KEY, AERIAL_RAW_KEY } from '@/lib/modClimates';

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

/**
 * Builds { span, tiles: Map<'climateId|groundKey', imageData>, climateById }
 * for every climate/ground combination actually present on the maps.
 */
export async function buildTileCache({ groundData, climatesData, w, h, season, groundTextures }) {
  let aerialRaw = '', climatesRaw = '';
  try {
    aerialRaw   = localStorage.getItem(AERIAL_RAW_KEY) || '';
    climatesRaw = localStorage.getItem(DESCR_CLIMATES_KEY) || '';
  } catch {}
  if (!aerialRaw || !groundTextures || !groundData) return null;

  const { density, climates } = parseAerialGroundTypes(aerialRaw);
  // climate map pixel colour → climate codename
  const climateByColour = {};
  for (const c of parseDescrClimatesColours(climatesRaw)) climateByColour[`${c.r},${c.g},${c.b}`] = c.id;

  // Collect the (climate, ground) pairs that actually occur.
  const pairs = new Set();
  for (let i = 0; i < w * h; i++) {
    const b = i * 4;
    const gKey = `${groundData[b]},${groundData[b + 1]},${groundData[b + 2]}`;
    const cKey = climatesData ? `${climatesData[b]},${climatesData[b + 1]},${climatesData[b + 2]}` : '';
    pairs.add(`${climateByColour[cKey] || ''}|${gKey}`);
  }

  const tiles = {};
  const byFile = {};
  for (const pair of pairs) {
    const [climateId, gKey] = pair.split('|');
    const block = climates[climateId] || climates[Object.keys(climates)[0]];
    const texName = resolveGroundTexture(block, gKey, season);
    if (!texName) continue;
    const url = groundTextures[texKey(texName)];
    if (!url) continue;
    byFile[texKey(texName)] = byFile[texKey(texName)] || loadImageData(url);
    const img = await byFile[texKey(texName)];
    if (img) tiles[pair] = img;
  }

  return { span: spanForDensity(density), tiles, climateByColour, density };
}

/**
 * Per-pixel lookup used while filling the terrain canvas.
 * `i`/`j` are map-pixel coordinates and may be FRACTIONAL: the canvas is
 * supersampled, so a single map pixel covers several texels of the tile. Using
 * integers here is what made the terrain look like flat coloured squares —
 * each tile only ever showed density×density of its pixels.
 */
export function sampleTile(cache, climatesData, groundKey, srcIdx, i, j) {
  const cKey = climatesData
    ? `${climatesData[srcIdx]},${climatesData[srcIdx + 1]},${climatesData[srcIdx + 2]}`
    : '';
  const tile = cache.tiles[`${cache.climateByColour[cKey] || ''}|${groundKey}`];
  if (!tile) return null;
  const span = cache.span;
  const u = (i % span + span) % span / span;
  const v = (j % span + span) % span / span;
  const tx = Math.min(tile.w - 1, Math.floor(u * tile.w));
  const ty = Math.min(tile.h - 1, Math.floor(v * tile.h));
  const t = (ty * tile.w + tx) * 4;
  return [tile.data[t], tile.data[t + 1], tile.data[t + 2]];
}