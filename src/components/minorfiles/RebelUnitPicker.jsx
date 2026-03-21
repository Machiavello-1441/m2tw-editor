import React, { useState, useMemo } from 'react';
import { Plus, Search } from 'lucide-react';

export default function RebelUnitPicker({ eduUnitNames, existingUnits, onAdd }) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

  const existingSet = useMemo(() => new Set((existingUnits || []).map(u => u.unitName)), [existingUnits]);

  const filtered = useMemo(() => {
    if (!search) return eduUnitNames.filter(n => !existingSet.has(n)).slice(0, 20);
    const s = search.toLowerCase();
    return eduUnitNames.filter(n => !existingSet.has(n) && n.toLowerCase().includes(s)).slice(0, 30);
  }, [eduUnitNames, existingSet, search]);

  if (eduUnitNames.length === 0) {
    return (
      <div className="flex items-center gap-1">
        <input
          placeholder="Type unit name manually…"
          className="flex-1 h-6 px-1.5 text-[10px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 font-mono placeholder-slate-600"
          onKeyDown={e => {
            if (e.key === 'Enter' && e.target.value.trim()) {
              onAdd(e.target.value.trim());
              e.target.value = '';
            }
          }}
        />
        <span className="text-[8px] text-slate-600">Enter to add</span>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-1">
        <button
          onClick={() => setOpen(v => !v)}
          className="flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] border border-dashed border-slate-600/40 text-slate-400 hover:text-slate-200 hover:border-slate-400 transition-colors">
          <Plus className="w-3 h-3" /> Add Unit
        </button>
      </div>
      {open && (
        <div className="absolute z-10 mt-1 left-0 w-72 bg-slate-900 border border-slate-700 rounded-lg shadow-xl overflow-hidden">
          <div className="flex items-center gap-1 px-2 py-1.5 border-b border-slate-700/60">
            <Search className="w-3 h-3 text-slate-500 shrink-0" />
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search EDU units…"
              className="flex-1 bg-transparent text-[11px] text-slate-200 outline-none placeholder-slate-600"
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 && (
              <p className="text-[10px] text-slate-600 text-center py-3">No matching units</p>
            )}
            {filtered.map(name => (
              <button
                key={name}
                onClick={() => { onAdd(name); setOpen(false); setSearch(''); }}
                className="w-full text-left px-2 py-1 text-[10px] font-mono text-slate-300 hover:bg-slate-800 hover:text-slate-100 transition-colors truncate"
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}