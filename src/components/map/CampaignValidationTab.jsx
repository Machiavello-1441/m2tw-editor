import React from 'react';
import MapValidationPanel from '@/components/map/MapValidationPanel';
import OverlayMapGenerator from '@/components/map/OverlayMapGenerator';
import SettlementValidationView from '@/components/map/SettlementValidationView';

export default function CampaignValidationTab({ layers, overlayProps, settlements, edbData, onApply, onJumpTo }) {
  return <div className="h-full overflow-y-auto">
    <div className="p-3 border-b border-slate-800 bg-slate-900/40">
      <OverlayMapGenerator {...overlayProps} />
    </div>
    <div className="min-h-80">
      <MapValidationPanel layers={layers} onJumpTo={onJumpTo} />
    </div>
    <div className="p-3 border-b border-border">
      <SettlementValidationView settlements={settlements} edbData={edbData} onApply={onApply} />
    </div>
  </div>;
}