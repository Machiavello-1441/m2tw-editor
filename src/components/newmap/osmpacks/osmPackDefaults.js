const groups = {
  forest_sparse: ['forest', 'wood'], wilderness: ['scrub', 'heath', 'moor', 'cemetery'],
  fertile_high: ['farmland', 'meadow', 'orchard', 'allotments', 'village_green', 'garden'],
  fertile_medium: ['grassland', 'farmyard', 'vineyard'], fertile_low: ['residential', 'park'],
  swamp: ['water', 'river', 'riverbank', 'reservoir', 'lake', 'pond', 'wetland', 'marsh', 'swamp', 'bog', 'fen', 'reedbed', 'mangrove'],
  beach: ['beach', 'sand', 'tidalflat', 'shingle'], mountains_high: ['glacier', 'bare_rock'], mountains_low: ['quarry', 'scree'], impassable_land: ['industrial'],
};
export const defaultGround = Object.fromEntries(Object.entries(groups).flatMap(([ground, names]) => names.map(name => [name, ground])));
export const layerLabel = name => name.replace(/^gis_osm_/, '').replace(/_a_free_\d+$/i, '').replace(/_/g, ' ');
export const humanSize = bytes => bytes ? `${(bytes / (bytes >= 1073741824 ? 1073741824 : 1048576)).toFixed(1)} ${bytes >= 1073741824 ? 'GiB' : 'MiB'}` : 'Size unavailable';
export const colorHex = rgb => '#' + rgb.map(value => value.toString(16).padStart(2, '0')).join('');