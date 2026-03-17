import React, { useState, useRef, useEffect } from 'react';
import { WHEN_TO_TEST_OPTIONS } from './conditionDefs';
import { ChevronDown, Search } from 'lucide-react';

const CATEGORIES = {
  'Battle': ['PostBattle', 'PreBattle', 'PostBattleAfterResults', 'OnSmallestArmyWinsBattle', 'OnSiegeSuccessful', 'OnSiegeFailed', 'EndedInSiege'],
  'Character': ['OnGeneral', 'OnCharacterTurnEnd', 'OnCharacterTurnStart', 'OnCharacterComesOfAge', 'OnCharacterMarriage', 'OnCharacterDeath', 'OnCharacterBecomesFactionLeader', 'OnCharacterLooted', 'OnCharacterEndsTurnInSettlement', 'OnEnteringCity', 'OnLeavingCity', 'CharacterNearHeretic', 'BecomesFactionLeader', 'BecomesFactionHeir', 'CeasedFactionHeir', 'LesserGeneralOfferedForAdoption', 'FatherDiesNatural', 'Insurrection', 'CardinalPromoted', 'PriestBecomesHeretic'],
  'Mission': ['OnSuccessfulMission', 'OnFailedMission', 'OnAssassinationSuccess', 'OnAssassinationFailure', 'OnSpySuccess', 'OnSpyFailure', 'OnBribeSuccess', 'OnBribeFailure', 'OnDiplomacySuccess', 'OnDiplomacyFailure', 'OnTradeSuccess', 'OnTradeFailure', 'InquisitionSuccess', 'InquisitionFailure', 'LeaderOrderedSpyingMission', 'BriberyMission', 'AcceptBribe', 'RefuseBribe', 'DiplomacyMission', 'LeaderOrderedDiplomacyMission', 'SufferAcquisitionAttempt', 'AcquisitionMission', 'ExecutesAnAssassinOnAMission', 'ExecutesASpyOnAMission', 'DenouncementMission', 'SufferDenouncementAttempt', 'LeaderMissionSuccess'],
  'Faction': ['OnMakingAlliance', 'OnBreakingAlliance', 'OnCaptureSettlement', 'OnConstructBuilding', 'OnHereticBurned', 'OnHereticConverted', 'AgentCreated'],
  'Governor': ['GovernorBuildingDestroyed', 'GovernorBuildingCompleted', 'GovernorUnitTrained', 'GovernorAgentCreated', 'GovernorCityRiots', 'GovernorCityRebels', 'OccupySettlement', 'SackSettlement', 'ExterminatePopulation'],
  'General': ['GeneralDevastatesTile', 'GeneralPrisonersRansomedCaptor', 'GeneralJoinCrusade', 'GeneralAbandonCrusade', 'GeneralTakesCrusadeTarget', 'GeneralArrivesCrusadeTargetRegion', 'GeneralAssaultsResidence', 'GeneralCaptureSettlement'],
  'Religion': ['OnCrusade', 'OnJihad', 'OnCrusadeEnd', 'OnJihadEnd'],
  'Always': ['Always'],
};

export default function WhenToTestSelect({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const categoryNames = ['All', ...Object.keys(CATEGORIES)];

  const getOptionsForCategory = (cat) => {
    if (cat === 'All') return WHEN_TO_TEST_OPTIONS;
    return CATEGORIES[cat] || [];
  };

  const filtered = getOptionsForCategory(activeCategory).filter(o =>
    o.toLowerCase().includes(search.toLowerCase())
  );

  const showCustom = search && !WHEN_TO_TEST_OPTIONS.some(o => o.toLowerCase() === search.toLowerCase());

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => { setOpen(o => !o); setSearch(''); }}
        className="w-full h-7 flex items-center justify-between px-2 rounded border border-border bg-background text-xs font-mono text-white hover:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary"
      >
        <span className={value ? 'text-white' : 'text-muted-foreground'}>{value || 'Select event…'}</span>
        <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 w-full min-w-[260px] bg-card border border-border rounded-md shadow-xl overflow-hidden">
          {/* Search */}
          <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-border">
            <Search className="w-3 h-3 text-muted-foreground shrink-0" />
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search…"
              className="flex-1 bg-transparent text-xs text-white placeholder-muted-foreground focus:outline-none"
            />
          </div>
          {/* Category filter tabs */}
          <div className="flex gap-0.5 px-2 py-1.5 border-b border-border overflow-x-auto">
            {categoryNames.map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                  activeCategory === cat
                    ? 'bg-primary/20 text-primary border border-primary/40'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          {/* Options */}
          <div className="max-h-52 overflow-y-auto">
            {filtered.map(opt => (
              <button
                key={opt}
                type="button"
                onClick={() => { onChange(opt); setOpen(false); }}
                className={`w-full text-left px-3 py-1.5 text-xs font-mono hover:bg-accent transition-colors ${value === opt ? 'text-primary bg-primary/10' : 'text-foreground'}`}
              >
                {opt}
              </button>
            ))}
            {showCustom && (
              <button
                type="button"
                onClick={() => { onChange(search); setOpen(false); }}
                className="w-full text-left px-3 py-1.5 text-xs font-mono text-yellow-400 hover:bg-accent transition-colors"
              >
                Use custom: "{search}"
              </button>
            )}
            {filtered.length === 0 && !showCustom && (
              <p className="px-3 py-2 text-[11px] text-muted-foreground">No matches</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}