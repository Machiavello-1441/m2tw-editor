/**
 * M2TW Map Layer definitions and canonical color palettes
 * Colors sourced from TWC Wiki official documentation.
 */

export const LAYER_DEFS = [
  {
    id: 'map_regions',
    label: 'Regions',
    filename: 'map_regions.tga',
    mode: 'rgb',
    description: 'Region boundaries. Each unique RGB = one region. Sea = RGB 41,140,233. City = black pixel. Port = white pixel.',
    multiplier: 1,
    defaultColor: '#298ce9', // sea color RGB 41,140,233
  },
  {
    id: 'map_features',
    label: 'Features',
    filename: 'map_features.tga',
    mode: 'rgb',
    description: 'Rivers = pure blue (0,0,255). Fords = cyan (0,255,255). River source = white (255,255,255). Land-bridges = green (0,255,0). Cliffs = yellow (255,255,0). Volcanoes = red (255,0,0).',
    multiplier: 1,
    defaultColor: '#0000ff', // river blue
  },
  {
    id: 'map_heights',
    label: 'Heightmap',
    filename: 'map_heights.tga',
    mode: 'grayscale',
    description: 'Terrain elevation. Grayscale 1–255 for land. Sea = RGB 0,0,253. Size = 2×regions + 1px each axis.',
    multiplier: 2,
    defaultColor: '#808080',
  },
  {
    id: 'map_climates',
    label: 'Climates',
    filename: 'map_climates.tga',
    mode: 'rgb',
    description: 'Climate zone per tile. Use exact canonical RGB values. Size = 2×regions + 1px each axis.',
    multiplier: 2,
    defaultColor: '#ec008c', // mediterranean
  },
  {
    id: 'map_ground_types',
    label: 'Ground Types',
    filename: 'map_ground_types.tga',
    mode: 'rgb',
    description: 'Terrain type per tile. Use exact canonical RGB values. Size = 2×regions + 1px each axis.',
    multiplier: 2,
    defaultColor: '#008080', // fertile low
  },
  {
    id: 'map_roughness',
    label: 'Roughness',
    filename: 'map_roughness.tga',
    mode: 'grayscale',
    description: 'Terrain roughness. Grayscale. Size = 2×regions + 1px each axis.',
    multiplier: 2,
    defaultColor: '#9e9e9e',
  },
  {
    id: 'water_surface',
    label: 'Water Surface',
    filename: 'water_surface.tga',
    mode: 'rgb',
    description: 'Sea colouring layer. Same size as map_regions.',
    multiplier: 1,
    defaultColor: '#00008f',
  },
];

/** Canonical M2TW climate colors — from descr_climates.txt / TWC Wiki */
export const CLIMATE_PALETTE = [
  { id: 'mediterranean',            label: 'Mediterranean',         color: '#ec008c', rgb: [236,   0, 140] },
  { id: 'sandy_desert',             label: 'Sandy Desert',          color: '#662d91', rgb: [102,  45, 145] },
  { id: 'rocky_desert',             label: 'Rocky Desert',          color: '#92278f', rgb: [146,  39, 143] },
  { id: 'steppe',                   label: 'Steppe (infertile)',    color: '#ed1c24', rgb: [237,  28,  36] },
  { id: 'temperate_deciduous',      label: 'Temp. Deciduous Forest',color: '#f26522', rgb: [242, 101,  34] },
  { id: 'temperate_coniferous',     label: 'Temp. Coniferous Forest',color:'#f7941d', rgb: [247, 148,  29] },
  { id: 'highland',                 label: 'Highland',              color: '#8dc63f', rgb: [141, 198,  63] },
  { id: 'alpine',                   label: 'Alpine',                color: '#39b54a', rgb: [ 57, 181,  74] },
  { id: 'tropical',                 label: 'Tropical (sub-arctic)', color: '#00a651', rgb: [  0, 166,  81] },
  { id: 'semi_arid',                label: 'Semi-Arid',             color: '#0072bc', rgb: [  0, 114, 188] },
];

/** Canonical M2TW ground type colors — from TWC Wiki (Myrddraal's key) */
export const GROUND_TYPE_PALETTE = [
  { id: 'fertile_low',      label: 'Fertile Low',      color: '#008080', rgb: [  0, 128, 128] },
  { id: 'fertile_medium',   label: 'Fertile Medium',   color: '#60a040', rgb: [ 96, 160,  64] },
  { id: 'fertile_high',     label: 'Fertile High',     color: '#657c00', rgb: [101, 124,   0] },
  { id: 'wilderness',       label: 'Wilderness',        color: '#000000', rgb: [  0,   0,   0] },
  { id: 'mountains_high',   label: 'Mountains High',   color: '#c48080', rgb: [196, 128, 128] },
  { id: 'mountains_low',    label: 'Mountains Low',    color: '#624141', rgb: [ 98,  65,  65] },
  { id: 'hills',            label: 'Hills',             color: '#808040', rgb: [128, 128,  64] },
  { id: 'forest_dense',     label: 'Forest Dense',     color: '#004000', rgb: [  0,  64,   0] },
  { id: 'forest_sparse',    label: 'Forest Sparse',    color: '#008000', rgb: [  0, 128,   0] },
  { id: 'swamp',            label: 'Swamp',             color: '#00ff80', rgb: [  0, 255, 128] },
  { id: 'ocean',            label: 'Ocean',             color: '#400000', rgb: [ 64,   0,   0] },
  { id: 'sea_deep',         label: 'Sea Deep',          color: '#800000', rgb: [128,   0,   0] },
  { id: 'sea_shallow',      label: 'Sea Shallow',       color: '#c40000', rgb: [196,   0,   0] },
  { id: 'beach',            label: 'Beach',             color: '#ffffff', rgb: [255, 255, 255] },
  { id: 'impassable_land',  label: 'Impassable Land',  color: '#404040', rgb: [ 64,  64,  64] },
  { id: 'impassable_sea',   label: 'Impassable Sea',   color: '#000040', rgb: [  0,   0,  64] },
];

/** Canonical map_features colors */
export const FEATURES_PALETTE = [
  { id: 'river',       label: 'River',         color: '#0000ff', rgb: [  0,   0, 255] },
  { id: 'ford',        label: 'Ford / Crossing',color: '#00ffff', rgb: [  0, 255, 255] },
  { id: 'river_source',label: 'River Source',  color: '#ffffff', rgb: [255, 255, 255] },
  { id: 'landbridge',  label: 'Land-Bridge',   color: '#00ff00', rgb: [  0, 255,   0] },
  { id: 'cliff',       label: 'Cliff',          color: '#ffff00', rgb: [255, 255,   0] },
  { id: 'volcano',     label: 'Volcano',        color: '#ff0000', rgb: [255,   0,   0] },
  { id: 'empty',       label: 'Empty (no feature)', color: '#000000', rgb: [0, 0, 0] },
];

/**
 * Get pixel dimensions for a layer given the user-specified regions map size.
 * map_regions & map_features: exactly mapWidth × mapHeight
 * All x2 layers: (mapWidth * 2 + 1) × (mapHeight * 2 + 1)
 */
export function getLayerDimensions(layerDef, mapWidth, mapHeight) {
  const w = mapWidth ?? 512;
  const h = mapHeight ?? mapWidth ?? 512;
  if (layerDef.multiplier === 2) {
    return { width: w * 2 + 1, height: h * 2 + 1 };
  }
  return { width: w, height: h };
}

export function createBlankImageData(width, height, color = [0, 0, 0, 255]) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = `rgba(${color[0]},${color[1]},${color[2]},1)`;
  ctx.fillRect(0, 0, width, height);
  return ctx.getImageData(0, 0, width, height);
}

export function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return [r, g, b];
}

export function rgbToHex(r, g, b) {
  return '#' + [r,g,b].map(v => v.toString(16).padStart(2,'0')).join('');
}