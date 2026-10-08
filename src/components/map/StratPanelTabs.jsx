import React from 'react';

export default function StratPanelTabs({ tab, onChange }) {
  return <div className="flex border-b border-slate-800 shrink-0 flex-wrap">
    {[['overview', 'Overview'], ['settlements', 'Settlements'], ['validation', 'Settlement validation'], ['factions', 'Factions'], ['characters', 'Characters']].map(([id, label]) =>
      <button key={id} onClick={() => onChange(id)}
        className={`flex-1 py-1.5 text-[9px] font-semibold border-b-2 transition-colors ${tab === id ? 'border-amber-500 text-amber-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
        {label}
      </button>
    )}
  </div>;
}