import React from 'react';
import { Eye, EyeOff, ArrowRight } from 'lucide-react';
import { LAYER_DEFS } from '@/lib/mapLayerStore';

const LAYER_LABELS = {
  map_regions: 'Regions',
  map_features: 'Features / Rivers',
  map_heights: 'Heightmap',
  map_climates: 'Climates',
  map_ground_types: 'Ground Types',
  map_fog: 'Fog of War',
};

export default function LayerPreviewPanel({ layers, onToggleVisible, onOpacityChange, onProceed }) {
  const layerIds = Object.keys(layers).filter(id => layers[id]?.imageData);

  return (
    <div className="p-3 space-y-3">
      <p className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider">Step 4 — Preview Layers</p>
      <p className="text-[11px] text-slate-400">
        Toggle and adjust layers on the map before proceeding to edit. Use the eye icon to show/hide and the slider to set opacity.
      </p>

      {layerIds.length === 0 && (
        <p className="text-[10px] text-slate-500 italic">No layers generated yet. Go back to generate layers first.</p>
      )}

      <div className="space-y-2">
        {layerIds.map(id => {
          const layer = layers[id];
          const visible = layer?.visible !== false;
          const opacity = layer?.opacity ?? 0.8;
          const label = LAYER_LABELS[id] || id;

          return (
            <div key={id} className="bg-slate-800 border border-slate-700 rounded p-2 space-y-1.5">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onToggleVisible(id)}
                  className={`p-1 rounded transition-colors ${visible ? 'text-amber-400 hover:text-amber-300' : 'text-slate-600 hover:text-slate-400'}`}
                >
                  {visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                </button>
                <span className="text-[11px] text-slate-300 flex-1">{label}</span>
                <span className="text-[9px] text-slate-500 font-mono">{Math.round(opacity * 100)}%</span>
              </div>
              <input
                type="range" min="0" max="1" step="0.05"
                value={opacity}
                onChange={e => onOpacityChange(id, parseFloat(e.target.value))}
                className="w-full h-1 accent-amber-400"
                disabled={!visible}
              />
            </div>
          );
        })}
      </div>

      <p className="text-[9px] text-slate-500">
        Tip: Pan and zoom the map to inspect your layers at different scales. Toggle layers to compare them.
      </p>

      <button
        onClick={onProceed}
        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded text-[11px] bg-amber-600 border border-amber-500 text-white hover:bg-amber-500 transition-colors font-semibold"
      >
        <ArrowRight className="w-3.5 h-3.5" /> Proceed to Edit Layers →
      </button>
    </div>
  );
}