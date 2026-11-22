/**
 * Political map view for the regions layer.
 *
 * Every province is filled with the primary colour of the faction that owns it,
 * and a province border is drawn in that faction's secondary colour. Sea, and any
 * pixel that belongs to no region, stays transparent so the terrain layers below
 * remain visible. City (black) and port (white) pixels are kept as they are.
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

/** Recoloured RGBA copy of the regions layer pixels. */
export function politicalMapPixels(data, width, height, styles) {
  const out = new Uint8ClampedArray(width * height * 4);
  const palette = [];
  const indexByKey = new Map();
  for (const [key, style] of styles) {
    indexByKey.set(key, palette.length);
    palette.push(style);
  }

  const ids = new Int32Array(width * height);
  for (let p = 0; p < ids.length; p++) {
    const i = p * 4;
    const index = indexByKey.get(colourKey(data[i], data[i + 1], data[i + 2]));
    ids[p] = index === undefined ? -1 : index;
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      const i = p * 4;
      const id = ids[p];
      if (id < 0) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        // Reserved settlement (black) and port (white) markers stay visible.
        if ((r < 12 && g < 12 && b < 12) || (r > 243 && g > 243 && b > 243)) {
          out[i] = r; out[i + 1] = g; out[i + 2] = b; out[i + 3] = 255;
        }
        continue;
      }
      // A border pixel touches a pixel of a different province.
      const differs = (nx, ny) => {
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) return false;
        const neighbour = ids[ny * width + nx];
        return neighbour >= 0 && neighbour !== id;
      };
      const border = differs(x - 1, y) || differs(x + 1, y) || differs(x, y - 1) || differs(x, y + 1);
      const colour = border ? palette[id].border : palette[id].fill;
      out[i] = colour[0]; out[i + 1] = colour[1]; out[i + 2] = colour[2]; out[i + 3] = 255;
    }
  }
  return out;
}