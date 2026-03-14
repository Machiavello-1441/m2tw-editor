import React from 'react';
import { Eye, EyeOff, Upload } from 'lucide-react';
import { LAYER_DEFS } from './mapLayerConstants';

function ColorSwatch({ color }) {
  const [r, g, b] = color;
  return (
    <span
      className="inline-block w-3 h-3 rounded-sm border border-white/10 shrink-0"
      style={{ backgroundColor: `rgb(${r},${g},${b})` }}
    />
  );
}

export default function MapLayerPanel({ layers, onToggleVisible, onOpacityChange, onFileLoad, dirtyLayers }) {
  return (
    <div className="flex flex-col gap-1 h-full overflow-y-auto pr-1">
      {LAYER_DEFS.map((def) => {
        const state = layers[def.id] || {};
        const loaded = !!state.bitmap;
        const visible = state.visible ?? def.defaultVisible;
        const opacity = state.opacity ?? def.defaultOpacity;
        const dirty = dirtyLayers?.has(def.id);

        return (
          <div
            key={def.id}
            className={`rounded-lg border p-3 space-y-2 transition-colors ${
              dirty
                ? 'border-amber-500/50 bg-amber-900/10'
                : loaded
                ? 'border-slate-600/60 bg-slate-800/60'
                : 'border-slate-700/40 bg-slate-900/30'
            }`}
          >
            <div className="flex items-center gap-2">
              <button
                onClick={() => loaded && onToggleVisible(def.id)}
                className={`shrink-0 ${loaded ? 'text-slate-300 hover:text-white' : 'text-slate-700 cursor-default'}`}
                title={visible ? 'Hide layer' : 'Show layer'}
              >
                {visible && loaded ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
              <div className="flex-1 min-w-0">
                <div className={`text-xs font-semibold truncate flex items-center gap-1.5 ${loaded ? 'text-slate-200' : 'text-slate-500'}`}>
                  {def.label}
                  {dirty && <span className="text-[9px] text-amber-400 font-normal">● unsaved</span>}
                </div>
                <div className="text-[10px] text-slate-600 font-mono truncate">{def.filename}</div>
              </div>
              <label
                className="shrink-0 cursor-pointer flex items-center gap-1 px-2 py-1 rounded text-[10px] bg-slate-700/60 hover:bg-slate-600/60 text-slate-300 border border-slate-600/40 transition-colors"
                title={`Load ${def.filename}`}
              >
                <Upload className="w-3 h-3" />
                {loaded ? 'Replace' : 'Load'}
                <input
                  type="file"
                  accept=".tga"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && onFileLoad(def.id, e.target.files[0])}
                />
              </label>
            </div>

            {loaded && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-500 w-10 shrink-0">
                  {Math.round(opacity * 100)}%
                </span>
                <input
                  type="range"
                  min="0" max="1" step="0.01"
                  value={opacity}
                  onChange={(e) => onOpacityChange(def.id, parseFloat(e.target.value))}
                  className="flex-1 h-1.5 accent-amber-500"
                />
              </div>
            )}

            {loaded && visible && def.legend && (
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 pt-1 border-t border-slate-700/40">
                {def.legend.map((item, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <ColorSwatch color={item.color} />
                    <span className="text-[9px] text-slate-500">{item.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}