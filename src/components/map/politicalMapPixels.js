/**
 * Political map view for the regions layer.
 *
 * Every province is filled with the primary colour of the faction that owns it.
 * Sea, and any pixel that belongs to no region, stays transparent so the terrain
 * layers below remain visible. City (black) and port (white) pixels are kept as
 * they are. Province borders are not painted here: they are drawn as hairline
 * strokes on the pixel edges by politicalBorders.js.
 */

const colourKey = (r, g, b) => (r << 16) | (g << 8) | b;

// Used when a province has no owner, or its owner is missing from
// descr_sm_factions.txt: a muted grey reads as "unclaimed".
const UNOWNED_FILL = [110, 110, 110];
const UNOWNED_BORDER = [40, 40, 40];

/**
 * Region colour key → { fill, border } colours.
 * The owner comes from the region's settlement in descr_strat.txt, falling back
 * to the region's faction creator.
 */
export function buildPoliticalStyles(regionsData, overlayItems, factionColors) {
  const owners = new Map();
  for (const item of overlayItems || []) {
    if (item.category === 'settlement' && item.region && item.faction) owners.set(item.region, item.faction);
  }
  const styles = new Map();
  for (const region of regionsData || []) {
    if (region.r == null || region.g == null || region.b == null) continue;
    const faction = owners.get(region.regionName) || region.factionCreator || '';
    const colours = factionColors?.[faction];
    const primary = colours?.primaryColor;
    const secondary = colours?.secondaryColor;
    styles.set(colourKey(region.r, region.g, region.b), {
      fill: primary ? [primary.r, primary.g, primary.b] : UNOWNED_FILL,
      border: secondary ? [secondary.r, secondary.g, secondary.b] : UNOWNED_BORDER,
    });
  }
  return styles;
}

/** Recoloured RGBA copy of the regions layer pixels — flat faction fills only. */
export function politicalMapPixels(data, width, height, styles) {
  const out = new Uint8ClampedArray(width * height * 4);
  const fills = new Map();
  for (const [key, style] of styles) fills.set(key, style.fill);

  for (let p = 0; p < width * height; p++) {
    const i = p * 4;
    const fill = fills.get(colourKey(data[i], data[i + 1], data[i + 2]));
    if (fill) {
      out[i] = fill[0]; out[i + 1] = fill[1]; out[i + 2] = fill[2]; out[i + 3] = 255;
      continue;
    }
    const r = data[i], g = data[i + 1], b = data[i + 2];
    // Reserved settlement (black) and port (white) markers stay visible.
    if ((r < 12 && g < 12 && b < 12) || (r > 243 && g > 243 && b > 243)) {
      out[i] = r; out[i + 1] = g; out[i + 2] = b; out[i + 3] = 255;
    }
  }
  return out;
}