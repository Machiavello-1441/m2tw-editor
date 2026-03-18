import React, { useState } from 'react';
import { Plus } from 'lucide-react';

const KNOWN_BOOL_FLAGS = [
  'marian_reforms_disabled', 'marian_reforms_activated',
  'rebelling_characters_active', 'rebelling_characters_inactive',
  'gladiator_uprising_disabled', 'night_battles_enabled',
  'night_battles_disabled', 'show_date_as_turns',
];
const NUMERIC_FLAGS = ['brigand_spawn_value', 'pirate_spawn_value'];

function FactionGroup({ label, factions, color, allFactions, onRemove, onAdd }) {
  const [sel, setSel] = useState('');
  const available = allFactions.filter(f => !factions.includes(f));
  return (
    <div>
      <p className={`text-[9px] font-semibold uppercase mb-0.5 ${color}`}>{label} ({factions.length})</p>
      <div className="flex flex-wrap gap-0.5 mb-1">
        {factions.map(f => (
          <span key={f} className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] bg-slate-800 border border-slate-600/40 text-slate-300 font-mono">
            {f}
            <button onClick={() => onRemove(f)} className="text-slate-600 hover:text-red-400 ml-0.5 leading-none">×</button>
          </span>
        ))}
      </div>
      <div className="flex gap-1">
        <select value={sel} onChange={e => setSel(e.target.value)}
          className="flex-1 h-5 px-1 text-[9px] bg-slate-800 border border-slate-600/40 rounded text-slate-400">
          <option value="">+ add faction…</option>
          {available.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        <button onClick={() => { if (sel) { onAdd(sel); setSel(''); } }}
          className="px-1.5 py-0.5 rounded text-[9px] bg-slate-700 hover:bg-slate-600 text-slate-300 border border-slate-600/40 flex items-center">
          <Plus className="w-2.5 h-2.5" />
        </button>
      </div>
    </div>
  );
}

export default function StratSettingsEditor({ stratData, onStratSettingsChange, factionList }) {
  if (!stratData || !onStratSettingsChange) return null;

  const allFactions = [...new Set([
    ...(stratData.playable || []),
    ...(stratData.unlockable || []),
    ...(stratData.nonplayable || []),
    ...(factionList || []),
  ])].sort();

  const set = (key, val) => onStratSettingsChange({ [key]: val });

  const moveFaction = (fname, toGroup) => {
    const newP = (stratData.playable || []).filter(f => f !== fname);
    const newU = (stratData.unlockable || []).filter(f => f !== fname);
    const newN = (stratData.nonplayable || []).filter(f => f !== fname);
    if (toGroup === 'playable') newP.push(fname);
    else if (toGroup === 'unlockable') newU.push(fname);
    else if (toGroup === 'nonplayable') newN.push(fname);
    onStratSettingsChange({ playable: newP, unlockable: newU, nonplayable: newN });
  };

  const toggleFlag = (flag) => {
    const cur = stratData.flags || {};
    const newFlags = { ...cur };
    if (newFlags[flag]) delete newFlags[flag];
    else newFlags[flag] = true;
    set('flags', newFlags);
  };

  const setNumericFlag = (flag, val) => {
    set('flags', { ...(stratData.flags || {}), [flag]: val });
  };

  const inputCls = "flex-1 h-5 px-1 text-[10px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 font-mono";

  return (
    <div className="space-y-2">
      {/* Basic fields */}
      <div className="space-y-1">
        {[['Campaign', 'campaignName'], ['Script', 'scriptFile']].map(([label, key]) => (
          <div key={key} className="flex items-center gap-1.5">
            <span className="text-[9px] text-slate-500 w-14 shrink-0">{label}</span>
            <input value={stratData[key] || ''} onChange={e => set(key, e.target.value)} className={inputCls} />
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] text-slate-500 w-14 shrink-0">Start date</span>
          <input value={stratData.startDate || ''} onChange={e => set('startDate', e.target.value)}
            className={inputCls} placeholder="1080 summer" />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] text-slate-500 w-14 shrink-0">End date</span>
          <input value={stratData.endDate || ''} onChange={e => set('endDate', e.target.value)}
            className={inputCls} placeholder="1530 winter" />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] text-slate-500 w-14 shrink-0">Timescale</span>
          <input type="number" step="0.5" min="0.5" value={stratData.timescale || ''}
            onChange={e => set('timescale', e.target.value)}
            className="w-16 h-5 px-1 text-[10px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 font-mono" />
          <span className="text-[9px] text-slate-600">yr/turn</span>
        </div>
      </div>

      {/* Boolean flags */}
      <div>
        <p className="text-[9px] text-slate-500 uppercase font-semibold mb-1">Flags</p>
        <div className="flex flex-wrap gap-1 mb-1">
          {KNOWN_BOOL_FLAGS.map(flag => {
            const active = !!(stratData.flags || {})[flag];
            return (
              <button key={flag} onClick={() => toggleFlag(flag)}
                className={`px-1.5 py-0.5 rounded text-[8px] border font-mono transition-colors ${active ? 'bg-green-500/20 border-green-500/40 text-green-400' : 'bg-slate-800 border-slate-600/40 text-slate-500 hover:text-slate-300'}`}>
                {flag}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2">
          {NUMERIC_FLAGS.map(flag => (
            <div key={flag} className="flex items-center gap-1">
              <span className="text-[9px] text-slate-500 font-mono">{flag.replace('_value', '')}:</span>
              <input type="number" min="0" value={(stratData.flags || {})[flag] ?? ''}
                onChange={e => setNumericFlag(flag, parseInt(e.target.value) || 0)}
                className="w-12 h-5 px-1 text-[9px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 font-mono" />
            </div>
          ))}
        </div>
      </div>

      {/* Faction groups */}
      <div className="space-y-2 border-t border-slate-700/40 pt-2">
        <p className="text-[9px] text-slate-500 uppercase font-semibold">Faction Playability</p>
        <FactionGroup label="Playable" factions={stratData.playable || []} color="text-green-400"
          allFactions={allFactions} onRemove={f => moveFaction(f, null)} onAdd={f => moveFaction(f, 'playable')} />
        <FactionGroup label="Unlockable" factions={stratData.unlockable || []} color="text-yellow-400"
          allFactions={allFactions} onRemove={f => moveFaction(f, null)} onAdd={f => moveFaction(f, 'unlockable')} />
        <FactionGroup label="Nonplayable" factions={stratData.nonplayable || []} color="text-slate-500"
          allFactions={allFactions} onRemove={f => moveFaction(f, null)} onAdd={f => moveFaction(f, 'nonplayable')} />
      </div>
    </div>
  );
}