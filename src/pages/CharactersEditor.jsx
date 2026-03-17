import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Users, Save, Loader2, ChevronRight, Search } from 'lucide-react';

const CHARACTER_TYPES = ['Named', 'General', 'Admiral', 'Diplomat', 'Princess', 'Spy', 'Assassin', 'Merchant', 'Priest', 'Witch', 'Heretic', 'Inquisitor', 'Other'];

function CharacterDetailEditor({ character, onSave, onClose }) {
  const [form, setForm] = useState({ ...character });
  const [saving, setSaving] = useState(false);
  const [traitInput, setTraitInput] = useState('');
  const [ancinput, setAncInput] = useState('');

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const addTrait = () => {
    if (!traitInput.trim()) return;
    set('traits', [...(form.traits || []), traitInput.trim()]);
    setTraitInput('');
  };

  const removeTrait = (i) => set('traits', (form.traits || []).filter((_, idx) => idx !== i));

  const addAnc = () => {
    if (!ancinput.trim()) return;
    set('ancillaries', [...(form.ancillaries || []), ancinput.trim()]);
    setAncInput('');
  };

  const removeAnc = (i) => set('ancillaries', (form.ancillaries || []).filter((_, idx) => idx !== i));

  const handleSave = async () => {
    setSaving(true);
    await base44.entities.Character.update(character.id, form);
    setSaving(false);
    onSave({ ...character, ...form });
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto p-3 gap-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-bold text-slate-100">{form.name}</div>
          <div className="text-[10px] text-slate-500">{form.faction} · {form.type}</div>
        </div>
        <button onClick={onClose} className="text-slate-500 hover:text-slate-200 text-xs px-2 py-1">✕ Back</button>
      </div>

      {/* Name */}
      <div className="space-y-1">
        <label className="text-[10px] text-slate-400 uppercase tracking-wider">Name</label>
        <input value={form.name || ''} onChange={e => set('name', e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200" />
      </div>

      {/* Type & Sex */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-[10px] text-slate-400 uppercase tracking-wider">Type</label>
          <select value={form.type || 'General'} onChange={e => set('type', e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200">
            {CHARACTER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] text-slate-400 uppercase tracking-wider">Sex</label>
          <select value={form.sex || 'male'} onChange={e => set('sex', e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200">
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </div>
      </div>

      {/* Age & Faction */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-[10px] text-slate-400 uppercase tracking-wider">Age</label>
          <input type="number" value={form.age ?? 30} onChange={e => set('age', Number(e.target.value))}
            className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200" />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] text-slate-400 uppercase tracking-wider">Faction</label>
          <input value={form.faction || ''} onChange={e => set('faction', e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200" />
        </div>
      </div>

      {/* Flags */}
      <div className="flex gap-4">
        {['is_leader','is_heir','offmap'].map(flag => (
          <label key={flag} className="flex items-center gap-1.5 text-[10px] text-slate-300 cursor-pointer">
            <input type="checkbox" checked={!!form[flag]} onChange={e => set(flag, e.target.checked)}
              className="w-3 h-3 accent-primary" />
            {flag.replace(/_/g,' ')}
          </label>
        ))}
      </div>

      {/* Coordinates */}
      <div className="space-y-1">
        <label className="text-[10px] text-slate-400 uppercase tracking-wider">Starting Coordinates</label>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-slate-500 w-4">X</span>
            <input type="number" value={form.pos_x ?? 0} onChange={e => set('pos_x', Number(e.target.value))}
              className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200" />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-slate-500 w-4">Y</span>
            <input type="number" value={form.pos_y ?? 0} onChange={e => set('pos_y', Number(e.target.value))}
              className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200" />
          </div>
        </div>
      </div>

      {/* Traits */}
      <div className="space-y-1">
        <label className="text-[10px] text-slate-400 uppercase tracking-wider">Traits</label>
        <div className="flex gap-1">
          <input value={traitInput} onChange={e => setTraitInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addTrait()}
            placeholder="trait_name level"
            className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 placeholder-slate-600" />
          <button onClick={addTrait} className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs text-slate-200">+</button>
        </div>
        <div className="flex flex-wrap gap-1 mt-1">
          {(form.traits || []).map((t, i) => (
            <span key={i} className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-[10px] text-slate-300">
              {t}
              <button onClick={() => removeTrait(i)} className="text-slate-500 hover:text-red-400">×</button>
            </span>
          ))}
        </div>
      </div>

      {/* Ancillaries */}
      <div className="space-y-1">
        <label className="text-[10px] text-slate-400 uppercase tracking-wider">Ancillaries</label>
        <div className="flex gap-1">
          <input value={ancinput} onChange={e => setAncInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addAnc()}
            placeholder="ancillary_name"
            className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 placeholder-slate-600" />
          <button onClick={addAnc} className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs text-slate-200">+</button>
        </div>
        <div className="flex flex-wrap gap-1 mt-1">
          {(form.ancillaries || []).map((a, i) => (
            <span key={i} className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-[10px] text-slate-300">
              {a}
              <button onClick={() => removeAnc(i)} className="text-slate-500 hover:text-red-400">×</button>
            </span>
          ))}
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full flex items-center justify-center gap-2 py-2 rounded bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/80 disabled:opacity-50 transition-colors mt-auto"
      >
        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
        Save Character
      </button>
    </div>
  );
}

export default function CharactersEditor() {
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [filterFaction, setFilterFaction] = useState('All');

  useEffect(() => {
    base44.entities.Character.list().then(data => {
      setCharacters(data);
      setLoading(false);
    });
  }, []);

  const factions = ['All', ...new Set(characters.map(c => c.faction).filter(Boolean))].sort();
  const types = ['All', ...CHARACTER_TYPES];

  const filtered = characters.filter(c => {
    if (search && !(c.name + ' ' + c.faction).toLowerCase().includes(search.toLowerCase())) return false;
    if (filterType !== 'All' && c.type !== filterType) return false;
    if (filterFaction !== 'All' && c.faction !== filterFaction) return false;
    return true;
  });

  const handleSave = (updated) => {
    setCharacters(prev => prev.map(c => c.id === updated.id ? updated : c));
    setSelected(updated);
  };

  const TYPE_ICON = { General: '⚔️', Admiral: '⚓', Spy: '🕵️', Assassin: '🗡️', Merchant: '💰', Diplomat: '🤝', Priest: '✝️', Princess: '👑', Named: '⭐' };

  return (
    <div className="dark h-screen flex flex-col bg-slate-950 text-slate-200">
      <div className="h-9 border-b border-slate-800 flex items-center px-3 gap-2 shrink-0 bg-slate-900/80">
        <Users className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs font-semibold">Characters Editor</span>
        <span className="text-[10px] text-slate-500 ml-1">({characters.length} characters)</span>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* List */}
        <div className="w-72 border-r border-slate-800 flex flex-col shrink-0">
          {/* Filters */}
          <div className="p-2 border-b border-slate-800 space-y-1.5">
            <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded px-2 py-1">
              <Search className="w-3 h-3 text-slate-500 shrink-0" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search name or faction…"
                className="flex-1 bg-transparent text-xs text-slate-200 placeholder-slate-500 outline-none" />
            </div>
            <div className="grid grid-cols-2 gap-1">
              <select value={filterType} onChange={e => setFilterType(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded px-1.5 py-1 text-[10px] text-slate-300">
                {types.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <select value={filterFaction} onChange={e => setFilterFaction(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded px-1.5 py-1 text-[10px] text-slate-300">
                {factions.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading && <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-500" /></div>}
            {!loading && filtered.length === 0 && (
              <div className="text-center py-8 text-xs text-slate-500">No characters found.<br /><span className="text-[10px]">Import a campaign folder first.</span></div>
            )}
            {filtered.map(c => (
              <button
                key={c.id}
                onClick={() => setSelected(c)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left border-b border-slate-800/60 hover:bg-slate-800/60 transition-colors ${selected?.id === c.id ? 'bg-slate-800' : ''}`}
              >
                <span className="text-base leading-none">{TYPE_ICON[c.type] || '👤'}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-slate-200 truncate">{c.name}</div>
                  <div className="text-[10px] text-slate-500">{c.faction} · {c.type} · age {c.age}</div>
                </div>
                <ChevronRight className="w-3 h-3 text-slate-600 shrink-0" />
              </button>
            ))}
          </div>
        </div>

        {/* Detail */}
        <div className="flex-1 overflow-hidden">
          {selected ? (
            <CharacterDetailEditor
              key={selected.id}
              character={selected}
              onSave={handleSave}
              onClose={() => setSelected(null)}
            />
          ) : (
            <div className="h-full flex flex-col items-center justify-center gap-2 text-center px-4">
              <Users className="w-8 h-8 text-slate-700" />
              <p className="text-sm text-slate-500">Select a character to edit</p>
              <p className="text-[10px] text-slate-600">Changes saved directly to the database</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}