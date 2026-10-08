import React, { useEffect, useState } from 'react';
import { SETTLEMENT_LEVELS } from '@/components/map/stratParser';
import { normalizeSettlement, settlementLevelLabel } from '@/components/map/settlementBuildings';
import { populationSettlementLevel, useSettlementMechanics } from '@/components/map/settlementMechanics';
import SettlementTypeToggle from '@/components/map/SettlementTypeToggle';
import SettlementMechanicsStatus from '@/components/map/SettlementMechanicsStatus';

export default function SettlementTypeFields({ value, onChange, edbData }) {
  const [error, setError] = useState('');
  const mechanics = useSettlementMechanics();
  const autoLevel = populationSettlementLevel(value.population, value.castle, mechanics);
  const change = patch => {
    try { onChange(normalizeSettlement({ ...value, ...patch }, edbData, true)); setError(''); }
    catch (e) { setError(e.message); }
  };
  useEffect(() => {
    if (autoLevel && autoLevel !== value.level) change({ level: autoLevel });
  }, [autoLevel, value.level, edbData, onChange]);
  return <div className="space-y-1 text-[11px]">
    <div><span className="block text-muted-foreground">Settlement type</span>
      <SettlementTypeToggle value={value.castle ? 'castle' : 'city'} onChange={type => change({ castle: type === 'castle' })} />
    </div>
    <label className="block text-muted-foreground">Population
      <input type="number" min="0" step="1" value={value.population ?? 0} onChange={e => change({ population: Number(e.target.value) })} className="h-7 w-full rounded border border-input bg-background px-1 text-foreground" />
    </label>
    <label className="block text-muted-foreground">Settlement level
      <select disabled={!!autoLevel} value={autoLevel || value.level || 'village'} onChange={e => change({ level: e.target.value })} className="h-7 w-full rounded border border-input bg-background px-1 text-foreground disabled:opacity-70">
        {(value.castle ? SETTLEMENT_LEVELS.slice(0, 5) : SETTLEMENT_LEVELS).map(level => <option key={level} value={level}>{settlementLevelLabel(level, value.castle)}</option>)}
      </select>
    </label>
    <SettlementMechanicsStatus />
    <p className="text-[9px] text-muted-foreground">Type and tier changes replace the core building and remove incompatible buildings.</p>
    {error && <p role="alert" className="text-destructive">{error}</p>}
  </div>;
}