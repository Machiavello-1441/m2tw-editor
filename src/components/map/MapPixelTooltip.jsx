import React from 'react';
import { LAYER_DEFS } from './mapLayerConstants';

function colorDist(a, b) {
  return Math.abs(a[0]-b[0]) + Math.abs(a[1]-b[1]) + Math.abs(a[2]-b[2]);
}

function identifyPixel(def, r, g, b) {
  if (!def.legend) return null;
  let best = null, bestDist = 999;
  for (const item of def.legend) {
    const d = colorDist([r, g, b], item.color);
    if (d < bestDist) { bestDist = d; best = item; }
  }
  return bestDist < 30 ? best : null;
}

function identifyRegion(regionsData, r, g, b) {
  if (!regionsData?.length) return null;
  for (const reg of regionsData) {
    if (reg.r === r && reg.g === g && reg.b === b) {
      return reg;
    }
  }
  return null;
}

export default function MapPixelTooltip({ probe, layers, mapWidth, mapHeight, regionsData }) {
  if (!probe) return null;
  const { x, y, pixelData } = probe;

  return (
    <div
      className="absolute z-50 pointer-events-none bg-slate-900/95 border border-slate-600 rounded-lg shadow-2xl p-2.5 text-xs min-w-[180px]"
      style={{ left: probe.screenX + 14, top: probe.screenY - 10 }}
    >
      <div className="text-slate-400 font-mono mb-1.5">
        pixel ({x}, {y}) / map ({mapWidth}×{mapHeight})
      </div>
      <div className="space-y-1">
        {LAYER_DEFS.map((def) => {
          const pd = pixelData[def.id];
          if (!pd) return null;
          const { r, g, b, a } = pd;
          const match = identifyPixel(def, r, g, b);
          return (
            <div key={def.id} className="flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-sm border border-white/20 shrink-0"
                style={{ backgroundColor: `rgba(${r},${g},${b},${a/255})` }}
              />
              <span className="text-slate-400 w-16 shrink-0">{def.label}:</span>
              <span className="text-slate-200 font-mono text-[10px]">
                {match ? match.label : `rgb(${r},${g},${b})`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}