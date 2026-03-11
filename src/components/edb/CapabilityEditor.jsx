import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Swords, Shield } from 'lucide-react';
import { BUILDING_TRAITS } from './EDBParser';
import { useRefData } from './RefDataContext';
import RequirementBuilder from './RequirementBuilder';
import SearchableSelect from './SearchableSelect.jsx';

function RecruitPoolRow({ cap, index, onChange, onRemove, edbData }) {
  const [showReqs, setShowReqs] = useState(false);
  const { units } = useRefData();
  const unitOptions = units.map(u => ({ value: u.type, label: u.type }));

  return (
    <div className="bg-accent/50 rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Swords className="w-3.5 h-3.5 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          {units.length > 0 ? (
            <SearchableSelect
              value={cap.unitName || ''}
              onValueChange={v => onChange(index, { ...cap, unitName: v })}
              options={unitOptions}
              placeholder="Select unit..."
              className="w-full"
            />
          ) : (
            <Input
              className="h-7 text-xs"
              placeholder="Unit type name (load export_descr_unit.txt)"
              value={cap.unitName || ''}
              onChange={e => onChange(index, { ...cap, unitName: e.target.value })}
            />
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <div className="flex flex-col items-center">
            <span className="text-[9px] text-muted-foreground/70 mb-0.5">Init</span>
            <Input className="h-7 text-xs w-14" type="number" step="0.1"
              value={cap.initialPool ?? ''}
              onChange={e => onChange(index, { ...cap, initialPool: parseFloat(e.target.value) || 0 })}
            />
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[9px] text-muted-foreground/70 mb-0.5">+/turn</span>
            <Input className="h-7 text-xs w-16" type="number" step="0.001"
              value={cap.replenishRate ?? ''}
              onChange={e => onChange(index, { ...cap, replenishRate: parseFloat(e.target.value) || 0 })}
            />
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[9px] text-muted-foreground/70 mb-0.5">Max</span>
            <Input className="h-7 text-xs w-14" type="number" step="0.1"
              value={cap.maxPool ?? ''}
              onChange={e => onChange(index, { ...cap, maxPool: parseFloat(e.target.value) || 0 })}
            />
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[9px] text-muted-foreground/70 mb-0.5">XP</span>
            <Input className="h-7 text-xs w-10" type="number" min="0" max="9"
              value={cap.experience ?? ''}
              onChange={e => onChange(index, { ...cap, experience: Math.min(9, Math.max(0, parseInt(e.target.value) || 0)) })}
            />
          </div>
        </div>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs shrink-0" onClick={() => setShowReqs(!showReqs)}>
          <Shield className="w-3 h-3 mr-1" />
          Req ({cap.requirements?.length || 0})
        </Button>
        <button onClick={() => onRemove(index)} className="p-1 hover:bg-destructive/20 rounded shrink-0">
          <Trash2 className="w-3 h-3 text-destructive" />
        </button>
      </div>
      {showReqs && (
        <div className="ml-6">
          <RequirementBuilder
            requirements={cap.requirements || []}
            onChange={reqs => onChange(index, { ...cap, requirements: reqs })}
            edbData={edbData}
          />
        </div>
      )}
    </div>
  );
}

function BonusRow({ cap, index, onChange, onRemove, edbData }) {
  const [showReqs, setShowReqs] = useState(false);

  return (
    <div className="bg-accent/30 rounded-lg px-3 py-2 space-y-2">
      <div className="flex items-center gap-2">
        <Select value={cap.identifier || ''} onValueChange={val => onChange(index, { ...cap, identifier: val })}>
          <SelectTrigger className="h-7 text-xs flex-1">
            <SelectValue placeholder="Select trait..." />
          </SelectTrigger>
          <SelectContent>
            {BUILDING_TRAITS.filter(t => t !== 'recruit_pool').map(trait => (
              <SelectItem key={trait} value={trait} className="text-xs">{trait}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {cap.type === 'bonus' && (
          <Badge variant="outline" className="text-[10px] shrink-0">bonus</Badge>
        )}
        <Input className="h-7 text-xs w-20" type="number"
          value={cap.value ?? ''}
          onChange={e => onChange(index, { ...cap, value: parseFloat(e.target.value) || 0 })}
        />
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs shrink-0" onClick={() => setShowReqs(!showReqs)}>
          <Shield className="w-3 h-3 mr-1" />
          Req ({cap.requirements?.length || 0})
        </Button>
        <button onClick={() => onRemove(index)} className="p-1 hover:bg-destructive/20 rounded">
          <Trash2 className="w-3 h-3 text-destructive" />
        </button>
      </div>
      {showReqs && (
        <div className="ml-2">
          <RequirementBuilder
            requirements={cap.requirements || []}
            onChange={reqs => onChange(index, { ...cap, requirements: reqs })}
            edbData={edbData}
          />
        </div>
      )}
    </div>
  );
}

export default function CapabilityEditor({ capabilities, onChange, edbData }) {
  const handleChange = (index, updated) => {
    const newCaps = [...capabilities];
    newCaps[index] = updated;
    onChange(newCaps);
  };

  const handleRemove = (index) => {
    onChange(capabilities.filter((_, i) => i !== index));
  };

  const addRecruitPool = () => onChange([...capabilities, {
    type: 'recruit_pool', unitName: '', initialPool: 1, replenishRate: 0.5, maxPool: 4, experience: 0, requirements: []
  }]);
  const addBonus = () => onChange([...capabilities, { type: 'bonus', identifier: 'happiness_bonus', value: 1, requirements: [] }]);
  const addSimple = () => onChange([...capabilities, { type: 'simple', identifier: 'wall_level', value: 1, requirements: [] }]);

  const recruitPools = capabilities.filter(c => c.type === 'recruit_pool');
  const others = capabilities.filter(c => c.type !== 'recruit_pool');

  return (
    <div className="space-y-4">
      {others.length > 0 && (
        <div className="space-y-1">
          <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Building Traits</h4>
          {others.map((cap, i) => {
            const realIndex = capabilities.indexOf(cap);
            return <BonusRow key={i} cap={cap} index={realIndex} onChange={handleChange} onRemove={handleRemove} edbData={edbData} />;
          })}
        </div>
      )}
      {recruitPools.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Recruit Pools ({recruitPools.length})</h4>
          {recruitPools.map((cap, i) => {
            const realIndex = capabilities.indexOf(cap);
            return <RecruitPoolRow key={i} cap={cap} index={realIndex} onChange={handleChange} onRemove={handleRemove} edbData={edbData} />;
          })}
        </div>
      )}
      <div className="flex gap-2 pt-1">
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={addRecruitPool}>
          <Plus className="w-3 h-3 mr-1" /> Recruit Pool
        </Button>
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={addBonus}>
          <Plus className="w-3 h-3 mr-1" /> Bonus Trait
        </Button>
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={addSimple}>
          <Plus className="w-3 h-3 mr-1" /> Simple Trait
        </Button>
      </div>
    </div>
  );
}