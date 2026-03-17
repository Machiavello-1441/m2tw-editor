import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Shield, Save, ChevronRight, Loader2 } from 'lucide-react';

const PLAYABILITY_LABELS = { 0: 'Not Playable', 1: 'Playable', 2: 'Unlockable', 3: 'Hidden' };
const ECONOMIC_AI_OPTIONS = ['balanced', 'religious', 'trader', 'comfortable', 'bureaucrat', 'craftsman', 'sailor', 'fortified'];
const MILITARY_AI_OPTIONS = ['smith', 'mao', 'genghis', 'stalin', 'napoleon', 'henry', 'caesar'];

function ColorSwatch({ r, g, b }) {
  return (
    <div
      className="w-4 h-4 rounded border border-slate-600 shrink-0"
      style={{ background: `rgb(${r},${g},${b})` }}
    />
  );
}

function FactionDetailEditor({ faction, onSave, onClose }) {
  const [form, setForm] = useState({ ...faction });
  const [saving, setSaving] = useState(false);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleSave = async () => {
    setSaving(true);
    await base44.entities.Faction.update(faction.id, form);
    setSaving(false);
    onSave(form);
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto p-3 gap-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-bold text-slate-100">{form.name_out || form.name_in}</div>
          <div className="text-[10px] text-slate-500 font-mono">{form.name_in}</div>
        </div>
        <button onClick={onClose} className="text-slate-500 hover:text-slate-200 text-xs px-2 py-1">✕ Back</button>
      </div>

      {/* Playability */}
      <div className="space-y-1">
        <label className="text-[10px] text-slate-400 uppercase tracking-wider">Playability</label>
        <div className="grid grid-cols-2 gap-1">
          {Object.entries(PLAYABILITY_LABELS).map(([val, label]) => (
            <button
              key={val}
              onClick={() => set('playability', Number(val))}
              className={`py-1.5 rounded text-[10px] font-semibold border transition-colors ${
                form.playability === Number(val)
                  ? 'bg-primary/20 border-primary text-primary'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
              }`}
            >{label}</button>
          ))}
        </div>
      </div>

      {/* Economic AI */}
      <div className="space-y-1">
        <label className="text-[10px] text-slate-400 uppercase tracking-wider">Economic AI</label>
        <select
          value={form.economic_ai || ''}
          onChange={e => set('economic_ai', e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200"
        >
          <option value="">— none —</option>
          {ECONOMIC_AI_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>

      {/* Military AI */}
      <div className="space-y-1">
        <label className="text-[10px] text-slate-400 uppercase tracking-wider">Military AI</label>
        <select
          value={form.military_ai || ''}
          onChange={e => set('military_ai', e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200"
        >
          <option value="">— none —</option>
          {MILITARY_AI_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>

      {/* Colors */}
      <div className="space-y-2">
        <label className="text-[10px] text-slate-400 uppercase tracking-wider">Primary Color</label>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded border border-slate-600" style={{ background: `rgb(${form.color1_r},${form.color1_g},${form.color1_b})` }} />
          <div className="grid grid-cols-3 gap-1 flex-1">
            {['r','g','b'].map((c,i) => {
              const key = `color1_${c}`;
              return (
                <div key={c} className="flex flex-col gap-0.5">
                  <span className="text-[9px] text-slate-500 uppercase">{c}</span>
                  <input type="number" min={0} max={255} value={form[key] ?? 0}
                    onChange={e => set(key, Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded px-1 py-0.5 text-xs text-slate-200"
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-[10px] text-slate-400 uppercase tracking-wider">Secondary Color</label>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded border border-slate-600" style={{ background: `rgb(${form.color2_r},${form.color2_g},${form.color2_b})` }} />
          <div className="grid grid-cols-3 gap-1 flex-1">
            {['r','g','b'].map((c) => {
              const key = `color2_${c}`;
              return (
                <div key={c} className="flex flex-col gap-0.5">
                  <span className="text-[9px] text-slate-500 uppercase">{c}</span>
                  <input type="number" min={0} max={255} value={form[key] ?? 0}
                    onChange={e => set(key, Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded px-1 py-0.5 text-xs text-slate-200"
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Extra flags */}
      <div className="space-y-1">
        <label className="text-[10px] text-slate-400 uppercase tracking-wider">Flags</label>
        <div className="grid grid-cols-2 gap-1">
          {['custom_battle','naval_invasion','has_princess','can_death','disband_pool','build_tower','reemergent','undiscovered'].map(flag => (
            <label key={flag} className="flex items-center gap-1.5 text-[10px] text-slate-300 cursor-pointer">
              <input type="checkbox" checked={!!form[flag]} onChange={e => set(flag, e.target.checked)}
                className="w-3 h-3 accent-primary" />
              {flag.replace(/_/g,' ')}
            </label>
          ))}
        </div>
      </div>

      {/* Money */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-[10px] text-slate-400 uppercase tracking-wider">Money</label>
          <input type="number" value={form.money ?? 0} onChange={e => set('money', Number(e.target.value))}
            className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200" />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] text-slate-400 uppercase tracking-wider">King's Purse</label>
          <input type="number" value={form.kings_purse ?? 0} onChange={e => set('kings_purse', Number(e.target.value))}
            className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200" />
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full flex items-center justify-center gap-2 py-2 rounded bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/80 disabled:opacity-50 transition-colors mt-auto"
      >
        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
        Save Faction
      </button>
    </div>
  );
}

export default function FactionsEditor() {
  const [factions, setFactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    base44.entities.Faction.list().then(data => {
      setFactions(data);
      setLoading(false);
    });
  }, []);

  const filtered = factions.filter(f =>
    !search || (f.name_in + ' ' + (f.name_out || '')).toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = (updated) => {
    setFactions(prev => prev.map(f => f.id === updated.id ? { ...f, ...updated } : f));
    setSelected(s => s ? { ...s, ...updated } : s);
  };

  return (
    <div className="dark h-screen flex flex-col bg-slate-950 text-slate-200">
      <div className="h-9 border-b border-slate-800 flex items-center px-3 gap-2 shrink-0 bg-slate-900/80">
        <Shield className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs font-semibold">Factions Editor</span>
        <span className="text-[10px] text-slate-500 ml-1">({factions.length} factions from DB)</span>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* List */}
        <div className="w-64 border-r border-slate-800 flex flex-col shrink-0">
          <div className="p-2 border-b border-slate-800">
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search factions…"
              className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 placeholder-slate-500"
            />
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
              </div>
            )}
            {!loading && filtered.length === 0 && (
              <div className="text-center py-8 text-xs text-slate-500">
                No factions found.<br />
                <span className="text-[10px]">Import a campaign folder first.</span>
              </div>
            )}
            {filtered.map(f => (
              <button
                key={f.id}
                onClick={() => setSelected(f)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left border-b border-slate-800/60 hover:bg-slate-800/60 transition-colors ${selected?.id === f.id ? 'bg-slate-800' : ''}`}
              >
                <div className="flex gap-1">
                  <ColorSwatch r={f.color1_r} g={f.color1_g} b={f.color1_b} />
                  <ColorSwatch r={f.color2_r} g={f.color2_g} b={f.color2_b} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-slate-200 truncate">{f.name_out || f.name_in}</div>
                  <div className="text-[10px] text-slate-500">{PLAYABILITY_LABELS[f.playability] ?? 'Unknown'}</div>
                </div>
                <ChevronRight className="w-3 h-3 text-slate-600 shrink-0" />
              </button>
            ))}
          </div>
        </div>

        {/* Detail */}
        <div className="flex-1 overflow-hidden">
          {selected ? (
            <FactionDetailEditor
              key={selected.id}
              faction={selected}
              onSave={handleSave}
              onClose={() => setSelected(null)}
            />
          ) : (
            <div className="h-full flex flex-col items-center justify-center gap-2 text-center px-4">
              <Shield className="w-8 h-8 text-slate-700" />
              <p className="text-sm text-slate-500">Select a faction to edit</p>
              <p className="text-[10px] text-slate-600">Changes are saved directly to the database</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}