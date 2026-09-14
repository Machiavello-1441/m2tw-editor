import React from 'react';
import { Check } from 'lucide-react';

/**
 * Flat checkbox list of every mesh group in the model — the plain "what is
 * drawn right now" view, independent of the super-group tree below it.
 */
export default function MeshVisibilityChecklist({ meshInfos, onToggleVisibility, onSetAllVisible }) {
  if (!meshInfos?.length) return null;
  const shown = meshInfos.filter(m => m.visible).length;

  return (
    <div className="p-2.5 border-b border-slate-700">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
          Visible Meshes ({shown}/{meshInfos.length})
        </p>
        <div className="flex gap-1">
          <button onClick={() => onSetAllVisible(true)}
            className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700">All</button>
          <button onClick={() => onSetAllVisible(false)}
            className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700">None</button>
        </div>
      </div>
      <div className="space-y-0.5 max-h-44 overflow-y-auto pr-0.5">
        {meshInfos.map((info, idx) => (
          <label key={info.name + idx}
            className="flex items-center gap-1.5 px-1 py-0.5 rounded hover:bg-slate-800 cursor-pointer">
            <span className={`w-3 h-3 rounded-sm border flex items-center justify-center shrink-0 ${
              info.visible ? 'bg-blue-500 border-blue-500' : 'border-slate-600'
            }`}>
              {info.visible && <Check className="w-2.5 h-2.5 text-slate-900" />}
            </span>
            <input type="checkbox" className="hidden" checked={!!info.visible}
              onChange={() => onToggleVisibility(idx)} />
            <span className={`text-[10px] truncate ${info.visible ? 'text-slate-200' : 'text-slate-500'}`}
              title={info.name}>{info.name}</span>
            {info.optional && <span className="ml-auto text-[8px] text-yellow-500 shrink-0">opt</span>}
          </label>
        ))}
      </div>
    </div>
  );
}