import React from 'react';
import { CheckCircle, Circle, ChevronRight, Wand2, AlertCircle } from 'lucide-react';

/**
 * WorkflowPanel — drives the step-by-step layer editing flow.
 * Steps: heights → ground → climates → features → regions
 * Each step has: validate → proceed to next.
 */

const STEPS = [
  { id: 'heights',  label: 'Heightmap',   file: 'map_heights.tga',      desc: 'Paint elevation. Sea = blue (0,0,255). Land = grayscale 1–255.' },
  { id: 'ground',   label: 'Ground Types', file: 'map_ground_types.tga', desc: 'Terrain type per tile. Auto-generated from heightmap + topo reference.' },
  { id: 'climates', label: 'Climates',    file: 'map_climates.tga',     desc: 'Climate zones per tile. Paint using the M2TW palette.' },
  { id: 'features', label: 'Features',    file: 'map_features.tga',     desc: 'Rivers, cliffs, fords. Rivers must start with a white origin dot.' },
  { id: 'regions',  label: 'Regions',     file: 'map_regions.tga',      desc: 'Settlement placement. Each region = black pixel + unique RGB surround.' },
];

export default function WorkflowPanel({
  layers, activeLayerId, onSetActive,
  onValidateAndNext, currentStepId, onAutoGenerateGround,
  generatingGround,
}) {
  const currentIdx = STEPS.findIndex(s => s.id === currentStepId);

  return (
    <div className="p-3 space-y-2">
      <p className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider mb-2">Layer Workflow</p>

      {STEPS.map((step, idx) => {
        const hasData = !!layers[step.id]?.imageData;
        const isActive = step.id === currentStepId;
        const isDone = idx < currentIdx;
        const isLocked = idx > currentIdx;

        return (
          <div key={step.id}
            className={`rounded border p-2 transition-colors ${
              isActive ? 'border-amber-500/60 bg-slate-800' :
              isDone ? 'border-green-600/40 bg-slate-900' :
              'border-slate-700 bg-slate-900 opacity-50'
            }`}>
            <div className="flex items-center gap-2">
              {isDone
                ? <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />
                : isActive
                  ? <Circle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  : <Circle className="w-3.5 h-3.5 text-slate-600 shrink-0" />}
              <button
                onClick={() => !isLocked && onSetActive(step.id)}
                disabled={isLocked}
                className={`text-[11px] font-semibold flex-1 text-left ${
                  isActive ? 'text-amber-300' : isDone ? 'text-green-400' : 'text-slate-500'
                }`}>
                {step.label}
              </button>
              {hasData && <span className="text-[9px] text-green-500">✓</span>}
            </div>

            {isActive && (
              <div className="mt-2 space-y-2">
                <p className="text-[10px] text-slate-400">{step.desc}</p>

                {/* Auto-generate ground from heights */}
                {step.id === 'ground' && (
                  <button
                    onClick={onAutoGenerateGround}
                    disabled={generatingGround || !layers.heights?.imageData}
                    className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-[10px] bg-blue-700 border border-blue-600 text-white hover:bg-blue-600 disabled:opacity-50 transition-colors font-semibold">
                    <Wand2 className={`w-3 h-3 ${generatingGround ? 'animate-spin' : ''}`} />
                    {generatingGround ? 'Generating…' : 'Auto-generate from Heightmap'}
                  </button>
                )}

                {/* Features: waterway map link */}
                {step.id === 'features' && (
                  <a href="https://waterwaymap.org/" target="_blank" rel="noreferrer"
                    className="flex items-center gap-1.5 px-2 py-1.5 rounded text-[10px] bg-slate-700 border border-slate-600 text-blue-300 hover:bg-slate-600 transition-colors">
                    🗺 WaterwayMap.org — trace rivers ↗
                  </a>
                )}

                <button
                  onClick={() => onValidateAndNext(step.id)}
                  disabled={!hasData}
                  className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-[10px] bg-amber-600 border border-amber-500 text-white hover:bg-amber-500 disabled:opacity-40 transition-colors font-semibold">
                  <ChevronRight className="w-3 h-3" />
                  {idx < STEPS.length - 1 ? `Validate & Next →` : 'Validate & Finish'}
                </button>

                {!hasData && (
                  <p className="text-[9px] text-slate-500 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 text-amber-500" />
                    Paint or import this layer first.
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}