import React, { useState } from 'react';
import autoVictoryConditions from '@/components/map/autoVictoryConditions';

export default function VictoryAutoUpdate({ winConditions, onWinConditionsChange, factionNames, settlements }) {
  const [longMultiplier, setLongMultiplier] = useState('5');
  const [shortMultiplier, setShortMultiplier] = useState('3');
  const valid = [longMultiplier, shortMultiplier].every(value => Number.isSafeInteger(Number(value)) && Number(value) > 0);
  const hasFactions = factionNames.length > 0 || Object.keys(winConditions || {}).length > 0;
  const apply = () => onWinConditionsChange(autoVictoryConditions({
    winConditions, factionNames, settlements,
    longMultiplier: Number(longMultiplier), shortMultiplier: Number(shortMultiplier),
  }));
  return (
    <div className="rounded border border-border bg-card p-2 space-y-2">
      <button type="button" onClick={apply} disabled={!valid || !hasFactions}
        className="w-full rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 px-2 py-1.5 text-[10px] font-semibold">
        Update all factions
      </button>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[10px] text-muted-foreground">Long campaign ×
          <input type="number" min="1" step="1" required value={longMultiplier} onChange={event => setLongMultiplier(event.target.value)}
            className="mt-1 h-6 w-full rounded border border-input bg-background px-1.5 text-[11px] text-foreground" />
        </label>
        <label className="text-[10px] text-muted-foreground">Short campaign ×
          <input type="number" min="1" step="1" required value={shortMultiplier} onChange={event => setShortMultiplier(event.target.value)}
            className="mt-1 h-6 w-full rounded border border-input bg-background px-1.5 text-[11px] text-foreground" />
        </label>
      </div>
      <p className="text-[9px] leading-relaxed text-muted-foreground">
        take_regions = current settlement count × multiplier. Both hold_regions lists use the capital (first settlement).
        {' '}Landless factions: 0 regions and no capital. Outlive conditions stay unchanged.
      </p>
      {!valid && <p role="alert" className="text-[10px] text-destructive">Use positive whole-number multipliers.</p>}
    </div>
  );
}