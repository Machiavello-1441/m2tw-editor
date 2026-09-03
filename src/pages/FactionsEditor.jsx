import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, Download, Plus, Trash2, AlertTriangle, Shield, X, Copy, GripVertical, Palette, FileText, Settings, ScrollText, Image } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import BannersTab, { BANNERS_GLOBAL_KEY } from '@/components/factions/BannersTab';
import { parseStringsBin, encodeStringsBin } from '@/components/strings/stringsBinCodec';
import DuplicateFactionModal from '@/components/factions/DuplicateFactionModal';
import FactionZipExport from '@/components/factions/FactionZipExport';
import { copyBannerEntries, duplicateFactionStrings, duplicateStratmapCharacters, duplicateFactionNames, duplicateEduOwnership } from '@/components/factions/factionBulkDuplicate';
import { getFile, setFile } from '@/lib/bigFileStore';
import { useToast } from '@/components/ui/use-toast';
import { getStringsBinStore } from '@/lib/stringsBinStore';
import DescriptionsTab from '@/components/factions/DescriptionsTab';
import MiscTab, { hasFactionNavyEntry, insertFactionNavyEntry } from '@/components/factions/MiscTab';
import FactionSymbolsTab from '@/components/factions/FactionSymbolsTab';

const LS_OFFMAP = 'm2tw_offmap_models';
const LS_MENU_STRINGS = 'm2tw_menu_strings_bin';

/** Inject {UI_FACTION_X} and {UI_FACTION_X_DESCRIPTION} into menu strings if missing */
function injectMenuStringsForFaction(factionName, displayName) {
  try {
    const raw = getFile(LS_MENU_STRINGS);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    const entries = parsed.entries || [];
    const nameUpper = factionName.toUpperCase();
    const uiKey = `UI_FACTION_${nameUpper}`;
    const descKey = `UI_FACTION_${nameUpper}_DESCRIPTION`;
    let changed = false;
    if (!entries.some(e => e.key === uiKey)) {
      entries.push({ key: uiKey, value: displayName || nameUpper });
      changed = true;
    }
    if (!entries.some(e => e.key === descKey)) {
      entries.push({ key: descKey, value: displayName || factionName });
      changed = true;
    }
    if (changed) {
      setFile(LS_MENU_STRINGS, JSON.stringify({ ...parsed, entries }));
      window.dispatchEvent(new CustomEvent('menu-strings-updated'));
    }
  } catch {}
}

function autoInsertNavyEntry(name) {
  try {
    const data = getFile(LS_OFFMAP);
    if (!data) return;
    if (hasFactionNavyEntry(data, name)) return;
    const updated = insertFactionNavyEntry(data, name);
    setFile(LS_OFFMAP, updated);
    window.dispatchEvent(new CustomEvent('offmap-models-updated'));
  } catch {}
}

const VANILLA_FACTION_LIMIT = 31;
// Canonical key — the same one the Home page writes descr_sm_factions.txt to
// (via RefDataContext), so files loaded on Home appear here without re-upload.
const LS_KEY = 'm2tw_factions_file';
const LS_CULT = 'm2tw_cultures_list';
const LS_REL = 'm2tw_religions_list';
const LS_UNITS = 'm2tw_edu_units_list';

// ── Colour helpers ────────────────────────────────────────────────────────────
const rgbToHex = ({ r, g, b }) => '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
const hexToRgb = (hex) => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : { r: 0, g: 0, b: 0 };
};
const parseColour = (v) => {
  const m = v.match(/red\s+(\d+)[,\s]+green\s+(\d+)[,\s]+blue\s+(\d+)/i);
  return m ? { r: +m[1], g: +m[2], b: +m[3] } : { r: 0, g: 0, b: 0 };
};

// ── Reference file parsers ────────────────────────────────────────────────────
function parseCultures(text) {
  const cultures = [];
  for (const raw of text.split('\n')) {
    const line = raw.replace(/;.*$/, '').trim();
    const m = line.match(/^culture\s+(\S+)/i);
    if (m) cultures.push(m[1]);
  }
  return [...new Set(cultures)].sort();
}

function parseReligions(text) {
  const religions = [];
  for (const raw of text.split('\n')) {
    const line = raw.replace(/;.*$/, '').trim();
    const m = line.match(/^religion\s+(\S+)/i);
    if (m) religions.push(m[1]);
  }
  return [...new Set(religions)].sort();
}

function parseEduUnits(text) {
  const units = [];
  for (const raw of text.split('\n')) {
    const line = raw.replace(/;.*$/, '').trim();
    const m = line.match(/^type\s+(.+)/i);
    if (m) units.push(m[1].trim());
  }
  return [...new Set(units)].sort();
}

// ── Main faction parser ───────────────────────────────────────────────────────
function parseDescrSmFactions(text) {
  const factions = [];
  const lines = text.split('\n');
  let current = null;

  for (const rawLine of lines) {
    const line = rawLine.replace(/;.*$/, '').trim();
    if (!line) continue;

    const factionMatch = line.match(/^faction\s+([^,\s]+)(?:\s*,\s*(spawned_on_event|shadowing|shadowed_by)(?:\s+(\S+))?)?/i);
    if (factionMatch) {
      if (current) factions.push(current);
      current = {
        name: factionMatch[1].trim(),
        spawn_type: factionMatch[2] || 'default',
        shadow_faction: factionMatch[3] || '',
        culture: '',
        religion: '',
        symbol: '',
        rebel_symbol: '',
        primary_colour: { r: 0, g: 0, b: 0 },
        secondary_colour: { r: 0, g: 0, b: 0 },
        loading_logo: '',
        standard_index: 0,
        logo_index: '',
        small_logo_index: '',
        triumph_value: '5',
        custom_battle_availability: 'yes',
        can_sap: 'no',
        prefers_naval_invasions: 'no',
        can_have_princess: 'yes',
        has_family_tree: 'yes',
        can_horde: false,
        horde_min_units: 0,
        horde_max_units: 0,
        horde_max_units_reduction_every_horde: 0,
        horde_unit_per_settlement_population: 0,
        horde_min_named_characters: 0,
        horde_max_percent_army_stack: 0,
        horde_disband_percent_on_settlement_capture: 0,
        horde_units: []
      };
      continue;
    }

    if (!current) continue;

    const m = line.match(/^(\S+)\s*(.*)/);
    if (!m) continue;
    const key = m[1];
    const val = m[2].trim();

    switch (key) {
      case 'culture':current.culture = val;break;
      case 'religion':current.religion = val;break;
      case 'symbol':current.symbol = val;break;
      case 'rebel_symbol':current.rebel_symbol = val;break;
      case 'primary_colour':
      case 'primary_color':current.primary_colour = parseColour(val);break;
      case 'secondary_colour':
      case 'secondary_color':current.secondary_colour = parseColour(val);break;
      case 'loading_logo':current.loading_logo = val;break;
      case 'standard_index':current.standard_index = parseInt(val) || 0;break;
      case 'logo_index':current.logo_index = val;break;
      case 'small_logo_index':current.small_logo_index = val;break;
      case 'triumph_value':current.triumph_value = val;break;
      case 'custom_battle_availability':current.custom_battle_availability = val;break;
      case 'can_sap':current.can_sap = val;break;
      case 'prefers_naval_invasions':current.prefers_naval_invasions = val;break;
      case 'can_have_princess':current.can_have_princess = val;break;
      case 'has_family_tree':current.has_family_tree = val;break;
      case 'horde_min_units':current.can_horde = true;current.horde_min_units = +val || 0;break;
      case 'horde_max_units':current.horde_max_units = +val || 0;break;
      case 'horde_max_units_reduction_every_horde':current.horde_max_units_reduction_every_horde = +val || 0;break;
      case 'horde_unit_per_settlement_population':current.horde_unit_per_settlement_population = +val || 0;break;
      case 'horde_min_named_characters':current.horde_min_named_characters = +val || 0;break;
      case 'horde_max_percent_army_stack':current.horde_max_percent_army_stack = +val || 0;break;
      case 'horde_disband_percent_on_settlement_capture':current.horde_disband_percent_on_settlement_capture = +val || 0;break;
      case 'horde_unit':current.horde_units.push(val);break;
      default:
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
  const T = '\t\t\t\t\t\t';
  const T5 = '\t\t\t\t\t';
  const T4 = '\t\t\t\t';
  const T3 = '\t\t\t';
  const fmtC = (c) => `red ${c.r}, green ${c.g}, blue ${c.b}`;

  const lines = (f) => {
    const nameUpper = f.name.toUpperCase();
    const symbolVal = f.symbol || `models_strat/symbol_${f.name}.CAS`;
    const loadingLogoVal = f.loading_logo || `loading_screen/symbols/symbol128_${f.name}.tga`;
    const logoIndexVal = f.logo_index || `FACTION_LOGO_${nameUpper}`;
    const smallLogoIndexVal = f.small_logo_index || `SMALL_FACTION_LOGO_${nameUpper}`;

    let factionLine = `faction${T}${f.name}`;
    if (f.spawn_type === 'spawned_on_event') {
      factionLine += ', spawned_on_event';
    } else if (f.spawn_type === 'shadowing' && f.shadow_faction) {
      factionLine += `, shadowing ${f.shadow_faction}`;
    } else if (f.spawn_type === 'shadowed_by' && f.shadow_faction) {
      factionLine += `, shadowed_by ${f.shadow_faction}`;
    }

    const rows = [
    factionLine,
    `culture${T}${f.culture}`,
    `religion${T5}${f.religion}`,
    `symbol${T}${symbolVal}`,
    f.rebel_symbol ? `rebel_symbol${T4}${f.rebel_symbol}` : null,
    `primary_colour${T4}${fmtC(f.primary_colour)}`,
    `secondary_colour${T3}${fmtC(f.secondary_colour)}`,
    `loading_logo${T4}${loadingLogoVal}`,
    f.standard_index !== 0 ? `standard_index${T4}${f.standard_index}` : null,
    `logo_index${T5}${logoIndexVal}`,
    `small_logo_index${T3}${smallLogoIndexVal}`,
    f.triumph_value ? `triumph_value${T4}${f.triumph_value}` : null,
    `custom_battle_availability\t${f.custom_battle_availability}`,
    ...(f.can_horde ? [
    `horde_min_units${T3}${f.horde_min_units}`,
    `horde_max_units${T3}${f.horde_max_units}`,
    `horde_max_units_reduction_every_horde\t${f.horde_max_units_reduction_every_horde}`,
    `horde_unit_per_settlement_population\t${f.horde_unit_per_settlement_population}`,
    `horde_min_named_characters${T3}${f.horde_min_named_characters}`,
    `horde_max_percent_army_stack${T}${f.horde_max_percent_army_stack}`,
    `horde_disband_percent_on_settlement_capture\t${f.horde_disband_percent_on_settlement_capture}`,
    ...(f.horde_units || []).map((u, idx) => `horde_unit${T4}${u}${idx === 0 && f.can_horde ? ' ; general_unit required' : ''}`)] :
    []),
    `can_sap${T}${f.can_sap}`,
    `prefers_naval_invasions\t\t${f.prefers_naval_invasions}`,
    `can_have_princess${T3}${f.can_have_princess}`,
    `has_family_tree${T4}${f.has_family_tree}`].
    filter((r) => r !== null);
    return rows.join('\n');
  };

  return HEADER + factions.map(lines).join(SEP) + '\n';
}

// ── Colour Picker with modal ──────────────────────────────────────────────────
function ColourPickerField({ label, colour, onChange }) {
  const c = colour || { r: 0, g: 0, b: 0 };
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(c);
  const hex = rgbToHex(c);

  const openPicker = () => {setDraft({ ...c });setOpen(true);};
  const confirm = () => {onChange(draft);setOpen(false);};

  return (
    <>
      <div className="flex items-center gap-2 py-0.5">
        <span className="text-[10px] text-slate-300 w-40 shrink-0">{label}</span>
        <button onClick={openPicker} className="flex items-center gap-2 group">
          <div className="w-7 h-5 rounded border border-slate-600 shrink-0 group-hover:ring-2 group-hover:ring-blue-500 transition-all"
          style={{ background: hex }} />
          <span className="text-[10px] font-mono text-slate-200 group-hover:text-white">{hex.toUpperCase()} &nbsp; rgb({c.r},{c.g},{c.b})</span>
        </button>
      </div>
      {open &&
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setOpen(false)}>
          <div className="bg-slate-900 border border-slate-600 rounded-xl shadow-2xl p-5 w-72" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-200">{label}</span>
              <button onClick={() => setOpen(false)} className="text-slate-300 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <div className="w-full h-16 rounded-lg border border-slate-700 mb-4" style={{ background: rgbToHex(draft) }} />
            <div className="flex items-center gap-3 mb-3">
              <input type="color" value={rgbToHex(draft)}
            onChange={(e) => setDraft(hexToRgb(e.target.value))}
            className="w-12 h-8 rounded cursor-pointer bg-transparent border-0" />
              <span className="text-[10px] font-mono text-slate-200">{rgbToHex(draft).toUpperCase()}</span>
            </div>
            {[['r', 'R', '#ef4444'], ['g', 'G', '#22c55e'], ['b', 'B', '#3b82f6']].map(([ch, lbl, col]) =>
          <div key={ch} className="flex items-center gap-2 mb-1.5">
                <span className="text-[10px] font-bold w-4 shrink-0" style={{ color: col }}>{lbl}</span>
                <input type="range" min={0} max={255} value={draft[ch]}
            onChange={(e) => setDraft((d) => ({ ...d, [ch]: +e.target.value }))}
            className="flex-1 h-2 accent-current cursor-pointer" style={{ accentColor: col }} />
                <input type="number" min={0} max={255} value={draft[ch]}
            onChange={(e) => setDraft((d) => ({ ...d, [ch]: Math.max(0, Math.min(255, +e.target.value || 0)) }))}
            className="w-12 bg-slate-800 border border-slate-700 rounded px-1 py-0.5 text-[10px] text-center text-slate-200" />
              </div>
          )}
            <div className="flex gap-2 mt-4">
              <button onClick={() => setOpen(false)} className="flex-1 py-1.5 text-[11px] rounded border border-slate-500 text-slate-200 hover:text-white hover:border-slate-300">Cancel</button>
              <button onClick={confirm} className="flex-1 py-1.5 text-[11px] rounded bg-blue-700 hover:bg-blue-600 text-white font-semibold">OK</button>
            </div>
          </div>
        </div>
      }
    </>);

}

// ── Yes/No toggle ─────────────────────────────────────────────────────────────
function YesNo({ label, value, onChange }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-[10px] text-slate-300">{label}</span>
      <div className="flex rounded overflow-hidden border border-slate-600">
        {['yes', 'no'].map((opt) =>
        <button key={opt} onClick={() => onChange(opt)}
        className={`px-2 py-0.5 text-[10px] transition-colors ${value === opt ? 'bg-primary text-primary-foreground' : 'bg-slate-700 text-slate-200 hover:bg-slate-600'}`}>
            {opt}
          </button>
        )}
      </div>
    </div>);

}

// ── Dropdown or text input ────────────────────────────────────────────────────
function SelectOrInput({ label, value, onChange, options, placeholder }) {
  return (
    <div className="flex items-center gap-3 py-0.5">
      <label className="text-[10px] text-slate-300 w-40 shrink-0">{label}</label>
      {options && options.length > 0 ?
      <select value={value} onChange={(e) => onChange(e.target.value)}
      className="flex-1 h-6 text-[11px] px-2 rounded border border-slate-600 bg-slate-700 text-slate-100 font-mono">
          {!options.includes(value) && value && <option value={value}>{value} (custom)</option>}
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select> :

      <Input className="h-6 text-[11px] px-2 flex-1 font-mono bg-slate-700 border-slate-600 text-slate-100" value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      }
    </div>);

}

// ── Horde Units list editor ───────────────────────────────────────────────────
function HordeUnitsEditor({ units, onChange, eduUnits }) {
  const [custom, setCustom] = useState('');
  const add = (u) => {if (u && !units.includes(u)) onChange([...units, u]);setCustom('');};
  const remove = (i) => onChange(units.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-1 min-h-6">
        {units.map((u, i) =>
        <span key={i} className="inline-flex items-center gap-1 bg-amber-900/40 border border-amber-700 rounded px-1.5 py-0.5 text-[9px] font-mono text-amber-300">
            {u}
            <button onClick={() => remove(i)} className="text-red-400 hover:text-red-300 leading-none ml-0.5">×</button>
          </span>
        )}
        {units.length === 0 && <span className="text-[10px] text-red-400 italic">At least 1 unit required</span>}
      </div>
      <div className="flex gap-1">
        {eduUnits && eduUnits.length > 0 ?
        <select className="flex-1 h-6 text-[10px] px-1 rounded border border-slate-700 bg-slate-800 text-slate-100 font-mono"
        value="" onChange={(e) => add(e.target.value)}>
            <option value="">— add unit from EDU —</option>
            {eduUnits.filter((u) => !units.includes(u)).map((u) => <option key={u} value={u}>{u}</option>)}
          </select> :

        <>
            <Input className="flex-1 h-6 text-[10px] px-1 font-mono bg-slate-800 border-slate-700 text-slate-100" value={custom} onChange={(e) => setCustom(e.target.value)}
          placeholder="unit type name…" onKeyDown={(e) => e.key === 'Enter' && add(custom.trim())} />
            <button onClick={() => add(custom.trim())}
          className="text-[10px] px-2 rounded border border-green-800 text-green-400 hover:bg-green-900/30">Add</button>
          </>
        }
      </div>
    </div>);

}

// ── Faction detail panel ──────────────────────────────────────────────────────
function FactionDetail({ faction, onChange, cultures, religions, eduUnits, onSave, onCancel }) {
  const [draft, setDraft] = useState({ ...faction });
  const [activeTab, setActiveTab] = useState('stratmap');
  const [tertiaryEnabled, setTertiaryEnabled] = useState(!!faction.tertiary_colour);
  const set = (key, val) => setDraft({ ...draft, [key]: val });
  const [saved, setSaved] = useState(false);
  const handleSave = () => {
    onChange(draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };
  const handleCancel = () => { setDraft({ ...faction }); onCancel?.(); };
  const nameUpper = (draft.name || '').toUpperCase();
  const defaultLogo = `FACTION_LOGO_${nameUpper}`;
  const defaultSmallLogo = `SMALL_FACTION_LOGO_${nameUpper}`;

  const hordeIntField = (key, label) =>
  <div key={key} className="flex items-center gap-3">
      <label className="text-[10px] text-slate-300 w-60 shrink-0">{label}</label>
      <input type="number" min={0}
    value={faction[key] ?? 0}
    onChange={(e) => set(key, +e.target.value || 0)}
    className="w-20 bg-slate-700 border border-slate-600 rounded px-2 py-0.5 text-[11px] text-slate-100" />
    </div>;


  return (
    <ScrollArea className="h-full">
      <div className="p-4 max-w-xl">
        <div className="flex items-center justify-between border-b border-slate-600 pb-2 mb-4">
          <h2 className="text-sm font-semibold text-slate-200">Edit Faction: {draft.name}</h2>
          <div className="flex gap-2">
            <button onClick={handleCancel} className="px-3 py-1 text-[10px] rounded border border-slate-600 text-slate-300 hover:bg-slate-700">Reset</button>
            <button onClick={handleSave} className={`px-3 py-1 text-[10px] rounded font-semibold transition-colors ${saved ? 'bg-emerald-600 text-white' : 'bg-green-700 hover:bg-green-600 text-white'}`}>
              {saved ? '✓ Saved' : 'Save Changes'}
            </button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5 mb-4">
            <TabsTrigger value="stratmap" className="text-[10px]"><Palette className="w-3 h-3 mr-1" />Stratmap</TabsTrigger>
            <TabsTrigger value="banners" className="text-[10px]"><FileText className="w-3 h-3 mr-1" />Banners</TabsTrigger>
            <TabsTrigger value="descriptions" className="text-[10px]"><ScrollText className="w-3 h-3 mr-1" />Descriptions</TabsTrigger>
            <TabsTrigger value="misc" className="text-[10px]"><Settings className="w-3 h-3 mr-1" />Misc</TabsTrigger>
            <TabsTrigger value="symbols" className="text-[10px]"><Image className="w-3 h-3 mr-1" />Symbols</TabsTrigger>
          </TabsList>

          <TabsContent value="stratmap" className="space-y-5">
        <section className="space-y-2">
          <h3 className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold border-b border-slate-600 pb-1">Identity</h3>
          <div className="flex items-center gap-3">
            <label className="text-[10px] text-slate-300 w-40 shrink-0">Internal Name</label>
            <Input className="h-6 text-[11px] px-2 flex-1 font-mono bg-slate-700 border-slate-600 text-slate-100" value={draft.name ?? ''} onChange={(e) => set('name', e.target.value)} />
          </div>
          <div className="flex items-center gap-3">
            <label className="text-[10px] text-slate-300 w-40 shrink-0">Type</label>
            <select value={draft.spawn_type || 'default'} onChange={(e) => set('spawn_type', e.target.value)}
            className="flex-1 h-6 text-[11px] px-2 rounded border border-slate-600 bg-slate-700 text-slate-100 font-mono">
              <option value="default">default</option>
              <option value="spawned_on_event">spawned_on_event</option>
              <option value="shadowing">shadowing</option>
              <option value="shadowed_by">shadowed_by</option>
            </select>
          </div>
          {(draft.spawn_type === 'shadowing' || draft.spawn_type === 'shadowed_by') &&
          <div className="flex items-center gap-3">
              <label className="text-[10px] text-slate-300 w-40 shrink-0">Shadow Faction</label>
              <Input className="h-6 text-[11px] px-2 flex-1 font-mono bg-slate-700 border-slate-600 text-slate-100" value={draft.shadow_faction ?? ''} onChange={(e) => set('shadow_faction', e.target.value)} placeholder="e.g. england" />
            </div>
          }
          <SelectOrInput label="Culture" value={draft.culture} onChange={(v) => set('culture', v)} options={cultures} placeholder="e.g. northern_european" />
          <SelectOrInput label="Religion" value={draft.religion} onChange={(v) => set('religion', v)} options={religions} placeholder="e.g. catholic" />
        </section>

        <section className="space-y-2">
          <h3 className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold border-b border-slate-600 pb-1">Colours</h3>
          <ColourPickerField label="Primary Colour" colour={draft.primary_colour} onChange={(v) => set('primary_colour', v)} />
          <ColourPickerField label="Secondary Colour" colour={draft.secondary_colour} onChange={(v) => set('secondary_colour', v)} />
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-[10px] text-slate-300 w-40 shrink-0">Tertiary Colour (M2EX only)</span>
            <button
              onClick={() => setTertiaryEnabled(!tertiaryEnabled)}
              className={`px-2 py-0.5 text-[9px] rounded border ${tertiaryEnabled ? 'bg-green-700 border-green-600 text-white' : 'bg-slate-700 border-slate-600 text-slate-400'}`}
            >
              {tertiaryEnabled ? 'Enabled' : 'Disabled'}
            </button>
          </div>
          {tertiaryEnabled && (
            <ColourPickerField label="Tertiary Colour" colour={draft.tertiary_colour || { r: 0, g: 0, b: 0 }} onChange={(v) => set('tertiary_colour', v)} />
          )}
          <p className="text-[9px] text-amber-300 mt-1">⚠ Tertiary colour only works with M2EX</p>
        </section>

        <section className="space-y-2">
          <h3 className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold border-b border-slate-600 pb-1">Files & Indices</h3>
          {[
          ['symbol', 'Symbol (.CAS)', `models_strat/symbol_${draft.name}.CAS`],
          ['rebel_symbol', 'Rebel Symbol (.CAS)', ''],
          ['loading_logo', 'Loading Logo (.tga)', `loading_screen/symbols/symbol128_${draft.name}.tga`],
          ['standard_index', 'Standard Index', ''],
          ['triumph_value', 'Triumph Value', ''],
          ['logo_index', 'Logo Index', defaultLogo],
          ['small_logo_index', 'Small Logo Index', defaultSmallLogo]].
          map(([k, l, def]) =>
          <div key={k} className="flex items-center gap-3">
              <label className="text-[10px] text-slate-300 w-40 shrink-0">{l}</label>
              <Input className="h-6 text-[11px] px-2 flex-1 font-mono bg-slate-700 border-slate-600 text-slate-100" value={draft[k] ?? ''} onChange={(e) => set(k, e.target.value)} placeholder={def || undefined} />
            </div>
          )}
        </section>

        <section className="space-y-1">
          <h3 className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold border-b border-slate-600 pb-1">Flags</h3>
          <YesNo label="Custom battle availability" value={draft.custom_battle_availability} onChange={(v) => set('custom_battle_availability', v)} />
          <YesNo label="Can sap" value={draft.can_sap} onChange={(v) => set('can_sap', v)} />
          <YesNo label="Prefers naval invasions" value={draft.prefers_naval_invasions} onChange={(v) => set('prefers_naval_invasions', v)} />
          <YesNo label="Can have princess" value={draft.can_have_princess} onChange={(v) => set('can_have_princess', v)} />
          <YesNo label="Has family tree" value={draft.has_family_tree} onChange={(v) => set('has_family_tree', v)} />
        </section>

        <section className="space-y-2">
          <h3 className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold border-b border-slate-600 pb-1">Horde</h3>
          <div className="flex items-center justify-between py-0.5">
            <span className="text-[10px] text-slate-300">Can horde</span>
            <div className="flex rounded overflow-hidden border border-slate-600">
              {[true, false].map((opt) =>
              <button key={String(opt)} onClick={() => set('can_horde', opt)}
              className={`px-2 py-0.5 text-[10px] transition-colors ${draft.can_horde === opt ? 'bg-primary text-primary-foreground' : 'bg-slate-700 text-slate-200 hover:bg-slate-600'}`}>
                  {opt ? 'yes' : 'no'}
                </button>
              )}
            </div>
          </div>
          {draft.can_horde &&
          <div className="space-y-2 pl-2 border-l-2 border-amber-700">
              {hordeIntField('horde_min_units', 'horde_min_units')}
              {hordeIntField('horde_max_units', 'horde_max_units')}
              {hordeIntField('horde_max_units_reduction_every_horde', 'horde_max_units_reduction_every_horde')}
              {hordeIntField('horde_unit_per_settlement_population', 'horde_unit_per_settlement_population')}
              {hordeIntField('horde_min_named_characters', 'horde_min_named_characters')}
              {hordeIntField('horde_max_percent_army_stack', 'horde_max_percent_army_stack')}
              <div className="flex items-center gap-3">
                <label className="text-[10px] text-slate-300 w-60 shrink-0">horde_disband_percent <span className="text-slate-400">(0-100)</span></label>
                <input type="number" min={0} max={100}
              value={draft.horde_disband_percent_on_settlement_capture ?? 0}
              onChange={(e) => set('horde_disband_percent_on_settlement_capture', Math.max(0, Math.min(100, +e.target.value || 0)))}
              className="w-20 bg-slate-700 border border-slate-600 rounded px-2 py-0.5 text-[11px] text-slate-100" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-slate-300">horde_unit entries <span className="text-red-300">*</span></label>
                <HordeUnitsEditor units={draft.horde_units || []} onChange={(v) => set('horde_units', v)} eduUnits={eduUnits} />
                <p className="text-[9px] text-amber-300 mt-1">⚠ First unit must have general_unit attribute in export_descr_unit.txt</p>
              </div>
            </div>
          }
        </section>

          </TabsContent>

          <TabsContent value="banners" className="space-y-4">
            <BannersTab factionName={draft.name} />
          </TabsContent>

          <TabsContent value="descriptions" className="space-y-4">
            <DescriptionsTab factionName={draft.name} />
          </TabsContent>

          <TabsContent value="misc" className="space-y-4">
            <MiscTab factionName={draft.name} />
          </TabsContent>

          <TabsContent value="symbols" className="space-y-4">
            <FactionSymbolsTab factionName={draft.name} />
          </TabsContent>
        </Tabs>

      </div>
    </ScrollArea>);

}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function FactionsEditor() {
  const { toast } = useToast();
  const [factions, setFactions] = useState(null);
  const [selectedIdx, setSelectedIdx] = useState(null);
  const [search, setSearch] = useState('');
  const [cultures, setCultures] = useState([]);
  const [religions, setReligions] = useState([]);
  const [eduUnits, setEduUnits] = useState([]);

  const fileRef = useRef();
  const cultRef = useRef();
  const relRef = useRef();
  const eduRef = useRef();
  const bannersRef = useRef();
  const stringsRef = useRef();
  const menuStringsRef = useRef();
  const [bannersLoaded, setBannersLoaded] = useState(false);
  const [stringsLoaded, setStringsLoaded] = useState(false);
  const [menuStringsLoaded, setMenuStringsLoaded] = useState(false);

  useEffect(() => {
    // ── Reconcile files loaded on the Home page into the keys this editor uses ──
    // Home stores each file under a canonical key; this editor historically read
    // different keys, forcing a re-upload. Populate the editor's keys from Home's
    // (only when the editor's own key is empty, so manual uploads are preserved).
    try {
      // Cultures / religions / EDU units — Home stores raw text; parse into lists.
      const cultRaw = localStorage.getItem('m2tw_cultures_file');
      if (cultRaw && !localStorage.getItem(LS_CULT)) {
        const list = parseCultures(cultRaw);
        if (list.length) localStorage.setItem(LS_CULT, JSON.stringify(list));
      }
      const relRaw = localStorage.getItem('m2tw_religions_file');
      if (relRaw && !localStorage.getItem(LS_REL)) {
        const list = parseReligions(relRaw);
        if (list.length) localStorage.setItem(LS_REL, JSON.stringify(list));
      }
      const eduRaw = localStorage.getItem('m2tw_units_file');
      if (eduRaw && !localStorage.getItem(LS_UNITS)) {
        const list = parseEduUnits(eduRaw);
        if (list.length) localStorage.setItem(LS_UNITS, JSON.stringify(list));
      }
      // Banners — Home writes raw XML to m2tw_banners_file; BannersTab reads BANNERS_GLOBAL_KEY.
      const bannersRaw = getFile('m2tw_banners_file');
      if (bannersRaw && !getFile(BANNERS_GLOBAL_KEY)) {
        setFile(BANNERS_GLOBAL_KEY, bannersRaw);
      }
      // Strings.bin — Home stores every .strings.bin in the shared store (keyed by
      // filename). Build the global keys this editor expects from the relevant entries.
      const store = getStringsBinStore();
      const findBin = (needle) => {
        const key = Object.keys(store).find((k) => k.toLowerCase().includes(needle));
        return key ? store[key] : null;
      };
      if (!getFile('m2tw_strings_bin_global')) {
        const expanded = findBin('expanded');
        if (expanded?.entries?.length) {
          setFile('m2tw_strings_bin_global', JSON.stringify({
            entries: expanded.entries, magic1: expanded.magic1 ?? 2, magic2: expanded.magic2 ?? 2048,
          }));
        }
      }
      if (!getFile(LS_MENU_STRINGS)) {
        const menu = findBin('menu');
        if (menu?.entries?.length) {
          setFile(LS_MENU_STRINGS, JSON.stringify({
            entries: menu.entries, magic1: menu.magic1 ?? 2, magic2: menu.magic2 ?? 2048,
          }));
        }
      }
    } catch {}

    // ── Load everything from the (now reconciled) editor keys ──
    try {
      const r = localStorage.getItem(LS_KEY);
      if (r) setFactions(parseDescrSmFactions(r));
    } catch {}
    try {const r = localStorage.getItem(LS_CULT);if (r) setCultures(JSON.parse(r));} catch {}
    try {const r = localStorage.getItem(LS_REL);if (r) setReligions(JSON.parse(r));} catch {}
    try {const r = localStorage.getItem(LS_UNITS);if (r) setEduUnits(JSON.parse(r));} catch {}
    try {if (getFile(BANNERS_GLOBAL_KEY)) setBannersLoaded(true);} catch {}
    try {if (getFile('m2tw_strings_bin_global')) setStringsLoaded(true);} catch {}
    try {if (getFile(LS_MENU_STRINGS)) setMenuStringsLoaded(true);} catch {}
  }, []);

  const loadFactions = useCallback(async (e) => {
    const file = e.target.files?.[0];if (!file) return;
    const text = await file.text();
    try {
      localStorage.setItem(LS_KEY, text);
    } catch {}
    const parsed = parseDescrSmFactions(text);
    setFactions(parsed);
    setSelectedIdx(parsed.length > 0 ? 0 : null);
    e.target.value = '';
  }, []);

  const loadCultures = useCallback(async (e) => {
    const file = e.target.files?.[0];if (!file) return;
    const text = await file.text();
    const list = parseCultures(text);
    setCultures(list);
    try {localStorage.setItem(LS_CULT, JSON.stringify(list));} catch {}
    e.target.value = '';
  }, []);

  const loadReligions = useCallback(async (e) => {
    const file = e.target.files?.[0];if (!file) return;
    const text = await file.text();
    const list = parseReligions(text);
    setReligions(list);
    try {localStorage.setItem(LS_REL, JSON.stringify(list));} catch {}
    e.target.value = '';
  }, []);

  const loadEdu = useCallback(async (e) => {
    const file = e.target.files?.[0];if (!file) return;
    const text = await file.text();
    const list = parseEduUnits(text);
    setEduUnits(list);
    try {localStorage.setItem(LS_UNITS, JSON.stringify(list));} catch {}
    e.target.value = '';
  }, []);

  const loadBannersXml = useCallback(async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const text = await file.text();
    setFile(BANNERS_GLOBAL_KEY, text);
    setBannersLoaded(true);
    window.dispatchEvent(new CustomEvent('banners-xml-loaded'));
    e.target.value = '';
  }, []);

  const loadStringsBinGlobal = useCallback(async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const buf = await file.arrayBuffer();
    const parsed = parseStringsBin(buf);
    if (parsed?.entries) {
      setFile('m2tw_strings_bin_global', JSON.stringify({
        entries: parsed.entries, magic1: parsed.magic1, magic2: parsed.magic2
      }));
      setStringsLoaded(true);
      window.dispatchEvent(new CustomEvent('strings-bin-updated'));
    }
    e.target.value = '';
  }, []);

  const loadMenuStrings = useCallback(async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const buf = await file.arrayBuffer();
    const parsed = parseStringsBin(buf);
    if (parsed?.entries) {
      setFile(LS_MENU_STRINGS, JSON.stringify({
        entries: parsed.entries, magic1: parsed.magic1, magic2: parsed.magic2
      }));
      setMenuStringsLoaded(true);
      window.dispatchEvent(new CustomEvent('menu-strings-updated'));
    }
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
    try {localStorage.setItem(LS_KEY, serialiseDescrSmFactions(updated));} catch {}
  };

  const addFaction = () => {
    const newF = {
      name: 'new_faction',
      culture: cultures[0] || '',
      religion: religions[0] || '',
      spawn_type: 'default',
      shadow_faction: '',
      symbol: '',
      rebel_symbol: 'models_strat/symbol_rebels.CAS',
      primary_colour: { r: 128, g: 128, b: 128 },
      secondary_colour: { r: 200, g: 200, b: 200 },
      loading_logo: '',
      standard_index: 0,
      logo_index: '',
      small_logo_index: '',
      triumph_value: '5',
      custom_battle_availability: 'yes',
      can_sap: 'no',
      prefers_naval_invasions: 'no',
      can_have_princess: 'yes',
      has_family_tree: 'yes',
      can_horde: false,
      horde_min_units: 0,
      horde_max_units: 0,
      horde_max_units_reduction_every_horde: 0,
      horde_unit_per_settlement_population: 0,
      horde_min_named_characters: 0,
      horde_max_percent_army_stack: 0,
      horde_disband_percent_on_settlement_capture: 0,
      horde_units: []
    };
    const updated = [...(factions || []), newF];
    setFactions(updated);
    setSelectedIdx(updated.length - 1);
    autoInsertNavyEntry(newF.name);
    injectMenuStringsForFaction(newF.name, newF.name);
  };

  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [duplicateSourceIdx, setDuplicateSourceIdx] = useState(null);
  const [duplicateDefaultName, setDuplicateDefaultName] = useState('');

  const openDuplicateModal = (i) => {
    const src = factions[i];
    const baseName = src.name.replace(/_\d+$/, '');
    let newName = `${baseName}_copy`;
    let counter = 1;
    while (factions.some((f) => f.name === newName)) {
      newName = `${baseName}_copy${++counter}`;
    }
    setDuplicateDefaultName(newName);
    setDuplicateSourceIdx(i);
    setDuplicateModalOpen(true);
  };

  const confirmDuplicate = (payload) => {
    if (!payload?.newName?.trim() || duplicateSourceIdx === null) return;
    const src = factions[duplicateSourceIdx];
    const newFactionName = payload.newName.trim();
    const nameUpper = newFactionName.toUpperCase();

    const dup = {
      ...src,
      name: newFactionName,
      spawn_type: 'default',
      shadow_faction: '',
      symbol: `models_strat/symbol_${newFactionName}.CAS`,
      loading_logo: `loading_screen/symbols/symbol128_${newFactionName}.tga`,
      logo_index: `FACTION_LOGO_${nameUpper}`,
      small_logo_index: `SMALL_FACTION_LOGO_${nameUpper}`,
      standard_index: 0,
      horde_units: []
    };
    // Insert directly below the source faction (not at the bottom)
    const updated = [...factions];
    updated.splice(duplicateSourceIdx + 1, 0, dup);
    setFactions(updated);
    setSelectedIdx(duplicateSourceIdx + 1);
    try { localStorage.setItem(LS_KEY, serialiseDescrSmFactions(updated)); } catch {}

    // Bulk duplication across all related files
    copyBannerEntries(src.name, newFactionName);
    duplicateFactionStrings(src.name, newFactionName, payload);
    const charRes = duplicateStratmapCharacters(src.name, newFactionName);
    const namesRes = duplicateFactionNames(src.name, newFactionName);
    const eduRes = duplicateEduOwnership(src.name, newFactionName);
    autoInsertNavyEntry(newFactionName);
    injectMenuStringsForFaction(newFactionName, payload.displayName || newFactionName);

    // Report what was (and couldn't be) duplicated
    const done = [];
    const missing = [];
    if (charRes.charLoaded) done.push(`${charRes.charTypes} character types`); else missing.push('descr_character.txt');
    if (charRes.stratLoaded) done.push(`${charRes.stratTextures} strat textures`); else missing.push('descr_model_strat.txt');
    if (namesRes.loaded) done.push(namesRes.ok ? 'names block' : 'names block (already exists / source not found)'); else missing.push('descr_names.txt');
    if (eduRes.loaded) {
      if (eduRes.count > 0) done.push(`${eduRes.count} unit ownerships`);
      else if (eduRes.already > 0) done.push(`unit ownerships (already on ${eduRes.already} lines)`);
      else done.push(`unit ownerships: "${src.name}" not found on any ownership/era line (${eduRes.srcLines} matches)`);
    } else missing.push('export_descr_unit.txt');
    toast({
      variant: missing.length ? 'destructive' : 'default',
      title: `Duplicated ${src.name} → ${newFactionName}`,
      description: `Copied: ${done.join(', ') || 'nothing'}.${missing.length ? ` Not loaded (re-load from Home): ${missing.join(', ')}` : ''}`,
    });

    setDuplicateModalOpen(false);
    setDuplicateSourceIdx(null);
  };

  const onDragEnd = (result) => {
    if (!result.destination) return;
    const items = Array.from(factions);
    const [reordered] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reordered);
    setFactions(items);
    try { localStorage.setItem(LS_KEY, serialiseDescrSmFactions(items)); } catch {}
    if (selectedIdx !== null) {
      const newIdx = items.findIndex(f => f.name === factions[selectedIdx].name);
      setSelectedIdx(newIdx >= 0 ? newIdx : null);
    }
  };

  const deleteFaction = (i) => {
    const updated = factions.filter((_, idx) => idx !== i);
    setFactions(updated);
    setSelectedIdx(updated.length > 0 ? Math.min(i, updated.length - 1) : null);
  };

  const filtered = factions ?
  factions.map((f, i) => ({ f, i })).filter(({ f }) => !search || f.name.toLowerCase().includes(search.toLowerCase())) :
  [];

  const overLimit = factions && factions.length > VANILLA_FACTION_LIMIT;

  return (
    <div className="h-screen flex flex-col">
      <div className="border-b border-border flex flex-wrap items-center px-4 gap-2 py-1.5 shrink-0 bg-card/50">
        <Shield className="w-4 h-4 text-muted-foreground shrink-0" />
        <span className="text-xs font-semibold text-[hsl(var(--foreground))]">Factions Editor</span>
        {factions && <span className="text-[10px] text-slate-500 font-mono">({factions.length} factions)</span>}
        {overLimit &&
        <span className="flex items-center gap-1 text-[10px] text-amber-400 bg-amber-900/30 border border-amber-700 rounded px-2 py-0.5">
            <AlertTriangle className="w-3 h-3" />
            {factions.length} — vanilla limit {VANILLA_FACTION_LIMIT}. Extras require M2EX.
          </span>
        }
        <div className="ml-auto flex items-center gap-1.5 flex-wrap">
          <input ref={cultRef} type="file" accept=".txt" className="hidden" onChange={loadCultures} />
          <Button variant="outline" size="sm" className={`text-[10px] h-7 text-[hsl(var(--foreground))] ${cultures.length ? 'text-green-300 border-green-700' : ''}`} onClick={() => cultRef.current?.click()}>
            <Upload className="w-3 h-3 mr-1" />
            {cultures.length ? `${cultures.length} cultures` : 'descr_cultures.txt'}
          </Button>

          <input ref={relRef} type="file" accept=".txt" className="hidden" onChange={loadReligions} />
          <Button variant="outline" size="sm" className={`text-[10px] h-7 bg-[hsl(var(--background))] text-[hsl(var(--foreground))] ${religions.length ? 'text-green-300 border-green-700' : ''}`} onClick={() => relRef.current?.click()}>
            <Upload className="w-3 h-3 mr-1" />
            {religions.length ? `${religions.length} religions` : 'descr_religions.txt'}
          </Button>

          <input ref={eduRef} type="file" accept=".txt" className="hidden" onChange={loadEdu} />
          <Button variant="outline" size="sm" className={`text-[10px] h-7 text-[hsl(var(--foreground))] ${eduUnits.length ? 'text-green-300 border-green-700' : ''}`} onClick={() => eduRef.current?.click()}>
            <Upload className="w-3 h-3 mr-1" />
            {eduUnits.length ? `${eduUnits.length} units` : 'export_descr_unit.txt'}
          </Button>

          <input ref={bannersRef} type="file" accept=".xml" className="hidden" onChange={loadBannersXml} />
          <Button variant="outline" size="sm" className={`text-[10px] h-7 ${bannersLoaded ? 'text-green-300 border-green-700' : ''}`} onClick={() => bannersRef.current?.click()}>
            <Upload className="w-3 h-3 mr-1" />
            {bannersLoaded ? 'Banners ✓' : 'descr_banners_new.xml'}
          </Button>

          <input ref={stringsRef} type="file" accept=".bin" className="hidden" onChange={loadStringsBinGlobal} />
          <Button variant="outline" size="sm" className={`text-[10px] h-7 ${stringsLoaded ? 'text-green-300 border-green-700' : ''}`} onClick={() => stringsRef.current?.click()}>
            <Upload className="w-3 h-3 mr-1" />
            {stringsLoaded ? 'Strings ✓' : 'expanded.txt.strings.bin'}
          </Button>

          <input ref={menuStringsRef} type="file" accept=".bin" className="hidden" onChange={loadMenuStrings} />
          <Button variant="outline" size="sm" className={`text-[10px] h-7 ${menuStringsLoaded ? 'text-green-300 border-green-700' : ''}`} onClick={() => menuStringsRef.current?.click()}>
            <Upload className="w-3 h-3 mr-1" />
            {menuStringsLoaded ? 'Menu Strings ✓' : 'menu_english.txt.strings.bin'}
          </Button>

          <div className="w-px h-5 bg-border mx-1" />

          <input ref={fileRef} type="file" accept=".txt" className="hidden" onChange={loadFactions} />
          <Button variant="outline" size="sm" className={`text-[10px] h-7 ${factions ? 'text-amber-300 border-amber-600' : ''}`} onClick={() => fileRef.current?.click()}>
            <Upload className="w-3 h-3 mr-1" />
            {factions ? 'Reload factions' : 'Load descr_sm_factions.txt'}
          </Button>
          {factions &&
          <Button variant="outline" size="sm" className="text-[10px] h-7 text-slate-200 border-slate-600 hover:bg-slate-700" onClick={handleExport}>
              <Download className="w-3 h-3 mr-1" /> Export factions
            </Button>
          }
          {factions && <FactionZipExport getFactionsText={() => serialiseDescrSmFactions(factions)} />}
          {bannersLoaded && (
            <Button variant="outline" size="sm" className="text-[10px] h-7 text-slate-200 border-slate-600 hover:bg-slate-700" onClick={() => {
              const data = getFile(BANNERS_GLOBAL_KEY);
              if (!data) return;
              const blob = new Blob([data], { type: 'text/plain' });
              const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'descr_banners_new.xml'; a.click();
            }}>
              <Download className="w-3 h-3 mr-1" /> Export banners
            </Button>
          )}
          {menuStringsLoaded && (
            <Button variant="outline" size="sm" className="text-[10px] h-7 text-slate-200 border-slate-600 hover:bg-slate-700" onClick={() => {
              try {
                const raw = getFile(LS_MENU_STRINGS);
                if (!raw) return;
                const { entries, magic1, magic2 } = JSON.parse(raw);
                const buf = encodeStringsBin(entries, magic1, magic2);
                const blob = new Blob([buf], { type: 'application/octet-stream' });
                const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'menu_english.txt.strings.bin'; a.click();
              } catch {}
            }}>
              <Download className="w-3 h-3 mr-1" /> Export menu strings
            </Button>
          )}
        </div>
      </div>

      {!factions ?
      <div className="flex flex-col items-center justify-center flex-1 gap-3 text-slate-500">
          <Shield className="w-10 h-10 opacity-30" />
          <p className="text-sm">Load <span className="font-mono text-amber-400">descr_sm_factions.txt</span> to begin</p>
          <p className="text-[11px] text-slate-600">Optionally load <span className="font-mono text-slate-400">descr_cultures.txt</span>, <span className="font-mono text-slate-400">descr_religions.txt</span>, <span className="font-mono text-slate-400">export_descr_unit.txt</span> for dropdowns</p>
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            <Upload className="w-3 h-3 mr-1" /> Choose file…
          </Button>
        </div> :

      <div className="flex flex-1 min-h-0">
          <div className="w-56 border-r border-border flex flex-col shrink-0">
            <div className="p-2 border-b border-border space-y-1">
              <Input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-6 text-[10px] px-2 bg-slate-700 border-slate-600 text-slate-100 placeholder:text-slate-400" />
              <Button variant="outline" size="sm" className="w-full text-[10px] h-6 text-slate-200 border-slate-600 hover:bg-slate-700" onClick={addFaction}>
                <Plus className="w-3 h-3 mr-1" /> Add Faction
              </Button>
            </div>
            <ScrollArea className="flex-1 max-h-[calc(100vh-120px)]">
              <DragDropContext onDragEnd={onDragEnd}>
                <Droppable droppableId="factions">
                  {(provided) => (
                    <div {...provided.droppableProps} ref={provided.innerRef}>
                      {filtered.map(({ f, i }, index) => {
                        const originalIdx = factions.findIndex(faction => faction.name === f.name);
                        return (
                          <Draggable key={f.name} draggableId={f.name} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className={`w-full border-b border-border/60 ${selectedIdx === originalIdx ? 'bg-accent' : 'hover:bg-accent'} ${snapshot.isDragging ? 'bg-accent shadow-lg' : ''}`}
                                style={{ ...provided.draggableProps.style }}
                              >
                                <div className="flex items-center gap-2 px-3 py-2">
                                  <div {...provided.dragHandleProps} className="cursor-grab text-slate-500 hover:text-slate-300">
                                    <GripVertical className="w-3 h-3" />
                                  </div>
                                  <button onClick={() => setSelectedIdx(originalIdx)} className="flex items-center gap-2 flex-1 text-left min-w-0">
                                    <div className="flex gap-1 shrink-0">
                                      <div className="w-3 h-3 rounded-sm border border-slate-600" style={{ background: rgbToHex(f.primary_colour) }} />
                                      <div className="w-3 h-3 rounded-sm border border-slate-600" style={{ background: rgbToHex(f.secondary_colour) }} />
                                    </div>
                                    <span className="flex-1 text-[11px] font-mono truncate text-slate-100">{f.name}</span>
                                  </button>
                                </div>
                                {selectedIdx === originalIdx && (
                                  <div className="flex gap-1.5 px-3 pb-2">
                                    <Button variant="outline" size="sm" className="flex-1 h-6 text-[10px] text-blue-300 border-blue-700/60 hover:bg-blue-900/30 hover:text-blue-200"
                                      onClick={(e) => {e.stopPropagation();openDuplicateModal(originalIdx);}}>
                                      <Copy className="w-3 h-3 mr-1" /> Duplicate
                                    </Button>
                                    <Button variant="outline" size="sm" className="flex-1 h-6 text-[10px] text-red-400 border-red-700/60 hover:bg-red-900/30 hover:text-red-300"
                                      onClick={(e) => {e.stopPropagation();deleteFaction(originalIdx);}}>
                                      <Trash2 className="w-3 h-3 mr-1" /> Delete
                                    </Button>
                                  </div>
                                )}
                              </div>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            </ScrollArea>
          </div>

          <div className="flex-1 min-h-0 overflow-hidden">
            {selectedIdx !== null && factions[selectedIdx] ?
          <FactionDetail
            key={selectedIdx}
            faction={factions[selectedIdx]}
            onChange={(f) => updateFaction(selectedIdx, f)}
            onCancel={() => setSelectedIdx(null)}
            cultures={cultures}
            religions={religions}
            eduUnits={eduUnits} /> :


          <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                Select a faction to edit
              </div>
          }
          </div>
        </div>
      }

      <DuplicateFactionModal
        open={duplicateModalOpen}
        onOpenChange={setDuplicateModalOpen}
        sourceFaction={duplicateSourceIdx !== null && factions ? factions[duplicateSourceIdx] : null}
        defaultName={duplicateDefaultName}
        onConfirm={confirmDuplicate}
      />
    </div>);

}