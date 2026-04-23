/**
 * GuildEditor — shown inside LevelEditor when the selected building tree
 * starts with "guild_". Displays and lets the user edit:
 *   • Guild point thresholds for each level (from export_descr_guilds.txt)
 *   • Triggers (WhenToTest + Conditions + GuildPointsEffect entries)
 *
 * Guild "o/s/a" scope note (confirmed via community research):
 *   "o" (or any non-"a" token) → adds points to the LOCAL exported settlement
 *   "a"                        → adds points to ALL settlements in the faction
 *   For faction-export events only "a" has any effect.
 */

import React, { useState } from 'react';
import { useRefData } from './RefDataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, ChevronDown, ChevronRight, Zap, AlertCircle, Info } from 'lucide-react';
import WhenToTestSelect from '../shared/WhenToTestSelect';
import ConditionRow from '../shared/ConditionRow';
import { serializeCondition } from '../shared/conditionDefs';

// ── Scope selector ──────────────────────────────────────────────────────────
const SCOPE_OPTIONS = [
  { value: 'o', label: 'o — local settlement' },
  { value: 'a', label: 'a — all faction settlements' },
  { value: 's', label: 's — local (same as o in practice)' },
];

function ScopeSelect({ value, onChange }) {
  return (
    <select
      value={value || 'o'}
      onChange={e => onChange(e.target.value)}
      className="h-6 px-1 rounded border border-border bg-background text-[11px] font-mono text-white focus:outline-none"
    >
      {SCOPE_OPTIONS.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

// ── GuildPointsEffect row ───────────────────────────────────────────────────
function PointsEffectRow({ eff, onChange, onRemove }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-[10px] text-muted-foreground font-mono w-28 shrink-0">GuildPointsEffect</span>
      <Input
        className="h-6 text-[11px] font-mono w-40"
        value={eff.building}
        onChange={e => onChange({ ...eff, building: e.target.value })}
        placeholder="guild_xxx or level name"
      />
      <ScopeSelect value={eff.scope} onChange={v => onChange({ ...eff, scope: v })} />
      <Input
        className="h-6 text-[11px] font-mono w-20"
        type="number"
        value={eff.amount}
        onChange={e => onChange({ ...eff, amount: parseInt(e.target.value) || 0 })}
        placeholder="pts"
      />
      <button onClick={onRemove} className="p-0.5 hover:bg-destructive/20 rounded shrink-0">
        <Trash2 className="w-3 h-3 text-destructive" />
      </button>
    </div>
  );
}

// ── Single trigger editor ────────────────────────────────────────────────────
function TriggerBlock({ trigger, onUpdate, onDelete }) {
  const [open, setOpen] = useState(false);

  const addCondition = () => {
    const newCond = serializeCondition({
      connector: trigger.conditions.length === 0 ? 'Condition' : 'and',
      type: 'IsGeneral',
      boolVal: 'true',
    });
    onUpdate({ ...trigger, conditions: [...(trigger.conditions || []), newCond] });
  };

  const addPointsEffect = () => {
    onUpdate({
      ...trigger,
      pointsEffects: [
        ...(trigger.pointsEffects || []),
        { building: '', scope: 'o', amount: 1 },
      ],
    });
  };

  return (
    <div className="rounded border border-border bg-card/40 overflow-hidden">
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-accent/40"
        onClick={() => setOpen(o => !o)}
      >
        {open
          ? <ChevronDown className="w-3 h-3 shrink-0 text-muted-foreground" />
          : <ChevronRight className="w-3 h-3 shrink-0 text-muted-foreground" />}
        <span className="text-[11px] font-mono font-semibold text-primary flex-1 truncate">{trigger.name}</span>
        {trigger.whenToTest && (
          <span className="text-[10px] text-muted-foreground hidden sm:block">{trigger.whenToTest}</span>
        )}
        <Badge variant="outline" className="text-[9px] shrink-0">
          {(trigger.conditions || []).length} cond · {(trigger.pointsEffects || []).length} fx
        </Badge>
        <button
          onClick={e => { e.stopPropagation(); onDelete(); }}
          className="p-0.5 hover:bg-destructive/20 rounded shrink-0"
        >
          <Trash2 className="w-3 h-3 text-destructive" />
        </button>
      </div>

      {open && (
        <div className="px-3 pb-3 pt-2 border-t border-border/50 space-y-3">
          {/* Trigger name */}
          <div>
            <Label className="text-[10px] text-muted-foreground">Trigger Name</Label>
            <Input
              value={trigger.name}
              onChange={e => onUpdate({ ...trigger, name: e.target.value })}
              className="h-7 text-xs mt-0.5 font-mono"
            />
          </div>

          {/* WhenToTest */}
          <div>
            <Label className="text-[10px] text-muted-foreground">WhenToTest</Label>
            <div className="mt-0.5">
              <WhenToTestSelect
                value={trigger.whenToTest}
                onChange={v => onUpdate({ ...trigger, whenToTest: v })}
              />
            </div>
          </div>

          {/* Conditions */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Label className="text-[10px] text-muted-foreground">Conditions</Label>
              <button className="text-[10px] text-primary hover:underline" onClick={addCondition}>
                + Add condition
              </button>
            </div>
            <div className="space-y-1.5">
              {(trigger.conditions || []).map((cond, ci) => (
                <ConditionRow
                  key={ci}
                  condStr={cond}
                  isFirst={ci === 0}
                  onChange={newStr => {
                    const conds = [...trigger.conditions];
                    conds[ci] = newStr;
                    onUpdate({ ...trigger, conditions: conds });
                  }}
                  onDelete={() =>
                    onUpdate({ ...trigger, conditions: trigger.conditions.filter((_, j) => j !== ci) })
                  }
                />
              ))}
              {(trigger.conditions || []).length === 0 && (
                <p className="text-[10px] text-muted-foreground italic">No conditions</p>
              )}
            </div>
          </div>

          {/* GuildPointsEffect rows */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Label className="text-[10px] text-muted-foreground">GuildPointsEffect</Label>
              <button className="text-[10px] text-primary hover:underline" onClick={addPointsEffect}>
                + Add effect
              </button>
            </div>
            <div className="space-y-1.5">
              {(trigger.pointsEffects || []).map((eff, ei) => (
                <PointsEffectRow
                  key={ei}
                  eff={eff}
                  onChange={newEff => {
                    const fxs = [...trigger.pointsEffects];
                    fxs[ei] = newEff;
                    onUpdate({ ...trigger, pointsEffects: fxs });
                  }}
                  onRemove={() =>
                    onUpdate({ ...trigger, pointsEffects: trigger.pointsEffects.filter((_, j) => j !== ei) })
                  }
                />
              ))}
              {(trigger.pointsEffects || []).length === 0 && (
                <p className="text-[10px] text-muted-foreground italic">No point effects — add at least one</p>
              )}
            </div>

            {/* Scope hint */}
            <div className="flex items-start gap-1.5 mt-2 p-2 bg-amber-500/5 border border-amber-500/20 rounded text-[10px] text-amber-300 leading-relaxed">
              <Info className="w-3 h-3 shrink-0 mt-0.5" />
              <span>
                <strong>Scope research notes:</strong> For <em>settlement-export events</em> (e.g. GovernorBuildingCompleted),
                <strong className="font-mono"> o</strong> adds points to the local settlement and
                <strong className="font-mono"> a</strong> adds to all faction settlements.
                For <em>faction-export events</em> (most others), only <strong className="font-mono">a</strong> has any effect.
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main GuildEditor component ───────────────────────────────────────────────

export default function GuildEditor({ buildingName }) {
  const { guildData, updateGuild } = useRefData();

  // Derive guild internal name: strip "guild_" prefix to find in guild data,
  // or match by the building name prefix
  const guildEntry = guildData?.find(g => {
    const gName = g.name.toLowerCase();
    const bName = buildingName.toLowerCase();
    return bName === gName || bName.startsWith(gName + '_') || gName.startsWith(bName.replace(/_\d+$/, ''));
  }) || guildData?.find(g => buildingName.toLowerCase().includes(g.name.toLowerCase()));

  if (!guildData) {
    return (
      <Card className="border-amber-500/30">
        <CardContent className="p-4 flex items-start gap-2 text-[11px] text-amber-400">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            Load <code className="font-mono bg-accent px-1 rounded">export_descr_guilds.txt</code> from the Home page
            to edit guild point thresholds and triggers.
          </span>
        </CardContent>
      </Card>
    );
  }

  if (!guildEntry) {
    return (
      <Card className="border-border/50">
        <CardContent className="p-4 flex items-start gap-2 text-[11px] text-muted-foreground">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            No guild definition found in <code className="font-mono">export_descr_guilds.txt</code> for{' '}
            <strong className="font-mono">{buildingName}</strong>. Check the guild name matches the building tree name.
          </span>
        </CardContent>
      </Card>
    );
  }

  const update = (patch) => updateGuild(guildEntry.name, patch);

  const addTrigger = () => {
    const newTrigger = {
      name: `${guildEntry.name}_trigger_${(guildEntry.triggers || []).length + 1}`,
      whenToTest: 'GovernorBuildingCompleted',
      conditions: [],
      pointsEffects: [{ building: guildEntry.name, scope: 'o', amount: 1 }],
    };
    update({ triggers: [...(guildEntry.triggers || []), newTrigger] });
  };

  const LEVEL_LABELS = ['Level 1 (Guild House)', 'Level 2 (Master Guild)', 'Level 3 (Headquarters)'];

  return (
    <Card className="border-amber-600/30 bg-amber-950/10">
      <CardHeader className="p-3 pb-2">
        <CardTitle className="text-xs font-semibold flex items-center gap-1.5 text-amber-400">
          <Zap className="w-3.5 h-3.5" />
          Guild Definition — {guildEntry.name}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 pt-0 space-y-4">

        {/* Point thresholds */}
        <div>
          <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
            Point Thresholds (cumulative guild standing needed to unlock each level)
          </Label>
          <div className="flex flex-wrap gap-2 mt-1.5">
            {(guildEntry.pointThresholds?.length ? guildEntry.pointThresholds : [0, 0, 0]).map((pt, i) => (
              <div key={i} className="flex flex-col items-center gap-0.5">
                <span className="text-[9px] text-muted-foreground">{LEVEL_LABELS[i] || `Level ${i + 1}`}</span>
                <Input
                  className="h-7 text-xs w-24 text-center font-mono"
                  type="number"
                  value={pt}
                  onChange={e => {
                    const pts = [...(guildEntry.pointThresholds || [0, 0, 0])];
                    pts[i] = parseInt(e.target.value) || 0;
                    update({ pointThresholds: pts });
                  }}
                />
              </div>
            ))}
            {/* Allow adding extra threshold slots */}
            {(guildEntry.pointThresholds?.length || 0) < 3 && (
              <button
                className="self-end mb-0.5 text-[10px] text-primary hover:underline"
                onClick={() => update({ pointThresholds: [...(guildEntry.pointThresholds || []), 0] })}
              >
                + Add level
              </button>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            The guild is offered to the player once a settlement accumulates enough standing points.
            Rejecting it blocks the offer for 11 turns (hard-coded).
          </p>
        </div>

        {/* Settlement min level */}
        {guildEntry.settlementMinLevel && (
          <div>
            <Label className="text-[10px] text-muted-foreground">Settlement Min Level</Label>
            <Input
              className="h-7 text-xs mt-0.5 font-mono w-40"
              value={guildEntry.settlementMinLevel}
              onChange={e => update({ settlementMinLevel: e.target.value })}
            />
          </div>
        )}

        {/* Faction support */}
        {guildEntry.factionSupport?.length > 0 && (
          <div>
            <Label className="text-[10px] text-muted-foreground">Faction Support Modifiers</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {guildEntry.factionSupport.map((fs, i) => (
                <div key={i} className="flex items-center gap-1.5 bg-accent/30 rounded px-2 py-1">
                  <span className="text-[10px] font-mono text-foreground">{fs.faction}</span>
                  <Input
                    className="h-6 text-[10px] w-14 font-mono"
                    type="number"
                    value={fs.value}
                    onChange={e => {
                      const arr = [...guildEntry.factionSupport];
                      arr[i] = { ...fs, value: parseInt(e.target.value) || 0 };
                      update({ factionSupport: arr });
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Triggers */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Zap className="w-3 h-3" />
              Triggers ({(guildEntry.triggers || []).length})
            </Label>
            <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" onClick={addTrigger}>
              <Plus className="w-3 h-3 mr-1" /> Add Trigger
            </Button>
          </div>

          <div className="space-y-2">
            {(guildEntry.triggers || []).map((trigger, ti) => (
              <TriggerBlock
                key={ti}
                trigger={trigger}
                onUpdate={updated => {
                  const triggers = [...guildEntry.triggers];
                  triggers[ti] = updated;
                  update({ triggers });
                }}
                onDelete={() => {
                  update({ triggers: guildEntry.triggers.filter((_, j) => j !== ti) });
                }}
              />
            ))}
            {(guildEntry.triggers || []).length === 0 && (
              <p className="text-[10px] text-muted-foreground italic">
                No triggers — add a trigger to define when guild standing points accumulate.
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}