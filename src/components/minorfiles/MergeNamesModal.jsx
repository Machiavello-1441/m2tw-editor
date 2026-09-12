import React, { useState, useMemo } from 'react';
import { X, Search } from 'lucide-react';

const SECTIONS = [
  { key: 'characters', label: 'Male names' },
  { key: 'surnames', label: 'Surnames' },
  { key: 'females', label: 'Female names' },
];

/**
 * Compute the merged result for one section.
 * Returns { list, added, skipped, internalDupes } where:
 *  - added   = names from sources not already in target
 *  - skipped = names from sources that were already present (duplicates)
 *  - internalDupes = duplicate names already inside the target itself
 */
export function mergeSection(target, sources, { dedupe, sort }) {
  const seen = new Set();
  const internalDupes = [];
  let list = [];
  for (const n of target) {
    if (seen.has(n)) { internalDupes.push(n); if (dedupe) continue; }
    seen.add(n); list.push(n);
  }
  const added = [], skipped = [];
  for (const n of sources) {
    if (seen.has(n)) { skipped.push(n); if (!dedupe) list.push(n); continue; }
    seen.add(n); list.push(n); added.push(n);
  }
  if (sort) list = [...list].sort((a, b) => a.localeCompare(b));
  return { list, added, skipped, internalDupes };
}

export default function MergeNamesModal({ target, descrNames, onConfirm, onClose }) {
  const [selected, setSelected] = useState([]);
  const [filter, setFilter] = useState('');
  const [dedupe, setDedupe] = useState(true);
  const [sort, setSort] = useState(false);

  const candidates = useMemo(() =>
    Object.keys(descrNames).filter(f => f !== target && f.toLowerCase().includes(filter.toLowerCase())),
    [descrNames, target, filter]);

  const preview = useMemo(() => {
    const out = {};
    for (const { key } of SECTIONS) {
      const src = selected.flatMap(f => descrNames[f]?.[key] || []);
      out[key] = mergeSection(descrNames[target]?.[key] || [], src, { dedupe, sort });
    }
    return out;
  }, [selected, descrNames, target, dedupe, sort]);

  const toggle = (f) => setSelected(s => s.includes(f) ? s.filter(x => x !== f) : [...s, f]);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-slate-800 border border-slate-600 rounded-lg p-4 w-[30rem] max-h-[85vh] flex flex-col gap-3 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-200">Merge names into <span className="font-mono text-amber-400">{target}</span></h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300"><X className="w-4 h-4" /></button>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] text-slate-500 uppercase font-semibold">Source factions</label>
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded px-1.5 h-6">
            <Search className="w-3 h-3 text-slate-500 shrink-0" />
            <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filter…"
              className="flex-1 bg-transparent text-[11px] text-slate-200 placeholder-slate-600 focus:outline-none" />
          </div>
          <div className="max-h-32 overflow-y-auto border border-slate-700 rounded p-1 space-y-0.5">
            {candidates.map(f => (
              <label key={f} className="flex items-center gap-2 px-1.5 py-0.5 rounded hover:bg-slate-700/60 cursor-pointer text-[11px] font-mono text-slate-300">
                <input type="checkbox" checked={selected.includes(f)} onChange={() => toggle(f)} className="accent-amber-500" />
                {f}
              </label>
            ))}
            {candidates.length === 0 && <p className="text-[10px] text-slate-600 px-1.5 py-1">No factions</p>}
          </div>
        </div>

        <div className="flex flex-col gap-1.5 text-[11px] text-slate-300">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={dedupe} onChange={e => setDedupe(e.target.checked)} className="accent-amber-500" />
            Eliminate duplicates (skip names already present, also inside the target)
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={sort} onChange={e => setSort(e.target.checked)} className="accent-amber-500" />
            Sort each section alphabetically (A→Z)
          </label>
        </div>

        <div className="border border-slate-700 rounded divide-y divide-slate-700 text-[10px]">
          {SECTIONS.map(({ key, label }) => {
            const p = preview[key];
            return (
              <div key={key} className="px-2 py-1.5 flex items-center gap-3">
                <span className="w-24 text-slate-400 font-semibold">{label}</span>
                <span className="text-green-400">+{p.added.length} new</span>
                <span className={p.skipped.length ? 'text-yellow-400' : 'text-slate-600'}>{p.skipped.length} duplicate{p.skipped.length !== 1 ? 's' : ''} from sources</span>
                <span className={p.internalDupes.length ? 'text-orange-400' : 'text-slate-600'}>{p.internalDupes.length} in target</span>
                <span className="ml-auto text-slate-500 font-mono">→ {p.list.length}</span>
              </div>
            );
          })}
        </div>

        <div className="flex gap-2 justify-end pt-1">
          <button onClick={onClose}
            className="px-3 py-1 rounded text-[11px] border border-slate-600 text-slate-400 hover:text-slate-200 hover:border-slate-400 transition-colors">
            Cancel
          </button>
          <button onClick={() => onConfirm(preview)} disabled={selected.length === 0 && !dedupe && !sort}
            className="px-3 py-1 rounded text-[11px] bg-amber-600/30 border border-amber-500/50 text-amber-300 hover:bg-amber-600/50 disabled:opacity-40 transition-colors">
            Merge
          </button>
        </div>
      </div>
    </div>
  );
}