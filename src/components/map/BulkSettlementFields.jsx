import React from 'react';
import { SETTLEMENT_LEVELS } from '@/components/map/stratParser';
import { settlementLevelLabel } from '@/components/map/settlementBuildings';
import SettlementTypeToggle from '@/components/map/SettlementTypeToggle';
import SettlementMechanicsStatus from '@/components/map/SettlementMechanicsStatus';
import { useSettlementMechanics } from '@/components/map/settlementMechanics';

export default function BulkSettlementFields({ draft, setDraft, buildings }) {
  const mechanics = useSettlementMechanics();
  const set = (key, value) => setDraft(d => ({ ...d, [key]: value }));
  const input = 'h-7 w-full rounded border border-input bg-background px-1 text-foreground';
  const trees = [...new Set(buildings.map(b => b.building))];
  return <div className="grid grid-cols-2 gap-2 text-[11px]">
    <div>Type<SettlementTypeToggle allowKeep value={draft.type} onChange={type => setDraft(d => ({ ...d, type, building: '' }))} /></div>
    <label>Settlement level<select disabled={!!mechanics} className={input} value={mechanics ? '' : draft.level} onChange={e => setDraft(d => ({ ...d, level: e.target.value, building: '' }))}>
      <option value="">{mechanics ? 'Automatic from population' : 'Keep each level'}</option>{(draft.type === 'castle' ? SETTLEMENT_LEVELS.slice(0, 5) : SETTLEMENT_LEVELS).map(l => <option key={l} value={l}>{settlementLevelLabel(l, draft.type === 'castle')}</option>)}
    </select></label>
    <label>Population<input type="number" min="0" className={input} placeholder="Unchanged" value={draft.population} onChange={e => set('population', e.target.value)} /></label>
    <label>Building action<select className={input} value={draft.action} onChange={e => set('action', e.target.value)}>
      <option value="set">Set / replace level</option><option value="remove">Remove tree</option>
    </select></label>
    <label>Building tree<select className={input} value={draft.tree} onChange={e => setDraft(d => ({ ...d, tree: e.target.value, building: '' }))}>
      <option value="">No building change</option>{trees.map(t => <option key={t}>{t}</option>)}
    </select></label>
    {draft.action === 'set' && <label>Building level<select className={input} value={draft.building} onChange={e => set('building', e.target.value)}>
      <option value="">Choose level…</option>{buildings.filter(b => b.building === draft.tree).map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
    </select></label>}
    <div className="col-span-2"><SettlementMechanicsStatus /></div>
  </div>;
}