import React, { useState, useMemo } from 'react';
import { Scan, Check, AlertTriangle, ArrowRight } from 'lucide-react';

/**
 * Scans map_regions.tga pixel data to extract unique region colors,
 * then cross-references with descr_regions.txt data to show matches/mismatches.
 */

function extractUniqueColors(layerData) {
  if (!layerData?.data) return [];
  const { data, width, height } = layerData;
  const colorCounts = {};

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    // Skip black (borders/sea) and white (unused)
    if (r < 5 && g < 5 && b < 5) continue;
    if (r > 245 && g > 245 && b > 245) continue;
    const key = `${r},${g},${b}`;
    colorCounts[key] = (colorCounts[key] || 0) + 1;
  }

  return Object.entries(colorCounts)
    .map(([key, count]) => {
      const [r, g, b] = key.split(',').map(Number);
      return { r, g, b, pixelCount: count };
    })
    .sort((a, b) => b.pixelCount - a.pixelCount);
}

export default function RegionColorDetector({ regionsLayer, regionsData, onRegionsDataUpdate }) {
  const [scanned, setScanned] = useState(false);
  const [tgaColors, setTgaColors] = useState([]);

  const scan = () => {
    const colors = extractUniqueColors(regionsLayer);
    setTgaColors(colors);
    setScanned(true);
  };

  // Build lookup: RGB key → region name from descr_regions.txt
  const regionsByColor = useMemo(() => {
    const map = {};
    for (const reg of (regionsData || [])) {
      map[`${reg.r},${reg.g},${reg.b}`] = reg.regionName;
    }
    return map;
  }, [regionsData]);

  // Build lookup: region name → RGB from descr_regions.txt
  const colorByRegion = useMemo(() => {
    const map = {};
    for (const reg of (regionsData || [])) {
      map[reg.regionName] = { r: reg.r, g: reg.g, b: reg.b };
    }
    return map;
  }, [regionsData]);

  // Classification
  const matched = useMemo(() => tgaColors.filter(c => regionsByColor[`${c.r},${c.g},${c.b}`]), [tgaColors, regionsByColor]);
  const unmatched = useMemo(() => tgaColors.filter(c => !regionsByColor[`${c.r},${c.g},${c.b}`]), [tgaColors, regionsByColor]);
  const missingFromTGA = useMemo(() => {
    if (!scanned) return [];
    const tgaSet = new Set(tgaColors.map(c => `${c.r},${c.g},${c.b}`));
    return (regionsData || []).filter(r => !tgaSet.has(`${r.r},${r.g},${r.b}`));
  }, [regionsData, tgaColors, scanned]);

  const autoFix = () => {
    if (!regionsData || unmatched.length === 0 || missingFromTGA.length === 0) return;
    // Try to auto-assign unmatched TGA colors to regions missing from TGA
    // by matching 1-to-1 based on closest color distance
    const remaining = [...missingFromTGA];
    const updates = {};

    for (const uc of unmatched) {
      if (remaining.length === 0) break;
      // Find closest region by color distance
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let i = 0; i < remaining.length; i++) {
        const reg = remaining[i];
        const dist = Math.abs(reg.r - uc.r) + Math.abs(reg.g - uc.g) + Math.abs(reg.b - uc.b);
        if (dist < bestDist) { bestDist = dist; bestIdx = i; }
      }
      if (bestDist < 80) { // Only auto-match if reasonably close
        updates[remaining[bestIdx].regionName] = { r: uc.r, g: uc.g, b: uc.b };
        remaining.splice(bestIdx, 1);
      }
    }

    if (Object.keys(updates).length > 0 && onRegionsDataUpdate) {
      onRegionsDataUpdate(prev => {
        if (!prev) return prev;
        return prev.map(r => updates[r.regionName] ? { ...r, ...updates[r.regionName] } : r);
      });
    }
  };

  if (!regionsLayer?.data) {
    return (
      <div className="rounded-lg border border-slate-700/40 bg-slate-900/30 p-2.5">
        <p className="text-[10px] text-slate-600 text-center">Load map_regions.tga first to auto-detect colors</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-700/40 bg-slate-900/30 p-2.5 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Region Color Detection</p>
        <button onClick={scan}
          className="flex items-center gap-1 px-2 py-1 rounded text-[10px] bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/30 text-blue-400 transition-colors font-semibold">
          <Scan className="w-3 h-3" /> {scanned ? 'Re-scan' : 'Scan TGA'}
        </button>
      </div>

      {scanned && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-3 gap-1.5 text-center">
            <div className="rounded bg-green-900/20 border border-green-700/30 py-1">
              <div className="text-[14px] font-bold text-green-400">{matched.length}</div>
              <div className="text-[9px] text-green-500">Matched</div>
            </div>
            <div className="rounded bg-amber-900/20 border border-amber-700/30 py-1">
              <div className="text-[14px] font-bold text-amber-400">{unmatched.length}</div>
              <div className="text-[9px] text-amber-500">Unknown</div>
            </div>
            <div className="rounded bg-red-900/20 border border-red-700/30 py-1">
              <div className="text-[14px] font-bold text-red-400">{missingFromTGA.length}</div>
              <div className="text-[9px] text-red-500">Missing</div>
            </div>
          </div>

          {/* Auto-fix button */}
          {unmatched.length > 0 && missingFromTGA.length > 0 && (
            <button onClick={autoFix}
              className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-[10px] bg-amber-600/20 hover:bg-amber-600/40 border border-amber-500/30 text-amber-400 transition-colors font-semibold">
              <ArrowRight className="w-3 h-3" /> Auto-match closest colors ({Math.min(unmatched.length, missingFromTGA.length)} candidates)
            </button>
          )}

          {/* Matched regions */}
          {matched.length > 0 && (
            <details className="group">
              <summary className="text-[10px] text-green-400 cursor-pointer font-semibold flex items-center gap-1">
                <Check className="w-3 h-3" /> Matched regions ({matched.length})
              </summary>
              <div className="mt-1 max-h-32 overflow-y-auto space-y-0.5">
                {matched.map(c => (
                  <div key={`${c.r},${c.g},${c.b}`} className="flex items-center gap-1.5 px-1 py-0.5">
                    <span className="w-3 h-3 rounded-sm border border-white/20 shrink-0" style={{ background: `rgb(${c.r},${c.g},${c.b})` }} />
                    <span className="text-[10px] text-slate-300 font-mono flex-1 truncate">{regionsByColor[`${c.r},${c.g},${c.b}`]}</span>
                    <span className="text-[9px] text-slate-600 font-mono">{c.r},{c.g},{c.b}</span>
                    <span className="text-[9px] text-slate-600">{c.pixelCount.toLocaleString()}px</span>
                  </div>
                ))}
              </div>
            </details>
          )}

          {/* Unmatched TGA colors */}
          {unmatched.length > 0 && (
            <details open className="group">
              <summary className="text-[10px] text-amber-400 cursor-pointer font-semibold flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Colors in TGA not in descr_regions ({unmatched.length})
              </summary>
              <div className="mt-1 max-h-32 overflow-y-auto space-y-0.5">
                {unmatched.map(c => (
                  <div key={`${c.r},${c.g},${c.b}`} className="flex items-center gap-1.5 px-1 py-0.5">
                    <span className="w-3 h-3 rounded-sm border border-white/20 shrink-0" style={{ background: `rgb(${c.r},${c.g},${c.b})` }} />
                    <span className="text-[10px] text-amber-400 font-mono flex-1">{c.r}, {c.g}, {c.b}</span>
                    <span className="text-[9px] text-slate-600">{c.pixelCount.toLocaleString()}px</span>
                  </div>
                ))}
              </div>
            </details>
          )}

          {/* Regions in descr_regions.txt but color not found in TGA */}
          {missingFromTGA.length > 0 && (
            <details open className="group">
              <summary className="text-[10px] text-red-400 cursor-pointer font-semibold flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Regions not found on TGA ({missingFromTGA.length})
              </summary>
              <div className="mt-1 max-h-32 overflow-y-auto space-y-0.5">
                {missingFromTGA.map(r => (
                  <div key={r.regionName} className="flex items-center gap-1.5 px-1 py-0.5">
                    <span className="w-3 h-3 rounded-sm border border-white/20 shrink-0" style={{ background: `rgb(${r.r},${r.g},${r.b})` }} />
                    <span className="text-[10px] text-slate-300 font-mono flex-1 truncate">{r.regionName}</span>
                    <span className="text-[9px] text-red-500 font-mono">{r.r},{r.g},{r.b}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </>
      )}
    </div>
  );
}