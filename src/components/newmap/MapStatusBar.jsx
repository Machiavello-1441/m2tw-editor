import React from 'react';
import { LAYER_DEFS, PRESET_RESOLUTIONS, getLayerDimensions } from '@/lib/mapLayerStore';

export default function MapStatusBar({ coords, activeLayerId, layers, baseResolution }) {
  const layerDef = LAYER_DEFS.find(d => d.id === activeLayerId);
  const layer = layers[activeLayerId];
  const dims = layerDef ? getLayerDimensions(layerDef, baseResolution) : null;
  const loadedCount = Object.values(layers).filter(l => l?.imageData).length;

  return (
    <div className="h-7 bg-slate-900 border-t border-slate-700 flex items-center gap-4 px-4 shrink-0">
      {coords ? (
        <span className="text-[10px] text-slate-400 font-mono">
          {coords.lat.toFixed(4)}°, {coords.lng.toFixed(4)}°
        </span>
      ) : (
        <span className="text-[10px] text-slate-600">Move mouse over map</span>
      )}
      <span className="text-slate-700">|</span>
      <span className="text-[10px] text-slate-400">
        Active: <span className="text-amber-400 font-mono">{layerDef?.label ?? '—'}</span>
      </span>
      {dims && (
        <>
          <span className="text-slate-700">|</span>
          <span className="text-[10px] text-slate-400">
            Resolution: <span className="font-mono text-slate-300">{dims.width}×{dims.height}</span>
          </span>
        </>
      )}
      {layer?.imageData && (
        <>
          <span className="text-slate-700">|</span>
          <span className="text-[10px] text-green-500">✓ loaded</span>
          {layer.dirty && <span className="text-[10px] text-amber-400 ml-1">• unsaved changes</span>}
        </>
      )}
      <div className="flex-1" />
      <span className="text-[10px] text-slate-500">{loadedCount}/{LAYER_DEFS.length} layers loaded</span>
      <span className="text-slate-700">|</span>
      <span className="text-[10px] text-slate-500">Base: {baseResolution}×{baseResolution}</span>
    </div>
  );
}