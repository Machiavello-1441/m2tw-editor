import React from 'react';
import { MapPin, Anchor, Check, SkipForward, Paintbrush } from 'lucide-react';

const STEPS = [
  { id: 'paint',  label: 'Paint Region',        icon: Paintbrush, description: 'Paint the region territory on the map using the selected color.' },
  { id: 'city',   label: 'Place Settlement',     icon: MapPin,     description: 'Click on the map to place a black pixel marking the settlement location.' },
  { id: 'port',   label: 'Place Port (optional)', icon: Anchor,     description: 'Click on the map to place a white pixel for the port, or skip.' },
];

export default function NewRegionPaintWizard({ regionDraft, currentStep, onFinish, onSkipPort }) {
  const stepIdx = STEPS.findIndex(s => s.id === currentStep);

  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-900/10 p-2.5 space-y-2">
      <div className="flex items-center gap-2">
        <span className="w-4 h-4 rounded border border-slate-600/40 shrink-0"
          style={{ background: `rgb(${regionDraft.r},${regionDraft.g},${regionDraft.b})` }} />
        <p className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider flex-1">
          Setting up: {regionDraft.regionName}
        </p>
      </div>

      {/* Step indicators */}
      <div className="flex gap-1">
        {STEPS.map((step, i) => {
          const isCurrent = i === stepIdx;
          const isDone = i < stepIdx;
          const Icon = step.icon;
          return (
            <div key={step.id}
              className={`flex-1 flex items-center gap-1 px-2 py-1 rounded text-[9px] font-semibold transition-colors ${
                isCurrent ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300' :
                isDone    ? 'bg-green-500/10 border border-green-500/30 text-green-400' :
                            'bg-slate-800/40 border border-slate-700/30 text-slate-600'
              }`}>
              {isDone ? <Check className="w-2.5 h-2.5" /> : <Icon className="w-2.5 h-2.5" />}
              <span className="truncate">{step.label}</span>
            </div>
          );
        })}
      </div>

      {/* Current step instructions */}
      {stepIdx >= 0 && stepIdx < STEPS.length && (
        <p className="text-[10px] text-amber-200/80">
          {STEPS[stepIdx].description}
        </p>
      )}

      {/* Step-specific controls */}
      {currentStep === 'paint' && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-400">Paint mode is active on the regions layer. Use pencil or bucket to paint, then:</span>
        </div>
      )}

      <div className="flex gap-1.5 justify-end">
        {currentStep === 'paint' && (
          <button onClick={() => onFinish('paint')}
            className="flex items-center gap-0.5 px-2 py-1 rounded text-[10px] bg-amber-600/80 hover:bg-amber-600 border border-amber-500/40 text-slate-900 font-semibold transition-colors">
            <Check className="w-2.5 h-2.5" /> Done Painting → Place Settlement
          </button>
        )}
        {currentStep === 'port' && (
          <button onClick={onSkipPort}
            className="flex items-center gap-0.5 px-2 py-1 rounded text-[10px] text-slate-400 hover:text-slate-200 border border-slate-700/40 transition-colors">
            <SkipForward className="w-2.5 h-2.5" /> Skip Port
          </button>
        )}
      </div>
    </div>
  );
}