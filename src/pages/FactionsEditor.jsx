import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, Download, Plus, Trash2, ChevronRight, ChevronDown, AlertTriangle, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

const VANILLA_FACTION_LIMIT = 31;

// ── Parser ────────────────────────────────────────────────────────────────────
function parseDescrSmFactions(text) {
  const factions = [];
  const lines = text.split('\n');
  let current = null;

  for (const rawLine of lines) {
    const line = rawLine.replace(/;.*$/, '').trim();
    if (!line) continue;

    if (line.startsWith('faction ')) {
      if (current) factions.push(current);
      current = {
        name: line.slice(8).trim(),
        culture: '',
        religion: '',
        symbol: '',
        rebel_symbol: '',
        primary_colour: { r: 0, g: 0, b: 0 },
        secondary_colour: { r: 0, g: 0, b: 0 },
        loading_logo: '',
        standard_index: '',
        logo_index: '',
        small_logo_index: '',
        triumph_value: '5',
        custom_battle_availability: 'yes',
        can_sap: 'no',
        prefers_naval_invasions: 'no',
        can_have_princess: 'yes',
        has_family_tree: 'yes',
        // extra fields stored as raw lines for round-trip fidelity
        extras: [],
      };
      continue;
    }

    if (!current) continue;

    const spaceIdx = line.indexOf(' ');
    const key = spaceIdx === -1 ? line : line.slice(0, spaceIdx);
    const val = spaceIdx === -1 ? '' : line.slice(spaceIdx + 1).trim();

    const parseColour = (v) => {
      const m = v.match(/red\s+(\d+)[,\s]+green\s+(\d+)[,\s]+blue\s+(\d+)/i);
      return m ? { r: +m[1], g: +m[2], b: +m[3] } : { r: 0, g: 0, b: 0 };
    };

    switch (key) {
      case 'culture':                       current.culture = val; break;
      case 'religion':                      current.religion = val; break;
      case 'symbol':                        current.symbol = val; break;
      case 'rebel_symbol':                  current.rebel_symbol = val; break;
      case 'primary_colour':
      case 'primary_color':                 current.primary_colour = parseColour(val); break;
      case 'secondary_colour':
      case 'secondary_color':               current.secondary_colour = parseColour(val); break;
      case 'loading_logo':                  current.loading_logo = val; break;
      case 'standard_index':                current.standard_index = val; break;
      case 'logo_index':                    current.logo_index = val; break;
      case 'small_logo_index':              current.small_logo_index = val; break;
      case 'triumph_value':                 current.triumph_value = val; break;
      case 'custom_battle_availability':    current.custom_battle_availability = val; break;
      case 'can_sap':                       current.can_sap = val; break;
      case 'prefers_naval_invasions':       current.prefers_naval_invasions = val; break;
      case 'can_have_princess':             current.can_have_princess = val; break;
      case 'has_family_tree':               current.has_family_tree = val; break;
      default:
        current.extras.push(line);
        break;
    }
  }
  if (current) factions.push(current);
  return factions;
}

// ── Serialiser ────────────────────────────────────────────────────────────────
function serialiseDescrSmFactions(factions) {
  const HEADER = `;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; faction description
;;  logo_index          gets resolved from STRATEGY_SPRITE_PAGE
;;  small_logo_index    gets resolved from SHARED_SPRITE_PAGE
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

`;
  const SEP = '\n;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;\n\n';

  const fmtColour = (c) => `red ${c.r}, green ${c.g}, blue ${c.b}`;

  const lines = (f) => {
    const rows = [
      `faction\t\t\t\t\t\t${f.name}`,
      `culture\t\t\t\t\t\t${f.culture}`,
      `religion\t\t\t\t\t${f.religion}`,
      f.symbol          ? `symbol\t\t\t\t\t\t${f.symbol}` : null,
      f.rebel_symbol    ? `rebel_symbol\t\t\t\t${f.rebel_symbol}` : null,
      `primary_colour\t\t\t\t${fmtColour(f.primary_colour)}`,
      `secondary_colour\t\t\t${fmtColour(f.secondary_colour)}`,
      f.loading_logo    ? `loading_logo\t\t\t\t${f.loading_logo}` : null,
      f.standard_index !== '' ? `standard_index\t\t\t\t${f.standard_index}` : null,
      f.logo_index      ? `logo_index\t\t\t\t\t${f.logo_index}` : null,
      f.small_logo_index? `small_logo_index\t\t\t${f.small_logo_index}` : null,
      f.triumph_value   ? `triumph_value\t\t\t\t${f.triumph_value}` : null,
      `custom_battle_availability\t${f.custom_battle_availability}`,
      `can_sap\t\t\t\t\t\t${f.can_sap}`,
      `prefers_naval_invasions\t\t${f.prefers_naval_invasions}`,
      `can_have_princess\t\t\t${f.can_have_princess}`,
      `has_family_tree\t\t\t\t${f.has_family_tree}`,
      ...(f.extras || []),
    ].filter(r => r !== null);
    return rows.join('\n');
  };

  return HEADER + factions.map(lines).join(SEP) + '\n';
}

// ── Colour swatch ─────────────────────────────────────────────────────────────
function ColourPicker({ label, colour, onChange }) {
  const c = colour || { r: 0, g: 0, b: 0 };
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <label className="text-[10px] text-slate-400 uppercase tracking-wider w-32 shrink-0">{label}</label>
        <div className="w-6 h-6 rounded border border-slate-600 shrink-0" style={{ background: `rgb(${c.r},${c.g},${c.b})` }} />
      </div>
      <div className="grid grid-cols-3 gap-1 pl-34">
        {['r', 'g', 'b'].map(ch => (
          <div key={ch} className="flex flex-col gap-0.5">
            <span className="text-[9px] text-slate-500 uppercase text-center">{ch}</span>
            <input type="number" min={0} max={255}
              value={c[ch]}
              onChange={e => onChange({ ...c, [ch]: Math.max(0, Math.min(255, +e.target.value || 0)) })}
              className="w-full bg-slate-800 border border-slate-700 rounded px-1 py-0.5 text-xs text-center text-slate-200"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Yes/No toggle ─────────────────────────────────────────────────────────────
function YesNo({ label, value, onChange }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-[10px] text-slate-400">{label}</span>
      <div className="flex rounded overflow-hidden border border-slate-700">
        {['yes', 'no'].map(opt => (
          <button key={opt} onClick={() => onChange(opt)}
            className={`px-2 py-0.5 text-[10px] transition-colors ${value === opt ? 'bg-primary text-primary-foreground' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Faction detail panel ──────────────────────────────────────────────────────
function FactionDetail({ faction, onChange }) {
  const set = (key, val) => onChange({ ...faction, [key]: val });

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4 max-w-lg">

        {/* Identity */}
        <section className="space-y-2">
          <h3 className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-700 pb-1">Identity</h3>
          {[
            ['name', 'Internal Name (faction key)'],
            ['culture', 'Culture'],
            ['religion', 'Religion'],
          ].map(([k, l]) => (
            <div key={k} className="flex items-center gap-3">
              <label className="text-[10px] text-slate-400 w-40 shrink-0">{l}</label>
              <Input className="h-6 text-[11px] px-2 flex-1" value={faction[k] ?? ''} onChange={e => set(k, e.target.value)} />
            </div>
          ))}
        </section>

        {/* Colours */}
        <section className="space-y-3">
          <h3 className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-700 pb-1">Colours</h3>
          <ColourPicker label="Primary" colour={faction.primary_colour} onChange={v => set('primary_colour', v)} />
          <ColourPicker label="Secondary" colour={faction.secondary_colour} onChange={v => set('secondary_colour', v)} />
        </section>

        {/* Files */}
        <section className="space-y-2">
          <h3 className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-700 pb-1">Files & Indices</h3>
          {[
            ['symbol', 'Symbol (.CAS)'],
            ['rebel_symbol', 'Rebel Symbol (.CAS)'],
            ['loading_logo', 'Loading Logo (.tga)'],
            ['logo_index', 'Logo Index'],
            ['small_logo_index', 'Small Logo Index'],
            ['standard_index', 'Standard Index'],
            ['triumph_value', 'Triumph Value'],
          ].map(([k, l]) => (
            <div key={k} className="flex items-center gap-3">
              <label className="text-[10px] text-slate-400 w-40 shrink-0">{l}</label>
              <Input className="h-6 text-[11px] px-2 flex-1 font-mono" value={faction[k] ?? ''} onChange={e => set(k, e.target.value)} />
            </div>
          ))}
        </section>

        {/* Flags */}
        <section className="space-y-1">
          <h3 className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-700 pb-1">Flags</h3>
          <YesNo label="Custom battle availability" value={faction.custom_battle_availability} onChange={v => set('custom_battle_availability', v)} />
          <YesNo label="Can sap" value={faction.can_sap} onChange={v => set('can_sap', v)} />
          <YesNo label="Prefers naval invasions" value={faction.prefers_naval_invasions} onChange={v => set('prefers_naval_invasions', v)} />
          <YesNo label="Can have princess" value={faction.can_have_princess} onChange={v => set('can_have_princess', v)} />
          <YesNo label="Has family tree" value={faction.has_family_tree} onChange={v => set('has_family_tree', v)} />
        </section>

        {/* Extra / unknown lines */}
        {faction.extras?.length > 0 && (
          <section className="space-y-1">
            <h3 className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-700 pb-1">Additional Lines</h3>
            <textarea
              className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-[10px] font-mono text-slate-300 resize-y"
              rows={Math.min(faction.extras.length + 1, 6)}
              value={faction.extras.join('\n')}
              onChange={e => set('extras', e.target.value.split('\n'))}
            />
          </section>
        )}
      </div>
    </ScrollArea>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
const LS_KEY = 'm2tw_sm_factions_raw';

export default function FactionsEditor() {
  const [factions, setFactions] = useState(null);
  const [selectedIdx, setSelectedIdx] = useState(null);
  const [search, setSearch] = useState('');
  const fileInputRef = useRef();

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) setFactions(parseDescrSmFactions(raw));
    } catch {}
  }, []);

  const handleFileInput = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    try { localStorage.setItem(LS_KEY, text); } catch {}
    const parsed = parseDescrSmFactions(text);
    setFactions(parsed);
    setSelectedIdx(parsed.length > 0 ? 0 : null);
    e.target.value = '';
  }, []);

  const handleExport = () => {
    if (!factions) return;
    const text = serialiseDescrSmFactions(factions);
    const blob = new Blob([text], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'descr_sm_factions.txt';
    a.click();
  };

  const updateFaction = (i, f) => {
    const updated = factions.map((x, idx) => idx === i ? f : x);
    setFactions(updated);
    try { localStorage.setItem(LS_KEY, serialiseDescrSmFactions(updated)); } catch {}
  };

  const addFaction = () => {
    const newF = {
      name: 'new_faction',
      culture: 'northern_european',
      religion: 'catholic',
      symbol: 'models_strat/symbol_new_faction.CAS',
      rebel_symbol: 'models_strat/symbol_rebels.CAS',
      primary_colour: { r: 128, g: 128, b: 128 },
      secondary_colour: { r: 200, g: 200, b: 200 },
      loading_logo: '',
      standard_index: '',
      logo_index: '',
      small_logo_index: '',
      triumph_value: '5',
      custom_battle_availability: 'yes',
      can_sap: 'no',
      prefers_naval_invasions: 'no',
      can_have_princess: 'yes',
      has_family_tree: 'yes',
      extras: [],
    };
    const updated = [...(factions || []), newF];
    setFactions(updated);
    setSelectedIdx(updated.length - 1);
  };

  const deleteFaction = (i) => {
    const updated = factions.filter((_, idx) => idx !== i);
    setFactions(updated);
    setSelectedIdx(updated.length > 0 ? Math.min(i, updated.length - 1) : null);
  };

  const filtered = factions
    ? factions.map((f, i) => ({ f, i })).filter(({ f }) => !search || f.name.toLowerCase().includes(search.toLowerCase()))
    : [];

  const overLimit = factions && factions.length > VANILLA_FACTION_LIMIT;

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="h-10 border-b border-border flex items-center px-4 gap-3 shrink-0 bg-card/50">
        <Shield className="w-4 h-4 text-muted-foreground" />
        <span className="text-xs font-semibold">Factions Editor</span>
        <span className="text-[10px] text-muted-foreground font-mono">descr_sm_factions.txt</span>
        {factions && <span className="text-[10px] text-slate-500">({factions.length} factions)</span>}
        {overLimit && (
          <span className="flex items-center gap-1 text-[10px] text-amber-400 bg-amber-900/30 border border-amber-700 rounded px-2 py-0.5">
            <AlertTriangle className="w-3 h-3" />
            {factions.length} factions — vanilla limit is {VANILLA_FACTION_LIMIT}. Extra factions require M2EX.
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <input ref={fileInputRef} type="file" accept=".txt" className="hidden" onChange={handleFileInput} />
          <Button variant="outline" size="sm" className="text-[10px] h-7" onClick={() => fileInputRef.current?.click()}>
            <Upload className="w-3 h-3 mr-1" />
            {factions ? 'Reload file' : 'Load descr_sm_factions.txt'}
          </Button>
          {factions && (
            <Button variant="outline" size="sm" className="text-[10px] h-7" onClick={handleExport}>
              <Download className="w-3 h-3 mr-1" /> Export
            </Button>
          )}
        </div>
      </div>

      {!factions ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-3 text-slate-500">
          <Shield className="w-10 h-10 opacity-30" />
          <p className="text-sm">Load <span className="font-mono text-amber-400">descr_sm_factions.txt</span> to begin</p>
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            <Upload className="w-3 h-3 mr-1" /> Choose file…
          </Button>
        </div>
      ) : (
        <div className="flex flex-1 min-h-0">
          {/* Sidebar list */}
          <div className="w-56 border-r border-border flex flex-col shrink-0">
            <div className="p-2 border-b border-border space-y-1">
              <Input placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)}
                className="h-6 text-[10px] px-2" />
              <Button variant="outline" size="sm" className="w-full text-[10px] h-6" onClick={addFaction}>
                <Plus className="w-3 h-3 mr-1" /> Add Faction
              </Button>
            </div>
            <ScrollArea className="flex-1">
              {filtered.map(({ f, i }) => (
                <button key={i} onClick={() => setSelectedIdx(i)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left border-b border-border/60 hover:bg-accent transition-colors group ${selectedIdx === i ? 'bg-accent' : ''}`}>
                  <div className="flex gap-1 shrink-0">
                    <div className="w-3 h-3 rounded-sm border border-slate-600"
                      style={{ background: `rgb(${f.primary_colour.r},${f.primary_colour.g},${f.primary_colour.b})` }} />
                    <div className="w-3 h-3 rounded-sm border border-slate-600"
                      style={{ background: `rgb(${f.secondary_colour.r},${f.secondary_colour.g},${f.secondary_colour.b})` }} />
                  </div>
                  <span className="flex-1 text-[11px] font-mono truncate">{f.name}</span>
                  <button onClick={e => { e.stopPropagation(); deleteFaction(i); }}
                    className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-400 transition-opacity shrink-0">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </button>
              ))}
            </ScrollArea>
          </div>

          {/* Detail panel */}
          <div className="flex-1 min-h-0 overflow-hidden">
            {selectedIdx !== null && factions[selectedIdx] ? (
              <FactionDetail
                key={selectedIdx}
                faction={factions[selectedIdx]}
                onChange={f => updateFaction(selectedIdx, f)}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                Select a faction to edit
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}