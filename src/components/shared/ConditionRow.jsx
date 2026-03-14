import React, { useState, useRef, useEffect } from 'react';
import { Trash2, ChevronDown, Search } from 'lucide-react';
import {
  CONDITION_DEFS,
  CONDITION_PREFIXES,
  INT_OPERATORS,
  parseConditionString,
  serializeCondition,
} from './conditionDefs';

const inputCls = 'h-7 px-2 rounded bg-background border border-border text-xs font-mono text-white focus:outline-none focus:ring-1 focus:ring-primary';
const selectCls = 'h-7 px-1 rounded bg-background border border-border text-xs font-mono text-white focus:outline-none focus:ring-1 focus:ring-primary';

/** Small inline searchable dropdown */
function SearchableSelect({ value, options, onChange, placeholder = 'Select…', className = '' }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const filtered = options.filter(o => {
    const label = typeof o === 'string' ? o : o.label;
    return label.toLowerCase().includes(query.toLowerCase());
  });

  const getLabel = (v) => {
    const opt = options.find(o => (typeof o === 'string' ? o : o.value) === v);
    return opt ? (typeof opt === 'string' ? opt : opt.label) : v;
  };

  const select = (v) => { onChange(v); setOpen(false); setQuery(''); };

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(p => !p)}
        className={`w-full flex items-center justify-between ${inputCls}`}
      >
        <span className={value ? 'text-white truncate' : 'text-muted-foreground'}>{value ? getLabel(value) : placeholder}</span>
        <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0 ml-1" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 left-0 min-w-full bg-card border border-border rounded shadow-xl overflow-hidden" style={{ minWidth: '180px' }}>
          <div className="flex items-center gap-1 px-2 py-1 border-b border-border">
            <Search className="w-3 h-3 text-muted-foreground shrink-0" />
            <input
              autoFocus
              className="flex-1 bg-transparent text-xs text-white placeholder-muted-foreground focus:outline-none"
              placeholder="Search…"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 && <p className="text-[11px] text-muted-foreground px-3 py-1.5">No matches</p>}
            {filtered.map(opt => {
              const v = typeof opt === 'string' ? opt : opt.value;
              const l = typeof opt === 'string' ? opt : opt.label;
              return (
                <button key={v} type="button" onClick={() => select(v)}
                  className={`w-full text-left px-3 py-1 text-xs font-mono hover:bg-accent transition-colors ${v === value ? 'bg-primary/15 text-primary' : 'text-white'}`}>
                  {l}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * ConditionRow
 * Renders one structured condition line.
 *
 * Props:
 *   rawValue   – raw condition string (e.g. "Condition IsGeneral true")
 *   onChange   – (newRawString) => void
 *   onDelete   – () => void
 *   isFirst    – boolean (first condition must always be 'Condition', not and/or)
 *   buildings  – string[] of building tree names from EDB
 *   traits     – string[] of trait names from traits file
 */
export default function ConditionRow({ rawValue, onChange, onDelete, isFirst, buildings = [], traits = [] }) {
  const parsed = parseConditionString(rawValue);
  const { prefix, condName, operator, value1, value2 } = parsed;

  const def = CONDITION_DEFS.find(d => d.name === condName);

  const update = (patch) => {
    onChange(serializeCondition({ prefix, condName, operator, value1, value2, ...patch }));
  };

  const condOptions = CONDITION_DEFS.map(d => ({
    value: d.name,
    label: `${d.name}  —  ${d.description}`,
  }));

  // Building options from EDB (with fallback)
  const buildingOptions = buildings.length > 0 ? buildings : [];

  // Trait options from traits file (with fallback)
  const traitOptions = traits.length > 0 ? traits : [];

  return (
    <div className="flex flex-wrap items-center gap-1 p-1.5 rounded border border-border/60 bg-background/60">
      {/* Prefix selector */}
      {isFirst ? (
        <span className="text-[10px] font-bold text-primary px-1.5 py-0.5 bg-primary/10 rounded shrink-0">Condition</span>
      ) : (
        <select
          value={prefix}
          onChange={e => update({ prefix: e.target.value })}
          className={`${selectCls} w-24 shrink-0`}
        >
          {CONDITION_PREFIXES.filter(p => p !== 'Condition').map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      )}

      {/* Condition name searchable dropdown */}
      <SearchableSelect
        value={condName}
        options={condOptions}
        onChange={v => update({ condName: v, operator: '', value1: '', value2: '' })}
        placeholder="Choose condition…"
        className="flex-1 min-w-32"
      />

      {/* Argument fields depending on type */}
      {def?.argumentType === 'boolean' && (
        <select value={value1 || 'true'} onChange={e => update({ value1: e.target.value })} className={`${selectCls} w-20`}>
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      )}

      {def?.argumentType === 'int_op' && (
        <>
          <select value={operator || '>='} onChange={e => update({ operator: e.target.value })} className={`${selectCls} w-14`}>
            {INT_OPERATORS.map(op => <option key={op} value={op}>{op}</option>)}
          </select>
          <input
            type="number"
            value={value1}
            onChange={e => update({ value1: e.target.value })}
            className={`${inputCls} w-20`}
            placeholder="0"
          />
        </>
      )}

      {def?.argumentType === 'building' && (
        buildingOptions.length > 0 ? (
          <SearchableSelect
            value={value1}
            options={buildingOptions}
            onChange={v => update({ value1: v })}
            placeholder="Building tree…"
            className="flex-1 min-w-28"
          />
        ) : (
          <input
            value={value1}
            onChange={e => update({ value1: e.target.value })}
            className={`${inputCls} flex-1 min-w-28`}
            placeholder="building_tree_name"
          />
        )
      )}

      {def?.argumentType === 'trait_op' && (
        <>
          {traitOptions.length > 0 ? (
            <SearchableSelect
              value={value1}
              options={traitOptions}
              onChange={v => update({ value1: v })}
              placeholder="Trait name…"
              className="flex-1 min-w-28"
            />
          ) : (
            <input
              value={value1}
              onChange={e => update({ value1: e.target.value })}
              className={`${inputCls} flex-1 min-w-28`}
              placeholder="TraitName"
            />
          )}
          <select value={operator || '>'} onChange={e => update({ operator: e.target.value })} className={`${selectCls} w-14`}>
            {INT_OPERATORS.map(op => <option key={op} value={op}>{op}</option>)}
          </select>
          <input
            type="number"
            value={value2}
            onChange={e => update({ value2: e.target.value })}
            className={`${inputCls} w-16`}
            placeholder="0"
          />
        </>
      )}

      {(def?.argumentType === 'string' || def?.argumentType === 'faction' || def?.argumentType === 'culture') && (
        <input
          value={value1}
          onChange={e => update({ value1: e.target.value })}
          className={`${inputCls} flex-1 min-w-28`}
          placeholder={def.description}
        />
      )}

      {!def && condName && (
        // Unknown / free-form condition — show raw value input
        <input
          value={value1}
          onChange={e => update({ value1: e.target.value })}
          className={`${inputCls} flex-1 min-w-28`}
          placeholder="arguments…"
        />
      )}

      {/* Delete */}
      <button onClick={onDelete} className="p-0.5 hover:bg-destructive/20 rounded shrink-0 ml-auto">
        <Trash2 className="w-3 h-3 text-destructive" />
      </button>
    </div>
  );
}