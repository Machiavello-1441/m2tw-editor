import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Plus, Info, ChevronDown, ChevronRight } from 'lucide-react';

// Full capability reference from buildingcapabilities.xlsx (59 entries)
// Code column is the literal string to emit; Range is the integer argument range; Description is the tooltip
export const CAPABILITY_LIBRARY = [
  // ── Agent ──
  { type: 'Agent', subtype: 'Agent limit',      code: 'agent_limit',      args: '[spy|assassin|merchant|admiral|princess|diplomat|priest|heretic|witch|inquisitor]', range: '[int]',  description: "Adds to the faction's total number of recruitable agents" },
  { type: 'Agent', subtype: 'Agent recruitment',code: 'agent',            args: '[spy|assassin|merchant|admiral|princess|diplomat|priest|heretic|witch|inquisitor]', range: '[int]',  description: 'Allows recruitment of agents: named character, spy, assassin, merchant, admiral, princess, diplomat, priest, heretic, witch, inquisitor' },

  // ── Civilian Bonus › Construction bonus ──
  { type: 'Civilian Bonus', subtype: 'Construction bonus (cost, defensive)', code: 'construction_cost_bonus_defensive', args: 'bonus', range: '1-100', description: "Changes cost of core buildings by ∓1% per increment" },
  { type: 'Civilian Bonus', subtype: 'Construction bonus (cost, military)',  code: 'construction_cost_bonus_military',  args: 'bonus', range: '1-100', description: 'No effects' },
  { type: 'Civilian Bonus', subtype: 'Construction bonus (cost, other)',     code: 'construction_cost_bonus_other',     args: 'bonus', range: '1-100', description: "Changes cost of buildings other than core and 'temple_' by ∓1% per increment" },
  { type: 'Civilian Bonus', subtype: 'Construction bonus (cost, religious)', code: 'construction_cost_bonus_religious',  args: 'bonus', range: '1-100', description: "Changes cost of buildings with 'temple_' prefix by ∓1% per increment" },
  { type: 'Civilian Bonus', subtype: 'Construction bonus (cost, stone)',     code: 'construction_cost_bonus_stone',     args: 'bonus', range: '1-100', description: 'Changes cost of stone buildings by ∓1% per increment. The material of the last level of the chain determines the material for the whole chain' },
  { type: 'Civilian Bonus', subtype: 'Construction bonus (cost, wooden)',    code: 'construction_cost_bonus_wooden',    args: 'bonus', range: '1-100', description: 'Changes cost of wooden buildings by ∓1% per increment. The material of the last level of the chain determines the material for the whole chain' },
  { type: 'Civilian Bonus', subtype: 'Construction bonus (time, defensive)', code: 'construction_time_bonus_defensive', args: 'bonus', range: '1-100', description: 'Changes construction time of core buildings by ∓1% per increment' },
  { type: 'Civilian Bonus', subtype: 'Construction bonus (time, military)',  code: 'construction_time_bonus_military',  args: 'bonus', range: '1-100', description: 'No effects' },
  { type: 'Civilian Bonus', subtype: 'Construction bonus (time, other)',     code: 'construction_time_bonus_other',     args: 'bonus', range: '1-100', description: "Changes construction time of buildings other than core and 'temple_' by ∓1% per increment" },
  { type: 'Civilian Bonus', subtype: 'Construction bonus (time, religious)', code: 'construction_time_bonus_religious', args: 'bonus', range: '1-100', description: "Changes construction time of 'temple_' buildings by ∓1% per increment" },
  { type: 'Civilian Bonus', subtype: 'Construction bonus (time, stone)',     code: 'construction_time_bonus_stone',     args: 'bonus', range: '1-100', description: 'Changes construction time of stone buildings by ∓1% per increment' },
  { type: 'Civilian Bonus', subtype: 'Construction bonus (time, wooden)',    code: 'construction_time_bonus_wooden',    args: 'bonus', range: '1-100', description: 'Changes construction time of wooden buildings by ∓1% per increment' },

  // ── Civilian Bonus › Economic bonus ──
  { type: 'Civilian Bonus', subtype: 'Economic bonus (income)',        code: 'income_bonus',           args: 'bonus', range: '[int]', description: 'Adds specified amount of income to the settlement, added to "Corruption and Other" income' },
  { type: 'Civilian Bonus', subtype: 'Economic bonus (taxable income)',code: 'taxable_income_bonus',   args: 'bonus', range: '[int]', description: '10× the specified value; adds 10–327 670 to taxable income directly. Supposedly does not work in M2. Shows text.' },
  { type: 'Civilian Bonus', subtype: 'Economic bonus (trade base)',    code: 'trade_base_income_bonus',args: 'bonus', range: '[int]', description: '10× the specified value; adds 10–327 670% to trade income from both land and sea' },
  { type: 'Civilian Bonus', subtype: 'Economic bonus (trade fleet)',   code: 'trade_fleet',            args: '',      range: '[int]', description: 'Does nothing — number of trade fleets is hard coded to the port building level and bugged based on mod folder name' },
  { type: 'Civilian Bonus', subtype: 'Economic bonus (trade level)',   code: 'trade_level_bonus',      args: 'bonus', range: '[int]', description: '100× the specified value; adds 100–3 276 700% to base land trade income (calculated from land trade base without any road upgrade)' },

  // ── Civilian Bonus › Infrastructure bonus ──
  { type: 'Civilian Bonus', subtype: 'Infrastructure (farming)',      code: 'farming_level',  args: '',      range: '1-3',   description: '33%, 66%, and 100% of arable land becomes farmland on strat map; increases income from farming' },
  { type: 'Civilian Bonus', subtype: 'Infrastructure (mine)',         code: 'mine_resource',  args: '',      range: '[int]', description: 'Converts has_mine resource strat models to mines; initiates mining income. 80–2000 ×mine_resource (income from mining); 1–32767 (set mine value to 50–1 638 350)' },
  { type: 'Civilian Bonus', subtype: 'Infrastructure (road level)',   code: 'road_level',     args: '',      range: '0-3',   description: '0 = dirt paths; 1 = paved roads & +100% trade income; 2 = highways & +200%; 3 = highways & +300%' },

  // ── Civilian Bonus › Population bonus ──
  { type: 'Civilian Bonus', subtype: 'Population (fire risk)',         code: 'fire_risk',               args: '',      range: '[int]', description: 'Does nothing — fire disaster disabled in early versions of RTW' },
  { type: 'Civilian Bonus', subtype: 'Population (happiness)',         code: 'happiness_bonus',         args: 'bonus', range: '[int]', description: 'Each increment is a 5% public order bonus due to happiness (5–125%). Possibly also affects population growth' },
  { type: 'Civilian Bonus', subtype: 'Population (law)',               code: 'law_bonus',               args: 'bonus', range: '[int]', description: 'Each increment is a 5% public order bonus due to law (5–125%)' },
  { type: 'Civilian Bonus', subtype: 'Population (growth)',            code: 'population_growth_bonus', args: 'bonus', range: '[int]', description: 'Increases population growth % by half of the specified value (0.5–12.5%). Subject to descr_settlement_mechanics' },
  { type: 'Civilian Bonus', subtype: 'Population (health)',            code: 'population_health_bonus', args: 'bonus', range: '[int]', description: 'Increases pop growth % by half value (0.5–12.5%); increases public order due to happiness by 5×value (5–125%). Check descr_settlement_mechanics' },
  { type: 'Civilian Bonus', subtype: 'Population (loyalty)',           code: 'population_loyalty_bonus',args: 'bonus', range: '[int]', description: 'Does nothing — cut in early version of RTW. Shows text.' },
  { type: 'Civilian Bonus', subtype: 'Population (stage games)',       code: 'stage_games',             args: '',      range: '1-3',   description: 'Increases public order' },
  { type: 'Civilian Bonus', subtype: 'Population (stage races)',       code: 'stage_races',             args: '',      range: '1-2',   description: 'Increases public order' },

  // ── Civilian Bonus › Religious bonus ──
  { type: 'Civilian Bonus', subtype: 'Religion (amplify)',     code: 'amplify_religion_level', args: '',      range: '[int]', description: 'Increases religion conversion in the settlement by 33.3 for each increment (not religion-specific)' },
  { type: 'Civilian Bonus', subtype: 'Religion (pope approval)',    code: 'pope_approval',    args: '',      range: '[int]', description: 'Sends a message when the building is complete talking about "pope approves"' },
  { type: 'Civilian Bonus', subtype: 'Religion (pope disapproval)', code: 'pope_disapproval', args: '',      range: '[int]', description: 'Apparently no effect' },
  { type: 'Civilian Bonus', subtype: 'Religion level',              code: 'religion_level',   args: 'bonus', range: '[int]', description: 'Increases religion conversion % by 0.5× the specified value' },

  // ── Military Bonus › Defence bonus ──
  { type: 'Military Bonus', subtype: 'Defence (gate defences)', code: 'gate_defences', args: '', range: '0-1',  description: '0 = none; 1 = boiling oil' },
  { type: 'Military Bonus', subtype: 'Defence (gate strength)', code: 'gate_strength', args: '', range: '0-2',  description: '0 = wooden; 1 = reinforced; 2 = iron. Apparently does nothing as gate strength is hard coded to match the settlement level' },
  { type: 'Military Bonus', subtype: 'Defence (gun bonus)',     code: 'gun_bonus',     args: '', range: '0-9',  description: 'Experience level of all gunpowder units trained in the settlement' },
  { type: 'Military Bonus', subtype: 'Defence (tower level)',   code: 'tower_level',   args: '', range: '1-3',  description: '1 = arrow; 2 = ballista; 3 = cannon' },
  { type: 'Military Bonus', subtype: 'Defence (wall level)',    code: 'wall_level',    args: '', range: '0-4',  description: '0 = palisade; 1 = wooden; 2 = stone; 3 = large stone; 4 = epic stone. Apparently does nothing as wall level is hard coded to match settlement level' },

  // ── Military Bonus › Recruitment bonus ──
  { type: 'Military Bonus', subtype: 'Recruitment (free upkeep)',    code: 'free_upkeep',               args: 'bonus', range: '[int]', description: 'Number of additional free upkeep slots for units with free_upkeep_unit attribute' },
  { type: 'Military Bonus', subtype: 'Recruitment (naval cost)',     code: 'recruitment_cost_bonus_naval', args: 'bonus', range: '1-2', description: 'Reduces cost of naval units trained in the settlement\'s port by 10% per increment (20% max, although info scroll can show higher values)' },
  { type: 'Military Bonus', subtype: 'Recruitment (slots)',          code: 'recruitment_slots',         args: '',      range: '[int]', description: 'Adds specified number of recruitment slots to the settlement' },
  { type: 'Military Bonus', subtype: 'Recruitment (exp bonus)',      code: 'recruits_exp_bonus',        args: 'bonus', range: '1-5',  description: 'Experience level of units trained in the settlement. Possible range 0–15 but 10–15 counted as 9; negative values go to 9' },
  { type: 'Military Bonus', subtype: 'Recruitment (morale bonus)',   code: 'recruits_morale_bonus',     args: 'bonus', range: '[int]', description: 'Increases recruited unit morale by 20% × number specified' },
  { type: 'Military Bonus', subtype: 'Recruitment (retrain cost)',   code: 'retrain_cost_bonus',        args: 'bonus', range: '0-1',  description: 'Reduces cost to retrain units in the settlement by 20%; capped at 1' },

  // ── Military Bonus › Unit bonus ──
  { type: 'Military Bonus', subtype: 'Unit (navy bonus)',           code: 'navy_bonus',            args: '', range: '0-9', description: 'Experience level of all gunpowder ship units trained in the settlement\'s port' },
  { type: 'Military Bonus', subtype: 'Unit (archer bonus)',         code: 'archer_bonus',          args: '', range: '0-9', description: 'Experience level of archer units trained in the settlement' },
  { type: 'Military Bonus', subtype: 'Unit (armour)',               code: 'armour',                args: '', range: '1-6', description: 'Increases armour upgrade level; adds +2 to unit\'s true armour stat' },
  { type: 'Military Bonus', subtype: 'Unit (cavalry bonus)',        code: 'cavalry_bonus',         args: '', range: '0-9', description: 'Experience level of cavalry units trained in the settlement' },
  { type: 'Military Bonus', subtype: 'Unit (heavy cavalry bonus)',  code: 'heavy_cavalry_bonus',   args: 'bonus', range: '0-9', description: "Experience level of units with 'knight' attribute trained in the settlement" },
  { type: 'Military Bonus', subtype: 'Unit (upgrade bodyguard)',    code: 'upgrade_bodyguard',     args: '', range: '[int]', description: 'Enables the upgrading of General\'s Bodyguards after the Marian Reforms event' },

  // ── Military Bonus › Weapon bonus ──
  { type: 'Military Bonus', subtype: 'Weapon (artillery gunpowder)',  code: 'weapon_artillery_gunpowder', args: '', range: '0-9', description: 'Weapon level of all gunpowder artillery units' },
  { type: 'Military Bonus', subtype: 'Weapon (artillery mechanical)', code: 'weapon_artillery_mechanical',args: '', range: '0-9', description: 'Melee weapon level of all artillery crews; unknown if this includes gunpowder artillery' },
  { type: 'Military Bonus', subtype: 'Weapon (melee blade)',          code: 'weapon_melee_blade',         args: '', range: '0-9', description: "Weapon level of all melee units that don't use 'blunt' weapons" },
  { type: 'Military Bonus', subtype: 'Weapon (melee simple/blunt)',   code: 'weapon_melee_simple',        args: '', range: '0-9', description: "Weapon level of all melee units that use 'blunt' weapons" },
  { type: 'Military Bonus', subtype: 'Weapon (missile gunpowder)',    code: 'weapon_missile_gunpowder',   args: '', range: '0-9', description: 'Weapon level of all gunpowder units; unknown if this includes gunpowder artillery' },
  { type: 'Military Bonus', subtype: 'Weapon (missile mechanical)',   code: 'weapon_missile_mechanical',  args: '', range: '0-9', description: 'Melee weapon level of all missile units; unknown if this includes gunpowder units' },
  { type: 'Military Bonus', subtype: 'Weapon (naval gunpowder)',      code: 'weapon_naval_gunpowder',     args: '', range: '0-9', description: 'Weapon level of all gunpowder ships' },
  { type: 'Military Bonus', subtype: 'Weapon (projectile/all gun)',   code: 'weapon_projectile',          args: '', range: '0-9', description: 'Weapon level of all gunpowder units including artillery' },
];

const TYPE_COLORS = {
  'Agent':          'bg-purple-500/20 text-purple-300 border-purple-500/30',
  'Civilian Bonus': 'bg-green-500/20 text-green-300 border-green-500/30',
  'Military Bonus': 'bg-red-500/20 text-red-300 border-red-500/30',
};

export default function CapabilityLibrary({ onInsert }) {
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState({});

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return CAPABILITY_LIBRARY;
    return CAPABILITY_LIBRARY.filter(c =>
      c.subtype.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q) ||
      c.type.toLowerCase().includes(q)
    );
  }, [search]);

  const grouped = useMemo(() => {
    const g = {};
    for (const item of filtered) {
      if (!g[item.type]) g[item.type] = [];
      g[item.type].push(item);
    }
    return g;
  }, [filtered]);

  const toggleGroup = (type) => setCollapsed(c => ({ ...c, [type]: !c[type] }));

  return (
    <div className="flex flex-col h-full">
      <div className="p-2 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2 top-1.5 w-3 h-3 text-muted-foreground" />
          <Input
            className="h-6 text-[10px] pl-6 bg-background"
            placeholder="Search capabilities…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-1.5 space-y-1">
          {Object.entries(grouped).map(([type, items]) => (
            <div key={type}>
              <button
                className="flex items-center gap-1 w-full text-left px-1 py-0.5 rounded hover:bg-accent/30 transition-colors"
                onClick={() => toggleGroup(type)}
              >
                {collapsed[type]
                  ? <ChevronRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                  : <ChevronDown className="w-3 h-3 text-muted-foreground flex-shrink-0" />}
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${TYPE_COLORS[type] || 'bg-muted text-muted-foreground border-border'}`}>
                  {type}
                </span>
                <span className="text-[9px] text-muted-foreground ml-auto">{items.length}</span>
              </button>
              {!collapsed[type] && (
                <div className="ml-3 space-y-0.5 mt-0.5">
                  {items.map((item, i) => (
                    <CapabilityLibraryItem key={i} item={item} onInsert={onInsert} />
                  ))}
                </div>
              )}
            </div>
          ))}
          {Object.keys(grouped).length === 0 && (
            <p className="text-[10px] text-muted-foreground text-center py-4">No capabilities match "{search}"</p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function CapabilityLibraryItem({ item, onInsert }) {
  const [showInfo, setShowInfo] = useState(false);

  return (
    <div className="rounded border border-border/50 bg-card/30 overflow-hidden">
      <div className="flex items-center gap-1 px-1.5 py-1">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-medium text-foreground truncate">{item.subtype}</span>
            <button
              onClick={() => setShowInfo(v => !v)}
              className="flex-shrink-0 text-muted-foreground hover:text-foreground"
              title="Show description"
            >
              <Info className="w-2.5 h-2.5" />
            </button>
          </div>
          <code className="text-[9px] text-primary/80 truncate block">
            {item.code}{item.args ? ' ' + item.args : ''}
          </code>
          <span className="text-[9px] text-muted-foreground/60">Range: {item.range}</span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-5 w-5 p-0 flex-shrink-0 hover:bg-primary/20 hover:text-primary"
          onClick={() => onInsert(item)}
          title={`Insert ${item.subtype}`}
        >
          <Plus className="w-3 h-3" />
        </Button>
      </div>
      {showInfo && (
        <div className="px-1.5 pb-1.5 text-[9px] text-muted-foreground bg-accent/10 border-t border-border/30 leading-relaxed">
          {item.description}
        </div>
      )}
    </div>
  );
}