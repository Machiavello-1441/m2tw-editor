import React, { useState } from 'react';
import { Plus, X, Check } from 'lucide-react';

export default function NewRegionForm({ factionColors, onAdd, onCancel }) {
  const [draft, setDraft] = useState({
    regionName: '',
    settlementName: '',
    regionDisplayName: '',
    settlementDisplayName: '',
    r: Math.floor(Math.random() * 200) + 30,
    g: Math.floor(Math.random() * 200) + 30,
    b: Math.floor(Math.random() * 200) + 30,
    faction: '',
    factionCreator: '',
    level: 'village',
    population: 400,
    yearFounded: 0,
  });

  const factionList = factionColors ? Object.keys(factionColors).sort() : [];

  const handleSubmit = () => {
    if (!draft.regionName || !draft.settlementName) return;
    onAdd(draft);
  };

  return (
    <div className="rounded-lg border border-green-600/40 bg-green-900/10 p-2.5 space-y-1.5">
      <p className="text-[10px] font-semibold text-green-400 uppercase tracking-wider flex items-center gap-1">
        <Plus className="w-3 h-3" /> New Region
      </p>

      <div className="grid grid-cols-2 gap-1.5">
        <div>
          <span className="text-[9px] text-slate-500">Region Internal *</span>
          <input value={draft.regionName} onChange={e => setDraft(d => ({ ...d, regionName: e.target.value }))}
            placeholder="e.g. Province_of_Rome"
            className="h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 w-full font-mono" />
        </div>
        <div>
          <span className="text-[9px] text-slate-500">Region Display</span>
          <input value={draft.regionDisplayName} onChange={e => setDraft(d => ({ ...d, regionDisplayName: e.target.value }))}
            placeholder="e.g. Province of Rome"
            className="h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 w-full font-mono" />
        </div>
        <div>
          <span className="text-[9px] text-slate-500">Settlement Internal *</span>
          <input value={draft.settlementName} onChange={e => setDraft(d => ({ ...d, settlementName: e.target.value }))}
            placeholder="e.g. Rome"
            className="h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 w-full font-mono" />
        </div>
        <div>
          <span className="text-[9px] text-slate-500">Settlement Display</span>
          <input value={draft.settlementDisplayName} onChange={e => setDraft(d => ({ ...d, settlementDisplayName: e.target.value }))}
            placeholder="e.g. Rome"
            className="h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 w-full font-mono" />
        </div>
      </div>

      {/* Region Color */}
      <div>
        <span className="text-[9px] text-slate-500">Region Color (RGB)</span>
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded border border-slate-600/40 shrink-0"
            style={{ background: `rgb(${draft.r},${draft.g},${draft.b})` }} />
          <input type="number" min="0" max="255" value={draft.r}
            onChange={e => setDraft(d => ({ ...d, r: parseInt(e.target.value) || 0 }))}
            className="h-6 px-1 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-red-400 w-14 font-mono text-center" />
          <input type="number" min="0" max="255" value={draft.g}
            onChange={e => setDraft(d => ({ ...d, g: parseInt(e.target.value) || 0 }))}
            className="h-6 px-1 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-green-400 w-14 font-mono text-center" />
          <input type="number" min="0" max="255" value={draft.b}
            onChange={e => setDraft(d => ({ ...d, b: parseInt(e.target.value) || 0 }))}
            className="h-6 px-1 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-blue-400 w-14 font-mono text-center" />
        </div>
      </div>

      {/* Faction */}
      <div>
        <span className="text-[9px] text-slate-500">Faction (owner)</span>
        {factionList.length > 0 ? (
          <select value={draft.faction} onChange={e => setDraft(d => ({ ...d, faction: e.target.value }))}
            className="w-full h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200">
            <option value="">— select faction —</option>
            {factionList.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        ) : (
          <input value={draft.faction} onChange={e => setDraft(d => ({ ...d, faction: e.target.value }))}
            placeholder="Faction name"
            className="h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 w-full font-mono" />
        )}
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <div>
          <span className="text-[9px] text-slate-500">Population</span>
          <input type="number" value={draft.population}
            onChange={e => setDraft(d => ({ ...d, population: parseInt(e.target.value) || 0 }))}
            className="h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 w-full font-mono" />
        </div>
        <div>
          <span className="text-[9px] text-slate-500">Year Founded</span>
          <input type="number" value={draft.yearFounded}
            onChange={e => setDraft(d => ({ ...d, yearFounded: parseInt(e.target.value) || 0 }))}
            className="h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 w-full font-mono" />
        </div>
      </div>

      <div className="flex gap-1.5 justify-end pt-0.5">
        <button onClick={onCancel}
          className="flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] text-slate-400 hover:text-slate-200 border border-slate-700/40">
          <X className="w-2.5 h-2.5" /> Cancel
        </button>
        <button onClick={handleSubmit}
          disabled={!draft.regionName || !draft.settlementName}
          className="flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] bg-green-700/80 hover:bg-green-700 border border-green-600/40 text-green-200 font-semibold disabled:opacity-40">
          <Check className="w-2.5 h-2.5" /> Create Region
        </button>
      </div>
    </div>
  );
}