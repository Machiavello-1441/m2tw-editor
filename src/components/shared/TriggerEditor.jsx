import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, ChevronDown, ChevronRight, Zap } from 'lucide-react';
import WhenToTestSelect from './WhenToTestSelect';
import ConditionRow from './ConditionRow';
import { serializeCondition } from './conditionDefs';
import { useEDB } from '../edb/EDBContext';

const inputCls = 'h-7 text-xs font-mono bg-background text-white';

// mode: 'trait' | 'ancillary'
// traitNames: optional string[] passed from trait editor
export default function TriggerEditor({ triggers, onUpdate, onAdd, onDelete, entityName, mode, traitNames = [] }) {
  const [expanded, setExpanded] = useState(null);

  // Get building tree names from EDB for SettlementBuildingExists etc.
  let buildingNames = [];
  try {
    const { edbData } = useEDB();
    buildingNames = (edbData?.buildings || []).map(b => b.name);
  } catch {}

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

                  {/* WhenToTest — searchable dropdown */}
                  <div>
                    <Label className="text-[10px] text-muted-foreground">WhenToTest</Label>
                    <div className="mt-0.5">
                      <WhenToTestSelect value={t.whenToTest} onChange={v => onUpdate(i, { ...t, whenToTest: v })} />
                    </div>
                  </div>

                  {/* Conditions — structured rows */}
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
                          traitNames={traitNames}
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

                  {/* Affects (trait mode) */}
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
                            <Input value={a.trait}
                              onChange={e => {
                                const affects = [...t.affects];
                                affects[ai] = { ...a, trait: e.target.value };
                                onUpdate(i, { ...t, affects });
                              }}
                              placeholder="Trait name" className={inputCls + ' flex-1 min-w-0'} />
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