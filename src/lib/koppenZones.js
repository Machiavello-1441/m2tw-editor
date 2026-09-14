/**
 * Köppen-Geiger zones with their default M2TW climate mapping and the
 * pixel colours koppen.earth uses in its legend.
 */
export const KOPPEN_ZONES = [
  // Tropical
  { code: 'Af',  label: 'Tropical Rainforest',         group: 'Tropical (A)',   defaultClimate: 'tropical', desc: 'Tropical rainforest climate — hot and wet all year' },
  { code: 'Am',  label: 'Tropical Monsoon',            group: 'Tropical (A)',   defaultClimate: 'tropical', desc: 'Tropical monsoon climate — short, pronounced dry season' },
  { code: 'Aw',  label: 'Tropical Savanna',            group: 'Tropical (A)',   defaultClimate: 'tropical', desc: 'Tropical savanna climate — dry winter' },
  { code: 'As',  label: 'Tropical Savanna (Dry Summer)', group: 'Tropical (A)', defaultClimate: 'tropical', desc: 'Tropical savanna climate — dry summer (rare)' },
  // Arid
  { code: 'BWh', label: 'Hot Desert',                  group: 'Arid (B)',       defaultClimate: 'sandy_desert', desc: 'Hot desert climate' },
  { code: 'BWk', label: 'Cold Desert',                 group: 'Arid (B)',       defaultClimate: 'rocky_desert', desc: 'Cold desert climate' },
  { code: 'BSh', label: 'Hot Steppe',                  group: 'Arid (B)',       defaultClimate: 'steppe',       desc: 'Hot semi-arid steppe climate' },
  { code: 'BSk', label: 'Cold Steppe',                 group: 'Arid (B)',       defaultClimate: 'steppe',       desc: 'Cold semi-arid steppe climate' },
  // Temperate
  { code: 'Csa', label: 'Mediterranean (Hot Summer)',  group: 'Temperate (C)',  defaultClimate: 'mediterranean',     desc: 'Mediterranean climate — hot, dry summer' },
  { code: 'Csb', label: 'Mediterranean (Warm Summer)', group: 'Temperate (C)',  defaultClimate: 'mediterranean',     desc: 'Mediterranean climate — warm, dry summer' },
  { code: 'Csc', label: 'Mediterranean (Cold Summer)', group: 'Temperate (C)',  defaultClimate: 'mediterranean',     desc: 'Mediterranean climate — cool, dry summer' },
  { code: 'Cwa', label: 'Humid Subtropical (Dry Winter)', group: 'Temperate (C)', defaultClimate: 'tropical', desc: 'Humid subtropical climate — dry winter, hot summer' },
  { code: 'Cwb', label: 'Subtropical Highland (Dry Winter)', group: 'Temperate (C)', defaultClimate: 'highland', desc: 'Subtropical highland climate — dry winter' },
  { code: 'Cwc', label: 'Subpolar Oceanic (Dry Winter)', group: 'Temperate (C)', defaultClimate: 'highland', desc: 'Cold subtropical highland climate — dry winter' },
  { code: 'Cfa', label: 'Humid Subtropical',           group: 'Temperate (C)',  defaultClimate: 'temperate_grassland', desc: 'Humid subtropical climate — hot summer, no dry season' },
  { code: 'Cfb', label: 'Oceanic',                     group: 'Temperate (C)',  defaultClimate: 'temperate_deciduous',  desc: 'Oceanic climate — warm summer, no dry season' },
  { code: 'Cfc', label: 'Subpolar Oceanic',            group: 'Temperate (C)',  defaultClimate: 'temperate_coniferous', desc: 'Subpolar oceanic climate — cool summer, no dry season' },
  // Continental
  { code: 'Dsa', label: 'Continental (Hot, Dry Summer)',      group: 'Continental (D)', defaultClimate: 'mediterranean',          desc: 'Humid continental climate — hot summer, dry summer' },
  { code: 'Dsb', label: 'Continental (Warm, Dry Summer)',     group: 'Continental (D)', defaultClimate: 'mediterranean',          desc: 'Humid continental climate — warm summer, dry summer' },
  { code: 'Dsc', label: 'Continental (Cool, Dry Summer)',     group: 'Continental (D)', defaultClimate: 'steppe',                 desc: 'Humid continental climate — cool summer, dry summer' },
  { code: 'Dsd', label: 'Continental (Very Cold, Dry Summer)', group: 'Continental (D)', defaultClimate: 'alpine',                 desc: 'Humid continental climate — very cold winter, dry summer' },
  { code: 'Dwa', label: 'Continental (Hot, Dry Winter)',      group: 'Continental (D)', defaultClimate: 'temperate_grassland',    desc: 'Humid continental climate — dry winter, hot summer' },
  { code: 'Dwb', label: 'Continental (Warm, Dry Winter)',     group: 'Continental (D)', defaultClimate: 'temperate_deciduous',    desc: 'Humid continental climate — dry winter, warm summer' },
  { code: 'Dwc', label: 'Continental (Cool, Dry Winter)',     group: 'Continental (D)', defaultClimate: 'temperate_coniferous',   desc: 'Humid continental climate — dry winter, cool summer' },
  { code: 'Dwd', label: 'Continental (Very Cold, Dry Winter)', group: 'Continental (D)', defaultClimate: 'alpine',                desc: 'Humid continental climate — dry winter, very cold' },
  { code: 'Dfa', label: 'Humid Continental (Hot Summer)',      group: 'Continental (D)', defaultClimate: 'temperate_grassland',    desc: 'Humid continental climate — hot summer, no dry season' },
  { code: 'Dfb', label: 'Humid Continental (Warm Summer)',     group: 'Continental (D)', defaultClimate: 'temperate_deciduous',    desc: 'Humid continental climate — warm summer, no dry season' },
  { code: 'Dfc', label: 'Subarctic',                          group: 'Continental (D)', defaultClimate: 'temperate_coniferous',   desc: 'Subarctic climate — cool summer, no dry season' },
  { code: 'Dfd', label: 'Subarctic (Severe Winter)',          group: 'Continental (D)', defaultClimate: 'alpine',                 desc: 'Subarctic climate — extremely cold winter' },
  // Polar
  { code: 'ET',  label: 'Tundra',                     group: 'Polar (E)',      defaultClimate: 'alpine', desc: 'Tundra climate' },
  { code: 'EF',  label: 'Ice Cap',                    group: 'Polar (E)',      defaultClimate: 'alpine', desc: 'Ice cap climate' },
];

// koppen.earth pixel RGB values for each zone (from their published legend)
export const KOPPEN_RGB = {
  Af:  [0,   0,   255], Am:  [0,   120, 255], Aw:  [70,  170, 250], As:  [112, 168, 0],
  BWh: [255, 0,   0  ], BWk: [255, 150, 150], BSh: [245, 165, 0  ], BSk: [255, 220, 100],
  Csa: [255, 255, 0  ], Csb: [200, 200, 0  ], Csc: [150, 150, 0  ],
  Cwa: [150, 255, 150], Cwb: [100, 200, 100], Cwc: [50,  150, 50 ],
  Cfa: [200, 255, 80 ], Cfb: [100, 255, 80 ], Cfc: [50,  200, 50 ],
  Dsa: [255, 0,    255], Dsb: [200, 0,    200], Dsc: [150, 50, 150 ], Dsd: [150, 100, 150],
  Dwa: [170, 175, 255], Dwb: [90,  120, 220], Dwc: [75,  80,  180], Dwd: [50,  0,   135],
  Dfa: [0,   255, 255], Dfb: [55,  200, 255], Dfc: [0,   125, 125], Dfd: [0,   70,  95 ],
  ET:  [178, 178, 178], EF:  [102, 102, 102],
};

export const rgbToHex = ([r, g, b]) => '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');