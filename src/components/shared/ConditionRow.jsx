import React, { useState, useRef, useEffect } from 'react';
import { CONDITION_DEFS, COMPARE_OPS, RELIGION_OPTIONS, CULTURE_OPTIONS, AGENT_TYPES, parseConditionString, serializeCondition } from './conditionDefs';
import { Trash2, ChevronDown, Search } from 'lucide-react';

const CONNECTORS = ['and', 'or', 'and not', 'or not'];

// ── Searchable type dropdown ─────────────────────────────────────────────────
function TypeSelect({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = CONDITION_DEFS.filter(d =>
    d.key.toLowerCase().includes(search.toLowerCase()) ||
    (d.hint || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div ref={ref} className="relative flex-1 min-w-0">
      <button
        type="button"
        onClick={() => { setOpen(o => !o); setSearch(''); }}
        className="w-full h-6 flex items-center justify-between px-2 rounded border border-border bg-background text-[11px] font-mono text-white hover:border-primary/50 focus:outline-none"
      >
        <span className="truncate">{value || 'Select condition…'}</span>
        <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0 ml-1" />
      </button>
      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 w-64 bg-card border border-border rounded-md shadow-xl overflow-hidden">
          <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-border">
            <Search className="w-3 h-3 text-muted-foreground shrink-0" />
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search conditions…"
              className="flex-1 bg-transparent text-[11px] text-white placeholder-muted-foreground focus:outline-none"
            />
          </div>
          <div className="max-h-56 overflow-y-auto">
            {filtered.map(d => (
              <button
                key={d.key}
                type="button"
                onClick={() => { onChange(d.key); setOpen(false); }}
                className={`w-full text-left px-3 py-1.5 hover:bg-accent transition-colors ${value === d.key ? 'text-primary bg-primary/10' : ''}`}
              >
                <span className="text-[11px] font-mono text-white">{d.key}</span>
                {d.hint && <span className="ml-2 text-[10px] text-muted-foreground">{d.hint}</span>}
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="px-3 py-2 text-[11px] text-muted-foreground">No matches</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Searchable value dropdown ─────────────────────────────────────────────────
function SearchableValueSelect({ value, onChange, options, placeholder }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = options.filter(o => o.toLowerCase().includes(search.toLowerCase()));
  const showCustom = search && !options.some(o => o.toLowerCase() === search.toLowerCase());

  return (
    <div ref={ref} className="relative flex-1 min-w-0">
      <button
        type="button"
        onClick={() => { setOpen(o => !o); setSearch(''); }}
        className="w-full h-6 flex items-center justify-between px-2 rounded border border-border bg-background text-[11px] font-mono text-white hover:border-primary/50 focus:outline-none truncate"
      >
        <span className="truncate">{value || placeholder || 'Select…'}</span>
        <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0 ml-1" />
      </button>
      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 w-56 bg-card border border-border rounded-md shadow-xl overflow-hidden">
          <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-border">
            <Search className="w-3 h-3 text-muted-foreground shrink-0" />
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search…"
              className="flex-1 bg-transparent text-[11px] text-white placeholder-muted-foreground focus:outline-none"
            />
          </div>
          <div className="max-h-44 overflow-y-auto">
            {filtered.map(opt => (
              <button key={opt} type="button"
                onClick={() => { onChange(opt); setOpen(false); }}
                className={`w-full text-left px-3 py-1.5 text-[11px] font-mono hover:bg-accent ${value === opt ? 'text-primary' : 'text-white'}`}
              >{opt}</button>
            ))}
            {showCustom && (
              <button type="button"
                onClick={() => { onChange(search); setOpen(false); }}
                className="w-full text-left px-3 py-1.5 text-[11px] font-mono text-yellow-400 hover:bg-accent"
              >Use: "{search}"</button>
            )}
            {filtered.length === 0 && !showCustom && (
              <p className="px-3 py-2 text-[11px] text-muted-foreground">No matches</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const inputCls = 'h-6 px-2 rounded border border-border bg-background text-[11px] font-mono text-white focus:outline-none focus:ring-1 focus:ring-primary';
const selectCls = 'h-6 px-1 rounded border border-border bg-background text-[11px] font-mono text-white focus:outline-none';

// ── Main ConditionRow ────────────────────────────────────────────────────────
// Props: condStr, onChange, onDelete, isFirst, buildingNames, buildingLevelNames, traitNames, factionNames, traitAttributeNames
export default function ConditionRow({ condStr, onChange, onDelete, isFirst, buildingNames = [], buildingLevelNames = [], traitNames = [], factionNames = [], traitAttributeNames = [] }) {
  const cond = parseConditionString(condStr);
  const def = CONDITION_DEFS.find(d => d.key === cond.type);

  const update = (patch) => {
    onChange(serializeCondition({ ...cond, ...patch }));
  };

  const handleTypeChange = (newType) => {
    const newDef = CONDITION_DEFS.find(d => d.key === newType);
    const base = { ...cond, type: newType };
    if (newDef?.argType === 'bool') { base.boolVal = 'true'; delete base.value; delete base.op; delete base.traitName; delete base.attrName; }
    else if (newDef?.argType === 'compare_int') { base.op = '>='; base.value = '0'; delete base.boolVal; delete base.traitName; delete base.attrName; }
    else if (newDef?.argType === 'compare_trait') { base.traitName = ''; base.op = '>'; base.value = '0'; delete base.boolVal; delete base.attrName; }
    else if (newDef?.argType === 'compare_building') { base.op = '>='; base.value = ''; delete base.boolVal; delete base.traitName; delete base.attrName; }
    else if (newDef?.argType === 'compare_attribute') { base.attrName = ''; base.op = '>='; base.value = '0'; delete base.boolVal; delete base.traitName; }
    else if (newDef?.argType === 'building') { base.value = ''; delete base.boolVal; delete base.op; delete base.traitName; delete base.attrName; }
    else if (newDef?.argType === 'int') { base.value = '50'; delete base.boolVal; delete base.op; delete base.traitName; delete base.attrName; }
    else { base.value = ''; delete base.boolVal; delete base.op; delete base.traitName; delete base.attrName; }
    onChange(serializeCondition(base));
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {/* Connector */}
      {isFirst ? (
        <span className="text-[10px] text-muted-foreground font-mono w-16 shrink-0 text-right pr-1">IF</span>
      ) : (
        <select
          value={cond.connector}
          onChange={e => update({ connector: e.target.value })}
          className={selectCls + ' w-20 shrink-0'}
        >
          {CONNECTORS.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      )}

      {/* Type dropdown */}
      <TypeSelect value={cond.type} onChange={handleTypeChange} />

      {/* Arguments based on type */}
      {!def && (
        <input
          value={cond.value || ''}
          onChange={e => update({ value: e.target.value })}
          placeholder="value"
          className={inputCls + ' flex-1 min-w-0 w-24'}
        />
      )}

      {def?.argType === 'bool' && (
        <select value={cond.boolVal ?? 'true'} onChange={e => update({ boolVal: e.target.value })} className={selectCls + ' w-20'}>
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      )}

      {def?.argType === 'int' && (
        <input type="number" value={cond.value ?? ''} onChange={e => update({ value: e.target.value })}
          className={inputCls + ' w-20'} placeholder="0" />
      )}

      {def?.argType === 'compare_int' && (
        <>
          <select value={cond.op || '>='} onChange={e => update({ op: e.target.value })} className={selectCls + ' w-14'}>
            {COMPARE_OPS.map(op => <option key={op} value={op}>{op}</option>)}
          </select>
          <input type="number" value={cond.value ?? ''} onChange={e => update({ value: e.target.value })}
            className={inputCls + ' w-20'} placeholder="0" />
        </>
      )}

      {def?.argType === 'compare_trait' && (
        <>
          {traitNames?.length > 0
            ? <SearchableValueSelect value={cond.traitName || ''} onChange={v => update({ traitName: v })} options={traitNames} placeholder="Trait name" />
            : <input value={cond.traitName || ''} onChange={e => update({ traitName: e.target.value })}
                placeholder="TraitName" className={inputCls + ' w-32'} />
          }
          <select value={cond.op || '>'} onChange={e => update({ op: e.target.value })} className={selectCls + ' w-14'}>
            {COMPARE_OPS.map(op => <option key={op} value={op}>{op}</option>)}
          </select>
          <input type="number" value={cond.value ?? ''} onChange={e => update({ value: e.target.value })}
            className={inputCls + ' w-20'} placeholder="0" />
        </>
      )}

      {/* compare_attribute: Attribute <attrName> >= <int> */}
      {def?.argType === 'compare_attribute' && (
        <>
          {traitAttributeNames?.length > 0
            ? <SearchableValueSelect value={cond.attrName || ''} onChange={v => update({ attrName: v })} options={traitAttributeNames} placeholder="Attribute name" />
            : <input value={cond.attrName || ''} onChange={e => update({ attrName: e.target.value })}
                placeholder="AttributeName" className={inputCls + ' w-32'} />
          }
          <select value={cond.op || '>='} onChange={e => update({ op: e.target.value })} className={selectCls + ' w-14'}>
            {COMPARE_OPS.map(op => <option key={op} value={op}>{op}</option>)}
          </select>
          <input type="number" value={cond.value ?? ''} onChange={e => update({ value: e.target.value })}
            className={inputCls + ' w-20'} placeholder="0" />
        </>
      )}

      {/* compare_building: SettlementBuildingFinished >= <level> */}
      {def?.argType === 'compare_building' && (
        <>
          <select value={cond.op || '>='} onChange={e => update({ op: e.target.value })} className={selectCls + ' w-14'}>
            {COMPARE_OPS.map(op => <option key={op} value={op}>{op}</option>)}
          </select>
          {buildingLevelNames?.length > 0
            ? <SearchableValueSelect value={cond.value || ''} onChange={v => update({ value: v })} options={buildingLevelNames} placeholder="building level" />
            : <input value={cond.value || ''} onChange={e => update({ value: e.target.value })}
                placeholder="building_level_name" className={inputCls + ' flex-1'} />
          }
        </>
      )}

      {def?.argType === 'building' && (
        buildingNames?.length > 0
          ? <SearchableValueSelect value={cond.value || ''} onChange={v => update({ value: v })} options={buildingNames} placeholder="building tree" />
          : <input value={cond.value || ''} onChange={e => update({ value: e.target.value })}
              placeholder="building_tree_name" className={inputCls + ' flex-1'} />
      )}

      {/* agent: fixed list dropdown */}
      {def?.argType === 'agent' && (
        <SearchableValueSelect value={cond.value || ''} onChange={v => update({ value: v })} options={AGENT_TYPES} placeholder="agent type" />
      )}

      {/* faction: from descr_sm_factions.txt */}
      {def?.argType === 'faction' && (
        factionNames?.length > 0
          ? <SearchableValueSelect value={cond.value || ''} onChange={v => update({ value: v })} options={factionNames} placeholder="faction name" />
          : <input value={cond.value || ''} onChange={e => update({ value: e.target.value })}
              placeholder="faction_name" className={inputCls + ' flex-1'} />
      )}

      {def?.argType === 'religion' && (
        <SearchableValueSelect value={cond.value || ''} onChange={v => update({ value: v })} options={RELIGION_OPTIONS} placeholder="religion" />
      )}

      {def?.argType === 'culture' && (
        <SearchableValueSelect value={cond.value || ''} onChange={v => update({ value: v })} options={CULTURE_OPTIONS} placeholder="culture" />
      )}

      {def?.argType === 'string' && (
        <input value={cond.value || ''} onChange={e => update({ value: e.target.value })}
          placeholder={def.hint || 'value'} className={inputCls + ' flex-1 min-w-0 w-28'} />
      )}

      {/* Delete */}
      <button onClick={onDelete} className="p-0.5 hover:bg-destructive/20 rounded shrink-0">
        <Trash2 className="w-3 h-3 text-destructive" />
      </button>
    </div>
  );
}