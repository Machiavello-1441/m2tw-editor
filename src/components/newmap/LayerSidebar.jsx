import React from 'react';
import { Eye, EyeOff, Upload } from 'lucide-react';
import { LAYER_DEFS, getLayerDimensions } from '@/lib/mapLayerStore';

export default function LayerSidebar({ layers, activeLayerId, onSetActive, onToggleVisible, onOpacityChange, onImport, mapWidth, mapHeight, compact }) {
  // compact = rendered inside an existing tab, no fixed-width wrapper
  const content = (
    <div className="p-2 space-y-1">
      {compact && <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-1">Map Layers</p>}
        {LAYER_DEFS.map(def => {
          const layer = layers[def.id] || {};
          const isActive = activeLayerId === def.id;
          const isVisible = layer.visible !== false;
          return (
            <div key={def.id}
              className={`rounded p-2 cursor-pointer border transition-colors ${
                isActive ? 'bg-slate-700 border-amber-500/50' : 'bg-slate-800 border-transparent hover:bg-slate-750'
              }`}
              onClick={() => onSetActive(def.id)}>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm shrink-0 border border-slate-600"
                  style={{ backgroundColor: def.defaultColor }} />
                <span className="text-[11px] text-slate-200 font-medium flex-1 truncate">{def.label}</span>
                <button onClick={e => { e.stopPropagation(); onToggleVisible(def.id); }}
                  className="text-slate-500 hover:text-slate-300 transition-colors">
                  {isVisible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                </button>
              </div>
              {layer.imageData && (
                <div className="mt-1.5">
                  <input type="range" min="0" max="100" value={Math.round((layer.opacity ?? 1) * 100)}
                    onClick={e => e.stopPropagation()}
                    onChange={e => { e.stopPropagation(); onOpacityChange(def.id, e.target.value / 100); }}
                    className="w-full h-1 accent-amber-400" />
                </div>
              )}
              <div className="mt-1.5 flex items-center justify-between">
                <span className="text-[9px] text-slate-600 truncate">{def.filename}</span>
                <label className="cursor-pointer text-slate-500 hover:text-amber-400 transition-colors"
                  onClick={e => e.stopPropagation()}>
                  <Upload className="w-3 h-3" />
                  <input type="file" accept="image/*,.tga" className="hidden"
                    onChange={e => onImport(def.id, e.target.files?.[0])} />
                </label>
              </div>
              {layer.imageData && (
                <div className="mt-1">
                  <span className="text-[9px] text-green-500">✓ {layer.imageData.width}×{layer.imageData.height}</span>
                </div>
              )}
              {!layer.imageData && mapWidth && (
                <div className="mt-1">
                  {(() => { const d = getLayerDimensions(def, mapWidth, mapHeight); return <span className="text-[9px] text-slate-600">{d.width}×{d.height}px</span>; })()}
                </div>
              )}
            </div>
          );
        })}
    </div>
  );

  if (compact) return content;

  return (
    <div className="w-56 shrink-0 bg-slate-900 border-r border-slate-700 flex flex-col h-full overflow-hidden">
      <div className="px-3 py-2 border-b border-slate-700">
        <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">Map Layers</p>
      </div>
      <div className="flex-1 overflow-y-auto">
        {content}
      </div>
    </div>
  );
}