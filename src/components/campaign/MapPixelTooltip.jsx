import React from 'react';
import { LAYER_DEFS, LAYER_ORDER } from './MapLayerDefs';

function colorDist(a, b) {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
}

function identifyPixel(def, r, g, b) {
  if (!def.colors) return null;
  let best = null, bestDist = 999;
  for (const item of def.colors) {
    if (!item.rgb) continue;
    const d = colorDist([r, g, b], item.rgb);
    if (d < bestDist) { bestDist = d; best = item; }
  }
  return bestDist < 30 ? best : null;
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

export default function MapPixelTooltip({ probe, layers, mapWidth, mapHeight }) {
  if (!probe) return null;
  const { x, y, screenX, screenY, pixelData } = probe;

  const entries = LAYER_ORDER
    .filter(key => layers[key] && pixelData[key])
    .map(key => {
      const [r, g, b] = pixelData[key];
      const def = LAYER_DEFS[key];
      const match = identifyPixel(def, r, g, b);
      return { key, label: def.label, r, g, b, match };
    });

  // Position: avoid going off screen right/bottom
  const style = {
    position: 'fixed',
    left: screenX + 16,
    top: screenY - 10,
    zIndex: 9999,
    pointerEvents: 'none',
  };

  return (
    <div
      style={style}
      className="bg-slate-900/95 border border-slate-600 rounded-lg shadow-2xl p-2.5 text-xs min-w-[200px] max-w-[260px]"
    >
      <div className="text-slate-300 font-mono mb-2 text-[10px]">
        ({x}, {y}) — map {mapWidth}×{mapHeight}
      </div>
      <div className="space-y-1">
        {entries.map(({ key, label, r, g, b, match }) => (
          <div key={key} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-sm shrink-0 border border-white/20"
              style={{ backgroundColor: rgbToHex(r, g, b) }}
            />
            <span className="text-slate-400 shrink-0 w-20 truncate text-[10px]">{label}</span>
            <span className="text-slate-200 flex-1 truncate text-[10px]">
              {match ? match.label : <span className="font-mono text-slate-500">{r},{g},{b}</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}