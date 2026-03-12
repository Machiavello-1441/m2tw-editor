import React from 'react';
import { Pencil, PaintBucket, Minus, Plus } from 'lucide-react';
import { useCampaignMap } from './CampaignMapContext';
import { LAYER_DEFS } from './MapLayerDefs';
import { Button } from '@/components/ui/button';

function rgbToHex([r, g, b]) {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

export default function PalettePanel() {
  const { activeLayer, tool, setTool, selectedColor, setSelectedColor, brushSize, setBrushSize } = useCampaignMap();
  const def = activeLayer ? LAYER_DEFS[activeLayer] : null;

  return (
    <div className="space-y-3">
      <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-1">Paint Tools</div>

      {/* Tool selector */}
      <div className="flex gap-1">
        <button
          onClick={() => setTool('pencil')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-medium transition-all ${tool === 'pencil' ? 'bg-primary text-primary-foreground' : 'bg-secondary hover:bg-accent'}`}
        >
          <Pencil className="w-3 h-3" /> Pencil
        </button>
        <button
          onClick={() => setTool('bucket')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-medium transition-all ${tool === 'bucket' ? 'bg-primary text-primary-foreground' : 'bg-secondary hover:bg-accent'}`}
        >
          <PaintBucket className="w-3 h-3" /> Bucket
        </button>
      </div>

      {/* Brush size */}
      {tool === 'pencil' && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Brush:</span>
          <button onClick={() => setBrushSize(s => Math.max(1, s - 1))} className="w-5 h-5 rounded bg-secondary flex items-center justify-center hover:bg-accent">
            <Minus className="w-3 h-3" />
          </button>
          <span className="text-xs w-4 text-center font-mono">{brushSize}</span>
          <button onClick={() => setBrushSize(s => Math.min(20, s + 1))} className="w-5 h-5 rounded bg-secondary flex items-center justify-center hover:bg-accent">
            <Plus className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Color palette */}
      {def && (
        <div className="space-y-1">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
            {def.label} Colors
          </div>
          <div className="space-y-0.5 max-h-64 overflow-y-auto pr-1">
            {def.colors.filter(c => c.rgb).map((c) => {
              const hex = rgbToHex(c.rgb);
              const isSelected = selectedColor && selectedColor.label === c.label;
              return (
                <button
                  key={c.label}
                  onClick={() => setSelectedColor(c)}
                  className={`w-full flex items-center gap-2 px-2 py-1 rounded text-xs text-left transition-all ${
                    isSelected ? 'ring-1 ring-primary bg-primary/10' : 'hover:bg-accent'
                  }`}
                >
                  <div
                    className="w-4 h-4 rounded-sm border border-white/20 shrink-0"
                    style={{ backgroundColor: hex }}
                  />
                  <span className="flex-1 truncate">{c.label}</span>
                  <span className="font-mono text-[9px] text-muted-foreground shrink-0">
                    {c.rgb.join(',')}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Active color preview */}
      {selectedColor && (
        <div className="flex items-center gap-2 mt-1 bg-secondary/50 rounded p-2">
          <div
            className="w-6 h-6 rounded border border-white/20"
            style={{ backgroundColor: rgbToHex(selectedColor.rgb) }}
          />
          <div>
            <div className="text-xs font-medium">{selectedColor.label}</div>
            <div className="text-[10px] font-mono text-muted-foreground">rgb({selectedColor.rgb.join(', ')})</div>
          </div>
        </div>
      )}
    </div>
  );
}