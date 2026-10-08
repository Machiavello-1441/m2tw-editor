import React, { useState } from 'react';
import BulkSettlementFields from '@/components/map/BulkSettlementFields';
import { availableSettlementBuildings, normalizeSettlement, replaceSettlementBuilding } from '@/components/map/settlementBuildings';
import { populationSettlementLevel, useSettlementMechanics } from '@/components/map/settlementMechanics';

export default function BulkSettlementEditor({ selected, visible, onSelectVisible, onClear, onApply, edbData }) {
  const [draft, setDraft] = useState({ type: '', level: '', population: '', tree: '', building: '', action: 'set' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const mechanics = useSettlementMechanics();
  const proposed = selected.map(s => {
    const next = { ...s, ...(draft.type ? { castle: draft.type === 'castle' } : {}), ...(draft.level && !mechanics ? { level: draft.level } : {}), ...(draft.population !== '' ? { population: Number(draft.population) } : {}) };
    return { ...next, level: populationSettlementLevel(next.population, next.castle, mechanics) || next.level };
  });
  const options = proposed.length ? availableSettlementBuildings(edbData, proposed[0]).filter(b => !b.building.startsWith('core_') && proposed.every(s => availableSettlementBuildings(edbData, s).some(other => other.name === b.name && other.building === b.building))) : [];
  const apply = () => {
    try {
      if (draft.population !== '' && (!Number.isInteger(Number(draft.population)) || Number(draft.population) < 0)) throw new Error('Population must be a non-negative whole number.');
      if (draft.tree && draft.action === 'set' && !options.some(b => b.building === draft.tree && b.name === draft.building)) throw new Error('Choose a building level available to every selected settlement.');
      const changes = proposed.map(s => {
        let next = normalizeSettlement(s, edbData, !!(draft.type || draft.level || draft.population !== '' || mechanics));
        if (draft.tree) next.buildings = draft.action === 'remove' ? next.buildings.filter(b => b.split(/\s+/)[0] !== draft.tree) : replaceSettlementBuilding(next.buildings, `${draft.tree} ${draft.building}`);
        return { id: s.id, edits: next };
      });
      onApply(changes); setError(''); setMessage(`Updated ${changes.length} provinces.`);
    } catch (e) { setError(e.message); setMessage(''); }
  };
  return <div className="space-y-2 rounded border border-border bg-card p-2 text-card-foreground">
    <div className="flex items-center gap-2 text-[11px]"><strong>{selected.length} selected</strong><button type="button" onClick={onSelectVisible} className="underline">Select filtered ({visible.length})</button><button type="button" onClick={onClear} className="underline">Clear</button></div>
    <BulkSettlementFields draft={draft} setDraft={setDraft} buildings={options} />
    <p className="text-[9px] text-muted-foreground">Only filled settings change. Building levels must work for all selected provinces. Core buildings are automatic; type/tier changes remove incompatible buildings.</p>
    {!selected.length && <p className="text-[10px] text-muted-foreground">Tick provinces below, or select the filtered list.</p>}
    {error && <p role="alert" className="text-[11px] text-destructive">{error}</p>}
    {message && <p role="status" className="text-[11px]">{message}</p>}
    <button type="button" onClick={apply} disabled={!selected.length || !(draft.type || draft.level || draft.population !== '' || draft.tree)} className="rounded bg-primary px-2 py-1 text-[11px] text-primary-foreground disabled:opacity-40">Apply to selected provinces</button>
  </div>;
}