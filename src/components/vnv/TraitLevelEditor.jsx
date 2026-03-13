import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { CHARACTER_STATS } from './VnVParser';

function EffectRow({ effect, onChange, onDelete }) {
  return (
    <div className="flex items-center gap-1.5 group">
      <input
        list="stat-list"
        className="flex-1 h-7 px-2 text-xs bg-background border border-border rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono"
        value={effect.stat}
        onChange={e => onChange({ ...effect, stat: e.target.value })}
        placeholder="Stat name"
      />
      <datalist id="stat-list">
        {CHARACTER_STATS.map(s => <option key={s} value={s} />)}
      </datalist>
      <Input
        className="w-20 h-7 text-xs text-center font-mono"
        type="number"
        value={effect.value}
        onChange={e => onChange({ ...effect, value: parseInt(e.target.value) || 0 })}
      />
      <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
        onClick={onDelete}>
        <Trash2 className="w-3 h-3" />
      </Button>
    </div>
  );
}

export default function TraitLevelEditor({ level, onChange, onDelete, onMoveUp, onMoveDown, isFirst, isLast }) {
  const update = (field, value) => onChange({ ...level, [field]: value });

  const updateEffect = (idx, eff) => {
    const effects = [...level.effects];
    effects[idx] = eff;
    update('effects', effects);
  };

  const deleteEffect = (idx) => {
    update('effects', level.effects.filter((_, i) => i !== idx));
  };

  const addEffect = () => {
    update('effects', [...level.effects, { stat: 'Command', value: 1 }]);
  };

  return (
    <div className="border border-border rounded-lg bg-card/60 p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-[10px] font-mono">Threshold {level.threshold}</Badge>
        <Input
          className="flex-1 h-7 text-xs font-semibold font-mono"
          value={level.name}
          onChange={e => update('name', e.target.value)}
          placeholder="Level name"
        />
        <div className="flex gap-0.5">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onMoveUp} disabled={isFirst}><ChevronUp className="w-3 h-3" /></Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onMoveDown} disabled={isLast}><ChevronDown className="w-3 h-3" /></Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={onDelete}><Trash2 className="w-3 h-3" /></Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-[10px] text-muted-foreground">Threshold</Label>
          <Input className="h-7 text-xs mt-0.5 font-mono" type="number" min="0"
            value={level.threshold} onChange={e => update('threshold', parseInt(e.target.value) || 0)} />
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">Epithet (optional)</Label>
          <Input className="h-7 text-xs mt-0.5 font-mono" value={level.epithet || ''}
            onChange={e => update('epithet', e.target.value)} placeholder="level_epithet_key" />
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">Description key</Label>
          <Input className="h-7 text-xs mt-0.5 font-mono" value={level.description || ''}
            onChange={e => update('description', e.target.value)} placeholder="Level_desc" />
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">Effects desc key</Label>
          <Input className="h-7 text-xs mt-0.5 font-mono" value={level.effectsDescription || ''}
            onChange={e => update('effectsDescription', e.target.value)} placeholder="Level_effects_desc" />
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">Gain message key</Label>
          <Input className="h-7 text-xs mt-0.5 font-mono" value={level.gainMessage || ''}
            onChange={e => update('gainMessage', e.target.value)} placeholder="optional" />
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">Lose message key</Label>
          <Input className="h-7 text-xs mt-0.5 font-mono" value={level.loseMessage || ''}
            onChange={e => update('loseMessage', e.target.value)} placeholder="optional" />
        </div>
      </div>

      {/* Effects */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <Label className="text-[10px] text-muted-foreground">Effects</Label>
          <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 text-primary" onClick={addEffect}>
            <Plus className="w-3 h-3" /> Add Effect
          </Button>
        </div>
        <div className="flex items-center gap-1 mb-1">
          <span className="flex-1 text-[9px] text-muted-foreground/60 pl-1">Stat</span>
          <span className="w-20 text-[9px] text-muted-foreground/60 text-center">Value</span>
          <span className="w-6" />
        </div>
        <div className="space-y-1">
          {level.effects.map((eff, idx) => (
            <EffectRow key={idx} effect={eff}
              onChange={e => updateEffect(idx, e)}
              onDelete={() => deleteEffect(idx)} />
          ))}
          {level.effects.length === 0 && (
            <p className="text-[10px] text-muted-foreground/50 italic text-center py-2">No effects — click Add Effect</p>
          )}
        </div>
      </div>
    </div>
  );
}