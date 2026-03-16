import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Swords, Shield, UserRound, Building2, Sword, Info } from 'lucide-react';
import { useRefData } from './RefDataContext';
import RequirementBuilder from './RequirementBuilder';
import SearchableSelect from './SearchableSelect.jsx';
import { CAPABILITY_LIBRARY } from './CapabilityLibrary';

// ─── Constants ───────────────────────────────────────────────────────────────

const AGENT_TYPES = ['merchant', 'spy', 'assassin', 'diplomat', 'princess', 'priest', 'imam', 'heretic', 'witch', 'inquisitor'];

// Derive sets for classification from the library
const CIVILIAN_CODES = new Set(
  CAPABILITY_LIBRARY.filter((c) => c.type === 'Civilian Bonus').map((c) => c.code)
);
const MILITARY_CODES = new Set(
  CAPABILITY_LIBRARY.filter((c) => c.type === 'Military Bonus').map((c) => c.code)
);

// Build searchable options for civilian and military
const CIVILIAN_OPTIONS = CAPABILITY_LIBRARY.
filter((c) => c.type === 'Civilian Bonus').
map((c) => ({ value: c.code, label: c.subtype, meta: c }));

const MILITARY_OPTIONS = CAPABILITY_LIBRARY.
filter((c) => c.type === 'Military Bonus').
map((c) => ({ value: c.code, label: c.subtype, meta: c }));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function classifyCapability(cap) {
  if (cap.type === 'recruit_pool') return 'recruit_pool';
  if (cap.type === 'agent' || cap.type === 'agent_limit') return 'agent';
  const id = cap.identifier || '';
  if (CIVILIAN_CODES.has(id)) return 'civilian';
  if (MILITARY_CODES.has(id)) return 'military';
  return 'military';
}

function getLibraryEntry(code) {
  return CAPABILITY_LIBRARY.find((c) => c.code === code) || null;
}

// Does this code need a trailing " bonus" keyword in the serialized output?
function needsBonusSuffix(code) {
  const entry = getLibraryEntry(code);
  return entry && entry.args === 'bonus';
}

// ─── Row Components ───────────────────────────────────────────────────────────

function RecruitPoolRow({ cap, index, onChange, onRemove, edbData }) {
  const [showReqs, setShowReqs] = useState(false);
  const { units } = useRefData();
  const unitOptions = units.map((u) => ({ value: u.type, label: u.type }));

  return (
    <div className="bg-accent/50 rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Swords className="w-3.5 h-3.5 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          {units.length > 0 ?
          <SearchableSelect
            value={cap.unitName || ''}
            onValueChange={(v) => onChange(index, { ...cap, unitName: v })}
            options={unitOptions}
            placeholder="Select unit..."
            className="w-full" /> :


          <Input
            className="h-7 text-xs"
            placeholder="Unit type name (load export_descr_unit.txt)"
            value={cap.unitName || ''}
            onChange={(e) => onChange(index, { ...cap, unitName: e.target.value })} />

          }
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <div className="flex flex-col items-center">
            <span className="text-[9px] text-muted-foreground/70 mb-0.5">Init</span>
            <Input className="h-7 text-xs w-14" type="number" step="0.1"
            value={cap.initialPool ?? ''}
            onChange={(e) => onChange(index, { ...cap, initialPool: parseFloat(e.target.value) || 0 })} />

          </div>
          <div className="flex flex-col items-center">
            <span className="text-[9px] text-muted-foreground/70 mb-0.5">+/turn</span>
            <Input className="h-7 text-xs w-16" type="number" step="0.001"
            value={cap.replenishRate ?? ''}
            onChange={(e) => onChange(index, { ...cap, replenishRate: parseFloat(e.target.value) || 0 })} />

          </div>
          <div className="flex flex-col items-center">
            <span className="text-[9px] text-muted-foreground/70 mb-0.5">Max</span>
            <Input className="h-7 text-xs w-14" type="number" step="0.1"
            value={cap.maxPool ?? ''}
            onChange={(e) => onChange(index, { ...cap, maxPool: parseFloat(e.target.value) || 0 })} />

          </div>
          <div className="flex flex-col items-center">
            <span className="text-[9px] text-muted-foreground/70 mb-0.5">XP</span>
            <Input className="h-7 text-xs w-10" type="number" min="0" max="9"
            value={cap.experience ?? ''}
            onChange={(e) => onChange(index, { ...cap, experience: Math.min(9, Math.max(0, parseInt(e.target.value) || 0)) })} />

          </div>
        </div>
        <Button variant="ghost" size="sm" className="bg-slate-500 px-2 text-xs font-medium rounded-md inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 hover:bg-accent hover:text-accent-foreground h-7 shrink-0" onClick={() => setShowReqs(!showReqs)}>
          <Shield className="w-3 h-3 mr-1" />
          Req ({cap.requirements?.length || 0})
        </Button>
        <button onClick={() => onRemove(index)} className="p-1 hover:bg-destructive/20 rounded shrink-0">
          <Trash2 className="w-3 h-3 text-destructive" />
        </button>
      </div>
      {showReqs &&
      <div className="ml-6">
          <RequirementBuilder
          requirements={cap.requirements || []}
          onChange={(reqs) => onChange(index, { ...cap, requirements: reqs })}
          edbData={edbData} />

        </div>
      }
    </div>);

}

function AgentRow({ cap, index, onChange, onRemove }) {
  const type = cap.type || 'agent';
  return (
    <div className="bg-accent/30 rounded-lg px-3 py-2 flex items-center gap-2">
      <UserRound className="w-3.5 h-3.5 text-blue-400 shrink-0" />
      <Select value={type} onValueChange={(val) => onChange(index, { ...cap, type: val })}>
        <SelectTrigger className="h-7 text-xs w-28">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="agent" className="text-xs">agent</SelectItem>
          <SelectItem value="agent_limit" className="text-xs">agent_limit</SelectItem>
        </SelectContent>
      </Select>
      <Select value={cap.agentType || ''} onValueChange={(val) => onChange(index, { ...cap, agentType: val })}>
        <SelectTrigger className="h-7 text-xs w-32">
          <SelectValue placeholder="agent type…" />
        </SelectTrigger>
        <SelectContent>
          {AGENT_TYPES.map((a) =>
          <SelectItem key={a} value={a} className="text-xs">{a}</SelectItem>
          )}
        </SelectContent>
      </Select>
      <Input className="h-7 text-xs w-16" type="number"
      value={cap.value ?? 1}
      onChange={(e) => onChange(index, { ...cap, value: parseInt(e.target.value) || 1 })} />

      <button onClick={() => onRemove(index)} className="ml-auto p-1 hover:bg-destructive/20 rounded shrink-0">
        <Trash2 className="w-3 h-3 text-destructive" />
      </button>
    </div>);

}

function BonusRow({ cap, index, onChange, onRemove, edbData, options, accentClass }) {
  const [showReqs, setShowReqs] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const entry = getLibraryEntry(cap.identifier || '');
  const rangeHint = entry ? `Range: ${entry.range}` : '';

  return (
    <div className={`rounded-lg px-3 py-2 space-y-1.5 ${accentClass}`}>
      <div className="flex items-center gap-2">
        {/* Capability picker */}
        <div className="flex-1 min-w-0">
          <SearchableSelect
            value={cap.identifier || ''}
            onValueChange={(val) => {
              const e = getLibraryEntry(val);
              onChange(index, { ...cap, identifier: val, needsBonus: e?.args === 'bonus' });
            }}
            options={options}
            placeholder="Select capability…" />

          {rangeHint &&
          <span className="text-[9px] text-muted-foreground/60 mt-0.5 block">{rangeHint}</span>
          }
        </div>

        {/* Value */}
        <Input className="h-7 text-xs w-20" type="number"
        value={cap.value ?? ''}
        onChange={(e) => onChange(index, { ...cap, value: parseFloat(e.target.value) || 0 })} />


        {/* Info */}
        {entry &&
        <button
          onClick={() => setShowInfo((v) => !v)}
          className="p-1 hover:bg-accent rounded shrink-0 text-muted-foreground hover:text-foreground"
          title={entry.description}>

            <Info className="w-3 h-3" />
          </button>
        }

        {/* Requirements toggle */}
        <button onClick={() => setShowReqs(!showReqs)} className="p-1 hover:bg-accent rounded shrink-0">
          <Shield className="w-3 h-3 text-muted-foreground" />
        </button>

        <button onClick={() => onRemove(index)} className="p-1 hover:bg-destructive/20 rounded">
          <Trash2 className="w-3 h-3 text-destructive" />
        </button>
      </div>

      {showInfo && entry &&
      <div className="text-[9px] text-muted-foreground bg-accent/20 rounded px-2 py-1 leading-relaxed">
          {entry.description}
        </div>
      }

      {showReqs &&
      <div className="ml-2 pt-1 border-t border-border/50">
          <RequirementBuilder
          requirements={cap.requirements || []}
          onChange={(reqs) => onChange(index, { ...cap, requirements: reqs })}
          edbData={edbData} />

        </div>
      }
    </div>);

}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CapabilityEditor({ capabilities, onChange, edbData }) {
  const handleChange = (index, updated) => {
    const newCaps = [...capabilities];
    newCaps[index] = updated;
    onChange(newCaps);
  };

  const handleRemove = (index) => {
    onChange(capabilities.filter((_, i) => i !== index));
  };

  const recruitPools = capabilities.filter((c) => classifyCapability(c) === 'recruit_pool');
  const agentCaps = capabilities.filter((c) => classifyCapability(c) === 'agent');
  const civilianCaps = capabilities.filter((c) => classifyCapability(c) === 'civilian');
  const militaryCaps = capabilities.filter((c) => classifyCapability(c) === 'military');

  const addRecruitPool = () => onChange([...capabilities, {
    type: 'recruit_pool', unitName: '', initialPool: 1, replenishRate: 0.5, maxPool: 4, experience: 0, requirements: []
  }]);
  const addAgent = () => onChange([...capabilities, { type: 'agent', agentType: 'merchant', value: 1 }]);
  const addCivilian = () => onChange([...capabilities, {
    type: 'bonus', identifier: 'happiness_bonus', needsBonus: true, value: 1, requirements: []
  }]);
  const addMilitary = () => onChange([...capabilities, {
    type: 'bonus', identifier: 'wall_level', needsBonus: false, value: 1, requirements: []
  }]);

  return (
    <div className="space-y-5">

      {/* Agent Recruitment */}
      {agentCaps.length > 0 &&
      <section className="space-y-1">
          <h4 className="text-[10px] font-semibold text-blue-400 uppercase tracking-wider flex items-center gap-1">
            <UserRound className="w-3 h-3" /> Agent Recruitment ({agentCaps.length})
          </h4>
          {agentCaps.map((cap) => {
          const realIndex = capabilities.indexOf(cap);
          return <AgentRow key={realIndex} cap={cap} index={realIndex} onChange={handleChange} onRemove={handleRemove} />;
        })}
        </section>
      }

      {/* Civilian Bonuses */}
      {civilianCaps.length > 0 &&
      <section className="space-y-1">
          <h4 className="text-[10px] font-semibold text-yellow-400 uppercase tracking-wider flex items-center gap-1">
            <Building2 className="w-3 h-3" /> Civilian Bonuses ({civilianCaps.length})
          </h4>
          {civilianCaps.map((cap) => {
          const realIndex = capabilities.indexOf(cap);
          return (
            <BonusRow
              key={realIndex}
              cap={cap}
              index={realIndex}
              onChange={handleChange}
              onRemove={handleRemove}
              edbData={edbData}
              options={CIVILIAN_OPTIONS}
              accentClass="bg-yellow-500/5 border border-yellow-500/20" />);


        })}
        </section>
      }

      {/* Military Bonuses */}
      {militaryCaps.length > 0 &&
      <section className="space-y-1">
          <h4 className="text-[10px] font-semibold text-red-400 uppercase tracking-wider flex items-center gap-1">
            <Sword className="w-3 h-3" /> Military Bonuses ({militaryCaps.length})
          </h4>
          {militaryCaps.map((cap) => {
          const realIndex = capabilities.indexOf(cap);
          return (
            <BonusRow
              key={realIndex}
              cap={cap}
              index={realIndex}
              onChange={handleChange}
              onRemove={handleRemove}
              edbData={edbData}
              options={MILITARY_OPTIONS}
              accentClass="bg-red-500/5 border border-red-500/20" />);


        })}
        </section>
      }

      {/* Recruit Pools */}
      {recruitPools.length > 0 &&
      <section className="space-y-2">
          <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <Swords className="w-3 h-3" /> Recruit Pools ({recruitPools.length})
          </h4>
          {recruitPools.map((cap) => {
          const realIndex = capabilities.indexOf(cap);
          return <RecruitPoolRow key={realIndex} cap={cap} index={realIndex} onChange={handleChange} onRemove={handleRemove} edbData={edbData} />;
        })}
        </section>
      }

      {/* Add buttons */}
      <div className="flex flex-wrap gap-2 pt-1">
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={addRecruitPool}>
          <Plus className="w-3 h-3 mr-1" /> Recruit Pool
        </Button>
        <Button variant="outline" size="sm" className="h-7 text-xs text-blue-400 border-blue-500/40 hover:bg-blue-500/10" onClick={addAgent}>
          <Plus className="w-3 h-3 mr-1" /> Agent Recruitment
        </Button>
        <Button variant="outline" size="sm" className="h-7 text-xs text-yellow-400 border-yellow-500/40 hover:bg-yellow-500/10" onClick={addCivilian}>
          <Plus className="w-3 h-3 mr-1" /> Civilian Bonus
        </Button>
        <Button variant="outline" size="sm" className="h-7 text-xs text-red-400 border-red-500/40 hover:bg-red-500/10" onClick={addMilitary}>
          <Plus className="w-3 h-3 mr-1" /> Military Bonus
        </Button>
      </div>
    </div>);

}