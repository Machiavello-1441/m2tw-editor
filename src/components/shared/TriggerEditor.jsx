import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, ChevronDown, ChevronRight, Zap, Pencil } from 'lucide-react';

const inputCls = 'h-7 text-xs font-mono text-white bg-background';
const textareaCls = 'w-full mt-1 text-xs bg-background border border-border rounded px-2 py-1.5 text-white resize-none focus:outline-none focus:ring-1 focus:ring-primary font-mono';

// ── Trait Triggers Editor ─────────────────────────────────────────────────────

export function TraitTriggersEditor({ triggers = [], traitName, onUpdateTriggers }) {
  const related = triggers.map((t, i) => ({ ...t, _idx: i }))
    .filter(t => t.affects?.some(a => a.trait === traitName));

  const addTrigger = () => {
    const name = `Trigger_${traitName}_${Date.now()}`;
    const newTrigger = {
      name,
      whenToTest: 'PostBattle',
      conditions: ['Condition IsGeneral'],
      affects: [{ trait: traitName, value: 1, chance: 100 }],
      rawLines: [],
    };
    onUpdateTriggers([...triggers, newTrigger]);
  };

  const updateTrigger = (idx, updated) => {
    const next = triggers.map((t, i) => i === idx ? updated : t);
    onUpdateTriggers(next);
  };

  const deleteTrigger = (idx) => {
    onUpdateTriggers(triggers.filter((_, i) => i !== idx));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <Label className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Zap className="w-3 h-3" /> Triggers ({related.length})
        </Label>
        <Button size="sm" variant="outline" className="h-6 px-2 text-[10px] text-white" onClick={addTrigger}>
          <Plus className="w-3 h-3 mr-1" /> Add Trigger
        </Button>
      </div>
      <div className="space-y-2">
        {related.map(t => (
          <TraitTriggerCard
            key={t._idx}
            trigger={t}
            traitName={traitName}
            onUpdate={(updated) => updateTrigger(t._idx, updated)}
            onDelete={() => deleteTrigger(t._idx)}
          />
        ))}
        {related.length === 0 && (
          <p className="text-[10px] text-muted-foreground italic">No triggers reference this trait.</p>
        )}
      </div>
    </div>
  );
}

function TraitTriggerCard({ trigger, traitName, onUpdate, onDelete }) {
  const [expanded, setExpanded] = useState(false);

  const myAffect = trigger.affects?.find(a => a.trait === traitName) || { trait: traitName, value: 1, chance: 100 };

  const updateAffect = (field, value) => {
    const affects = (trigger.affects || []).map(a =>
      a.trait === traitName ? { ...a, [field]: value } : a
    );
    if (!affects.some(a => a.trait === traitName)) affects.push({ ...myAffect, [field]: value });
    onUpdate({ ...trigger, affects });
  };

  const conditionsText = (trigger.conditions || []).join('\n');
  const setConditions = (text) => {
    onUpdate({ ...trigger, conditions: text.split('\n').map(s => s.trim()).filter(Boolean) });
  };

  return (
    <div className="rounded border border-border bg-card/40 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-accent/30"
        onClick={() => setExpanded(v => !v)}>
        {expanded ? <ChevronDown className="w-3 h-3 shrink-0 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 shrink-0 text-muted-foreground" />}
        <span className="text-[11px] font-mono font-semibold text-primary flex-1 truncate">{trigger.name}</span>
        <span className="text-[10px] text-muted-foreground hidden sm:block">{trigger.whenToTest}</span>
        <Pencil className="w-3 h-3 text-muted-foreground/40 ml-1" />
        <button onClick={e => { e.stopPropagation(); onDelete(); }}
          className="p-0.5 hover:bg-destructive/20 rounded shrink-0 ml-1">
          <Trash2 className="w-3 h-3 text-destructive" />
        </button>
      </div>

      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-border/50 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <Label className="text-[10px] text-muted-foreground">Trigger Name</Label>
              <Input value={trigger.name} onChange={e => onUpdate({ ...trigger, name: e.target.value })} className={inputCls + ' mt-1'} />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">WhenToTest</Label>
              <Input value={trigger.whenToTest} onChange={e => onUpdate({ ...trigger, whenToTest: e.target.value })} className={inputCls + ' mt-1'} />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Chance (%)</Label>
              <Input type="number" min={0} max={100} value={myAffect.chance}
                onChange={e => updateAffect('chance', parseInt(e.target.value) || 0)}
                className={inputCls + ' mt-1'} />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Value (points)</Label>
              <Input type="number" value={myAffect.value}
                onChange={e => updateAffect('value', parseInt(e.target.value) || 0)}
                className={inputCls + ' mt-1'} />
            </div>
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">Conditions (one per line)</Label>
            <textarea rows={4} className={textareaCls}
              value={conditionsText}
              onChange={e => setConditions(e.target.value)}
              placeholder={'Condition IsGeneral\nand FactionType == byzantium'} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Ancillary Triggers Editor ─────────────────────────────────────────────────

export function AncillaryTriggersEditor({ triggers = [], ancName, onUpdateTriggers }) {
  const related = triggers.map((t, i) => ({ ...t, _idx: i }))
    .filter(t => t.acquireAncillary?.name === ancName);

  const addTrigger = () => {
    const name = `Trigger_${ancName}_${Date.now()}`;
    const newTrigger = {
      name,
      whenToTest: 'PostBattle',
      conditions: ['Condition IsGeneral'],
      acquireAncillary: { name: ancName, chance: 100 },
      rawLines: [],
    };
    onUpdateTriggers([...triggers, newTrigger]);
  };

  const updateTrigger = (idx, updated) => {
    onUpdateTriggers(triggers.map((t, i) => i === idx ? updated : t));
  };

  const deleteTrigger = (idx) => {
    onUpdateTriggers(triggers.filter((_, i) => i !== idx));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <Label className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Zap className="w-3 h-3" /> Triggers ({related.length})
        </Label>
        <Button size="sm" variant="outline" className="h-6 px-2 text-[10px] text-white" onClick={addTrigger}>
          <Plus className="w-3 h-3 mr-1" /> Add Trigger
        </Button>
      </div>
      <div className="space-y-2">
        {related.map(t => (
          <AncTriggerCard
            key={t._idx}
            trigger={t}
            ancName={ancName}
            onUpdate={(updated) => updateTrigger(t._idx, updated)}
            onDelete={() => deleteTrigger(t._idx)}
          />
        ))}
        {related.length === 0 && (
          <p className="text-[10px] text-muted-foreground italic">No triggers reference this ancillary.</p>
        )}
      </div>
    </div>
  );
}

function AncTriggerCard({ trigger, ancName, onUpdate, onDelete }) {
  const [expanded, setExpanded] = useState(false);

  const acq = trigger.acquireAncillary || { name: ancName, chance: 100 };
  const conditionsText = (trigger.conditions || []).join('\n');

  return (
    <div className="rounded border border-border bg-card/40 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-accent/30"
        onClick={() => setExpanded(v => !v)}>
        {expanded ? <ChevronDown className="w-3 h-3 shrink-0 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 shrink-0 text-muted-foreground" />}
        <span className="text-[11px] font-mono font-semibold text-primary flex-1 truncate">{trigger.name}</span>
        <span className="text-[10px] text-muted-foreground hidden sm:block">{trigger.whenToTest} · {acq.chance}%</span>
        <Pencil className="w-3 h-3 text-muted-foreground/40 ml-1" />
        <button onClick={e => { e.stopPropagation(); onDelete(); }}
          className="p-0.5 hover:bg-destructive/20 rounded shrink-0 ml-1">
          <Trash2 className="w-3 h-3 text-destructive" />
        </button>
      </div>

      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-border/50 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <Label className="text-[10px] text-muted-foreground">Trigger Name</Label>
              <Input value={trigger.name} onChange={e => onUpdate({ ...trigger, name: e.target.value })} className={inputCls + ' mt-1'} />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">WhenToTest</Label>
              <Input value={trigger.whenToTest} onChange={e => onUpdate({ ...trigger, whenToTest: e.target.value })} className={inputCls + ' mt-1'} />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Chance (%)</Label>
              <Input type="number" min={0} max={100}
                value={acq.chance}
                onChange={e => onUpdate({ ...trigger, acquireAncillary: { ...acq, chance: parseInt(e.target.value) || 0 } })}
                className={inputCls + ' mt-1'} />
            </div>
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">Conditions (one per line)</Label>
            <textarea rows={4} className={textareaCls}
              value={conditionsText}
              onChange={e => onUpdate({ ...trigger, conditions: e.target.value.split('\n').map(s => s.trim()).filter(Boolean) })}
              placeholder={'Condition IsGeneral\nand FactionType == byzantium'} />
          </div>
        </div>
      )}
    </div>
  );
}