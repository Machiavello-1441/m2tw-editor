import React from 'react';
import { Paintbrush, Eraser, Pipette, Square, Minus } from 'lucide-react';
import { CLIMATE_PALETTE, GROUND_TYPE_PALETTE, LAYER_DEFS } from '@/lib/mapLayerStore';

const TOOLS = [
  { id: 'brush',  icon: Paintbrush, label: 'Brush' },
  { id: 'fill',   icon: Square,     label: 'Fill' },
  { id: 'eraser', icon: Eraser,     label: 'Eraser' },
  { id: 'picker', icon: Pipette,    label: 'Color Picker' },
  { id: 'river',  icon: Minus,      label: 'River Draw' },
];

export default function ToolSettings({ activeTool, onSetTool, brushSize, onBrushSize, color, onColor, activeLayerId, regionName, onRegionName }) {
  const layerDef = LAYER_DEFS.find(d => d.id === activeLayerId);
  const showPalette = activeLayerId === 'map_climates' || activeLayerId === 'map_ground_types';
  const palette = activeLayerId === 'map_climates' ? CLIMATE_PALETTE : GROUND_TYPE_PALETTE;

  return (
    <div className="w-52 shrink-0 bg-slate-900 border-l border-slate-700 flex flex-col h-full overflow-y-auto">
      <div className="px-3 py-2 border-b border-slate-700">
        <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">Tools</p>
      </div>

      {/* Tool picker */}
      <div className="p-2 border-b border-slate-700">
        <div className="grid grid-cols-5 gap-1">
          {TOOLS.map(t => (
            <button key={t.id} onClick={() => onSetTool(t.id)} title={t.label}
              className={`p-1.5 rounded transition-colors ${activeTool === t.id ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
              <t.icon className="w-3.5 h-3.5 mx-auto" />
            </button>
          ))}
        </div>
      </div>

      {/* Brush size */}
      {(activeTool === 'brush' || activeTool === 'eraser' || activeTool === 'river') && (
        <div className="p-3 border-b border-slate-700 space-y-1.5">
          <label className="text-[10px] text-slate-400">Brush Size: {brushSize}px</label>
          <input type="range" min="1" max="50" value={brushSize} onChange={e => onBrushSize(Number(e.target.value))}
            className="w-full h-1 accent-amber-400" />
        </div>
      )}

      {/* Color picker */}
      {activeTool !== 'eraser' && activeTool !== 'picker' && (
        <div className="p-3 border-b border-slate-700 space-y-1.5">
          <label className="text-[10px] text-slate-400">Paint Color</label>
          <div className="flex items-center gap-2">
            <input type="color" value={color} onChange={e => onColor(e.target.value)}
              className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent" />
            <span className="text-[11px] text-slate-300 font-mono">{color.toUpperCase()}</span>
          </div>
        </div>
      )}

      {/* Indexed palette */}
      {showPalette && (
        <div className="p-3 border-b border-slate-700 space-y-1">
          <label className="text-[10px] text-slate-400">
            {activeLayerId === 'map_climates' ? 'Climate Zones' : 'Ground Types'}
          </label>
          <div className="space-y-0.5 max-h-48 overflow-y-auto">
            {palette.map(p => (
              <button key={p.id} onClick={() => onColor(p.color)}
                className={`w-full flex items-center gap-2 px-2 py-1 rounded text-[10px] text-left transition-colors ${
                  color === p.color ? 'bg-amber-600/30 text-amber-300' : 'text-slate-300 hover:bg-slate-800'
                }`}>
                <div className="w-3 h-3 rounded-sm shrink-0 border border-slate-600" style={{ backgroundColor: p.color }} />
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Region name */}
      {activeLayerId === 'map_regions' && (
        <div className="p-3 border-b border-slate-700 space-y-1.5">
          <label className="text-[10px] text-slate-400">Region Name</label>
          <input value={regionName} onChange={e => onRegionName(e.target.value)} placeholder="e.g. england"
            className="w-full h-7 px-2 text-[11px] bg-slate-800 border border-slate-600 rounded text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500" />
        </div>
      )}

      {/* Layer info */}
      {layerDef && (
        <div className="p-3 space-y-1">
          <p className="text-[10px] text-slate-500 font-semibold">Active Layer</p>
          <p className="text-[10px] text-slate-400">{layerDef.description}</p>
          <p className="text-[9px] text-slate-600 font-mono">{layerDef.filename}</p>
          <p className="text-[9px] text-slate-600">Format: {layerDef.mode === 'grayscale' ? '8-bit grayscale' : '24-bit RGB'}</p>
          {layerDef.multiplier === 2 && (
            <p className="text-[9px] text-slate-600">Size: 2× regions + 1px</p>
          )}
        </div>
      )}
    </div>
  );
}