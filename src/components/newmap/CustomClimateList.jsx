import React from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { CLIMATE_PALETTE } from '@/lib/mapLayerStore';
import { removeCustomClimate } from '@/lib/climateStore';

const SRC_LABEL = Object.fromEntries(CLIMATE_PALETTE.map(p => [p.id, p.label]));

export default function CustomClimateList({ customs }) {
  if (customs.length === 0) return <p className="text-[9px] text-slate-600 italic">No custom climates yet.</p>;

  // A colour shared by two climates can't be told apart in map_climates.tga
  const taken = {};
  for (const p of [...CLIMATE_PALETTE, ...customs]) taken[p.color.toLowerCase()] = (taken[p.color.toLowerCase()] || 0) + 1;

  return (
    <div className="space-y-0.5 max-h-40 overflow-y-auto">
      {customs.map(c => {
        const dup = taken[c.color.toLowerCase()] > 1;
        return (
          <div key={c.id} className="flex items-center gap-1.5 px-1.5 py-0.5 rounded bg-slate-800/60">
            <div className="w-3 h-3 rounded-sm shrink-0 border border-slate-600" style={{ backgroundColor: c.color }} />
            <div className="flex-1 min-w-0">
              <p className="text-[9px] text-slate-200 font-mono truncate">{c.id}</p>
              <p className="text-[8px] text-slate-500 truncate">copy of {SRC_LABEL[c.sourceId] ?? c.sourceId}</p>
            </div>
            {dup && <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" title="Colour clashes with another climate" />}
            <button onClick={() => removeCustomClimate(c.id)} className="text-slate-500 hover:text-red-400 shrink-0" title="Remove">
              <X className="w-3 h-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}