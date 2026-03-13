import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Swords, Shield, UserRound, Building2, Sword, Info } from 'lucide-react';
import { useRefData } from './RefDataContext';
import RequirementBuilder from './RequirementBuilder';
import SearchableSelect from './SearchableSelect.jsx';

// ─── Agent types ────────────────────────────────────────────────────────────
const AGENT_TYPES = ['merchant','spy','assassin','diplomat','princess','priest','imam','heretic','witch','inquisitor'];

// ─── Capability definitions from buildingcapabilities.xlsx ──────────────────
// Each entry: { subtype, code, range, description }
// "code" is the EXACT string to emit (including trailing " bonus" where needed)

export const CIVILIAN_SUBTYPES = {
  'Construction bonus': [
    { subtype: 'Cost – defensive buildings',   code: 'construction_cost_bonus_defensive bonus', range: '1-100', description: "Changes cost of core buildings by ∓1% per increment" },
    { subtype: 'Cost – military buildings',    code: 'construction_cost_bonus_military bonus',  range: '1-100', description: 'No effects' },
    { subtype: 'Cost – other buildings',       code: 'construction_cost_bonus_other bonus',     range: '1-100', description: "Changes cost of buildings other than core and 'temple_' by ∓1% per increment" },
    { subtype: 'Cost – religious buildings',   code: 'construction_cost_bonus_religious bonus', range: '1-100', description: "Changes cost of buildings with 'temple_' prefix by ∓1% per increment" },
    { subtype: 'Cost – stone buildings',       code: 'construction_cost_bonus_stone bonus',     range: '1-100', description: 'Changes cost of stone buildings by ∓1% per increment' },
    { subtype: 'Cost – wooden buildings',      code: 'construction_cost_bonus_wooden bonus',    range: '1-100', description: 'Changes cost of wooden buildings by ∓1% per increment' },
    { subtype: 'Time – defensive buildings',   code: 'construction_time_bonus_defensive bonus', range: '1-100', description: 'Changes construction time of core buildings by ∓1% per increment' },
    { subtype: 'Time – military buildings',    code: 'construction_time_bonus_military bonus',  range: '1-100', description: 'No effects' },
    { subtype: 'Time – other buildings',       code: 'construction_time_bonus_other bonus',     range: '1-100', description: "Changes construction time of buildings other than core and 'temple_' by ∓1% per increment" },
    { subtype: 'Time – religious buildings',   code: 'construction_time_bonus_religious bonus', range: '1-100', description: "Changes construction time of 'temple_' buildings by ∓1% per increment" },
    { subtype: 'Time – stone buildings',       code: 'construction_time_bonus_stone bonus',     range: '1-100', description: 'Changes construction time of stone buildings by ∓1% per increment' },
    { subtype: 'Time – wooden buildings',      code: 'construction_time_bonus_wooden bonus',    range: '1-100', description: 'Changes construction time of wooden buildings by ∓1% per increment' },
  ],
  'Economic bonus': [
    { subtype: 'Income bonus',          code: 'income_bonus bonus',            range: '[int]', description: 'Adds specified amount of income to the settlement, added to "Corruption and Other" income' },
    { subtype: 'Taxable income bonus',  code: 'taxable_income_bonus bonus',    range: '[int]', description: '10× the specified value; adds 10–327670 to taxable income. Supposedly does not work in M2. Shows text.' },
    { subtype: 'Trade base income',     code: 'trade_base_income_bonus bonus', range: '[int]', description: '10× the specified value; adds 10–327670% to trade income from both land and sea' },
    { subtype: 'Trade fleet',           code: 'trade_fleet',                   range: '[int]', description: 'Does nothing — trade fleet count is hard coded to port building level' },
    { subtype: 'Trade level bonus',     code: 'trade_level_bonus bonus',       range: '[int]', description: '100× the specified value; adds 100–3276700% to base land trade income' },
  ],
  'Infrastructure bonus': [
    { subtype: 'Farming level',  code: 'farming_level',  range: '1-3',   description: '33%, 66%, and 100% of arable land becomes farmland on strat map; increases farming income' },
    { subtype: 'Mine resource',  code: 'mine_resource',  range: '[int]', description: 'Converts has_mine resource models to mines; initiates mining income (1-32767)' },
    { subtype: 'Road level',     code: 'road_level',     range: '0-3',   description: '0 = dirt paths; 1 = paved roads & +100% trade; 2 = highways & +200%; 3 = highways & +300%' },
  ],
  'Population bonus': [
    { subtype: 'Fire risk',           code: 'fire_risk',               range: '[int]', description: 'Does nothing — fire disaster disabled in early RTW versions' },
    { subtype: 'Happiness bonus',     code: 'happiness_bonus bonus',   range: '[int]', description: 'Each increment is a 5% public order bonus due to happiness (5–125%)' },
    { subtype: 'Law bonus',           code: 'law_bonus bonus',         range: '[int]', description: 'Each increment is a 5% public order bonus due to law (5–125%)' },
    { subtype: 'Population growth',   code: 'population_growth_bonus bonus', range: '[int]', description: 'Increases pop growth % by half of the specified value (0.5–12.5%)' },
    { subtype: 'Population health',   code: 'population_health_bonus bonus', range: '[int]', description: 'Increases pop growth % by half value; increases public order by 5×value. Check descr_settlement_mechanics' },
    { subtype: 'Population loyalty',  code: 'population_loyalty_bonus bonus', range: '[int]', description: 'Does nothing — cut in early RTW. Shows text.' },
    { subtype: 'Stage games',         code: 'stage_games',             range: '1-3',   description: 'Increases public order' },
    { subtype: 'Stage races',         code: 'stage_races',             range: '1-2',   description: 'Increases public order' },
  ],
  'Religious bonus': [
    { subtype: 'Amplify religion level', code: 'amplify_religion_level', range: '[int]', description: 'Increases religion conversion by 33.3 for each increment (not religion-specific)' },
    { subtype: 'Pope approval',          code: 'pope_approval',          range: '[int]', description: 'Sends a message when building is complete: "pope approves"' },
    { subtype: 'Pope disapproval',       code: 'pope_disapproval',       range: '[int]', description: 'Apparently no effect' },
    { subtype: 'Religion level',         code: 'religion_level bonus',   range: '[int]', description: 'Increases religion conversion % by 0.5× the specified value' },
  ],
};

export const MILITARY_SUBTYPES = {
  'Defence bonus': [
    { subtype: 'Gate defences', code: 'gate_defences', range: '0-1', description: '0 = none; 1 = boiling oil' },
    { subtype: 'Gate strength', code: 'gate_strength', range: '0-2', description: '0 = wooden; 1 = reinforced; 2 = iron (apparently does nothing — hard coded to settlement level)' },
    { subtype: 'Gun bonus',     code: 'gun_bonus',     range: '0-9', description: 'Experience level of all gunpowder units trained in the settlement' },
    { subtype: 'Tower level',   code: 'tower_level',   range: '1-3', description: '1 = arrow; 2 = ballista; 3 = cannon' },
    { subtype: 'Wall level',    code: 'wall_level',    range: '0-4', description: '0 = palisade; 1 = wooden; 2 = stone; 3 = large stone; 4 = epic stone (apparently does nothing — hard coded to settlement level)' },
  ],
  'Recruitment bonus': [
    { subtype: 'Free upkeep slots',      code: 'free_upkeep bonus',                range: '[int]', description: 'Number of additional free upkeep slots for units with free_upkeep_unit attribute' },
    { subtype: 'Naval recruitment cost', code: 'recruitment_cost_bonus_naval bonus', range: '1-2', description: "Reduces cost of naval units by 10% per increment (20% max)" },
    { subtype: 'Recruitment slots',      code: 'recruitment_slots',                range: '[int]', description: 'Adds specified number of recruitment slots to the settlement' },
    { subtype: 'Recruits exp bonus',     code: 'recruits_exp_bonus bonus',         range: '1-5',   description: 'Experience level of units trained (0-15; values 10-15 count as 9; negative → 9)' },
    { subtype: 'Recruits morale bonus',  code: 'recruits_morale_bonus bonus',      range: '[int]', description: 'Increases recruited unit morale by 20% × number specified' },
    { subtype: 'Retrain cost bonus',     code: 'retrain_cost_bonus bonus',         range: '0-1',   description: 'Reduces cost to retrain units by 20%; capped at 1' },
  ],
  'Unit bonus': [
    { subtype: 'Navy bonus',           code: 'navy_bonus',           range: '0-9', description: "Experience level of all gunpowder ship units trained in the settlement's port" },
    { subtype: 'Archer bonus',         code: 'archer_bonus',         range: '0-9', description: 'Experience level of archer units trained in the settlement' },
    { subtype: 'Armour',               code: 'armour',               range: '1-6', description: "Increases armour upgrade level; adds +2 to unit's true armour stat" },
    { subtype: 'Cavalry bonus',        code: 'cavalry_bonus',        range: '0-9', description: 'Experience level of cavalry units trained in the settlement' },
    { subtype: 'Heavy cavalry bonus',  code: 'heavy_cavalry_bonus bonus', range: '0-9', description: "Experience level of units with 'knight' attribute trained in the settlement" },
    { subtype: 'Upgrade bodyguard',    code: 'upgrade_bodyguard',    range: '[int]', description: "Enables upgrading of General's Bodyguards after the Marian Reforms event" },
  ],
  'Weapon bonus': [
    { subtype: 'Artillery gunpowder',  code: 'weapon_artillery_gunpowder',  range: '0-9', description: 'Weapon level of all gunpowder artillery units' },
    { subtype: 'Artillery mechanical', code: 'weapon_artillery_mechanical', range: '0-9', description: 'Melee weapon level of all artillery crews' },
    { subtype: 'Melee blade',          code: 'weapon_melee_blade',          range: '0-9', description: "Weapon level of all melee units that don't use 'blunt' weapons" },
    { subtype: 'Melee simple/blunt',   code: 'weapon_melee_simple',         range: '0-9', description: "Weapon level of all melee units that use 'blunt' weapons" },
    { subtype: 'Missile gunpowder',    code: 'weapon_missile_gunpowder',    range: '0-9', description: 'Weapon level of all gunpowder units' },
    { subtype: 'Missile mechanical',   code: 'weapon_missile_mechanical',   range: '0-9', description: 'Melee weapon level of all missile units' },
    { subtype: 'Naval gunpowder',      code: 'weapon_naval_gunpowder',      range: '0-9', description: 'Weapon level of all gunpowder ships' },
    { subtype: 'Projectile (all gun)', code: 'weapon_projectile',           range: '0-9', description: 'Weapon level of all gunpowder units including artillery' },
  ],
};

// Flat list of all codes for classification during parse
export const ALL_CIVILIAN_CODES = Object.values(CIVILIAN_SUBTYPES).flat().map(e => e.code);
export const ALL_MILITARY_CODES = Object.values(MILITARY_SUBTYPES).flat().map(e => e.code);

// Helper: given a raw serialized code string, find its definition
function findCapDef(codeStr) {
  for (const group of Object.values(CIVILIAN_SUBTYPES)) {
    const found = group.find(e => e.code === codeStr);
    if (found) return { category: 'civilian', def: found };
  }
  for (const group of Object.values(MILITARY_SUBTYPES)) {
    const found = group.find(e => e.code === codeStr);
    if (found) return { category: 'military', def: found };
  }
  return null;
}

// ─── Row Components ────────────────────────────────────────────────────────

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

function AgentRow({ cap, index, onChange, onRemove }) {
  const type = cap.type || 'agent';
  return (
    <div className="bg-accent/30 rounded-lg px-3 py-2 flex items-center gap-2">
      <UserRound className="w-3.5 h-3.5 text-blue-400 shrink-0" />
      <Select value={type} onValueChange={val => onChange(index, { ...cap, type: val })}>
        <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="agent" className="text-xs">agent</SelectItem>
          <SelectItem value="agent_limit" className="text-xs">agent_limit</SelectItem>
        </SelectContent>
      </Select>
      <Select value={cap.agentType || ''} onValueChange={val => onChange(index, { ...cap, agentType: val })}>
        <SelectTrigger className="h-7 text-xs w-32"><SelectValue placeholder="agent type…" /></SelectTrigger>
        <SelectContent>
          {AGENT_TYPES.map(a => <SelectItem key={a} value={a} className="text-xs">{a}</SelectItem>)}
        </SelectContent>
      </Select>
      <Input className="h-7 text-xs w-16" type="number"
        value={cap.value ?? 1}
        onChange={e => onChange(index, { ...cap, value: parseInt(e.target.value) || 1 })}
      />
      <button onClick={() => onRemove(index)} className="ml-auto p-1 hover:bg-destructive/20 rounded shrink-0">
        <Trash2 className="w-3 h-3 text-destructive" />
      </button>
    </div>
  );
}

// Bonus row for both civilian and military: subgroup → capability → int
function BonusRow({ cap, index, onChange, onRemove, edbData, subtypeMap, accentClass }) {
  const [showReqs, setShowReqs] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  const groups = Object.keys(subtypeMap);
  const currentGroup = cap.groupKey || groups[0];
  const groupItems = subtypeMap[currentGroup] || [];
  const currentDef = groupItems.find(e => e.code === cap.code) || groupItems[0];

  const handleGroupChange = (g) => {
    const items = subtypeMap[g] || [];
    onChange(index, { ...cap, groupKey: g, code: items[0]?.code || '' });
  };

  const handleCodeChange = (code) => {
    onChange(index, { ...cap, code });
  };

  return (
    <div className={`rounded-lg px-3 py-2 space-y-1.5 ${accentClass}`}>
      <div className="flex items-center gap-2 flex-wrap">
        {/* Subgroup */}
        <Select value={currentGroup} onValueChange={handleGroupChange}>
          <SelectTrigger className="h-7 text-xs w-40 shrink-0"><SelectValue /></SelectTrigger>
          <SelectContent>
            {groups.map(g => <SelectItem key={g} value={g} className="text-xs">{g}</SelectItem>)}
          </SelectContent>
        </Select>

        {/* Capability */}
        <Select value={cap.code || (groupItems[0]?.code || '')} onValueChange={handleCodeChange}>
          <SelectTrigger className="h-7 text-xs flex-1 min-w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            {groupItems.map(e => (
              <SelectItem key={e.code} value={e.code} className="text-xs">{e.subtype}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Value + range hint */}
        <div className="flex flex-col items-center shrink-0">
          <span className="text-[9px] text-muted-foreground/70 mb-0.5">
            Range: {currentDef?.range || '[int]'}
          </span>
          <Input
            className="h-7 text-xs w-20"
            type="number"
            value={cap.value ?? 0}
            onChange={e => onChange(index, { ...cap, value: parseFloat(e.target.value) || 0 })}
          />
        </div>

        {/* Info */}
        <button
          onClick={() => setShowInfo(v => !v)}
          className="p-1 hover:bg-accent/60 rounded shrink-0 text-muted-foreground hover:text-foreground"
          title="Show description"
        >
          <Info className="w-3.5 h-3.5" />
        </button>

        {/* Req */}
        <button onClick={() => setShowReqs(!showReqs)} className="p-1 hover:bg-accent/60 rounded shrink-0">
          <Shield className="w-3.5 h-3.5 text-muted-foreground" />
        </button>

        {/* Delete */}
        <button onClick={() => onRemove(index)} className="p-1 hover:bg-destructive/20 rounded shrink-0">
          <Trash2 className="w-3 h-3 text-destructive" />
        </button>
      </div>

      {/* Code preview */}
      <div className="text-[9px] font-mono text-muted-foreground/50 pl-0.5">
        → <span className="text-primary/60">{cap.code || currentDef?.code} {cap.value ?? 0}</span>
      </div>

      {showInfo && currentDef?.description && (
        <div className="text-[10px] text-muted-foreground bg-accent/20 rounded p-2 border border-border/40 leading-relaxed">
          {currentDef.description}
        </div>
      )}

      {showReqs && (
        <div className="pt-1 border-t border-border/50">
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

// ─── Classifier: maps a parsed cap to its category ─────────────────────────
function classifyCapability(cap) {
  if (cap.type === 'recruit_pool') return 'recruit_pool';
  if (cap.type === 'agent' || cap.type === 'agent_limit') return 'agent';
  // New style: has 'code' field
  if (cap.code) {
    if (ALL_CIVILIAN_CODES.includes(cap.code)) return 'civilian';
    if (ALL_MILITARY_CODES.includes(cap.code)) return 'military';
  }
  // Legacy: has 'identifier' field
  const id = cap.identifier || '';
  for (const [, items] of Object.entries(CIVILIAN_SUBTYPES)) {
    if (items.some(e => e.code.startsWith(id))) return 'civilian';
  }
  for (const [, items] of Object.entries(MILITARY_SUBTYPES)) {
    if (items.some(e => e.code.startsWith(id))) return 'military';
  }
  return 'military';
}

// Convert a legacy cap (identifier + type bonus/simple) to new-style (code + value)
function normalizeCap(cap) {
  if (cap.code) return cap; // already new style
  if (cap.type === 'recruit_pool' || cap.type === 'agent' || cap.type === 'agent_limit') return cap;
  const id = cap.identifier || '';
  const suffix = cap.type === 'bonus' ? ' bonus' : '';
  const code = id + suffix;
  // Find group
  let groupKey = null;
  for (const [g, items] of Object.entries(CIVILIAN_SUBTYPES)) {
    if (items.some(e => e.code === code)) { groupKey = g; break; }
  }
  if (!groupKey) {
    for (const [g, items] of Object.entries(MILITARY_SUBTYPES)) {
      if (items.some(e => e.code === code)) { groupKey = g; break; }
    }
  }
  return { ...cap, code, groupKey, value: cap.value ?? 0 };
}

// ─── Main Component ────────────────────────────────────────────────────────

export default function CapabilityEditor({ capabilities, onChange, edbData }) {
  const normalized = capabilities.map(normalizeCap);

  const handleChange = (index, updated) => {
    const newCaps = [...normalized];
    newCaps[index] = updated;
    onChange(newCaps);
  };

  const handleRemove = (index) => {
    onChange(normalized.filter((_, i) => i !== index));
  };

  const recruitPools  = normalized.filter(c => classifyCapability(c) === 'recruit_pool');
  const agentCaps     = normalized.filter(c => classifyCapability(c) === 'agent');
  const civilianCaps  = normalized.filter(c => classifyCapability(c) === 'civilian');
  const militaryCaps  = normalized.filter(c => classifyCapability(c) === 'military');

  const defaultCivGroup = Object.keys(CIVILIAN_SUBTYPES)[0];
  const defaultMilGroup = Object.keys(MILITARY_SUBTYPES)[0];

  const addRecruitPool = () => onChange([...normalized, {
    type: 'recruit_pool', unitName: '', initialPool: 1, replenishRate: 0.5, maxPool: 4, experience: 0, requirements: []
  }]);
  const addAgent = () => onChange([...normalized, { type: 'agent', agentType: 'merchant', value: 1 }]);
  const addCivilian = () => {
    const firstGroup = CIVILIAN_SUBTYPES[defaultCivGroup];
    onChange([...normalized, { type: 'civilian_bonus', code: firstGroup[0].code, groupKey: defaultCivGroup, value: 1, requirements: [] }]);
  };
  const addMilitary = () => {
    const firstGroup = MILITARY_SUBTYPES[defaultMilGroup];
    onChange([...normalized, { type: 'military_bonus', code: firstGroup[0].code, groupKey: defaultMilGroup, value: 1, requirements: [] }]);
  };

  return (
    <div className="space-y-5">

      {/* Agent Recruitment */}
      {agentCaps.length > 0 && (
        <section className="space-y-1">
          <h4 className="text-[10px] font-semibold text-blue-400 uppercase tracking-wider flex items-center gap-1">
            <UserRound className="w-3 h-3" /> Agent Recruitment ({agentCaps.length})
          </h4>
          {agentCaps.map((cap) => {
            const realIndex = normalized.indexOf(cap);
            return <AgentRow key={realIndex} cap={cap} index={realIndex} onChange={handleChange} onRemove={handleRemove} />;
          })}
        </section>
      )}

      {/* Civilian Bonuses */}
      {civilianCaps.length > 0 && (
        <section className="space-y-1">
          <h4 className="text-[10px] font-semibold text-yellow-400 uppercase tracking-wider flex items-center gap-1">
            <Building2 className="w-3 h-3" /> Civilian Bonuses ({civilianCaps.length})
          </h4>
          {civilianCaps.map((cap) => {
            const realIndex = normalized.indexOf(cap);
            return (
              <BonusRow
                key={realIndex}
                cap={cap}
                index={realIndex}
                onChange={handleChange}
                onRemove={handleRemove}
                edbData={edbData}
                subtypeMap={CIVILIAN_SUBTYPES}
                accentClass="bg-yellow-500/5 border border-yellow-500/15"
              />
            );
          })}
        </section>
      )}

      {/* Military Bonuses */}
      {militaryCaps.length > 0 && (
        <section className="space-y-1">
          <h4 className="text-[10px] font-semibold text-red-400 uppercase tracking-wider flex items-center gap-1">
            <Sword className="w-3 h-3" /> Military Bonuses ({militaryCaps.length})
          </h4>
          {militaryCaps.map((cap) => {
            const realIndex = normalized.indexOf(cap);
            return (
              <BonusRow
                key={realIndex}
                cap={cap}
                index={realIndex}
                onChange={handleChange}
                onRemove={handleRemove}
                edbData={edbData}
                subtypeMap={MILITARY_SUBTYPES}
                accentClass="bg-red-500/5 border border-red-500/15"
              />
            );
          })}
        </section>
      )}

      {/* Recruit Pools */}
      {recruitPools.length > 0 && (
        <section className="space-y-2">
          <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <Swords className="w-3 h-3" /> Recruit Pools ({recruitPools.length})
          </h4>
          {recruitPools.map((cap) => {
            const realIndex = normalized.indexOf(cap);
            return <RecruitPoolRow key={realIndex} cap={cap} index={realIndex} onChange={handleChange} onRemove={handleRemove} edbData={edbData} />;
          })}
        </section>
      )}

      {/* Add buttons */}
      <div className="flex flex-wrap gap-2 pt-1">
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={addRecruitPool}>
          <Plus className="w-3 h-3 mr-1" /> Recruit Pool
        </Button>
        <Button variant="outline" size="sm" className="h-7 text-xs text-blue-400 border-blue-500/40 hover:bg-blue-500/10" onClick={addAgent}>
          <Plus className="w-3 h-3 mr-1" /> Agent
        </Button>
        <Button variant="outline" size="sm" className="h-7 text-xs text-yellow-400 border-yellow-500/40 hover:bg-yellow-500/10" onClick={addCivilian}>
          <Plus className="w-3 h-3 mr-1" /> Civilian Bonus
        </Button>
        <Button variant="outline" size="sm" className="h-7 text-xs text-red-400 border-red-500/40 hover:bg-red-500/10" onClick={addMilitary}>
          <Plus className="w-3 h-3 mr-1" /> Military Bonus
        </Button>
      </div>
    </div>
  );
}