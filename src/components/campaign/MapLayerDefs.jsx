export const LAYER_DEFS = {
  heights: {
    key: 'heights',
    filename: 'map_heights.tga',
    label: 'Heights',
    defaultVisible: true,
    defaultOpacity: 1.0,
    transparentColor: null,
    colors: [
      { label: 'Sea', rgb: [0, 0, 253] },
      { label: 'Land (grayscale 1–255)', rgb: null, isGrayscale: true },
    ],
    description: 'Grayscale heightmap. Blue (0,0,253) = sea. Determines true coastline.'
  },
  ground_types: {
    key: 'ground_types',
    filename: 'map_ground_types.tga',
    label: 'Ground Types',
    defaultVisible: true,
    defaultOpacity: 0.85,
    transparentColor: null,
    colors: [
      { label: 'Fertile Low',        rgb: [0, 128, 128] },
      { label: 'Fertile Medium',     rgb: [96, 160, 64] },
      { label: 'Fertile High',       rgb: [101, 124, 0] },
      { label: 'Wilderness',         rgb: [0, 0, 0] },
      { label: 'Mountains High',     rgb: [196, 128, 128] },
      { label: 'Mountains Low',      rgb: [98, 65, 65] },
      { label: 'Hills',              rgb: [128, 128, 64] },
      { label: 'Forest Dense',       rgb: [0, 64, 0] },
      { label: 'Forest Sparse',      rgb: [0, 128, 0] },
      { label: 'Swamp',              rgb: [0, 255, 128] },
      { label: 'Ocean',              rgb: [64, 0, 0] },
      { label: 'Sea Deep',           rgb: [128, 0, 0] },
      { label: 'Sea Shallow',        rgb: [196, 0, 0] },
      { label: 'Beach',              rgb: [255, 255, 255] },
      { label: 'Impassable Land',    rgb: [64, 64, 64] },
      { label: 'Impassable Sea',     rgb: [0, 0, 64] },
    ]
  },
  climates: {
    key: 'climates',
    filename: 'map_climates.tga',
    label: 'Climates',
    defaultVisible: false,
    defaultOpacity: 0.7,
    transparentColor: null,
    colors: [
      { label: 'Mediterranean',              rgb: [236, 0, 140] },
      { label: 'Sandy Desert',               rgb: [102, 45, 145] },
      { label: 'Rocky Desert',               rgb: [146, 39, 143] },
      { label: 'Temp. Grassland (fertile)',  rgb: [237, 20, 91] },
      { label: 'Steppe',                     rgb: [237, 28, 36] },
      { label: 'Temp. Deciduous Forest',     rgb: [242, 101, 34] },
      { label: 'Temp. Coniferous Forest',    rgb: [247, 148, 29] },
      { label: 'Swamp (unused)',             rgb: [255, 242, 0] },
      { label: 'Highland',                   rgb: [141, 198, 63] },
      { label: 'Alpine',                     rgb: [57, 181, 74] },
      { label: 'Tropical',                   rgb: [0, 166, 81] },
      { label: 'Semi-Arid',                  rgb: [0, 114, 188] },
    ]
  },
  regions: {
    key: 'regions',
    filename: 'map_regions.tga',
    label: 'Regions',
    defaultVisible: true,
    defaultOpacity: 0.5,
    transparentColor: null,
    colors: [
      { label: 'City pixel',       rgb: [0, 0, 0] },
      { label: 'Port pixel',       rgb: [255, 255, 255] },
      { label: 'Sea (default)',    rgb: [41, 140, 233] },
    ],
    description: 'Each region = unique color. Black=city, White=port.'
  },
  features: {
    key: 'features',
    filename: 'map_features.tga',
    label: 'Features',
    defaultVisible: true,
    defaultOpacity: 1.0,
    transparentColor: [0, 0, 0],
    colors: [
      { label: 'River',                 rgb: [0, 0, 255] },
      { label: 'Ford',                  rgb: [0, 255, 255] },
      { label: 'River Origin',          rgb: [255, 255, 255] },
      { label: 'Cliff',                 rgb: [255, 255, 0] },
      { label: 'Land Bridge (M2TW)',    rgb: [0, 255, 0] },
      { label: 'Volcano',               rgb: [255, 0, 0] },
      { label: 'Background (transp.)',  rgb: [0, 0, 0] },
    ]
  },
  fog: {
    key: 'fog',
    filename: 'map_fog.tga',
    label: 'Fog of War',
    defaultVisible: false,
    defaultOpacity: 0.5,
    transparentColor: [255, 255, 255],
    colors: [
      { label: 'Fog / Hidden', rgb: [0, 0, 0] },
      { label: 'Visible',      rgb: [255, 255, 255] },
    ]
  },
};

export const LAYER_ORDER = ['heights', 'ground_types', 'climates', 'regions', 'features', 'fog'];

export const TGA_FILENAMES = Object.fromEntries(
  Object.entries(LAYER_DEFS).map(([k, v]) => [v.filename, k])
);

export function makeDefaultLayerSettings() {
  const out = {};
  for (const key of LAYER_ORDER) {
    out[key] = {
      visible: LAYER_DEFS[key].defaultVisible,
      opacity: LAYER_DEFS[key].defaultOpacity,
    };
  }
  // Regions-specific overlay mode
  out.regions.overlayMode = false;
  out.regions.highlightColor = null; // [r,g,b] of selected region color
  return out;
}