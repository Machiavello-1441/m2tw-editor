/**
 * Paint presets per layer.
 * Each preset is { label, r, g, b }
 * Heights layer uses slider-based UI instead (handled in toolbar).
 */

export const LAYER_PRESETS = {
  ground: [
    { label: 'Fertile Low',          r: 0,   g: 128, b: 128 },
    { label: 'Fertile Medium',       r: 96,  g: 160, b: 64  },
    { label: 'Fertile High',         r: 101, g: 124, b: 0   },
    { label: 'Wilderness',           r: 0,   g: 0,   b: 0   },
    { label: 'Mountains High',       r: 196, g: 128, b: 128 },
    { label: 'Mountains Low',        r: 98,  g: 65,  b: 65  },
    { label: 'Hills',                r: 128, g: 128, b: 64  },
    { label: 'Forest Dense',         r: 0,   g: 64,  b: 0   },
    { label: 'Forest Sparse',        r: 0,   g: 128, b: 0   },
    { label: 'Swamp',                r: 0,   g: 255, b: 128 },
    { label: 'Beach',                r: 255, g: 255, b: 255 },
    { label: 'Impassable Land',      r: 64,  g: 64,  b: 64  },
    { label: 'Impassable Sea',       r: 0,   g: 0,   b: 64  },
    { label: 'Ocean',                r: 64,  g: 0,   b: 0   },
    { label: 'Sea Deep',             r: 128, g: 0,   b: 0   },
    { label: 'Sea Shallow',          r: 196, g: 0,   b: 0   },
  ],
  climates: [
    { label: 'Mediterranean',              r: 236, g: 0,   b: 140 },
    { label: 'Sandy Desert',              r: 102, g: 45,  b: 145 },
    { label: 'Rocky Desert',             r: 146, g: 39,  b: 143 },
    { label: 'Temperate Grass Fertile',  r: 237, g: 20,  b: 91  },
    { label: 'Steppe',                   r: 237, g: 28,  b: 36  },
    { label: 'Temperate Decid. Forest',  r: 242, g: 101, b: 34  },
    { label: 'Temperate Conif. Forest',  r: 247, g: 148, b: 29  },
    { label: 'Swamp',                    r: 255, g: 242, b: 0   },
    { label: 'Highland',                 r: 141, g: 198, b: 63  },
    { label: 'Alpine',                   r: 57,  g: 181, b: 74  },
    { label: 'Tropical',                 r: 0,   g: 166, b: 81  },
    { label: 'Semi-Arid',               r: 0,   g: 114, b: 188 },
  ],
  features: [
    { label: 'River',        r: 0,   g: 0,   b: 255 },
    { label: 'Ford',         r: 0,   g: 255, b: 255 },
    { label: 'River Origin', r: 255, g: 255, b: 255 },
    { label: 'Cliff',        r: 255, g: 255, b: 0   },
    { label: 'Land-bridge',  r: 0,   g: 255, b: 0   },
    { label: 'Volcano',      r: 255, g: 0,   b: 0   },
    { label: 'Erase (bg)',   r: 0,   g: 0,   b: 0   },
  ],
  regions: [
    { label: 'City',  r: 0,   g: 0,   b: 0   },
    { label: 'Port',  r: 255, g: 255, b: 255 },
  ],
};