import React, { useState, useMemo } from 'react';
import { Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import FamilyTreeTab from './FamilyTreeTab';

const CHARACTER_TYPES = ['general','admiral','spy','merchant','diplomat','priest','assassin','princess','heretic','witch','inquisitor','named character'];

function CharacterRow({ char, allFactions, onUpdate, onDelete, onSelect }) {
  const [expanded, setExpanded] = useState(false);
  const c = char;

  const set = (key, val) => onUpdate(c.id, { ...c, [key]: val });

  const charLabel = `${c.name || '(unnamed)'} — ${c.charType || 'general'} (${c.faction || '?'})`;

  return (
    <div className="rounded border border-slate-700/40 bg-slate-900/20">
      <div className="flex items-center gap-1.5 px-2 py-1.5 cursor-pointer" onClick={() => setExpanded(v => !v)}>
        {expanded ? <ChevronDown className="w-3 h-3 text-slate-500" /> : <ChevronRight className="w-3 h-3 text-slate-500" />}
        <span className="text-sm shrink-0">
          {c.charType === 'admiral' ? '⚓' : c.charType === 'spy' ? '🕵️' : c.charType === 'priest' ? '✝' : '⚔️'}
        </span>
        <span className="text-[11px] font-mono flex-1 truncate text-slate-200">{charLabel}</span>
        <span className="text-[9px] text-slate-600 font-mono">{c.x != null ? `${c.x},${c.y}` : 'unplaced'}</span>
        <button onClick={e => { e.stopPropagation(); onSelect(char); }}
          className="text-[9px] px-1 py-0.5 rounded bg-amber-600/20 border border-amber-500/30 text-amber-400 hover:bg-amber-600/40 shrink-0">
          Go
        </button>
        <button onClick={e => { e.stopPropagation(); onDelete(c.id); }}
          className="p-0.5 text-slate-600 hover:text-red-400 transition-colors shrink-0">
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      {expanded && (
        <div className="border-t border-slate-700/40 px-2 py-2 space-y-1.5">
          <div className="grid grid-cols-2 gap-1.5">
            <div>
              <span className="text-[9px] text-slate-500">Name</span>
              <input value={c.name || ''} onChange={e => set('name', e.target.value)}
                className="w-full h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 font-mono" />
            </div>
            <div>
              <span className="text-[9px] text-slate-500">Type</span>
              <select value={c.charType || 'general'} onChange={e => set('charType', e.target.value)}
                className="w-full h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200">
                {CHARACTER_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <span className="text-[9px] text-slate-500">Faction</span>
              <select value={c.faction || ''} onChange={e => set('faction', e.target.value)}
                className="w-full h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200">
                <option value="">— select —</option>
                {allFactions.map(f => <option key={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <span className="text-[9px] text-slate-500">Sex</span>
              <select value={c.sex || 'male'} onChange={e => set('sex', e.target.value)}
                className="w-full h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200">
                <option value="male">male</option>
                <option value="female">female</option>
              </select>
            </div>
            <div>
              <span className="text-[9px] text-slate-500">Role</span>
              <select value={c.role || ''} onChange={e => set('role', e.target.value)}
                className="w-full h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200">
                <option value="">—</option>
                <option value="leader">leader</option>
                <option value="heir">heir</option>
              </select>
            </div>
            <div>
              <span className="text-[9px] text-slate-500">Age</span>
              <input type="number" value={c.age || 30} onChange={e => set('age', parseInt(e.target.value) || 30)}
                className="w-full h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 font-mono" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <div>
              <span className="text-[9px] text-slate-500">X (map)</span>
              <input type="number" value={c.x ?? ''} onChange={e => set('x', parseInt(e.target.value))}
                className="w-full h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 font-mono" />
            </div>
            <div>
              <span className="text-[9px] text-slate-500">Y (map)</span>
              <input type="number" value={c.y ?? ''} onChange={e => set('y', parseInt(e.target.value))}
                className="w-full h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 font-mono" />
            </div>
          </div>
          {/* Traits */}
          <div>
            <p className="text-[9px] text-slate-500 uppercase font-semibold mb-0.5">Traits</p>
            {(c.traits || []).map((t, i) => (
              <div key={i} className="flex items-center gap-1 mb-0.5">
                <input value={t.name} onChange={e => {
                  const traits = c.traits.map((x, j) => j === i ? { ...x, name: e.target.value } : x);
                  set('traits', traits);
                }} className="flex-1 h-5 px-1 text-[10px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 font-mono" placeholder="TraitName" />
                <input type="number" value={t.level} onChange={e => {
                  const traits = c.traits.map((x, j) => j === i ? { ...x, level: parseInt(e.target.value) } : x);
                  set('traits', traits);
                }} className="w-10 h-5 px-1 text-[10px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 font-mono text-center" />
                <button onClick={() => set('traits', c.traits.filter((_, j) => j !== i))} className="text-slate-600 hover:text-red-400 text-[9px]">✕</button>
              </div>
            ))}
            <button onClick={() => set('traits', [...(c.traits || []), { name: '', level: 1 }])}
              className="text-[9px] text-slate-500 hover:text-slate-300 flex items-center gap-0.5">
              <Plus className="w-2.5 h-2.5" /> Add trait
            </button>
          </div>
          {/* Ancillaries */}
          <div>
            <p className="text-[9px] text-slate-500 uppercase font-semibold mb-0.5">Ancillaries</p>
            <div className="flex flex-wrap gap-0.5 mb-0.5">
              {(c.ancillaries || []).map((a, i) => (
                <span key={i} className="flex items-center gap-0.5 px-1 py-0.5 bg-slate-700/50 rounded text-[9px] text-purple-300 font-mono">
                  {a}<button onClick={() => set('ancillaries', c.ancillaries.filter((_, j) => j !== i))} className="text-slate-600 hover:text-red-400 ml-0.5">×</button>
                </span>
              ))}
            </div>
            <div className="flex gap-1">
              <input id={`anc-${c.id}`} placeholder="ancillary_name" className="flex-1 h-5 px-1 text-[9px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 font-mono" />
              <button onClick={() => {
                const inp = document.getElementById(`anc-${c.id}`);
                if (inp?.value) { set('ancillaries', [...(c.ancillaries||[]), inp.value]); inp.value = ''; }
              }} className="text-[9px] px-1 rounded bg-slate-700/60 border border-slate-600/40 text-slate-300 hover:text-slate-100">+</button>
            </div>
          </div>

          {/* Army */}
          {(c.charType === 'general' || c.charType === 'named character' || c.charType === 'admiral') && (
            <div>
              <p className="text-[9px] text-slate-500 uppercase font-semibold mb-0.5">Army Units</p>
              <div className="space-y-0.5">
                {(c.army || []).map((u, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <input value={u.unit} onChange={e => {
                      const army = c.army.map((x, j) => j === i ? { ...x, unit: e.target.value } : x);
                      set('army', army);
                    }} className="flex-1 h-5 px-1 text-[9px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 font-mono" placeholder="unit name" />
                    <input type="number" title="exp" value={u.exp ?? 0} min={0} onChange={e => {
                      const army = c.army.map((x, j) => j === i ? { ...x, exp: parseInt(e.target.value)||0 } : x);
                      set('army', army);
                    }} className="w-8 h-5 px-0.5 text-[9px] bg-slate-800 border border-slate-600/40 rounded text-amber-300 font-mono text-center" />
                    <input type="number" title="armour" value={u.armour ?? 0} min={0} onChange={e => {
                      const army = c.army.map((x, j) => j === i ? { ...x, armour: parseInt(e.target.value)||0 } : x);
                      set('army', army);
                    }} className="w-8 h-5 px-0.5 text-[9px] bg-slate-800 border border-slate-600/40 rounded text-blue-300 font-mono text-center" />
                    <input type="number" title="wpn" value={u.weaponLvl ?? 0} min={0} onChange={e => {
                      const army = c.army.map((x, j) => j === i ? { ...x, weaponLvl: parseInt(e.target.value)||0 } : x);
                      set('army', army);
                    }} className="w-8 h-5 px-0.5 text-[9px] bg-slate-800 border border-slate-600/40 rounded text-red-300 font-mono text-center" />
                    <button onClick={() => set('army', c.army.filter((_, j) => j !== i))} className="text-slate-600 hover:text-red-400 text-[9px] shrink-0">✕</button>
                  </div>
                ))}
              </div>
              <p className="text-[8px] text-slate-600 mb-0.5">exp | armour | wpn_lvl</p>
              <button onClick={() => set('army', [...(c.army || []), { unit: '', exp: 0, armour: 0, weaponLvl: 0 }])}
                className="text-[9px] text-slate-500 hover:text-slate-300 flex items-center gap-0.5">
                <Plus className="w-2.5 h-2.5" /> Add unit
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function CharactersTab({ stratData, onStratDataChange, onSelectItem }) {
  const [subTab, setSubTab] = useState('list');
  const [search, setSearch] = useState('');
  const [filterFaction, setFilterFaction] = useState('');

  const allFactions = useMemo(() => {
    const from = (stratData?.factions || []).map(f => f.name).filter(Boolean);
    const fromLists = [...(stratData?.playable || []), ...(stratData?.unlockable || []), ...(stratData?.nonplayable || [])];
    return [...new Set([...from, ...fromLists])].sort();
  }, [stratData]);

  const allChars = useMemo(() =>
    (stratData?.items || []).filter(i => i.category === 'character'),
    [stratData?.items]
  );

  const filtered = useMemo(() =>
    allChars.filter(c => {
      const matchSearch = !search || c.name?.toLowerCase().includes(search.toLowerCase()) || c.charType?.includes(search);
      const matchFaction = !filterFaction || c.faction === filterFaction;
      return matchSearch && matchFaction;
    }),
    [allChars, search, filterFaction]
  );

  const handleUpdate = (id, updatedChar) => {
    if (!stratData) return;
    const items = (stratData.items || []).map(i => i.id === id ? updatedChar : i);
    onStratDataChange({ ...stratData, items });
  };

  const handleDelete = (id) => {
    if (!stratData) return;
    const items = (stratData.items || []).filter(i => i.id !== id);
    onStratDataChange({ ...stratData, items });
  };

  const handleAdd = () => {
    if (!stratData) return;
    const newChar = {
      id: -(Date.now()),
      category: 'character',
      name: 'New Character',
      charType: 'general',
      sex: 'male',
      role: '',
      age: 30,
      faction: allFactions[0] || '',
      x: null,
      y: null,
      traits: [],
      ancillaries: [],
      army: [],
    };
    const items = [...(stratData.items || []), newChar];
    onStratDataChange({ ...stratData, items });
  };

  if (!stratData?.raw) {
    return <div className="p-3 text-[10px] text-slate-600 text-center">Load descr_strat.txt to edit characters</div>;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Sub-tabs: Characters list | Family Trees */}
      <div className="flex border-b border-slate-800 shrink-0">
        {[['list', 'Characters'], ['trees', 'Family Trees']].map(([id, label]) => (
          <button key={id} onClick={() => setSubTab(id)}
            className={`flex-1 py-1 text-[9px] font-semibold border-b-2 transition-colors ${subTab === id ? 'border-amber-500 text-amber-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
            {label}
          </button>
        ))}
      </div>

      {subTab === 'trees' && (
        <div className="flex-1 overflow-hidden">
          <FamilyTreeTab stratData={stratData} />
        </div>
      )}

      {subTab === 'list' && (
        <>
          <div className="p-2 space-y-1.5 shrink-0 border-b border-slate-800">
            <div className="flex gap-1">
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or type…"
                className="flex-1 h-6 px-2 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 placeholder-slate-600" />
              <select value={filterFaction} onChange={e => setFilterFaction(e.target.value)}
                className="h-6 px-1 text-[10px] bg-slate-800 border border-slate-600/40 rounded text-slate-200">
                <option value="">All factions</option>
                {allFactions.map(f => <option key={f}>{f}</option>)}
              </select>
            </div>
            <button onClick={handleAdd}
              className="w-full flex items-center justify-center gap-1 py-1 text-[10px] rounded border border-slate-600/40 text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 transition-colors">
              <Plus className="w-3 h-3" /> Add Character
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {filtered.length === 0 && (
              <div className="text-[10px] text-slate-600 italic text-center py-4">
                {allChars.length === 0 ? 'No characters in descr_strat.txt' : 'No characters match filters'}
              </div>
            )}
            {filtered.map(char => (
              <CharacterRow
                key={char.id}
                char={char}
                allFactions={allFactions}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
                onSelect={onSelectItem}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}