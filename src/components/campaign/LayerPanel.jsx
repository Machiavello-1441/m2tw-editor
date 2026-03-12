import React, { useState, useMemo } from 'react';
import { Eye, EyeOff, Grid3X3, Layers } from 'lucide-react';
import { useCampaignMap } from './CampaignMapContext';
import { LAYER_ORDER, LAYER_DEFS } from './MapLayerDefs';
import { Slider } from '@/components/ui/slider';

function rgbToHex([r, g, b]) {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

export default function LayerPanel() {
  const {
    layers, layerSettings, updateLayerSetting,
    activeLayer, setActiveLayer,
    gridSettings, updateGridSetting,
  } = useCampaignMap();

  const [showRegionPicker, setShowRegionPicker] = useState(false);

  // Collect unique colors from loaded regions layer (excluding black/white)
  const regionColors = React.useMemo(() => {
    const layer = layers.regions;
    if (!layer) return [];
    const seen = new Map();
    const { width, height, edited } = layer;
    for (let i = 0; i < width * height; i++) {
      const si = i * 4;
      const r = edited[si], g = edited[si + 1], b = edited[si + 2];
      if ((r === 0 && g === 0 && b === 0) || (r === 255 && g === 255 && b === 255)) continue;
      const k = `${r},${g},${b}`;
      if (!seen.has(k)) seen.set(k, [r, g, b]);
      if (seen.size > 300) break; // safety cap
    }
    return Array.from(seen.values());
  }, [layers.regions]);

  return (
    <div className="space-y-1">
      <div className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider px-1 mb-2">Layers</div>

      {[...LAYER_ORDER].reverse().map(key => {
        const def = LAYER_DEFS[key];
        const settings = layerSettings[key];
        const loaded = !!layers[key];
        const isActive = activeLayer === key;

        return (
          <div
            key={key}
            onClick={() => loaded && setActiveLayer(key)}
            className={`rounded-md px-2 py-1.5 cursor-pointer transition-all ${
              isActive ? 'bg-primary/20 border border-primary/40' : 'hover:bg-accent border border-transparent'
            } ${!loaded ? 'opacity-40 cursor-default' : ''}`}
          >
            <div className="flex items-center gap-2">
              <button
                onClick={e => { e.stopPropagation(); if (loaded) updateLayerSetting(key, 'visible', !settings.visible); }}
                className="text-slate-400 hover:text-slate-100 transition-colors shrink-0"
              >
                {settings.visible && loaded ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              </button>
              <span className="text-xs font-medium flex-1 truncate text-slate-200">{def.label}</span>
              {!loaded && <span className="text-[9px] text-slate-500 italic">not loaded</span>}
            </div>

            {loaded && (
              <div className="mt-1.5 px-5" onClick={e => e.stopPropagation()}>
                <Slider
                  value={[settings.opacity * 100]}
                  onValueChange={([v]) => updateLayerSetting(key, 'opacity', v / 100)}
                  min={0} max={100} step={1}
                  className="h-1"
                />
              </div>
            )}

            {/* Regions overlay controls */}
            {key === 'regions' && loaded && (
              <div className="mt-1.5 px-1 space-y-1" onClick={e => e.stopPropagation()}>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!settings.overlayMode}
                    onChange={e => updateLayerSetting('regions', 'overlayMode', e.target.checked)}
                    className="accent-primary w-3 h-3"
                  />
                  <span className="text-[10px] text-slate-300">Overlay mode (city/port only)</span>
                </label>
                {settings.overlayMode && (
                  <div>
                    <div className="flex items-center gap-1 mb-1">
                      <span className="text-[10px] text-slate-400">Highlight region:</span>
                      {settings.highlightColor && (
                        <button
                          onClick={() => updateLayerSetting('regions', 'highlightColor', null)}
                          className="text-[9px] text-slate-500 hover:text-red-400 ml-1"
                        >✕ clear</button>
                      )}
                    </div>
                    <button
                      onClick={() => setShowRegionPicker(p => !p)}
                      className="text-[10px] text-primary hover:underline"
                    >
                      {showRegionPicker ? 'Hide' : 'Pick region color'} ({regionColors.length} found)
                    </button>
                    {showRegionPicker && (
                      <div className="mt-1 flex flex-wrap gap-0.5 max-h-20 overflow-y-auto">
                        {regionColors.map(rgb => {
                          const hex = rgbToHex(rgb);
                          const isSelected = settings.highlightColor &&
                            settings.highlightColor[0] === rgb[0] &&
                            settings.highlightColor[1] === rgb[1] &&
                            settings.highlightColor[2] === rgb[2];
                          return (
                            <button
                              key={hex}
                              title={`${rgb.join(',')}`}
                              onClick={() => {
                                updateLayerSetting('regions', 'highlightColor', isSelected ? null : rgb);
                              }}
                              style={{ backgroundColor: hex }}
                              className={`w-4 h-4 rounded-sm border ${isSelected ? 'border-white' : 'border-transparent'}`}
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Grid toggles */}
      <div className="pt-3 border-t border-border mt-2 space-y-1">
        <div className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider px-1 mb-2 flex items-center gap-1">
          <Grid3X3 className="w-3 h-3" /> Grids (zoom ≥4×)
        </div>
        <label className="flex items-center gap-2 px-1 cursor-pointer">
          <input
            type="checkbox"
            checked={!!gridSettings?.showGridRegionsFeatures}
            onChange={e => updateGridSetting('showGridRegionsFeatures', e.target.checked)}
            className="accent-yellow-400 w-3 h-3"
          />
          <span className="text-[10px] text-slate-300">Regions / Features grid</span>
          <span className="w-3 h-2 ml-auto" style={{ background: 'rgba(255,255,100,0.5)', borderRadius: 1 }} />
        </label>
        <label className="flex items-center gap-2 px-1 cursor-pointer">
          <input
            type="checkbox"
            checked={!!gridSettings?.showGridOther}
            onChange={e => updateGridSetting('showGridOther', e.target.checked)}
            className="accent-blue-400 w-3 h-3"
          />
          <span className="text-[10px] text-slate-300">Other layers grid (2px)</span>
          <span className="w-3 h-2 ml-auto" style={{ background: 'rgba(100,200,255,0.5)', borderRadius: 1 }} />
        </label>
      </div>
    </div>
  );
}