import React, { useState, useCallback } from 'react';
import { Search, Plus, Wand2, MapPin, Loader2 } from 'lucide-react';

/**
 * OsmRegionSearch — Nominatim-bounded search for a real-world place, with two
 * actions per result:
 *   • "Add region"        → dots map_regions.tga (black center + 8 surrounding
 *                            random-RGB pixels) and creates a region with the
 *                            auto-naming convention `<Name>_Province` /
 *                            `<Name>` / `<Name>_City` / `<Name>`.
 *   • "Boundary → last"  → fetches the OSM municipality polygon and paints it
 *                            onto the regions layer using the most recently
 *                            added region's colour (merging territory into it).
 *
 * Only shown by the parent when the campaign map has a validated BBox.
 */
export default function OsmRegionSearch({ bbox, onAdd, onMergeBoundary, lastRegionLabel, selectedRegionInfo }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [mergeStatus, setMergeStatus] = useState('');
  // The OSM result most recently used to "Add region" — kept so the top-level
  // "Boundary → last" button can paint that same place's boundary without the
  // user having to re-search it.
  const [lastAddedResult, setLastAddedResult] = useState(null);
  // 'last' = paint onto the most recently added region's colour.
  // 'selected' = paint onto the colour of the settlement currently selected
  // in the settlements list (an already-existing region).
  const [target, setTarget] = useState('last');

  const search = useCallback(async (q) => {
    const term = (q ?? query).trim();
    if (!term || !bbox) return;
    setSearching(true);
    setStatus('Searching Nominatim…');
    setMergeStatus('');
    try {
      const bboxStr = `${bbox.west},${bbox.south},${bbox.east},${bbox.north}`;
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(term)}&format=jsonv2&limit=12&bounded=1&viewbox=${bboxStr}&extratags=1&addressdetails=1`;
      const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
      const data = await res.json();
      setResults(data || []);
      setStatus(!data.length ? 'No results in this bbox.' : `${data.length} result(s).`);
    } catch (e) {
      setStatus(`Search error: ${e.message}`);
    } finally {
      setSearching(false);
    }
  }, [query, bbox]);

  const handleAdd = useCallback(async (r) => {
    setBusy(true);
    try {
      await onAdd?.(r);
      setLastAddedResult(r);
      setResults([]);
      setQuery('');
      setStatus('');
    } catch (e) {
      setStatus(`Error: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }, [onAdd]);

  const handleMerge = useCallback(async (r) => {
    setBusy(true);
    setMergeStatus(target === 'selected' ? 'Painting boundary onto selected region…' : 'Painting boundary…');
    try {
      // In 'selected' mode forward the selected settlement's region colour so
      // the polygon is merged onto its existing territory, regardless of which
      // region was added most recently.
      const colorOverride = target === 'selected' && selectedRegionInfo
        ? { r: selectedRegionInfo.r, g: selectedRegionInfo.g, b: selectedRegionInfo.b }
        : undefined;
      await onMergeBoundary?.(r, colorOverride);
      setResults([]);
      setQuery('');
      setStatus('');
      setMergeStatus('');
    } catch (e) {
      setMergeStatus(`Error: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }, [onMergeBoundary, target, selectedRegionInfo]);

  return (
    <div className="rounded-lg border border-blue-600/30 bg-blue-900/10 p-2 space-y-1.5">
      <p className="text-[10px] font-semibold text-blue-300 uppercase tracking-wider flex items-center gap-1">
        <MapPin className="w-3 h-3" /> Add region by place name (OSM)
      </p>
      <p className="text-[9px] text-slate-500 leading-tight">
        Searches within your campaign bbox. "Add region" paints the settlement dot and auto-names
        the province/city. "Boundary → last" paints this place's municipality polygon onto your
        most recent region's colour.
      </p>
      <div className="flex gap-1">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search()}
          placeholder="e.g. Camerino, Spoleto…"
          className="flex-1 h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500"
        />
        <button onClick={search} disabled={searching || busy}
          className="px-2 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50 transition-colors">
          {searching ? <Loader2 className="w-3 h-3 text-white animate-spin" /> : <Search className="w-3 h-3 text-white" />}
        </button>
      </div>
      {/* Paint-target selector: when a settlement is selected in the list, the
          user can choose to merge OSM boundaries onto that region's existing
          colour instead of the most recently added one. */}
      {selectedRegionInfo && (
        <div className="flex flex-wrap gap-1 items-center text-[9px]">
          <span className="text-slate-500 shrink-0">Paint target:</span>
          <button onClick={() => setTarget('last')}
            className={`px-1.5 py-0.5 rounded border transition-colors ${target === 'last' ? 'bg-violet-700 border-violet-600 text-white' : 'border-slate-600/40 text-slate-400 hover:text-slate-200'}`}>
            Last region
          </button>
          <button onClick={() => setTarget('selected')}
            className={`px-1.5 py-0.5 rounded border transition-colors flex items-center gap-1 ${target === 'selected' ? 'bg-amber-600 border-amber-500 text-white' : 'border-slate-600/40 text-slate-400 hover:text-slate-200'}`}>
            <span className="w-2 h-2 rounded-sm border border-white/30" style={{ background: `rgb(${selectedRegionInfo.r},${selectedRegionInfo.g},${selectedRegionInfo.b})` }} />
            Selected
          </button>
        </div>
      )}
      {/* One-click search for the selected settlement's boundaries. */}
      {selectedRegionInfo && (
        <button
          onClick={() => { setTarget('selected'); search(selectedRegionInfo.displayName); }}
          disabled={searching}
          className="w-full flex items-center justify-center gap-1 px-2 py-1 rounded text-[9px] border border-amber-500/40 bg-amber-700/20 text-amber-300 hover:bg-amber-700/40 disabled:opacity-50 transition-colors">
          <Search className="w-2.5 h-2.5" /> Find boundaries for: <span className="font-mono truncate">{selectedRegionInfo.displayName}</span>
        </button>
      )}
      {/* Top-level boundary action — reuses the last OSM result that was used
          to add a region, so you can paint its territory immediately without
          having to search the same settlement again. */}
      {lastAddedResult && (target === 'selected' ? selectedRegionInfo : lastRegionLabel) && (
        <button
          onClick={() => handleMerge(lastAddedResult)}
          disabled={busy}
          title={`Paint the boundary of "${(lastAddedResult.display_name || lastAddedResult.name || '').split(',')[0]}" onto the ${target === 'selected' && selectedRegionInfo ? 'selected region' : 'last region'}`}
          className={`w-full flex items-center justify-center gap-1 px-2 py-1.5 rounded text-[10px] disabled:opacity-40 transition-colors font-semibold ${target === 'selected' && selectedRegionInfo ? 'bg-amber-600 hover:bg-amber-500 text-white' : 'bg-violet-700 hover:bg-violet-600 text-white'}`}>
          <Wand2 className="w-3 h-3" /> {target === 'selected' && selectedRegionInfo ? 'Boundary → selected' : 'Boundary → last'}  <span className={`font-mono text-[9px] truncate ${target === 'selected' && selectedRegionInfo ? 'text-amber-100' : 'text-violet-200'}`}>{(lastAddedResult.display_name || lastAddedResult.name || '').split(',')[0]}</span>
        </button>
      )}
      {status && <p className="text-[9px] text-slate-500">{status}</p>}
      {mergeStatus && <p className="text-[9px] text-amber-400">{mergeStatus}</p>}

      {results.length > 0 && (
        <div className="bg-slate-800 border border-slate-700 rounded max-h-56 overflow-y-auto">
          {results.map((r, i) => {
            const parts = (r.display_name || '').split(',').map(s => s.trim());
            const top = parts[0] || r.name || '';
            const sub = parts.slice(1, 3).join(', ');
            return (
              <div key={i}
                className="px-2 py-1.5 hover:bg-slate-700/60 border-b border-slate-700 last:border-0 flex items-start gap-1.5 transition-colors">
                <MapPin className="w-3 h-3 text-blue-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] text-slate-200 truncate">{top}</div>
                  {sub && <div className="text-[9px] text-slate-500 truncate">{sub}</div>}
                  <div className="flex gap-1 mt-1">
                    <button onClick={() => handleAdd(r)} disabled={busy}
                      title="Paint settlement dot + create region with auto naming"
                      className="flex-1 flex items-center justify-center gap-1 px-1 py-0.5 rounded text-[9px] bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40 transition-colors font-semibold">
                      <Plus className="w-2.5 h-2.5" /> Add region
                    </button>
                    <button onClick={() => handleMerge(r)} disabled={busy || !lastRegionLabel}
                      title={lastRegionLabel ? `Paint this boundary using the last region's colour (${lastRegionLabel})` : 'Add a region first'}
                      className="flex-1 flex items-center justify-center gap-1 px-1 py-0.5 rounded text-[9px] bg-violet-700 text-white hover:bg-violet-600 disabled:opacity-40 transition-colors font-semibold">
                      <Wand2 className="w-2.5 h-2.5" /> Boundary → last
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {lastRegionLabel && (
        <p className="text-[9px] text-slate-500 leading-tight">
          Last added region: <span className="text-slate-300 font-mono">{lastRegionLabel}</span>
        </p>
      )}
    </div>
  );
}