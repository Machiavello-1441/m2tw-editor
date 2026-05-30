import React, { useState, useCallback, useMemo } from 'react';
import { Globe, FolderOpen, Download, Plus, Trash2, ChevronDown, ChevronRight, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { parseDescrCulturesFull, serializeDescrCulturesFull, SETTLEMENT_TYPES, AGENT_TYPES } from '../components/cultures/culturesParser';

function downloadText(text, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  a.download = filename;
  a.click();
}

// ── Path input helper ─────────────────────────────────────────────────────────
function PathInput({ value, onChange, placeholder, className }) {
  return (
    <input
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder || ''}
      className={`h-6 px-1.5 text-[10px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 font-mono w-full ${className || ''}`}
    />
  );
}

// ── Settlements tab ───────────────────────────────────────────────────────────
const SETTLEMENT_LABELS = {
  village: 'Village (Town lvl 1)',
  moot_and_bailey: 'Moot & Bailey (Castle lvl 1)',
  town: 'Town (Town lvl 2)',
  wooden_castle: 'Wooden Castle (Castle lvl 2)',
  large_town: 'Large Town (Town lvl 3)',
  castle: 'Castle (Castle lvl 3)',
  city: 'City (Town lvl 4)',
  fortress: 'Fortress (Castle lvl 4)',
  large_city: 'Large City (Town lvl 5)',
  citadel: 'Citadel (Castle lvl 5)',
  huge_city: 'Huge City (Town lvl 6)',
};

function SettlementsTab({ culture, onChange }) {
  return (
    <div className="space-y-2">
      {SETTLEMENT_TYPES.map(st => {
        const s = culture.settlements[st] || { normal: '', normalAnim: '', card: '' };
        const set = (field, val) => onChange({
          ...culture,
          settlements: { ...culture.settlements, [st]: { ...s, [field]: val } }
        });
        return (
          <div key={st} className="rounded border border-slate-700/40 bg-slate-900/30 p-2 space-y-1.5">
            <p className="text-[10px] font-semibold text-amber-400 font-mono">{st}
              <span className="text-slate-500 font-sans font-normal ml-2">{SETTLEMENT_LABELS[st]}</span>
            </p>
            <div className="grid grid-cols-[80px_1fr] gap-x-2 gap-y-1 items-center">
              <span className="text-[9px] text-slate-500">normal (.CAS)</span>
              <PathInput value={s.normal} onChange={v => set('normal', v)} placeholder="data/models_strat/residences/..." />
              <span className="text-[9px] text-slate-500">anim tag</span>
              <PathInput value={s.normalAnim} onChange={v => set('normalAnim', v)} placeholder="settlement_eastern_level_1" />
              <span className="text-[9px] text-slate-500">card (.tga)</span>
              <PathInput value={s.card} onChange={v => set('card', v)} placeholder="data/ui/.../cities/....tga" />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Infrastructure tab ────────────────────────────────────────────────────────
function InfrastructureTab({ culture, onChange }) {
  const set = (field, val) => onChange({ ...culture, [field]: val });
  const setNested = (field, subField, val) => onChange({ ...culture, [field]: { ...culture[field], [subField]: val } });
  const setPort = (idx, side, field, val) => {
    const ports = culture.ports.map((p, i) => i !== idx ? p : { ...p, [side]: { ...p[side], [field]: val } });
    onChange({ ...culture, ports });
  };

  return (
    <div className="space-y-3">
      {/* Fort */}
      <div className="rounded border border-slate-700/40 bg-slate-900/30 p-2 space-y-1.5">
        <p className="text-[10px] font-semibold text-slate-300 uppercase">Fort</p>
        <div className="grid grid-cols-[90px_1fr] gap-x-2 gap-y-1 items-center">
          <span className="text-[9px] text-slate-500">fort (.CAS)</span>
          <PathInput value={culture.fort?.path} onChange={v => setNested('fort', 'path', v)} />
          <span className="text-[9px] text-slate-500">anim tag</span>
          <PathInput value={culture.fort?.anim} onChange={v => setNested('fort', 'anim', v)} placeholder="fort_roman" />
          <span className="text-[9px] text-slate-500">fort_cost</span>
          <input type="number" value={culture.fortCost || 0} onChange={e => set('fortCost', parseInt(e.target.value) || 0)}
            className="h-6 px-1.5 text-[10px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 font-mono w-full" />
          <span className="text-[9px] text-slate-500">fort_wall</span>
          <PathInput value={culture.fortWall} onChange={v => set('fortWall', v)} />
        </div>
      </div>

      {/* Watchtower */}
      <div className="rounded border border-slate-700/40 bg-slate-900/30 p-2 space-y-1.5">
        <p className="text-[10px] font-semibold text-slate-300 uppercase">Watchtower</p>
        <div className="grid grid-cols-[90px_1fr] gap-x-2 gap-y-1 items-center">
          <span className="text-[9px] text-slate-500">watchtower</span>
          <PathInput value={culture.watchtower?.path} onChange={v => setNested('watchtower', 'path', v)} />
          <span className="text-[9px] text-slate-500">anim tag</span>
          <PathInput value={culture.watchtower?.anim} onChange={v => setNested('watchtower', 'anim', v)} placeholder="watchtower_roman" />
          <span className="text-[9px] text-slate-500">cost</span>
          <input type="number" value={culture.watchtowerCost || 0} onChange={e => set('watchtowerCost', parseInt(e.target.value) || 0)}
            className="h-6 px-1.5 text-[10px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 font-mono w-full" />
        </div>
      </div>

      {/* Fishing Village */}
      <div className="rounded border border-slate-700/40 bg-slate-900/30 p-2 space-y-1.5">
        <p className="text-[10px] font-semibold text-slate-300 uppercase">Fishing Village (Port lvl 1)</p>
        <div className="grid grid-cols-[90px_1fr] gap-x-2 gap-y-1 items-center">
          <span className="text-[9px] text-slate-500">path (.CAS)</span>
          <PathInput value={culture.fishingVillage?.path} onChange={v => setNested('fishingVillage', 'path', v)} />
          <span className="text-[9px] text-slate-500">anim tag</span>
          <PathInput value={culture.fishingVillage?.anim} onChange={v => setNested('fishingVillage', 'anim', v)} placeholder="port_roman_level_1" />
        </div>
      </div>

      {/* Ports lvl 2-4 */}
      {(culture.ports || []).map((port, idx) => (
        <div key={idx} className="rounded border border-slate-700/40 bg-slate-900/30 p-2 space-y-1.5">
          <p className="text-[10px] font-semibold text-slate-300 uppercase">Port Level {idx + 2}</p>
          <div className="grid grid-cols-[90px_1fr] gap-x-2 gap-y-1 items-center">
            <span className="text-[9px] text-slate-500">port_land</span>
            <PathInput value={port.land?.path} onChange={v => setPort(idx, 'land', 'path', v)} />
            <span className="text-[9px] text-slate-500">land anim</span>
            <PathInput value={port.land?.anim} onChange={v => setPort(idx, 'land', 'anim', v)} placeholder={`port_roman_level_${idx + 2}`} />
            <span className="text-[9px] text-slate-500">port_sea</span>
            <PathInput value={port.sea?.path} onChange={v => setPort(idx, 'sea', 'path', v)} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Agents tab ────────────────────────────────────────────────────────────────
function AgentsTab({ culture, onChange }) {
  const setAgent = (ag, field, val) => onChange({
    ...culture,
    agents: { ...culture.agents, [ag]: { ...culture.agents[ag], [field]: val } }
  });

  return (
    <div className="space-y-2">
      <p className="text-[9px] text-slate-500 italic">Paths are relative filenames (e.g. spy.tga). Cost is in denari.</p>
      {AGENT_TYPES.map(ag => {
        const a = culture.agents[ag] || { tga: '', infoTga: '', tga2: '', cost: 200, n1: 1, n2: 1 };
        return (
          <div key={ag} className="rounded border border-slate-700/40 bg-slate-900/30 p-2 space-y-1">
            <p className="text-[10px] font-semibold text-amber-400 font-mono capitalize">{ag}</p>
            <div className="grid grid-cols-[70px_1fr] gap-x-2 gap-y-1 items-center text-[9px]">
              <span className="text-slate-500">icon.tga</span>
              <PathInput value={a.tga} onChange={v => setAgent(ag, 'tga', v)} placeholder={`${ag}.tga`} />
              <span className="text-slate-500">info.tga</span>
              <PathInput value={a.infoTga} onChange={v => setAgent(ag, 'infoTga', v)} placeholder={`${ag}_info.tga`} />
              <span className="text-slate-500">card.tga</span>
              <PathInput value={a.tga2} onChange={v => setAgent(ag, 'tga2', v)} placeholder={`${ag}.tga`} />
              <span className="text-slate-500">cost</span>
              <input type="number" value={a.cost} onChange={e => setAgent(ag, 'cost', parseInt(e.target.value) || 0)}
                className="h-6 px-1.5 text-[10px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 font-mono w-full" />
              <span className="text-slate-500">n1 / n2</span>
              <div className="flex gap-1">
                <input type="number" value={a.n1} onChange={e => setAgent(ag, 'n1', parseInt(e.target.value) || 1)}
                  className="h-6 w-14 px-1 text-[10px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 font-mono text-center" />
                <input type="number" value={a.n2} onChange={e => setAgent(ag, 'n2', parseInt(e.target.value) || 1)}
                  className="h-6 w-14 px-1 text-[10px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 font-mono text-center" />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CulturesEditor() {
  const [cultures, setCultures] = useState(() => {
    try {
      const raw = localStorage.getItem('m2tw_cultures_file') || sessionStorage.getItem('m2tw_cultures_raw');
      return raw ? parseDescrCulturesFull(raw) : [];
    } catch { return []; }
  });
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [tab, setTab] = useState('general');
  const [rawText, setRawText] = useState(null); // stores original raw for re-load

  const selected = cultures[selectedIdx] || null;

  const handleLoad = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    e.target.value = '';
    try { localStorage.setItem('m2tw_cultures_file', text); sessionStorage.setItem('m2tw_cultures_raw', text); } catch {}
    setRawText(text);
    const parsed = parseDescrCulturesFull(text);
    setCultures(parsed);
    setSelectedIdx(0);
  };

  const handleExport = () => {
    if (!cultures.length) return;
    const text = serializeDescrCulturesFull(cultures);
    downloadText(text, 'descr_cultures.txt');
  };

  const updateSelected = useCallback((updated) => {
    setCultures(prev => prev.map((c, i) => i === selectedIdx ? updated : c));
  }, [selectedIdx]);

  const handleAddCulture = () => {
    if (!cultures.length) return;
    // Duplicate the first culture as a template
    const base = JSON.parse(JSON.stringify(cultures[selectedIdx] || cultures[0]));
    base.name = `new_culture_${cultures.length}`;
    base.portraitMapping = base.name;
    const updated = [...cultures, base];
    setCultures(updated);
    setSelectedIdx(updated.length - 1);
  };

  const handleDeleteCulture = (idx) => {
    if (cultures.length <= 1) return;
    const updated = cultures.filter((_, i) => i !== idx);
    setCultures(updated);
    setSelectedIdx(Math.min(idx, updated.length - 1));
  };

  const setField = (field, val) => updateSelected({ ...selected, [field]: val });

  if (!cultures.length) {
    return (
      <div className="min-h-screen bg-background p-6 flex flex-col items-center justify-center gap-4">
        <Globe className="w-10 h-10 text-muted-foreground" />
        <h2 className="text-lg font-bold text-foreground">Cultures Editor</h2>
        <p className="text-sm text-muted-foreground text-center max-w-sm">
          Load <code className="text-xs font-mono bg-accent px-1 rounded">descr_cultures.txt</code> to start editing cultures.
        </p>
        <label className="cursor-pointer">
          <input type="file" accept=".txt" className="hidden" onChange={handleLoad} />
          <Button variant="outline" className="gap-2 pointer-events-none">
            <FolderOpen className="w-4 h-4" /> Load descr_cultures.txt
          </Button>
        </label>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-slate-200">
      {/* Toolbar */}
      <div className="h-9 border-b border-slate-800 flex items-center px-3 gap-2 shrink-0 bg-slate-900/80">
        <Globe className="w-3.5 h-3.5 text-primary shrink-0" />
        <span className="text-xs font-semibold">Cultures Editor</span>
        <span className="text-[10px] text-slate-500 font-mono hidden lg:block">— descr_cultures.txt</span>
        <div className="ml-auto flex items-center gap-2">
          <label className="cursor-pointer">
            <input type="file" accept=".txt" className="hidden" onChange={handleLoad} />
            <span className="flex items-center gap-1 px-2 py-1 rounded text-[11px] bg-slate-800 border border-slate-600/40 text-slate-300 hover:bg-slate-700 transition-colors cursor-pointer">
              <FolderOpen className="w-3 h-3" /> Load
            </span>
          </label>
          <button onClick={handleExport}
            className="flex items-center gap-1 px-2 py-1 rounded text-[11px] bg-amber-600/80 hover:bg-amber-600 text-slate-900 font-semibold transition-colors">
            <Download className="w-3 h-3" /> Export
          </button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Left: culture list */}
        <div className="w-44 border-r border-slate-800 flex flex-col shrink-0 bg-slate-900/40">
          <div className="px-2 py-1.5 border-b border-slate-800 flex items-center justify-between">
            <span className="text-[10px] font-semibold text-slate-400 uppercase">Cultures ({cultures.length})</span>
            <button onClick={handleAddCulture} title="Duplicate selected as new" className="text-slate-500 hover:text-amber-400 transition-colors">
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            {cultures.map((c, i) => (
              <div key={i}
                className={`flex items-center gap-1 px-2 py-1.5 cursor-pointer group transition-colors ${selectedIdx === i ? 'bg-amber-600/20 text-amber-300' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'}`}
                onClick={() => setSelectedIdx(i)}>
                <span className="text-[11px] font-mono flex-1 truncate">{c.name}</span>
                {cultures.length > 1 && (
                  <button onClick={e => { e.stopPropagation(); handleDeleteCulture(i); }}
                    className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-colors shrink-0">
                    <Trash2 className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right: editor */}
        {selected && (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Tabs */}
            <div className="flex border-b border-slate-800 shrink-0">
              {[['general', 'General'], ['settlements', 'Settlements'], ['infrastructure', 'Infrastructure'], ['agents', 'Agents']].map(([id, label]) => (
                <button key={id} onClick={() => setTab(id)}
                  className={`px-4 py-1.5 text-[10px] font-semibold border-b-2 transition-colors ${tab === id ? 'border-amber-500 text-amber-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
                  {label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto p-3">
              {tab === 'general' && (
                <div className="max-w-sm space-y-3">
                  <div>
                    <p className="text-[9px] text-slate-500 mb-0.5 uppercase font-semibold">Culture Internal Name</p>
                    <p className="text-[9px] text-slate-600 italic mb-1">No spaces. Used everywhere in game files.</p>
                    <input value={selected.name} onChange={e => setField('name', e.target.value.replace(/\s/g, '_'))}
                      className="h-7 px-2 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 font-mono w-full" />
                  </div>
                  <div>
                    <p className="text-[9px] text-slate-500 mb-0.5 uppercase font-semibold">Portrait Mapping</p>
                    <p className="text-[9px] text-slate-600 italic mb-1">Which culture's portraits are used (can be this culture or another).</p>
                    <input value={selected.portraitMapping} onChange={e => setField('portraitMapping', e.target.value.replace(/\s/g, '_'))}
                      className="h-7 px-2 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 font-mono w-full" />
                  </div>
                  <div>
                    <p className="text-[9px] text-slate-500 mb-0.5 uppercase font-semibold">Rebel Standard Index</p>
                    <p className="text-[9px] text-slate-600 italic mb-1">Index for rebel faction standard banner (0-based integer).</p>
                    <input type="number" min="0" value={selected.rebelStandardIndex}
                      onChange={e => setField('rebelStandardIndex', parseInt(e.target.value) || 0)}
                      className="h-7 px-2 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 font-mono w-24" />
                  </div>
                  <div className="rounded border border-amber-500/20 bg-amber-900/10 p-2.5 text-[10px] text-amber-300/80 leading-relaxed space-y-1">
                    <p className="font-semibold">After adding a new culture:</p>
                    <p>• Add <code className="font-mono text-[9px] bg-amber-900/30 px-1 rounded">{'{'}{selected.name.toUpperCase()}{'}'}</code> to <code className="font-mono text-[9px]">data/text/expanded.txt</code> with the display name.</p>
                    <p>• Add <code className="font-mono text-[9px] bg-amber-900/30 px-1 rounded">{'{'}{`EMT_${selected.name.toUpperCase()}_PRIEST`}{'}'}</code>, <code className="font-mono text-[9px]">_PRIEST_1</code>, <code className="font-mono text-[9px]">_PRIEST_2</code> entries too.</p>
                    <p>• Assign the culture to factions in <code className="font-mono text-[9px]">descr_sm_factions.txt</code>.</p>
                    <p>• Game supports max 1 new culture added (beyond vanilla 7).</p>
                  </div>
                </div>
              )}
              {tab === 'settlements' && (
                <SettlementsTab culture={selected} onChange={updateSelected} />
              )}
              {tab === 'infrastructure' && (
                <InfrastructureTab culture={selected} onChange={updateSelected} />
              )}
              {tab === 'agents' && (
                <AgentsTab culture={selected} onChange={updateSelected} />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}