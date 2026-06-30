import React, { useState, useCallback, useRef } from 'react';
import { Search, Plus, Trash2, Download, MapPin, Map } from 'lucide-react';

const OSM_OVERPASS_MIRRORS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

async function fetchOverpass(query) {
  let lastErr;
  for (const mirror of OSM_OVERPASS_MIRRORS) {
    try {
      const res = await fetch(mirror, {
        method: 'POST', mode: 'cors',
        body: 'data=' + encodeURIComponent(query),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) { lastErr = e; }
  }
  throw lastErr ?? new Error('All mirrors failed');
}

/** Rasterize a polygon ring (array of {lat, lon}) onto imageData using toXY mapper. Scanline fill. */
function fillPolygon(imageData, ring, toXY, r, g, b) {
  if (ring.length < 3) return;
  const { data, width, height } = imageData;
  // Build edge table
  const pts = ring.map(p => toXY(p.lat, p.lon));
  let minY = Infinity, maxY = -Infinity;
  for (const [, y] of pts) { if (y < minY) minY = y; if (y > maxY) maxY = y; }
  minY = Math.max(0, Math.floor(minY));
  maxY = Math.min(height - 1, Math.ceil(maxY));

  for (let y = minY; y <= maxY; y++) {
    const intersections = [];
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [x0, y0] = pts[j], [x1, y1] = pts[i];
      if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y)) {
        intersections.push(x0 + (y - y0) / (y1 - y0) * (x1 - x0));
      }
    }
    intersections.sort((a, b) => a - b);
    for (let k = 0; k < intersections.length - 1; k += 2) {
      const xStart = Math.max(0, Math.round(intersections[k]));
      const xEnd = Math.min(width - 1, Math.round(intersections[k + 1]));
      for (let x = xStart; x <= xEnd; x++) {
        const i = (y * width + x) * 4;
        data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255;
      }
    }
  }
}

/** Chain way segments into closed rings (same as BboxLayerGenerator). */
function chainPolylines(polylines) {
  if (!polylines.length) return [];
  const PREC = 5;
  const k = pt => `${pt.lat.toFixed(PREC)},${pt.lon.toFixed(PREC)}`;
  const endpointMap = new Map();
  const used = new Array(polylines.length).fill(false);
  polylines.forEach((pl, idx) => {
    [k(pl[0]), k(pl[pl.length - 1])].forEach(key => {
      if (!endpointMap.has(key)) endpointMap.set(key, []);
    });
    endpointMap.get(k(pl[0])).push({ idx, isStart: true });
    endpointMap.get(k(pl[pl.length - 1])).push({ idx, isStart: false });
  });
  const chains = [];
  for (let start = 0; start < polylines.length; start++) {
    if (used[start]) continue;
    used[start] = true;
    let chain = [...polylines[start]];
    for (let dir = 0; dir < 2; dir++) {
      let extended = true;
      while (extended) {
        extended = false;
        const endPt = dir === 0 ? chain[chain.length - 1] : chain[0];
        for (const { idx, isStart } of (endpointMap.get(k(endPt)) ?? [])) {
          if (used[idx]) continue;
          used[idx] = true;
          const seg = polylines[idx];
          if (dir === 0) chain = chain.concat(isStart ? seg.slice(1) : [...seg].reverse().slice(1));
          else chain = (isStart ? [...seg].reverse() : seg).concat(chain.slice(1));
          extended = true; break;
        }
      }
    }
    chains.push(chain);
  }
  return chains;
}

/**
 * RegionsWorkshop — lets the user search for settlements in the bbox,
 * add them to a list, and place them on the map_regions layer.
 *
 * Each region = 1 black pixel (city) + 8 surrounding pixels in a unique random RGB.
 * Exports descr_regions-format txt.
 */

function randomRgb(used) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const r = 10 + Math.floor(Math.random() * 240);
    const g = 10 + Math.floor(Math.random() * 240);
    const b = 10 + Math.floor(Math.random() * 240);
    // Avoid black, white, pure blue (sea), and already-used colors
    if (r === 0 && g === 0 && b === 0) continue;
    if (r > 250 && g > 250 && b > 250) continue;
    if (r < 5 && g < 5 && b > 200) continue;
    const key = `${r},${g},${b}`;
    if (!used.has(key)) { used.add(key); return [r, g, b]; }
  }
  return [Math.floor(Math.random()*255), Math.floor(Math.random()*255), Math.floor(Math.random()*255)];
}

function paintRegionPixels(imageData, cx, cy, rgb) {
  const { data, width, height } = imageData;
  const set = (x, y, r, g, b) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const i = (y * width + x) * 4;
    data[i] = r; data[i+1] = g; data[i+2] = b; data[i+3] = 255;
  };
  // 8 surrounding pixels = region color
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      set(cx + dx, cy + dy, rgb[0], rgb[1], rgb[2]);
    }
  }
  // Center pixel = black city marker
  set(cx, cy, 0, 0, 0);
}

function latToMercN(lat) {
  const latRad = lat * Math.PI / 180;
  return Math.log(Math.tan(Math.PI / 4 + latRad / 2));
}

function latLngToPixel(lat, lng, bbox, width, height) {
  const mercNorth = latToMercN(bbox.north);
  const mercSouth = latToMercN(bbox.south);
  const px = Math.round(((lng - bbox.west) / (bbox.east - bbox.west)) * (width - 1));
  const py = Math.round(((mercNorth - latToMercN(lat)) / (mercNorth - mercSouth)) * (height - 1));
  return { px, py };
}

export default function RegionsWorkshop({ bbox, layers, onLayerUpdate, mapWidth, mapHeight }) {
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [settlements, setSettlements] = useState([]); // { name, lat, lng, rgb, px, py }
  const [status, setStatus] = useState('');
  const [municipalityStatus, setMunicipalityStatus] = useState({}); // idx → 'fetching'|'done'|string(error)
  const usedColors = useRef(new Set());

  const searchSettlements = async () => {
    if (!query.trim() || !bbox) return;
    setSearching(true);
    setStatus('Searching Nominatim…');
    try {
      const bboxStr = `${bbox.west},${bbox.south},${bbox.east},${bbox.north}`;
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=10&bounded=1&viewbox=${bboxStr}&featuretype=settlement,city,town,village`;
      const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
      const data = await res.json();
      setSearchResults(data);
      setStatus(data.length === 0 ? 'No results found in this area.' : `${data.length} result(s) found.`);
    } catch (e) {
      setStatus(`Search error: ${e.message}`);
    }
    setSearching(false);
  };

  const addSettlement = useCallback((result) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    const { px, py } = latLngToPixel(lat, lng, bbox, mapWidth, mapHeight);
    const rgb = randomRgb(usedColors.current);
    const name = result.display_name.split(',')[0].trim().toLowerCase().replace(/\s+/g, '_');
    const settlement = { name, displayName: result.display_name.split(',')[0], lat, lng, rgb, px, py };
    setSettlements(prev => [...prev, settlement]);

    // Paint onto the regions layer
    const layer = layers.regions;
    if (!layer?.imageData) return;
    const copy = new ImageData(new Uint8ClampedArray(layer.imageData.data), layer.imageData.width, layer.imageData.height);
    paintRegionPixels(copy, px, py, rgb);
    onLayerUpdate('regions', { imageData: copy, visible: true, opacity: 1, dirty: true });
    setSearchResults([]);
    setQuery('');
  }, [bbox, layers, mapWidth, mapHeight, onLayerUpdate]);

  const removeSettlement = (idx) => {
    // Re-paint layer from scratch without this settlement
    setSettlements(prev => {
      const next = prev.filter((_, i) => i !== idx);
      rebuildRegionsLayer(next);
      return next;
    });
  };

  const rebuildRegionsLayer = (list) => {
    const layer = layers.regions;
    if (!layer?.imageData) return;
    const w = layer.imageData.width, h = layer.imageData.height;
    // Start from black canvas
    const fresh = new ImageData(w, h);
    list.forEach(s => paintRegionPixels(fresh, s.px, s.py, s.rgb));
    onLayerUpdate('regions', { imageData: fresh, visible: true, opacity: 1, dirty: true });
  };

  const exportRegionsTxt = () => {
    // Format: province_name  r g b  city_x city_y  0 0 (port x y)
    const lines = settlements.map(s => {
      const [r, g, b] = s.rgb;
      return `${s.name}  ${r} ${g} ${b}  ${s.px} ${s.py}  0 0`;
    });
    const header = `; map_regions.txt — generated by M2TW New Map Editor\n; province_name  r g b  city_x city_y  port_x port_y\n\n`;
    const blob = new Blob([header + lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'map_regions.txt'; a.click();
    URL.revokeObjectURL(url);
  };

  const initBlankRegions = () => {
    const w = mapWidth, h = mapHeight;
    const blank = new ImageData(w, h);

    // Copy sea pixels from the heightmap layer (pure blue = 0,0,255)
    // All other pixels remain transparent so the underlying reference map shows through
    const heightsData = layers.heights?.imageData?.data;
    const heightsW = layers.heights?.imageData?.width ?? 0;
    const heightsH = layers.heights?.imageData?.height ?? 0;

    if (heightsData && heightsW > 0) {
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          // Sample the heightmap (it may be 2x+1 the size, so scale coordinates)
          const srcX = Math.round((x / (w - 1)) * (heightsW - 1));
          const srcY = Math.round((y / (h - 1)) * (heightsH - 1));
          const si = (srcY * heightsW + srcX) * 4;
          const r = heightsData[si], g = heightsData[si + 1], b = heightsData[si + 2];
          // Pure blue pixel = sea
          if (r === 0 && g === 0 && b === 255) {
            const di = (y * w + x) * 4;
            blank.data[di] = 0; blank.data[di + 1] = 0; blank.data[di + 2] = 255; blank.data[di + 3] = 255;
          }
          // else: alpha stays 0 (transparent) — the reference map shows through
        }
      }
    }

    onLayerUpdate('regions', { imageData: blank, visible: true, opacity: 1, dirty: true });
  };

  const fillMunicipality = async (settlement, idx) => {
    const layer = layers.regions;
    if (!layer?.imageData) { setMunicipalityStatus(s => ({ ...s, [idx]: 'No regions layer.' })); return; }

    setMunicipalityStatus(s => ({ ...s, [idx]: 'fetching' }));

    // Search radius ~0.5° around the settlement point
    const pad = 0.5;
    const bboxStr = `${settlement.lat - pad},${settlement.lng - pad},${settlement.lat + pad},${settlement.lng + pad}`;
    const query = `[out:json][timeout:60];\n(\n  way["place"="municipality"](${bboxStr});\n  relation["place"="municipality"](${bboxStr});\n  way["boundary"="administrative"]["admin_level"="8"](${bboxStr});\n  relation["boundary"="administrative"]["admin_level"="8"](${bboxStr});\n);\nout geom;`;

    let elements;
    try {
      const data = await fetchOverpass(query);
      elements = (data.elements || []).filter(e =>
        (e.type === 'way' && e.geometry?.length > 2) ||
        (e.type === 'relation' && e.members?.some(m => m.geometry?.length > 1))
      );
    } catch (e) {
      setMunicipalityStatus(s => ({ ...s, [idx]: `Error: ${e.message}` }));
      return;
    }

    if (!elements.length) {
      setMunicipalityStatus(s => ({ ...s, [idx]: 'No municipality boundary found.' }));
      return;
    }

    const W = mapWidth, H = mapHeight;
    const mercNorth = Math.log(Math.tan(Math.PI / 4 + bbox.north * Math.PI / 360));
    const mercSouth = Math.log(Math.tan(Math.PI / 4 + bbox.south * Math.PI / 360));
    const toXY = (lat, lon) => [
      ((lon - bbox.west) / (bbox.east - bbox.west)) * (W - 1),
      ((mercNorth - Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360))) / (mercNorth - mercSouth)) * (H - 1),
    ];

    const copy = new ImageData(new Uint8ClampedArray(layer.imageData.data), W, H);
    const [r, g, b] = settlement.rgb;

    for (const el of elements) {
      if (el.type === 'way' && el.geometry?.length > 2) {
        fillPolygon(copy, el.geometry, toXY, r, g, b);
      } else if (el.type === 'relation' && el.members) {
        const outerWays = el.members
          .filter(m => m.type === 'way' && m.geometry?.length > 1 && (m.role === 'outer' || m.role === ''))
          .map(m => m.geometry);
        const rings = chainPolylines(outerWays.length ? outerWays
          : el.members.filter(m => m.type === 'way' && m.geometry?.length > 1).map(m => m.geometry));
        for (const ring of rings) fillPolygon(copy, ring, toXY, r, g, b);
      }
    }

    // Re-stamp the black city pixel on top so it's never erased
    paintRegionPixels(copy, settlement.px, settlement.py, settlement.rgb);

    onLayerUpdate('regions', { imageData: copy, visible: true, opacity: 1, dirty: true });
    setMunicipalityStatus(s => ({ ...s, [idx]: 'done' }));
  };

  const hasRegionsLayer = !!layers.regions?.imageData;

  return (
    <div className="space-y-3">
      {!hasRegionsLayer && (
        <button onClick={initBlankRegions}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded text-[11px] bg-blue-700 border border-blue-600 text-white hover:bg-blue-600 transition-colors font-semibold">
          <Plus className="w-3.5 h-3.5" /> Initialize Regions (sea from heightmap)
        </button>
      )}

      {hasRegionsLayer && (
        <>
          {/* Settlement search */}
          <div className="space-y-1.5">
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Search Settlements</p>
            <div className="flex gap-1">
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && searchSettlements()}
                placeholder="e.g. Rome, Paris…"
                className="flex-1 h-7 px-2 text-[11px] bg-slate-800 border border-slate-600 rounded text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500"
              />
              <button onClick={searchSettlements} disabled={searching}
                className="px-2 py-1 rounded bg-amber-600 hover:bg-amber-500 disabled:opacity-50 transition-colors">
                <Search className="w-3.5 h-3.5 text-white" />
              </button>
            </div>
            {status && <p className="text-[9px] text-slate-500">{status}</p>}

            {searchResults.length > 0 && (
              <div className="bg-slate-800 border border-slate-700 rounded max-h-36 overflow-y-auto">
                {searchResults.map((r, i) => (
                  <button key={i} onClick={() => addSettlement(r)}
                    className="w-full text-left px-2 py-1.5 text-[10px] text-slate-300 hover:bg-slate-700 border-b border-slate-700 last:border-0 flex items-center gap-2 transition-colors">
                    <MapPin className="w-3 h-3 text-amber-400 shrink-0" />
                    <span className="truncate">{r.display_name.split(',').slice(0,2).join(',')}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Settlement list */}
          {settlements.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Placed Settlements ({settlements.length})</p>
                <button onClick={exportRegionsTxt}
                  className="flex items-center gap-1 px-2 py-0.5 rounded text-[9px] bg-green-700 border border-green-600 text-white hover:bg-green-600 transition-colors">
                  <Download className="w-3 h-3" /> .txt
                </button>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {settlements.map((s, i) => (
                  <div key={i} className="flex flex-col gap-1 px-2 py-1.5 bg-slate-800 border border-slate-700 rounded">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-sm shrink-0 border border-slate-600"
                        style={{ backgroundColor: `rgb(${s.rgb[0]},${s.rgb[1]},${s.rgb[2]})` }} />
                      <span className="text-[10px] text-slate-300 flex-1 truncate">{s.displayName}</span>
                      <span className="text-[9px] text-slate-600 font-mono shrink-0">{s.px},{s.py}</span>
                      <button
                        onClick={() => fillMunicipality(s, i)}
                        disabled={municipalityStatus[i] === 'fetching'}
                        title="Fill municipality boundary with region colour"
                        className={`shrink-0 flex items-center justify-center w-5 h-5 rounded transition-colors disabled:opacity-40 ${
                          municipalityStatus[i] === 'done'
                            ? 'bg-green-800/50 text-green-400'
                            : municipalityStatus[i] === 'fetching'
                              ? 'bg-blue-800/50 text-blue-400 animate-pulse'
                              : typeof municipalityStatus[i] === 'string'
                                ? 'bg-red-800/50 text-red-400'
                                : 'bg-slate-700/60 text-slate-400 hover:bg-slate-600 hover:text-amber-300'
                        }`}>
                        <Map className="w-2.5 h-2.5" />
                      </button>
                      <button onClick={() => removeSettlement(i)}
                        className="text-slate-600 hover:text-red-400 transition-colors shrink-0">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                    {typeof municipalityStatus[i] === 'string' && municipalityStatus[i] !== 'fetching' && municipalityStatus[i] !== 'done' && (
                      <p className="text-[8px] text-red-400 pl-5">{municipalityStatus[i]}</p>
                    )}
                    {municipalityStatus[i] === 'done' && (
                      <p className="text-[8px] text-green-400 pl-5">Municipality filled ✓</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-[9px] text-slate-500">Each settlement: 1 black city pixel + 8-pixel unique RGB region. You can also paint manually with the brush tool.</p>
        </>
      )}
    </div>
  );
}