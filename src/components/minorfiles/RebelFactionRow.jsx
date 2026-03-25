import React, { useState, useMemo } from 'react';
import { X, ChevronDown, ChevronRight, Plus } from 'lucide-react';
import RebelUnitPicker from './RebelUnitPicker';

const CATEGORY_COLORS = {
  gladiator_revolt: 'text-red-400',
  brigands: 'text-amber-400',
  peasant_revolt: 'text-green-400',
};

export default function RebelFactionRow({ faction, displayName, categories, eduUnitNames, onUpdate, onDisplayNameChange, onRemove }) {
  const [expanded, setExpanded] = useState(false);

  const addUnit = (unitName, exp = 1, maxCount = 2) => {
    if (!unitName) return;
    const already = (faction.units || []).some(u => u.unitName === unitName);
    if (already) return;
    onUpdate({ units: [...(faction.units || []), { unitName, minExp: exp, maxCount }] });
  };

  const removeUnit = (idx) => {
    onUpdate({ units: (faction.units || []).filter((_, i) => i !== idx) });
  };

  const updateUnit = (idx, field, value) => {
    onUpdate({ units: (faction.units || []).map((u, i) => i === idx ? { ...u, [field]: value } : u) });
  };

  const catColor = CATEGORY_COLORS[faction.category] || 'text-slate-400';

  return (
    <div className="rounded border border-slate-700/40 bg-slate-900/20">
      {/* Header row */}
      <div className="flex items-center gap-1.5 px-2 py-1.5">
        <button onClick={() => setExpanded(v => !v)} className="text-slate-500 hover:text-slate-300 shrink-0">
          {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </button>
        <span className="text-[11px] font-mono text-slate-200 flex-1 truncate">{faction.name}</span>
        <span className={`text-[9px] font-mono ${catColor}`}>{faction.category || '—'}</span>
        <span className="text-[9px] text-slate-500 font-mono">ch:{faction.chance ?? 50}</span>
        <span className="text-[9px] text-slate-600 font-mono">{(faction.units || []).length}u</span>
        <button onClick={onRemove} className="text-slate-600 hover:text-red-400 transition-colors shrink-0">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Expanded edit panel */}
      {expanded && (
        <div className="border-t border-slate-700/40 px-2 py-2 space-y-2">
          {/* Name + Display name */}
          <div className="grid grid-cols-2 gap-1.5">
            <div>
              <span className="text-[9px] text-slate-500">Internal Name</span>
              <input value={faction.name} onChange={e => onUpdate({ name: e.target.value })}
                className="w-full h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 font-mono" />
            </div>
            <div>
              <span className="text-[9px] text-slate-500">Display Name (type)</span>
              <input value={displayName} onChange={e => onDisplayNameChange(e.target.value)}
                className="w-full h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200" />
            </div>
          </div>

          {/* Category + Chance + Description */}
          <div className="grid grid-cols-3 gap-1.5">
            <div>
              <span className="text-[9px] text-slate-500">Category</span>
              <select value={faction.category} onChange={e => onUpdate({ category: e.target.value })}
                className="w-full h-6 px-1 text-[10px] bg-slate-800 border border-slate-600/40 rounded text-slate-200">
                <option value="">— none —</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <span className="text-[9px] text-slate-500">Chance</span>
              <input type="number" min="0" max="100" value={faction.chance ?? 50}
                onChange={e => onUpdate({ chance: parseInt(e.target.value) || 0 })}
                className="w-full h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 font-mono" />
            </div>
            <div>
              <span className="text-[9px] text-slate-500">Description</span>
              <input value={faction.description} onChange={e => onUpdate({ description: e.target.value })}
                className="w-full h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 font-mono" />
            </div>
          </div>

          {/* Units */}
          <div>
            <p className="text-[9px] text-slate-500 uppercase font-semibold mb-1">
              Units ({(faction.units || []).length})
            </p>
            {(faction.units || []).length > 0 && (
              <div className="space-y-0.5 mb-1.5 max-h-40 overflow-y-auto">
                {(faction.units || []).map((u, i) => (
                  <div key={i} className="flex items-center gap-1 px-1.5 py-0.5 bg-slate-800/60 rounded text-[10px]">
                    <span className="text-slate-300 font-mono flex-1 truncate">{u.unitName}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[8px] text-slate-600">exp:</span>
                      <input type="number" min="0" max="9" value={u.minExp}
                        onChange={e => updateUnit(i, 'minExp', parseInt(e.target.value) || 0)}
                        className="w-8 h-5 px-0.5 text-[10px] bg-slate-900 border border-slate-600/40 rounded text-slate-200 font-mono text-center" />
                      <span className="text-[8px] text-slate-600">max:</span>
                      <input type="number" min="1" max="99" value={u.maxCount}
                        onChange={e => updateUnit(i, 'maxCount', parseInt(e.target.value) || 1)}
                        className="w-8 h-5 px-0.5 text-[10px] bg-slate-900 border border-slate-600/40 rounded text-slate-200 font-mono text-center" />
                    </div>
                    <button onClick={() => removeUnit(i)} className="text-slate-600 hover:text-red-400 shrink-0">
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <RebelUnitPicker eduUnitNames={eduUnitNames} existingUnits={faction.units || []} onAdd={addUnit} />
          </div>
        </div>
      )}
    </div>
  );
}