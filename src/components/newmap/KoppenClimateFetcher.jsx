import React, { useState, useRef, useEffect } from 'react';
import { Download, ChevronDown, ChevronRight, Eye, EyeOff } from 'lucide-react';
import { hexToRgb } from '@/lib/mapLayerStore';
import { KOPPEN_ZONES, KOPPEN_RGB } from '@/lib/koppenZones';
import { useClimatePalette, useCustomClimates } from '@/lib/climateStore';

const GROUPS = [...new Set(KOPPEN_ZONES.map(z => z.group))];

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
  const palette = useClimatePalette();
  const customs = useCustomClimates();
  const CLIMATE_COLOR = Object.fromEntries(palette.map(p => [p.id, p.color]));
  // Custom climates created from a Köppen zone can take that zone 1:1
  const koppenCustoms = customs.filter(c => c.koppenCode);
  const useKoppenCustoms = () => setZoneMap(m => {
    const next = { ...m };
    for (const c of koppenCustoms) next[c.koppenCode] = c.id;
    return next;
  });
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

    // Target: climates layer (2×+1 scaled) — always use canonical dimensions
    // so an imported (wrong-size) base layer doesn't propagate its wrong size.
    const cW = mapWidth * 2 + 1, cH = mapHeight * 2 + 1;
    const base = climateLayerRef.current?.imageData;
    let out;
    if (base && base.width === cW && base.height === cH) {
      out = new ImageData(new Uint8ClampedArray(base.data), cW, cH);
    } else if (base) {
      // Resize the existing layer to the correct dimensions (nearest-neighbour)
      const srcCanvas = document.createElement('canvas');
      srcCanvas.width = base.width; srcCanvas.height = base.height;
      srcCanvas.getContext('2d').putImageData(base, 0, 0);
      const dstCanvas = document.createElement('canvas');
      dstCanvas.width = cW; dstCanvas.height = cH;
      const dstCtx = dstCanvas.getContext('2d');
      dstCtx.imageSmoothingEnabled = false;
      dstCtx.drawImage(srcCanvas, 0, 0, cW, cH);
      out = dstCtx.getImageData(0, 0, cW, cH);
    } else {
      out = new ImageData(cW, cH);
    }

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
                              {palette.map(p => (
                                <option key={p.id} value={p.id}>{p.custom ? '★ ' : ''}{p.label}</option>
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

          {/* Reset defaults / use custom Köppen climates */}
          <div className="flex gap-1">
            <button
              onClick={() => setZoneMap(Object.fromEntries(KOPPEN_ZONES.map(z => [z.code, z.defaultClimate])))}
              className="text-[9px] px-2 py-0.5 rounded bg-slate-700 text-slate-400 hover:bg-slate-600 border border-slate-600 transition-colors">
              Reset to Defaults
            </button>
            {koppenCustoms.length > 0 && (
              <button
                onClick={useKoppenCustoms}
                title="Map each zone to its own custom climate (same RGB as the Köppen legend)"
                className="text-[9px] px-2 py-0.5 rounded bg-violet-800/60 text-violet-200 hover:bg-violet-700/60 border border-violet-600 transition-colors">
                Use custom Köppen climates ({koppenCustoms.length})
              </button>
            )}
          </div>

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