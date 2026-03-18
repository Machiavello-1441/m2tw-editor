import React, { useState, useMemo } from 'react';
import { Plus, Trash2 } from 'lucide-react';

/**
 * Inline building editor for a settlement.
 * buildingLevelList: [{ name, building }] from EDB
 * buildings: string[] currently on this settlement (e.g. "core_building wooden_wall")
 * onChange: (newBuildings: string[]) => void
 */
export default function SettlementBuildingEditor({ buildings = [], buildingLevelList = [], onChange }) {
  const [search, setSearch] = useState('');

  // Group by building tree name for display in dropdown
  const grouped = useMemo(() => {
    const map = {};
    for (const lvl of buildingLevelList) {
      const grp = lvl.building || 'misc';
      if (!map[grp]) map[grp] = [];
      map[grp].push(lvl.name);
    }
    return Object.entries(map);
  }, [buildingLevelList]);

  // All available level names (flat)
  const allLevels = useMemo(() => buildingLevelList.map(l => l.name), [buildingLevelList]);

  const handleAdd = (levelName) => {
    if (!levelName || buildings.includes(levelName)) return;
    onChange([...buildings, levelName]);
    setSearch('');
  };

  const handleRemove = (idx) => {
    onChange(buildings.filter((_, i) => i !== idx));
  };

  const filtered = useMemo(() => {
    if (!search) return grouped;
    const q = search.toLowerCase();
    return grouped.map(([grp, levels]) => [grp, levels.filter(l => l.toLowerCase().includes(q))]).filter(([, l]) => l.length > 0);
  }, [grouped, search]);

  return (
    <div className="space-y-1">
      <p className="text-[9px] text-slate-500 uppercase font-semibold">Buildings</p>
      {/* Current buildings */}
      <div className="space-y-0.5">
        {buildings.length === 0
          ? <p className="text-[9px] text-slate-600 italic">No buildings</p>
          : buildings.map((b, idx) => (
            <div key={idx} className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800/60 border border-slate-700/40">
              <span className="text-[9px] text-slate-300 font-mono flex-1 truncate">{b}</span>
              <button onClick={() => handleRemove(idx)} className="text-slate-600 hover:text-red-400 transition-colors">
                <Trash2 className="w-2.5 h-2.5" />
              </button>
            </div>
          ))
        }
      </div>
      {/* Add building */}
      <div className="border-t border-slate-700/40 pt-1 space-y-1">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder={buildingLevelList.length > 0 ? "Filter buildings…" : "Load EDB first"}
          className="w-full h-5 px-1.5 text-[9px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 placeholder-slate-600" />
        {buildingLevelList.length > 0 && (
          <div className="max-h-28 overflow-y-auto space-y-0.5">
            {filtered.map(([grp, levels]) => (
              <div key={grp}>
                <p className="text-[8px] text-slate-600 font-semibold uppercase px-0.5">{grp}</p>
                {levels.map(lvl => (
                  <button key={lvl} onClick={() => handleAdd(lvl)}
                    className={`w-full text-left px-1.5 py-0.5 rounded text-[9px] font-mono transition-colors
                      ${buildings.includes(lvl)
                        ? 'text-slate-600 bg-slate-800/30 cursor-default'
                        : 'text-slate-400 hover:bg-amber-500/10 hover:text-amber-300 flex items-center gap-1'
                      }`}>
                    {!buildings.includes(lvl) && <Plus className="w-2 h-2 shrink-0" />}
                    {lvl}
                    {buildings.includes(lvl) && <span className="ml-1 text-[8px] text-green-600">✓</span>}
                  </button>
                ))}
              </div>
            ))}
            {filtered.length === 0 && <p className="text-[9px] text-slate-600 text-center py-1">No matches</p>}
          </div>
        )}
      </div>
    </div>
  );
}