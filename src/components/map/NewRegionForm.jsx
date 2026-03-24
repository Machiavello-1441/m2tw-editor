import React, { useState, useMemo } from 'react';
import { Plus, X, Check, ChevronDown, ChevronRight } from 'lucide-react';
import { extractHiddenResourcesFromEDB } from './additionalParsers';

export default function NewRegionForm({ factionColors, onAdd, onCancel, edbData, rebelFactionList, hiddenResourceList, musicTypeList, mercenaryPoolList, religionList, naturalResList }) {
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
    rebelFaction: '',
    resources: [],
    hiddenResources: [],
    val1: 0,
    val2: 0,
    musicType: '',
    mercenaryPool: '',
    religions: {},
  });
  const [showAdvanced, setShowAdvanced] = useState(true);

  const factionList = factionColors ? Object.keys(factionColors).sort() : [];
  const edbHiddenRes = useMemo(() => hiddenResourceList || extractHiddenResourcesFromEDB(edbData), [hiddenResourceList, edbData]);

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

      {/* Rebel Faction */}
      <div>
        <span className="text-[9px] text-slate-500">Rebel Faction</span>
        {(rebelFactionList?.length > 0) ? (
          <select value={draft.rebelFaction} onChange={e => setDraft(d => ({ ...d, rebelFaction: e.target.value }))}
            className="w-full h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200">
            <option value="">— select rebel faction —</option>
            {rebelFactionList.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        ) : (
          <input value={draft.rebelFaction} onChange={e => setDraft(d => ({ ...d, rebelFaction: e.target.value }))}
            placeholder="e.g. slave (load descr_rebel_factions.txt)"
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

      {/* Natural Resources */}
      <div>
        <span className="text-[9px] text-slate-500">Natural Resources (descr_sm_resources)</span>
        {draft.resources.length > 0 && (
          <div className="flex flex-wrap gap-0.5 mb-1">
            {draft.resources.map(r => (
              <span key={r} className="flex items-center gap-0.5 px-1 py-0.5 bg-slate-800/60 rounded text-[9px] text-emerald-300 font-mono">
                {r}
                <button onClick={() => setDraft(d => ({ ...d, resources: d.resources.filter(x => x !== r) }))}
                  className="text-slate-600 hover:text-red-400"><X className="w-2 h-2" /></button>
              </span>
            ))}
          </div>
        )}
        {naturalResList?.length > 0 ? (
          <select value="" onChange={e => {
            const val = e.target.value;
            if (val && !draft.resources.includes(val))
              setDraft(d => ({ ...d, resources: [...d.resources, val] }));
          }} className="w-full h-6 px-1 text-[10px] bg-slate-800 border border-slate-600/40 rounded text-slate-200">
            <option value="">— add resource —</option>
            {naturalResList.filter(r => !draft.resources.includes(r)).map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        ) : (
          <p className="text-[9px] text-slate-600 italic">Load descr_sm_resources.txt for list</p>
        )}
      </div>

      {/* Triumph & Agriculture */}
      <div className="grid grid-cols-2 gap-1.5">
        <div>
          <span className="text-[9px] text-slate-500">Triumph value</span>
          <input type="number" value={draft.val1}
            onChange={e => setDraft(d => ({ ...d, val1: parseInt(e.target.value) || 0 }))}
            className="h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 w-full font-mono" />
        </div>
        <div>
          <span className="text-[9px] text-slate-500">Agriculture value</span>
          <input type="number" value={draft.val2}
            onChange={e => setDraft(d => ({ ...d, val2: parseInt(e.target.value) || 0 }))}
            className="h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 w-full font-mono" />
        </div>
      </div>

      {/* Advanced toggle */}
      <button onClick={() => setShowAdvanced(v => !v)}
        className="flex items-center gap-1 text-[9px] text-slate-500 hover:text-slate-300 transition-colors">
        {showAdvanced ? <ChevronDown className="w-2.5 h-2.5" /> : <ChevronRight className="w-2.5 h-2.5" />}
        Advanced (Hidden Resources, Music, Mercenaries, Religions)
      </button>

      {showAdvanced && (
        <div className="space-y-1.5 border-t border-slate-700/30 pt-1.5">
          {/* Hidden Resources */}
          <div>
            <span className="text-[9px] text-slate-500">Hidden Resources (EDB)</span>
            {draft.hiddenResources.length > 0 && (
              <div className="flex flex-wrap gap-0.5 mb-1">
                {draft.hiddenResources.map(hr => (
                  <span key={hr} className="flex items-center gap-0.5 px-1 py-0.5 bg-slate-800/60 rounded text-[9px] text-purple-300 font-mono">
                    {hr}
                    <button onClick={() => setDraft(d => ({ ...d, hiddenResources: d.hiddenResources.filter(x => x !== hr) }))}
                      className="text-slate-600 hover:text-red-400"><X className="w-2 h-2" /></button>
                  </span>
                ))}
              </div>
            )}
            <select value="" onChange={e => {
              const val = e.target.value;
              if (val && !draft.hiddenResources.includes(val))
                setDraft(d => ({ ...d, hiddenResources: [...d.hiddenResources, val] }));
            }}
              className="w-full h-6 px-1 text-[10px] bg-slate-800 border border-slate-600/40 rounded text-slate-200">
              <option value="">{edbHiddenRes.length ? '— add hidden resource —' : 'Load EDB for list'}</option>
              {edbHiddenRes.filter(hr => !draft.hiddenResources.includes(hr)).map(hr => <option key={hr} value={hr}>{hr}</option>)}
            </select>
          </div>

          {/* Music Type */}
          <div>
            <span className="text-[9px] text-slate-500">Music Type</span>
            {(musicTypeList?.length > 0) ? (
              <select value={draft.musicType} onChange={e => setDraft(d => ({ ...d, musicType: e.target.value }))}
                className="w-full h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200">
                <option value="">— select music type —</option>
                {musicTypeList.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            ) : (
              <input value={draft.musicType} onChange={e => setDraft(d => ({ ...d, musicType: e.target.value }))}
                placeholder="Load descr_sounds_music_types.txt"
                className="h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 w-full font-mono" />
            )}
          </div>

          {/* Mercenary Pool */}
          <div>
            <span className="text-[9px] text-slate-500">Mercenary Pool</span>
            {(mercenaryPoolList?.length > 0) ? (
              <select value={draft.mercenaryPool} onChange={e => setDraft(d => ({ ...d, mercenaryPool: e.target.value }))}
                className="w-full h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200">
                <option value="">— select pool —</option>
                {mercenaryPoolList.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            ) : (
              <input value={draft.mercenaryPool} onChange={e => setDraft(d => ({ ...d, mercenaryPool: e.target.value }))}
                placeholder="Load descr_mercenaries.txt"
                className="h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 w-full font-mono" />
            )}
          </div>

          {/* Religions */}
          {religionList?.length > 0 && (
            <div>
              <span className="text-[9px] text-slate-500">Religions</span>
              <div className="space-y-0.5 max-h-24 overflow-y-auto">
                {religionList.map(rel => (
                  <div key={rel} className="flex items-center gap-1.5">
                    <span className="text-[9px] text-slate-400 font-mono flex-1 truncate">{rel}</span>
                    <input type="number" min="0" max="100" value={draft.religions[rel] || 0}
                      onChange={e => setDraft(d => ({ ...d, religions: { ...d.religions, [rel]: parseInt(e.target.value) || 0 } }))}
                      className="w-14 h-5 px-1 text-[10px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 font-mono text-center" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

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