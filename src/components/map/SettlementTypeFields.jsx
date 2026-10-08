import React, { useState } from 'react';
import { SETTLEMENT_LEVELS } from '@/components/map/stratParser';
import { normalizeSettlement, settlementLevelLabel } from '@/components/map/settlementBuildings';

export default function SettlementTypeFields({ value, onChange, edbData }) {
  const [error, setError] = useState('');
  const change = patch => {
    try { onChange(normalizeSettlement({ ...value, ...patch }, edbData, true)); setError(''); }
    catch (e) { setError(e.message); }
  };
  return <div className="space-y-1 text-[11px]">
    <label className="block text-muted-foreground">Settlement type
      <select value={value.castle ? 'castle' : 'city'} onChange={e => change({ castle: e.target.value === 'castle' })} className="h-7 w-full rounded border border-input bg-background px-1 text-foreground">
        <option value="city">City</option><option value="castle">Castle</option>
      </select>
    </label>
    <label className="block text-muted-foreground">Settlement level
      <select value={value.level || 'village'} onChange={e => change({ level: e.target.value })} className="h-7 w-full rounded border border-input bg-background px-1 text-foreground">
        {SETTLEMENT_LEVELS.map(level => <option key={level} value={level}>{settlementLevelLabel(level, value.castle)}</option>)}
      </select>
    </label>
    <p className="text-[9px] text-muted-foreground">Type and tier changes replace the core building and remove incompatible buildings.</p>
    {error && <p role="alert" className="text-destructive">{error}</p>}
  </div>;
}