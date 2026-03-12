import React from 'react';
import { LAYER_ORDER, LAYER_DEFS } from './MapLayerDefs';

function colorDist(a, b) {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
}

function identifyPixel(def, r, g, b) {
  if (!def.colors) return null;
  const candidates = def.colors.filter(c => c.rgb);
  if (!candidates.length) return null;
  let best = null, bestDist = 999;
  for (const item of candidates) {
    const d = colorDist([r, g, b], item.rgb);
    if (d < bestDist) { bestDist = d; best = item; }
  }
  return bestDist < 30 ? best : null;
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

export default function MapPixelTooltip({ probe, layers, primaryWidth, primaryHeight }) {
  if (!probe) return null;
  const { x, y, screenX, screenY } = probe;

  const rows = LAYER_ORDER
    .filter(key => layers[key])
    .map(key => {
      const def = LAYER_DEFS[key];
      const layer = layers[key];
      // Map primary coords to this layer's coords
      const lx = Math.round(x * layer.width / primaryWidth);
      const ly = Math.round(y * layer.height / primaryHeight);
      if (lx < 0 || ly < 0 || lx >= layer.width || ly >= layer.height) return null;
      const idx = (ly * layer.width + lx) * 4;
      const r = layer.edited[idx], g = layer.edited[idx + 1], b = layer.edited[idx + 2];
      const match = identifyPixel(def, r, g, b);
      return { key, def, r, g, b, match, lx, ly };
    })
    .filter(Boolean);

  if (!rows.length) return null;

  return (
    <div
      className="absolute z-50 pointer-events-none bg-slate-900/95 border border-slate-600 rounded-lg shadow-2xl p-2.5 text-xs min-w-[200px]"
      style={{ left: screenX + 16, top: screenY - 10 }}
    >
      <div className="text-slate-300 font-mono mb-2 border-b border-slate-700 pb-1.5">
        ({x}, {y}) — {primaryWidth}×{primaryHeight}
      </div>
      <div className="space-y-1">
        {rows.map(({ key, def, r, g, b, match }) => (
          <div key={key} className="flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-sm border border-white/20 shrink-0"
              style={{ backgroundColor: rgbToHex(r, g, b) }}
            />
            <span className="text-slate-400 w-20 shrink-0 truncate">{def.label}:</span>
            <span className="text-slate-200 font-mono text-[10px] truncate">
              {match ? match.label : `${r},${g},${b}`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}