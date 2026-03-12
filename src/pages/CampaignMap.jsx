import React, { useState, useEffect } from 'react';
import { CampaignMapProvider, useCampaignMap } from '../components/campaign/CampaignMapContext';
import CampaignToolbar from '../components/campaign/CampaignToolbar';
import MapCanvas from '../components/campaign/MapCanvas';
import LayerPanel from '../components/campaign/LayerPanel';
import PalettePanel from '../components/campaign/PalettePanel';
import CampaignValidationPanel from '../components/campaign/ValidationPanel';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TGA_FILENAMES } from '../components/campaign/MapLayerDefs';

function CampaignMapContent() {
  const { loadLayer } = useCampaignMap();
  const [showValidation, setShowValidation] = useState(false);

  useEffect(() => {
    const handleLoadMapTGA = (e) => {
      const { fileName, data } = e.detail;
      const fname = fileName.toLowerCase();
      const key = TGA_FILENAMES?.[fname];
      if (!key) return;
      loadLayer(key, data);
    };

    window.addEventListener('load-map-tga', handleLoadMapTGA);
    return () => window.removeEventListener('load-map-tga', handleLoadMapTGA);
  }, [loadLayer]);

  return (
      <div className="flex flex-col h-screen bg-background">
        <CampaignToolbar onValidate={() => setShowValidation(true)} />

        <div className="flex flex-1 min-h-0">
          {/* Left sidebar: Layers + Palette */}
          <div className="w-56 shrink-0 flex flex-col border-r border-border bg-card">
            <ScrollArea className="flex-1">
              <div className="p-3 space-y-5">
                <LayerPanel />
                <div className="border-t border-border pt-3">
                  <PalettePanel />
                </div>
              </div>
            </ScrollArea>
          </div>

          {/* Main canvas */}
          <div className="flex-1 min-w-0 min-h-0 relative flex flex-col">
            <MapCanvas />
          </div>

          {/* Right: Validation panel (conditional) */}
          {showValidation && (
            <div className="w-72 shrink-0 border-l border-border bg-card flex flex-col">
              <CampaignValidationPanel onClose={() => setShowValidation(false)} />
            </div>
          )}
        </div>
      </div>
  );
}

export default function CampaignMap() {
  return (
    <CampaignMapProvider>
      <CampaignMapContent />
    </CampaignMapProvider>
  );
}