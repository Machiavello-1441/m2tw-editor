import React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useCampaignMap } from './CampaignMapContext';
import { LAYER_ORDER, LAYER_DEFS } from './MapLayerDefs';
import { Slider } from '@/components/ui/slider';

export default function LayerPanel() {
  const { layers, layerSettings, updateLayerSetting, activeLayer, setActiveLayer } = useCampaignMap();

  return (
    <div className="space-y-1">
      <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-2">Layers</div>
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
                className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
              >
                {settings.visible && loaded ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              </button>
              <span className="text-xs font-medium flex-1 truncate">{def.label}</span>
              {!loaded && <span className="text-[9px] text-muted-foreground italic">not loaded</span>}
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
          </div>
        );
      })}
    </div>
  );
}