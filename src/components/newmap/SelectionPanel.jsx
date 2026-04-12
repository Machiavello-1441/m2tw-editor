import React from 'react';
import { Crop, Check, X } from 'lucide-react';

export default function SelectionPanel({ selectionMode, onToggleSelection, selection, onConfirmSelection, onClearSelection }) {
  const hasSel = selection?.start && selection?.end;
  const latMin = hasSel ? Math.min(selection.start.lat, selection.end.lat).toFixed(2) : '—';
  const latMax = hasSel ? Math.max(selection.start.lat, selection.end.lat).toFixed(2) : '—';
  const lngMin = hasSel ? Math.min(selection.start.lng, selection.end.lng).toFixed(2) : '—';
  const lngMax = hasSel ? Math.max(selection.start.lng, selection.end.lng).toFixed(2) : '—';

  return (
    <div className="space-y-2">
      <p className="text-[10px] text-slate-400">
        Draw a bounding box on the map to define your map region. The selection will be used to crop all layers for export.
      </p>
      <button onClick={onToggleSelection}
        className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded text-[11px] border transition-colors ${
          selectionMode
            ? 'bg-amber-600 border-amber-500 text-white'
            : 'bg-slate-700 border-slate-600 text-slate-200 hover:bg-slate-600'
        }`}>
        <Crop className="w-3.5 h-3.5" />
        {selectionMode ? 'Drawing… (drag on map)' : 'Draw Selection Box'}
      </button>

      {hasSel && (
        <div className="bg-slate-800 border border-slate-700 rounded p-2 space-y-1 text-[10px]">
          <p className="text-slate-400">Lat: <span className="text-slate-200 font-mono">{latMin}° → {latMax}°</span></p>
          <p className="text-slate-400">Lng: <span className="text-slate-200 font-mono">{lngMin}° → {lngMax}°</span></p>
          <div className="flex gap-1.5 mt-2">
            <button onClick={onConfirmSelection}
              className="flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded text-[10px] bg-green-700 text-white hover:bg-green-600 transition-colors">
              <Check className="w-3 h-3" /> Confirm
            </button>
            <button onClick={onClearSelection}
              className="flex items-center justify-center gap-1 px-2 py-1 rounded text-[10px] bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors">
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}