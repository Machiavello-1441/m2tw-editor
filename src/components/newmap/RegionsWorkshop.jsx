import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Search, Plus, Trash2, Download, MapPin, Anchor, Wand2, X } from 'lucide-react';
import SettlementBoundaryButton from './SettlementBoundaryButton';
import { paintBoundary } from './boundaryRasterizer';

function randomRgb(used) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const r = 10 + Math.floor(Math.random() * 240);
    const g = 10 + Math.floor(Math.random() * 240);
    const b = 10 + Math.floor(Math.random() * 240);
    if (r === 0 && g === 0 && b === 0) continue;
    if (r > 250 && g > 250 && b > 250) continue;
    if (r < 5 && g < 5 && b > 200) continue;
    const key = `${r},${g},${b}`;
    if (!used.has(key)) { used.add(key); return [r, g, b]; }
  }
  return [Math.floor(Math.random() * 255), Math.floor(Math.random() * 255), Math.floor(Math.random() * 255)];
}

function paintRegionPixels(imageData, cx, cy, rgb) {
  const { data, width, height } = imageData;
  const set = (x, y, r, g, b) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const i = (y * width + x) * 4;
    data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255;
  };
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      set(cx + dx, cy + dy, rgb[0], rgb[1], rgb[2]);
    }
  set(cx, cy, 0, 0, 0);
}

function latToMercN(lat) {
  return Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360));
}

// Classify a Nominatim result into a short, color-coded tag so visually
// identical results (e.g. "Trapani, Sicily" as a city, a commune, a province
// and a metropolitan area) become distinguishable.
function classifyNominatimResult(r) {
  const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
  const at = (r.addresstype || r.type || '').toLowerCase();
  const lvl = r.extratags && r.extratags.admin_level ? parseInt(r.extratags.admin_level, 10) : null;
  if (r.osm_type === 'node') {
    if (['city', 'town', 'village', 'hamlet', 'suburb', 'neighbourhood'].includes(at))
      return { label: cap(at), cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' };
    return { label: 'Settlement', cls: 'bg-amber-500/10 text-amber-200 border-amber-500/20' };
  }
  if (r.class === 'boundary' || r.type === 'administrative' || lvl !== null) {
    if (lvl === 2) return { label: 'Country', cls: 'bg-rose-500/15 text-rose-300 border-rose-500/30' };
    if (lvl === 4 || lvl === 5) return { label: 'Region', cls: 'bg-violet-500/20 text-violet-300 border-violet-500/30' };
    if (lvl === 6 || lvl === 7) return { label: 'Province', cls: 'bg-sky-500/20 text-sky-300 border-sky-500/30' };
    if (lvl === 8) return { label: 'Commune', cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' };
    if (lvl === 9 || lvl === 10 || lvl === 11) return { label: 'District', cls: 'bg-emerald-500/10 text-emerald-200 border-emerald-500/20' };
    if (at === 'state' || at === 'region') return { label: 'Region', cls: 'bg-violet-500/20 text-violet-300 border-violet-500/30' };
    if (at === 'county') return { label: 'Province', cls: 'bg-sky-500/20 text-sky-300 border-sky-500/30' };
    return { label: 'Admin', cls: 'bg-slate-500/20 text-slate-300 border-slate-500/30' };
  }
  if (['city', 'town', 'village', 'hamlet'].includes(at))
    return { label: cap(at), cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' };
  return { label: at ? cap(at) : 'Place', cls: 'bg-slate-500/15 text-slate-300 border-slate-500/25' };
}

function latLngToPixel(lat, lng, bbox, width, height) {
  const mercNorth = latToMercN(bbox.north);
  const mercSouth = latToMercN(bbox.south);
  const px = Math.round(((lng - bbox.west) / (bbox.east - bbox.west)) * (width - 1));
  const py = Math.round(((mercNorth - latToMercN(lat)) / (mercNorth - mercSouth)) * (height - 1));
  return { px, py };
}

/**
 * RegionsWorkshop — settlement search and placement only.
 * Settlements are lifted to parent so state survives tab switches.
 */
export default function RegionsWorkshop({
  bbox, layers, onLayerUpdate, mapWidth, mapHeight,
  settlements, onSettlementsChange, onAssetReady,
  portTarget, onRequestPort, onCancelPort, onRemovePort,
}) {
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [status, setStatus] = useState('');
  const usedColors = useRef(new Set());

  const layersRef = useRef(layers);
  useEffect(() => { layersRef.current = layers; }, [layers]);

  const settlementsRef = useRef(settlements);
  useEffect(() => { settlementsRef.current = settlements; }, [settlements]);

  // Sync used colors from existing settlements on mount
  useEffect(() => {
    settlements.forEach(s => usedColors.current.add(`${s.rgb[0]},${s.rgb[1]},${s.rgb[2]}`));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-export regions txt whenever settlements change
  useEffect(() => {
    if (!onAssetReady || !settlements.length) return;
    const lines = [`; map_regions.txt — generated by M2TW New Map Editor`, `; province_name  r g b  city_x city_y  port_x port_y`, ``];
    settlements.forEach(s => {
      const [r, g, b] = s.rgb;
      lines.push(`${s.name}  ${r} ${g} ${b}  ${s.px} ${s.py}  ${s.portX ?? 0} ${s.portY ?? 0}`);
    });
    onAssetReady({ filename: 'map_regions.txt', type: 'txt', getData: () => lines.join('\n') });
  }, [settlements, onAssetReady]);

  const searchSettlements = async () => {
    if (!query.trim() || !bbox) return;
    setSearching(true);
    setStatus('Searching Nominatim…');
    try {
      const bboxStr = `${bbox.west},${bbox.south},${bbox.east},${bbox.north}`;
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=jsonv2&limit=12&bounded=1&viewbox=${bboxStr}&extratags=1&addressdetails=1`;
      const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
      const data = await res.json();
      setSearchResults(data);
      setStatus(data.length === 0 ? 'No results found.' : `${data.length} result(s) found.`);
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
    const displayName = result.display_name.split(',')[0];
    const settlement = { name, displayName, lat, lng, rgb, px, py, osmId: result.osm_id, osmType: result.osm_type };

    const newSettlements = [...settlementsRef.current, settlement];
    onSettlementsChange(newSettlements);
    setSearchResults([]);
    setQuery('');
    setStatus('');

    // Paint city dot onto regions layer
    const layer = layersRef.current.regions;
    if (layer?.imageData) {
      const copy = new ImageData(new Uint8ClampedArray(layer.imageData.data), layer.imageData.width, layer.imageData.height);
      paintRegionPixels(copy, px, py, rgb);
      onLayerUpdate('regions', { imageData: copy, visible: true, opacity: layer.opacity ?? 1, dirty: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bbox, mapWidth, mapHeight, onLayerUpdate, onSettlementsChange]);

  // Paint the lowest-order administrative boundary of `result` using the
  // last placed settlement's colour, without creating a new settlement and
  // without drawing a black dot — i.e. add land to an already-placed
  // settlement by merging this boundary into its region colour.
  const mergeToLast = useCallback(async (result) => {
    const last = settlementsRef.current[settlementsRef.current.length - 1];
    if (!last) {
      setStatus('Add at least one settlement first, then use Merge.');
      return;
    }
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    setSearching(true);
    setStatus(`Painting boundary with ${last.displayName}'s colour…`);
    try {
      await paintBoundary({
        lat, lng,
        osmId: result.osm_id, osmType: result.osm_type,
        rgb: last.rgb, drawDot: false,
        bbox, layers: layersRef.current, onLayerUpdate, mapWidth, mapHeight,
      });
      setSearchResults([]);
      setQuery('');
      setStatus('');
    } catch (e) {
      setStatus(`Merge error: ${e.message}`);
    } finally {
      setSearching(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bbox, onLayerUpdate, mapWidth, mapHeight]);

  const removeSettlement = (idx) => {
    const next = settlements.filter((_, i) => i !== idx);
    onSettlementsChange(next);
    const layer = layersRef.current.regions;
    if (!layer?.imageData) return;
    const w = layer.imageData.width, h = layer.imageData.height;
    const fresh = new ImageData(w, h);
    const srcData = layer.imageData.data;
    for (let i = 0; i < srcData.length; i += 4) {
      if (srcData[i] === 0 && srcData[i + 1] === 0 && srcData[i + 2] === 255) {
        fresh.data[i] = 0; fresh.data[i + 1] = 0; fresh.data[i + 2] = 255; fresh.data[i + 3] = 255;
      }
    }
    next.forEach(s => paintRegionPixels(fresh, s.px, s.py, s.rgb));
    // Re-apply any white port pixels for the surviving settlements.
    next.forEach(s => {
      if (s.portX != null) {
        const i = (s.portY * w + s.portX) * 4;
        fresh.data[i] = 255; fresh.data[i + 1] = 255; fresh.data[i + 2] = 255; fresh.data[i + 3] = 255;
      }
    });
    onLayerUpdate('regions', { imageData: fresh, visible: true, opacity: 1, dirty: true });
  };

  const exportRegionsTxt = () => {
    const lines = [`; map_regions.txt — generated by M2TW New Map Editor`, `; province_name  r g b  city_x city_y  port_x port_y`, ``];
    settlements.forEach(s => {
      const [r, g, b] = s.rgb;
      lines.push(`${s.name}  ${r} ${g} ${b}  ${s.px} ${s.py}  ${s.portX ?? 0} ${s.portY ?? 0}`);
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'map_regions.txt'; a.click();
  };

  const initBlankRegions = () => {
    const w = mapWidth, h = mapHeight;
    const blank = new ImageData(w, h);
    const heightsData = layers.heights?.imageData?.data;
    const heightsW = layers.heights?.imageData?.width ?? 0;
    const heightsH = layers.heights?.imageData?.height ?? 0;
    if (heightsData && heightsW > 0) {
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const srcX = Math.round((x / (w - 1)) * (heightsW - 1));
          const srcY = Math.round((y / (h - 1)) * (heightsH - 1));
          const si = (srcY * heightsW + srcX) * 4;
          if (heightsData[si] === 0 && heightsData[si + 1] === 0 && heightsData[si + 2] === 255) {
            const di = (y * w + x) * 4;
            blank.data[di] = 0; blank.data[di + 1] = 0; blank.data[di + 2] = 255; blank.data[di + 3] = 255;
          }
        }
      }
    }
    onLayerUpdate('regions', { imageData: blank, visible: true, opacity: 1, dirty: true });
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
              <div className="bg-slate-800 border border-slate-700 rounded max-h-52 overflow-y-auto">
                {searchResults.map((r, i) => {
                  const tag = classifyNominatimResult(r);
                  const parts = (r.display_name || '').split(',').map(s => s.trim());
                  const top = parts[0] || r.name || '';
                  const sub = parts.slice(1, 3).join(', ');
                  const lastSettle = settlements[settlements.length - 1];
                  return (
                    <div key={i}
                      className="px-2 py-1.5 hover:bg-slate-700 border-b border-slate-700 last:border-0 flex items-start gap-1.5 transition-colors">
                      <MapPin className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-slate-200 truncate flex-1">{top}</span>
                          <span className={`shrink-0 px-1 py-0.5 rounded text-[8px] font-semibold leading-none border ${tag.cls}`}
                            title={r.extratags && r.extratags.admin_level ? `admin_level ${r.extratags.admin_level}` : tag.label}>
                            {tag.label}{r.extratags && r.extratags.admin_level ? ` ${r.extratags.admin_level}` : ''}
                          </span>
                        </div>
                        {sub && <div className="text-[9px] text-slate-500 truncate">{sub}</div>}
                        <div className="flex gap-1 mt-1">
                          <button onClick={() => addSettlement(r)}
                            title="Add as a separate settlement (new colour + black dot)"
                            className="flex-1 flex items-center justify-center gap-1 px-1 py-0.5 rounded text-[9px] bg-amber-600 text-white hover:bg-amber-500 transition-colors font-semibold">
                            <Plus className="w-2.5 h-2.5" /> Add settlement
                          </button>
                          <button onClick={() => mergeToLast(r)} disabled={!lastSettle}
                            title={lastSettle ? `Colour this boundary with ${lastSettle.displayName}'s colour (adds land — no new black dot)` : 'Add at least one settlement first'}
                            className="flex-1 flex items-center justify-center gap-1 px-1 py-0.5 rounded text-[9px] bg-violet-700 text-white hover:bg-violet-600 disabled:opacity-40 transition-colors font-semibold">
                            <Wand2 className="w-2.5 h-2.5" /> Merge to last
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

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
                  <div key={i} className="bg-slate-800 border border-slate-700 rounded px-2 py-1.5 space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-sm shrink-0 border border-slate-600"
                        style={{ backgroundColor: `rgb(${s.rgb[0]},${s.rgb[1]},${s.rgb[2]})` }} />
                      <span className="text-[10px] text-slate-300 flex-1 truncate">{s.displayName}</span>
                      <span className="text-[9px] text-slate-600 font-mono shrink-0">{s.px},{s.py}</span>
                      <button onClick={() => removeSettlement(i)}
                        className="text-slate-600 hover:text-red-400 transition-colors shrink-0">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                    <SettlementBoundaryButton
                      settlement={s}
                      bbox={bbox}
                      layers={layers}
                      onLayerUpdate={onLayerUpdate}
                      mapWidth={mapWidth}
                      mapHeight={mapHeight}
                    />
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => portTarget === s ? onCancelPort && onCancelPort() : onRequestPort && onRequestPort(s)}
                        disabled={!bbox || !onRequestPort}
                        className={`flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded text-[9px] border transition-colors font-semibold
                          ${portTarget === s ? 'bg-amber-600 border-amber-500 text-white' : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600 disabled:opacity-50'}`}>
                        <Anchor className="w-3 h-3" />
                        {portTarget === s
                          ? 'Cancel — click map to set port'
                          : (s.portX != null ? `Move port (${s.portX},${s.portY})` : 'Set port (click map)')}
                      </button>
                      {s.portX != null && portTarget !== s && onRemovePort && (
                        <button onClick={() => onRemovePort(s)}
                          title="Remove port"
                          className="px-1.5 py-1 rounded text-[9px] bg-slate-700 border border-slate-600 text-red-400 hover:bg-slate-600 transition-colors shrink-0">
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-[9px] text-slate-500 leading-relaxed">
            Search and place settlement dots on the regions map. Use the paint tool to fill region areas manually.
          </p>
        </>
      )}
    </div>
  );
}