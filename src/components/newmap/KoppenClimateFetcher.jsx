import React, { useState, useRef, useEffect } from 'react';
import { Download, ChevronDown, ChevronRight, Eye, EyeOff } from 'lucide-react';
import { CLIMATE_PALETTE, hexToRgb } from '@/lib/mapLayerStore';

/**
 * All Köppen-Geiger climate zones with their default M2TW climate mapping.
 * koppen.earth returns a GeoTIFF/PNG whose pixels are indexed by zone code.
 * We fetch a tile-based PNG snapshot and map each pixel's zone to an M2TW climate color.
 */
const KOPPEN_ZONES = [
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
// Source: https://koppen.earth legend PNG
const KOPPEN_RGB = {
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

const GROUPS = [...new Set(KOPPEN_ZONES.map(z => z.group))];

const CLIMATE_COLOR = Object.fromEntries(CLIMATE_PALETTE.map(p => [p.id, p.color]));
const CLIMATE_LABEL = Object.fromEntries(CLIMATE_PALETTE.map(p => [p.id, p.label]));

// Euclidean RGB distance for nearest-neighbor matching
function rgbDist(a, b) {
  return Math.sqrt((a[0]-b[0])**2 + (a[1]-b[1])**2 + (a[2]-b[2])**2);
}

// Match a pixel's RGB to the closest Köppen zone
function matchKoppen(r, g, b, threshold = 50) {
  let best = null, bestD = Infinity;
  for (const [code, rgb] of Object.entries(KOPPEN_RGB)) {
    const d = rgbDist([r, g, b], rgb);
    if (d < bestD) { bestD = d; best = code; }
  }
  return bestD <= threshold ? best : null;
}

function latToMercN(lat) {
  return Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360));
}

export default function KoppenClimateFetcher({ bbox, climateLayer, onLayerUpdate, mapWidth, mapHeight }) {
  const [expanded, setExpanded] = useState(false);
  const [zoneMap, setZoneMap] = useState(() =>
    Object.fromEntries(KOPPEN_ZONES.map(z => [z.code, z.defaultClimate]))
  );
  const [openGroups, setOpenGroups] = useState({});
  const [status, setStatus] = useState('');
  const [fetching, setFetching] = useState(false);
  const [hiddenZones, setHiddenZones] = useState(new Set());
  const climateLayerRef = useRef(climateLayer);
  useEffect(() => { climateLayerRef.current = climateLayer; }, [climateLayer]);

  const toggleGroup = (g) => setOpenGroups(s => ({ ...s, [g]: !s[g] }));

  // koppen.earth serves its Köppen map through a terrakio WMS (EPSG:3857) backend
  // using the Beck 2018 classification (cmap "koppen", values 1–30). The WMS itself
  // does not send CORS headers, so we load via blob-URL image fetch with CORS-proxy
  // fallbacks — blob-URL images are same-origin, so getImageData never taints.
  const WMS_BASE = 'https://terrakio-server-wms-lark-573248941006.australia-southeast1.run.app/wms';
  const WMS_KEY = 'dzK6YcYlYjlXsI7k5r2pv1EPHpQ1-7GHPizDazLMy4c';

  // Compute request dimensions that match the bbox's true Web-Mercator aspect
  // (so the WMS server doesn't quietly resample / letterbox ↔ detail loss or distortion).
  const computeWmsDimensions = (targetMaxSide) => {
    const R = 6378137;
    const mercW = R * (bbox.east - bbox.west) * Math.PI / 180;
    const mercH = R * (latToMercN(bbox.north) - latToMercN(bbox.south));
    const aspect = mercW / mercH; // requested width : height
    const t = Math.max(64, targetMaxSide);
    const W = Math.round(aspect >= 1 ? t : t * aspect);
    const H = Math.round(aspect >= 1 ? t / aspect : t);
    return { W: Math.max(8, W), H: Math.max(8, H) };
  };

  const buildWmsURL = (W, H) => {
    const R = 6378137;
    const westX = R * bbox.west * Math.PI / 180;
    const eastX = R * bbox.east * Math.PI / 180;
    const northY = R * Math.log(Math.tan(Math.PI / 4 + bbox.north * Math.PI / 360));
    const southY = R * Math.log(Math.tan(Math.PI / 4 + bbox.south * Math.PI / 360));
    const params = new URLSearchParams({
      service: 'WMS', request: 'GetMap', layers: 'koppen', styles: '',
      format: 'image/png', transparent: 'false', version: '1.1.1',
      expression: 'CMIP6Koppen.reanalysis@(year=2020)',
      cmap: 'koppen', vmin: '1', vmax: '30',
      'api-key': WMS_KEY,
      width: String(W), height: String(H), srs: 'EPSG:3857',
      bbox: `${westX},${southY},${eastX},${northY}`,
    });
    return `${WMS_BASE}?${params.toString()}`;
  };

  const fetchAsImage = async (urls) => {
    for (const u of urls) {
      try {
        const res = await fetch(u, { mode: 'cors' });
        if (!res.ok) continue;
        const blob = await res.blob();
        if (!blob || blob.size < 100) continue;
        const obj = URL.createObjectURL(blob);
        try {
          return await new Promise((resolve, reject) => {
            const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = obj;
          });
        } finally { URL.revokeObjectURL(obj); }
      } catch { /* try next source */ }
    }
    return null;
  };

  const fetchAndApply = async () => {
    if (!bbox) { setStatus('No bounding box defined.'); return; }
    setFetching(true);
    setStatus('Fetching Köppen data (terreserv WMS)…');
    try {
      // Request an image whose width:height matches the bbox's true
      // Web-Mercator aspect — the server then returns that exact resolution,
      // so no aspect resampling skews our sampling.
      const targetSide = Math.min(2048, Math.max(512, Math.max(mapWidth, mapHeight) * 2 + 1));
      const { W, H } = computeWmsDimensions(targetSide);
      const raw = buildWmsURL(W, H);
      const img = await fetchAsImage([
        raw,
        `https://corsproxy.io/?url=${encodeURIComponent(raw)}`,
        `https://api.allorigins.win/raw?url=${encodeURIComponent(raw)}`,
      ]);
      if (!img) { setStatus('Köppen fetch failed — WMS service unavailable.'); setFetching(false); return; }
      applyKoppenImage(img);
    } catch (e) {
      setStatus(`Error: ${e.message}`);
      setFetching(false);
    }
  };

  const applyKoppenImage = (img) => {
    // CRITICAL: sample from the WMS image at ITS NATURAL aspect — never
    // pre-stretch into an arbitrary W×H canvas, or rows/cols get skewed
    // before sampling (which produced the diagonal mismatch with terrain).
    const nW = img.naturalWidth || img.width;
    const nH = img.naturalHeight || img.height;
    const srcCanvas = document.createElement('canvas');
    srcCanvas.width = nW; srcCanvas.height = nH;
    const srcCtx = srcCanvas.getContext('2d');
    srcCtx.imageSmoothingEnabled = false;
    srcCtx.drawImage(img, 0, 0, nW, nH);
    const srcData = srcCtx.getImageData(0, 0, nW, nH);

    // Target: climates layer (2×+1 scaled)
    const cW = mapWidth * 2 + 1, cH = mapHeight * 2 + 1;
    const base = climateLayerRef.current?.imageData;
    const out = base
      ? new ImageData(new Uint8ClampedArray(base.data), base.width, base.height)
      : new ImageData(cW, cH);

    let painted = 0;
    for (let cy = 0; cy < cH; cy++) {
      const fy = cy / (cH - 1);
      const sy = Math.round(fy * (nH - 1));
      for (let cx = 0; cx < cW; cx++) {
        const fx = cx / (cW - 1);
        const sx = Math.round(fx * (nW - 1));
        const si = (sy * nW + sx) * 4;
        const r = srcData.data[si], g = srcData.data[si + 1], b = srcData.data[si + 2], a = srcData.data[si + 3];
        if (a < 10) continue; // transparent = sea/unmapped

        const code = matchKoppen(r, g, b);
        if (!code) continue;
        if (hiddenZones.has(code)) continue;

        const climId = zoneMap[code] ?? 'temperate_grassland';
        const hex = CLIMATE_COLOR[climId] ?? '#ed145b';
        const { r: cr, g: cg, b: cb } = hexToRgb(hex);

        const oi = (cy * cW + cx) * 4;
        out.data[oi] = cr; out.data[oi + 1] = cg; out.data[oi + 2] = cb; out.data[oi + 3] = 255;
        painted++;
      }
    }

    onLayerUpdate('climates', { imageData: out, visible: true, opacity: 1, dirty: true });
    setStatus(`Done — painted ${painted.toLocaleString()} pixels from Köppen data (${nW}×${nH}).`);
    setFetching(false);
  };

  return (
    <div className="rounded border border-slate-700 bg-slate-900/60">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-2 py-1.5 text-[10px] text-slate-300 font-semibold hover:bg-slate-800/60 transition-colors">
        <span className="flex items-center gap-1.5">
          {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          Köppen Climate Fetch
        </span>
        <span className="text-[9px] text-slate-500">koppen.earth</span>
      </button>

      {expanded && (
        <div className="px-2 pb-2 space-y-2 border-t border-slate-700/50">
          <p className="text-[9px] text-slate-500 pt-1.5 leading-relaxed">
            Fetch Köppen-Geiger climate zones from <span className="text-slate-300">koppen.earth</span> and map each zone to an M2TW climate. Then click Apply to paint the climates layer.
          </p>

          {/* Zone mapping list */}
          <div className="space-y-1">
            {GROUPS.map(group => (
              <div key={group} className="rounded border border-slate-700/60 overflow-hidden">
                <button
                  onClick={() => toggleGroup(group)}
                  className="w-full flex items-center justify-between px-2 py-1 bg-slate-800/60 hover:bg-slate-700/60 transition-colors">
                  <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">{group}</span>
                  {openGroups[group] ? <ChevronDown className="w-2.5 h-2.5 text-slate-500" /> : <ChevronRight className="w-2.5 h-2.5 text-slate-500" />}
                </button>

                {openGroups[group] && (
                  <div className="divide-y divide-slate-800">
                    {KOPPEN_ZONES.filter(z => z.group === group).map(zone => {
                      const climId = zoneMap[zone.code];
                      const isHidden = hiddenZones.has(zone.code);
                      return (
                        <div key={zone.code} className="bg-slate-900">
                          <div className="flex items-center gap-1.5 px-1.5 pt-1">
                            {/* Köppen pixel color swatch */}
                            <div
                              className="w-3 h-3 rounded-sm shrink-0 border border-slate-700"
                              style={{ backgroundColor: `rgb(${KOPPEN_RGB[zone.code]?.join(',') ?? '128,128,128'})` }}
                              title={`Köppen pixel color for ${zone.code}`}
                            />
                            <span className="text-[9px] font-mono text-slate-500 w-7 shrink-0">{zone.code}</span>
                            <span className="text-[9px] text-slate-300 flex-1 truncate">{zone.label}</span>
                            {/* Arrow */}
                            <span className="text-[9px] text-slate-600">→</span>
                            {/* M2TW climate color swatch */}
                            <div
                              className="w-3 h-3 rounded-sm shrink-0 border border-slate-600"
                              style={{ backgroundColor: CLIMATE_COLOR[climId] ?? '#888' }}
                            />
                            {/* Climate selector */}
                            <select
                              value={climId}
                              onChange={e => setZoneMap(m => ({ ...m, [zone.code]: e.target.value }))}
                              className="h-5 text-[9px] bg-slate-800 border border-slate-600 rounded text-slate-200 focus:outline-none focus:border-amber-500 max-w-[100px]">
                              {CLIMATE_PALETTE.map(p => (
                                <option key={p.id} value={p.id}>{p.label}</option>
                              ))}
                            </select>
                            {/* Visibility toggle */}
                            <button
                              onClick={() => setHiddenZones(prev => {
                                const next = new Set(prev);
                                if (next.has(zone.code)) next.delete(zone.code); else next.add(zone.code);
                                return next;
                              })}
                              title={isHidden ? 'Include zone' : 'Exclude zone'}
                              className={`shrink-0 ${isHidden ? 'text-slate-600' : 'text-slate-400'} hover:text-white transition-colors`}>
                              {isHidden ? <EyeOff className="w-2.5 h-2.5" /> : <Eye className="w-2.5 h-2.5" />}
                            </button>
                          </div>
                          {/* Short explanation */}
                          <p className="px-2.5 pb-1 -mt-0.5 text-[8.5px] italic text-slate-500 leading-tight">{zone.desc}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Reset defaults */}
          <button
            onClick={() => setZoneMap(Object.fromEntries(KOPPEN_ZONES.map(z => [z.code, z.defaultClimate])))}
            className="text-[9px] px-2 py-0.5 rounded bg-slate-700 text-slate-400 hover:bg-slate-600 border border-slate-600 transition-colors">
            Reset to Defaults
          </button>

          {/* Status */}
          {status && (
            <p className={`text-[9px] leading-snug ${status.startsWith('Done') ? 'text-green-400' : status.includes('failed') || status.includes('error') ? 'text-red-400' : 'text-amber-400'}`}>
              {status}
            </p>
          )}

          {/* Apply button */}
          <button
            onClick={fetchAndApply}
            disabled={fetching || !bbox}
            className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-[10px] bg-blue-700 border border-blue-600 text-white hover:bg-blue-600 disabled:opacity-50 transition-colors font-semibold">
            <Download className={`w-3 h-3 ${fetching ? 'animate-spin' : ''}`} />
            {fetching ? status || 'Fetching…' : 'Fetch & Apply Köppen Data'}
          </button>

          {!bbox && <p className="text-[9px] text-slate-600 italic">No bounding box — go back to area selection.</p>}
        </div>
      )}
    </div>
  );
}