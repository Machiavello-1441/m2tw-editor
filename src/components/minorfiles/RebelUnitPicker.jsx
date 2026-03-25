import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Plus, Search, X } from 'lucide-react';

export default function RebelUnitPicker({ eduUnitNames, existingUnits, onAdd }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState('');
  const [exp, setExp] = useState(1);
  const [maxCount, setMaxCount] = useState(2);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const existingSet = useMemo(() => new Set((existingUnits || []).map(u => u.unitName)), [existingUnits]);

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    const all = eduUnitNames.length > 0 ? eduUnitNames : [];
    return all.filter(n => !existingSet.has(n) && (!s || n.toLowerCase().includes(s))).slice(0, 40);
  }, [eduUnitNames, existingSet, search]);

  const handleConfirm = () => {
    const name = selected || search.trim();
    if (!name) return;
    onAdd(name, parseInt(exp) || 0, parseInt(maxCount) || 1);
    setSelected('');
    setSearch('');
    setExp(1);
    setMaxCount(2);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] border border-dashed border-slate-600/40 text-slate-400 hover:text-slate-200 hover:border-slate-400 transition-colors">
        <Plus className="w-3 h-3" /> Add Unit
      </button>

      {open && (
        <div className="absolute z-20 mt-1 left-0 w-80 bg-slate-900 border border-slate-700 rounded-lg shadow-xl overflow-hidden">
          {/* Search */}
          <div className="flex items-center gap-1 px-2 py-1.5 border-b border-slate-700/60">
            <Search className="w-3 h-3 text-slate-500 shrink-0" />
            <input
              autoFocus
              value={search}
              onChange={e => { setSearch(e.target.value); setSelected(''); }}
              placeholder={eduUnitNames.length > 0 ? 'Search EDU units…' : 'Type unit name…'}
              className="flex-1 bg-transparent text-[11px] text-slate-200 outline-none placeholder-slate-600 font-mono"
            />
            {(search || selected) && (
              <button onClick={() => { setSearch(''); setSelected(''); }} className="text-slate-600 hover:text-slate-400">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* EDU unit list */}
          {eduUnitNames.length > 0 && (
            <div className="max-h-40 overflow-y-auto border-b border-slate-700/60">
              {filtered.length === 0 && (
                <p className="text-[10px] text-slate-600 text-center py-2">No matching units</p>
              )}
              {filtered.map(name => (
                <button
                  key={name}
                  onClick={() => { setSelected(name); setSearch(name); }}
                  className={`w-full text-left px-2 py-1 text-[10px] font-mono transition-colors truncate ${
                    selected === name
                      ? 'bg-amber-600/20 text-amber-300'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-slate-100'
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          )}

          {/* Exp + MaxCount + Confirm */}
          <div className="px-2 py-2 space-y-1.5">
            {/* Selected unit name (editable if no EDU list) */}
            {eduUnitNames.length === 0 && (
              <div>
                <span className="text-[9px] text-slate-500">Unit type</span>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="unit_type_name"
                  className="w-full h-6 px-1.5 text-[10px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 font-mono"
                />
              </div>
            )}
            <div className="grid grid-cols-2 gap-1.5">
              <div>
                <span className="text-[9px] text-slate-500">Experience (exp)</span>
                <input
                  type="number" min="0" max="9" value={exp}
                  onChange={e => setExp(e.target.value)}
                  className="w-full h-6 px-1.5 text-[10px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 font-mono text-center"
                />
              </div>
              <div>
                <span className="text-[9px] text-slate-500">Max count</span>
                <input
                  type="number" min="1" max="99" value={maxCount}
                  onChange={e => setMaxCount(e.target.value)}
                  className="w-full h-6 px-1.5 text-[10px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 font-mono text-center"
                />
              </div>
            </div>
            <button
              onClick={handleConfirm}
              disabled={!selected && !search.trim()}
              className="w-full flex items-center justify-center gap-1 py-1 rounded text-[10px] bg-amber-600/80 hover:bg-amber-600 text-slate-900 font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus className="w-3 h-3" />
              {selected || search.trim() ? `Add "${selected || search.trim()}"` : 'Select a unit first'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}