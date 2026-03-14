import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, ChevronDown, ChevronRight, Zap, Search } from 'lucide-react';
import WhenToTestSelect from './WhenToTestSelect';
import ConditionRow from './ConditionRow';
import { serializeCondition, getFactionNames, getBuildingLevelNames } from './conditionDefs';
import { useEDB } from '../edb/EDBContext';

const inputCls = 'h-7 text-xs font-mono bg-background text-white';

// Searchable dropdown for trait names in Affects
function TraitNameSelect({ value, onChange, traitNames }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = traitNames.filter(t => t.toLowerCase().includes(search.toLowerCase()));
  const showCustom = search && !traitNames.some(t => t.toLowerCase() === search.toLowerCase());

  if (!traitNames?.length) {
    return (
      <Input value={value} onChange={e => onChange(e.target.value)}
        placeholder="Trait name" className={inputCls + ' flex-1 min-w-0'} />
    );
  }

  return (
    <div ref={ref} className="relative flex-1 min-w-0">
      <button
        type="button"
        onClick={() => { setOpen(o => !o); setSearch(''); }}
        className="w-full h-7 flex items-center justify-between px-2 rounded border border-border bg-background text-xs font-mono text-white hover:border-primary/50 focus:outline-none"
      >
        <span className="truncate">{value || 'Select trait…'}</span>
        <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0 ml-1" />
      </button>
      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 w-56 bg-card border border-border rounded-md shadow-xl overflow-hidden">
          <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-border">
            <Search className="w-3 h-3 text-muted-foreground shrink-0" />
            <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search traits…"
              className="flex-1 bg-transparent text-xs text-white placeholder-muted-foreground focus:outline-none"
            />
          </div>
          <div className="max-h-44 overflow-y-auto">
            {filtered.map(t => (
              <button key={t} type="button"
                onClick={() => { onChange(t); setOpen(false); }}
                className={`w-full text-left px-3 py-1.5 text-xs font-mono hover:bg-accent ${value === t ? 'text-primary' : 'text-white'}`}
              >{t}</button>
            ))}
            {showCustom && (
              <button type="button" onClick={() => { onChange(search); setOpen(false); }}
                className="w-full text-left px-3 py-1.5 text-xs font-mono text-yellow-400 hover:bg-accent"
              >Use: "{search}"</button>
            )}
            {filtered.length === 0 && !showCustom && (
              <p className="px-3 py-2 text-xs text-muted-foreground">No matches</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// mode: 'trait' | 'ancillary'
export default function TriggerEditor({ triggers, onUpdate, onAdd, onDelete, entityName, mode, traitNames = [], traitAttributeNames = [] }) {
  const [expanded, setExpanded] = useState(null);

  let buildingNames = [];
  let buildingLevelNames = [];
  try {
    const { edbData } = useEDB();
    buildingNames = (edbData?.buildings || []).map(b => b.name);
    // Collect all level names from all buildings
    for (const b of (edbData?.buildings || [])) {
      for (const lvl of (b.levels || [])) {
        if (lvl.name) buildingLevelNames.push(lvl.name);
      }
    }
  } catch {}

  // Load faction names from cached descr_sm_factions.txt
  const [factionNames] = useState(() => getFactionNames());

  const addCondition = (trigger, i) => {
    const newCond = serializeCondition({ connector: trigger.conditions.length === 0 ? 'Condition' : 'and', type: 'IsGeneral', boolVal: 'true' });
    onUpdate(i, { ...trigger, conditions: [...(trigger.conditions || []), newCond] });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <Label className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Zap className="w-3 h-3" /> Triggers ({triggers.length})
        </Label>
        <Button size="sm" variant="outline" className="h-6 px-2 text-[10px] text-white"
          onClick={() => { onAdd(entityName); setExpanded(triggers.length); }}>
          <Plus className="w-3 h-3 mr-1" /> Add Trigger
        </Button>
      </div>

      <div className="space-y-2">
        {triggers.map((t, i) => {
          const isOpen = expanded === i;
          return (
            <div key={i} className="rounded border border-border bg-card/40 overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-accent/40"
                onClick={() => setExpanded(isOpen ? null : i)}>
                {isOpen ? <ChevronDown className="w-3 h-3 shrink-0 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 shrink-0 text-muted-foreground" />}
                <span className="text-[11px] font-mono font-semibold text-primary flex-1 truncate">{t.name}</span>
                {t.whenToTest && <span className="text-[10px] text-muted-foreground hidden sm:block">{t.whenToTest}</span>}
                <button onClick={e => { e.stopPropagation(); onDelete(i); }}
                  className="p-0.5 hover:bg-destructive/20 rounded shrink-0">
                  <Trash2 className="w-3 h-3 text-destructive" />
                </button>
              </div>

              {isOpen && (
                <div className="px-3 pb-3 pt-2 border-t border-border/50 space-y-3">
                  {/* Name */}
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Trigger Name</Label>
                    <Input value={t.name} onChange={e => onUpdate(i, { ...t, name: e.target.value })} className={inputCls + ' mt-0.5'} />
                  </div>

                  {/* WhenToTest */}
                  <div>
                    <Label className="text-[10px] text-muted-foreground">WhenToTest</Label>
                    <div className="mt-0.5">
                      <WhenToTestSelect value={t.whenToTest} onChange={v => onUpdate(i, { ...t, whenToTest: v })} />
                    </div>
                  </div>

                  {/* Conditions */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <Label className="text-[10px] text-muted-foreground">Conditions</Label>
                      <button className="text-[10px] text-primary hover:underline" onClick={() => addCondition(t, i)}>
                        + Add condition
                      </button>
                    </div>
                    <div className="space-y-1.5">
                      {(t.conditions || []).map((cond, ci) => (
                        <ConditionRow
                          key={ci}
                          condStr={cond}
                          isFirst={ci === 0}
                          buildingNames={buildingNames}
                          buildingLevelNames={buildingLevelNames}
                          traitNames={traitNames}
                          factionNames={factionNames}
                          traitAttributeNames={traitAttributeNames}
                          onChange={newStr => {
                            const conds = [...t.conditions];
                            conds[ci] = newStr;
                            onUpdate(i, { ...t, conditions: conds });
                          }}
                          onDelete={() => onUpdate(i, { ...t, conditions: t.conditions.filter((_, j) => j !== ci) })}
                        />
                      ))}
                      {(t.conditions || []).length === 0 && (
                        <p className="text-[10px] text-muted-foreground italic">No conditions — click + Add condition</p>
                      )}
                    </div>
                  </div>

                  {/* Affects (trait mode) — searchable trait dropdown */}
                  {mode === 'trait' && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <Label className="text-[10px] text-muted-foreground">Affects</Label>
                        <button className="text-[10px] text-primary hover:underline"
                          onClick={() => onUpdate(i, { ...t, affects: [...(t.affects || []), { trait: entityName, value: 1, chance: 10 }] })}>
                          + Add
                        </button>
                      </div>
                      <div className="space-y-1">
                        {(t.affects || []).map((a, ai) => (
                          <div key={ai} className="flex items-center gap-1.5">
                            <TraitNameSelect
                              value={a.trait}
                              onChange={v => {
                                const affects = [...t.affects];
                                affects[ai] = { ...a, trait: v };
                                onUpdate(i, { ...t, affects });
                              }}
                              traitNames={traitNames}
                            />
                            <span className="text-[10px] text-muted-foreground shrink-0">+</span>
                            <Input type="number" value={a.value}
                              onChange={e => {
                                const affects = [...t.affects];
                                affects[ai] = { ...a, value: parseInt(e.target.value) || 0 };
                                onUpdate(i, { ...t, affects });
                              }}
                              className={inputCls + ' w-16'} />
                            <span className="text-[10px] text-muted-foreground shrink-0">%</span>
                            <Input type="number" value={a.chance}
                              onChange={e => {
                                const affects = [...t.affects];
                                affects[ai] = { ...a, chance: parseInt(e.target.value) || 0 };
                                onUpdate(i, { ...t, affects });
                              }}
                              className={inputCls + ' w-16'} />
                            <button onClick={() => onUpdate(i, { ...t, affects: t.affects.filter((_, j) => j !== ai) })}
                              className="p-0.5 hover:bg-destructive/20 rounded shrink-0">
                              <Trash2 className="w-3 h-3 text-destructive" />
                            </button>
                          </div>
                        ))}
                        {(t.affects || []).length === 0 && (
                          <p className="text-[10px] text-muted-foreground italic">No affects entries</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* AcquireAncillary (ancillary mode) */}
                  {mode === 'ancillary' && (
                    <div>
                      <Label className="text-[10px] text-muted-foreground">AcquireAncillary</Label>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Input
                          value={t.acquireAncillary?.name || ''}
                          onChange={e => onUpdate(i, { ...t, acquireAncillary: { ...(t.acquireAncillary || {}), name: e.target.value, chance: t.acquireAncillary?.chance ?? 10 } })}
                          placeholder="Ancillary name"
                          className={inputCls + ' flex-1'} />
                        <span className="text-[10px] text-muted-foreground shrink-0">Chance</span>
                        <Input type="number"
                          value={t.acquireAncillary?.chance ?? ''}
                          onChange={e => onUpdate(i, { ...t, acquireAncillary: { ...(t.acquireAncillary || {}), chance: parseInt(e.target.value) || 0 } })}
                          className={inputCls + ' w-16'} placeholder="%" />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {triggers.length === 0 && (
          <p className="text-[10px] text-muted-foreground italic">No triggers — click Add Trigger to create one.</p>
        )}
      </div>
    </div>
  );
}