/**
 * M2TW Map Layer definitions and palette data
 */

export const LAYER_DEFS = [
  {
    id: 'map_regions',
    label: 'Regions',
    filename: 'map_regions.tga',
    mode: 'rgb',
    description: 'Region boundaries. Each unique color = one region.',
    multiplier: 1,
    defaultColor: '#3a7ebf',
  },
  {
    id: 'map_heights',
    label: 'Heightmap',
    filename: 'map_heights.tga',
    mode: 'grayscale',
    description: 'Terrain elevation. 8-bit grayscale.',
    multiplier: 2,
    defaultColor: '#808080',
  },
  {
    id: 'map_climates',
    label: 'Climates',
    filename: 'map_climates.tga',
    mode: 'rgb',
    description: 'Climate zones per region.',
    multiplier: 2,
    defaultColor: '#4caf50',
  },
  {
    id: 'map_ground_types',
    label: 'Ground Types',
    filename: 'map_ground_types.tga',
    mode: 'rgb',
    description: 'Terrain type per tile.',
    multiplier: 2,
    defaultColor: '#8d6e63',
  },
  {
    id: 'map_features',
    label: 'Features',
    filename: 'map_features.tga',
    mode: 'rgb',
    description: 'Rivers, cliffs, volcanoes.',
    multiplier: 1,
    defaultColor: '#2196f3',
  },
  {
    id: 'map_roughness',
    label: 'Roughness',
    filename: 'map_roughness.tga',
    mode: 'grayscale',
    description: 'Terrain roughness layer.',
    multiplier: 2,
    defaultColor: '#9e9e9e',
  },
  {
    id: 'water_surface',
    label: 'Water Surface',
    filename: 'water_surface.tga',
    mode: 'rgb',
    description: 'Sea colouring layer.',
    multiplier: 1,
    defaultColor: '#1565c0',
  },
];

export const CLIMATE_PALETTE = [
  { id: 0, label: 'Temperate',   color: '#4caf50' },
  { id: 1, label: 'Arid',        color: '#f9a825' },
  { id: 2, label: 'Desert',      color: '#ffcc02' },
  { id: 3, label: 'Alpine',      color: '#90caf9' },
  { id: 4, label: 'Continental', color: '#a5d6a7' },
  { id: 5, label: 'Tropical',    color: '#66bb6a' },
  { id: 6, label: 'Semi-Arid',   color: '#ffa726' },
  { id: 7, label: 'Mediterranean','color': '#8bc34a' },
];

export const GROUND_TYPE_PALETTE = [
  { id: 0, label: 'Plains',    color: '#a5d6a7' },
  { id: 1, label: 'Forest',    color: '#2e7d32' },
  { id: 2, label: 'Mountains', color: '#757575' },
  { id: 3, label: 'Desert',    color: '#ffe082' },
  { id: 4, label: 'Snow',      color: '#e3f2fd' },
  { id: 5, label: 'Marsh',     color: '#558b2f' },
  { id: 6, label: 'Scrub',     color: '#9ccc65' },
  { id: 7, label: 'Mud',       color: '#8d6e63' },
  { id: 8, label: 'Sand',      color: '#fff176' },
  { id: 9, label: 'Beach',     color: '#f9a825' },
];

/** Resolutions (base = map_regions size) */
export const PRESET_RESOLUTIONS = [
  { label: 'Vanilla (512×512)', base: 512 },
  { label: 'Large (1024×1024)', base: 1024 },
  { label: 'M2EX (2048×2048)', base: 2048 },
];

export function getLayerDimensions(layerDef, baseResolution) {
  if (layerDef.multiplier === 2) {
    return { width: baseResolution * 2 + 1, height: baseResolution * 2 + 1 };
  }
  return { width: baseResolution, height: baseResolution };
}

export function createBlankImageData(width, height, color = [0, 0, 0, 255]) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
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