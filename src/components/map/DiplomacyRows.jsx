import React from 'react';
import CampaignDropdown from '@/components/map/CampaignDropdown';
import DiplomacyTargets from '@/components/map/DiplomacyTargets';

export default function DiplomacyRows({ entries, type, factionNames, onUpdate, onRemove, total }) {
  const standing = type === 'standings';
  return <div className="flex-1 space-y-1 overflow-y-auto">
    {entries.map(({ row, index }) => <div key={index} className="flex items-center gap-1">
      <CampaignDropdown aria-label={`Source faction in ${type} row ${index + 1}`} value={row.faction} onChange={event => onUpdate(index, 'faction', event.target.value)}
        className="h-5 flex-1 rounded border border-input bg-background px-1 text-[9px] text-foreground">
        {factionNames.map(name => <option key={name}>{name}</option>)}
      </CampaignDropdown>
      {standing ? <input type="number" step="any" min="-1" max="1" aria-label={`Standing value for ${row.faction}`} value={row.value}
        onChange={event => onUpdate(index, 'value', parseFloat(event.target.value))}
        className="h-5 w-14 rounded border border-input bg-background px-1 text-center font-mono text-[9px] text-foreground" /> :
        <CampaignDropdown aria-label={`Relationship type for ${row.faction}`} value={row.relation} onChange={event => onUpdate(index, 'relation', event.target.value)}
          className="h-5 rounded border border-input bg-background px-1 text-[9px] text-foreground">
          <option value="at_war_with">at_war_with</option><option value="allied_to">allied_to</option>
          <option value="protectorate_of">protectorate_of</option><option value="client_of">client_of</option>
        </CampaignDropdown>}
      <DiplomacyTargets value={row.targets} options={factionNames.filter(name => name !== row.faction)} single={!standing && row.relation === 'client_of'}
        label={`${standing ? 'Standing' : 'Relationship'} targets for ${row.faction}`} onChange={targets => onUpdate(index, 'targets', targets)} />
      <button type="button" aria-label={`Remove ${standing ? 'standing' : 'relationship'} row ${index + 1}`} onClick={() => onRemove(index)} className="text-xs text-muted-foreground hover:text-destructive">×</button>
    </div>)}
    {!entries.length && <p className="text-[10px] italic text-muted-foreground">{total ? 'No entries match this faction' : `No ${standing ? 'standings' : 'relationships'} defined`}</p>}
  </div>;
}