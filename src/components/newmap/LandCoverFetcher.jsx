import React, { useState, useRef, useEffect } from 'react';
import { Download, ChevronDown, ChevronRight, Eye, EyeOff, Globe2 } from 'lucide-react';
import { GROUND_TYPE_PALETTE, LAYER_DEFS, getLayerDimensions } from '@/lib/mapLayerStore';
import { GT } from '@/lib/autoGroundTypes';
import {
  ESA_CLASSES, ESA_CLASS_GROUPS,
  fetchCoverage, compositeLandCover,
} from '@/lib/worldCover';

const GT_COLOR = Object.fromEntries(GROUND_TYPE_PALETTE.map(p => [p.id, p.color]));

/** Ensures an ImageData is at the target dimensions (nearest-neighbour resize). */
function ensureDimensions(imageData, targetW, targetH) {
  if (imageData.width === targetW && imageData.height === targetH) return imageData;
  const canvas = document.createElement('canvas');
  canvas.width = targetW; canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const src = document.createElement('canvas');
  src.width = imageData.width; src.height = imageData.height;
  src.getContext('2d').putImageData(imageData, 0, 0);
  ctx.drawImage(src, 0, 0, targetW, targetH);
  return ctx.getImageData(0, 0, targetW, targetH);
}

export default function LandCoverFetcher({ bbox, groundLayer, onLayerUpdate, mapWidth, mapHeight }) {
  const [expanded, setExpanded] = useState(false);
  const [classMap, setClassMap] = useState(() =>
    Object.fromEntries(ESA_CLASSES.map(c => [c.code, c.defaultGt]))
  );
  const [openGroups, setOpenGroups] = useState({});
  const [hidden, setHidden] = useState(() => new Set());
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(0);
  const [fetching, setFetching] = useState(false);

  const groundRef = useRef(groundLayer);
  useEffect(() => { groundRef.current = groundLayer; }, [groundLayer]);

  const hasLayer = !!groundLayer?.imageData;
  const toggleGroup = (g) => setOpenGroups(s => ({ ...s, [g]: !s[g] }));

  const fetchAndApply = async () => {
    if (!bbox) { setStatus('No bounding box — go back to area selection.'); return; }
    if (!hasLayer) { setStatus('Generate or import the ground layer first.'); return; }
    setFetching(true);
    setStatus('Fetching ESA WorldCover tiles (decoding LERC)…');
    setProgress(0);
    try {
      // Compute ground-layer dimensions first so we fetch ESA at the ground
      // layer's native resolution (2× map +1), not the coarser map resolution.
      // Fetching at the map resolution produces blocky 2×2 squares because each
      // coverage pixel maps to four ground pixels.
      const gDef = LAYER_DEFS.find(d => d.id === 'ground');
      const { width: gW, height: gH } = getLayerDimensions(gDef, mapWidth, mapHeight);

      const coverage = await fetchCoverage(bbox, gW, gH, (p) => setProgress(p));
      setStatus(`Compositing onto ground layer… (${coverage.cols}×${coverage.rows} tiles @ level ${coverage.level})`);

      const classColor = {};
      for (const [code, gtId] of Object.entries(classMap)) {
        const rgb = GT[gtId];
        if (rgb) classColor[Number(code)] = rgb;
      }

      const base = groundRef.current.imageData;
      const fixedBase = ensureDimensions(base, gW, gH);
      const { imageData, painted } = compositeLandCover(coverage, fixedBase, bbox, classColor, hidden);
      onLayerUpdate('ground', { imageData, visible: true, opacity: 1, dirty: true });
      setStatus(`Done — painted ${painted.toLocaleString()} pixels from ESA WorldCover (level ${coverage.level}).`);
    } catch (e) {
      setStatus(`Fetch failed: ${e.message}`);
    } finally {
      setFetching(false);
    }
  };

  return (
    <div className="rounded border border-slate-700 bg-slate-900/60">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-2 py-1.5 text-[10px] text-slate-300 font-semibold hover:bg-slate-800/60 transition-colors">
        <span className="flex items-center gap-1.5">
          {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          ESA WorldCover Land Cover
        </span>
        <span className="flex items-center gap-1 text-[9px] text-slate-500">
          <Globe2 className="w-2.5 h-2.5" /> 2021 · LERC
        </span>
      </button>

      {expanded && (
        <div className="px-2 pb-2 space-y-2 border-t border-slate-700/50">
          <p className="text-[9px] text-slate-500 pt-1.5 leading-relaxed">
            Fetch ESA WorldCover 2021 land-cover classes (decoded from LERC tiles — exact class values, not colour-matched) and map each class to an M2TW ground type, then paint the ground layer.
          </p>

          {/* Class → ground-type mapping */}
          <div className="space-y-1">
            {ESA_CLASS_GROUPS.map(group => (
              <div key={group} className="rounded border border-slate-700/60 overflow-hidden">
                <button
                  onClick={() => toggleGroup(group)}
                  className="w-full flex items-center justify-between px-2 py-1 bg-slate-800/60 hover:bg-slate-700/60 transition-colors">
                  <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">{group}</span>
                  {openGroups[group] ? <ChevronDown className="w-2.5 h-2.5 text-slate-500" /> : <ChevronRight className="w-2.5 h-2.5 text-slate-500" />}
                </button>
                {openGroups[group] && (
                  <div className="divide-y divide-slate-800">
                    {ESA_CLASSES.filter(c => c.group === group).map(c => {
                      const gtId = classMap[c.code];
                      const isHidden = hidden.has(c.code);
                      return (
                        <div key={c.code} className="flex items-center gap-1.5 px-1.5 py-1 bg-slate-900">
                          <span className="text-[9px] font-mono text-slate-500 w-6 shrink-0">{c.code}</span>
                          <span className="text-[9px] text-slate-300 flex-1 truncate">{c.label}</span>
                          <span className="text-[9px] text-slate-600">→</span>
                          <div className="w-3 h-3 rounded-sm shrink-0 border border-slate-600" style={{ backgroundColor: GT_COLOR[gtId] ?? '#888' }} />
                          <select
                            value={gtId}
                            onChange={e => setClassMap(m => ({ ...m, [c.code]: e.target.value }))}
                            className="h-5 text-[9px] bg-slate-800 border border-slate-600 rounded text-slate-200 focus:outline-none focus:border-amber-500 max-w-[104px]">
                            {GROUND_TYPE_PALETTE.map(p => (
                              <option key={p.id} value={p.id}>{p.label}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => setHidden(prev => {
                              const next = new Set(prev);
                              if (next.has(c.code)) next.delete(c.code); else next.add(c.code);
                              return next;
                            })}
                            title={isHidden ? 'Include class' : 'Exclude class'}
                            className={`shrink-0 ${isHidden ? 'text-slate-600' : 'text-slate-400'} hover:text-white transition-colors`}>
                            {isHidden ? <EyeOff className="w-2.5 h-2.5" /> : <Eye className="w-2.5 h-2.5" />}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>

          <button
            onClick={() => setClassMap(Object.fromEntries(ESA_CLASSES.map(c => [c.code, c.defaultGt])))}
            className="text-[9px] px-2 py-0.5 rounded bg-slate-700 text-slate-400 hover:bg-slate-600 border border-slate-600 transition-colors">
            Reset to Defaults
          </button>

          {status && (
            <p className={`text-[9px] leading-snug ${
              status.startsWith('Done') ? 'text-green-400' :
              status.includes('failed') || status.includes('first') ? 'text-red-400' :
              'text-amber-400'
            }`}>
              {status}
            </p>
          )}

          {fetching && (
            <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full transition-all duration-200" style={{ width: `${progress}%` }} />
            </div>
          )}

          <button
            onClick={fetchAndApply}
            disabled={fetching || !bbox || !hasLayer}
            className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-[10px] bg-blue-700 border border-blue-600 text-white hover:bg-blue-600 disabled:opacity-50 transition-colors font-semibold">
            <Download className={`w-3 h-3 ${fetching ? 'animate-spin' : ''}`} />
            {fetching ? status || 'Fetching…' : 'Fetch & Apply ESA Land Cover'}
          </button>

          {!bbox && <p className="text-[9px] text-slate-600 italic">No bounding box — go back to area selection.</p>}
          {!hasLayer && <p className="text-[9px] text-slate-600 italic">Generate or import the ground layer first.</p>}
        </div>
      )}
    </div>
  );
}