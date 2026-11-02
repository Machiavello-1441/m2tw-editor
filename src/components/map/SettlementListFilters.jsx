import React from 'react';
import CampaignDropdown from '@/components/map/CampaignDropdown';

export default function SettlementListFilters({ faction, resource, factions, resources, onFactionChange, onResourceChange, shown, total }) {
  return <div className="space-y-1.5 rounded border border-border bg-card p-2 text-[10px] text-foreground">
    <div className="grid grid-cols-2 gap-2">
      <label className="min-w-0 space-y-1">
        <span className="text-muted-foreground">Faction</span>
        <CampaignDropdown value={faction} onChange={event => onFactionChange(event.target.value)} aria-label="Filter settlements by faction" className="h-7 w-full rounded border border-input bg-background px-1.5">
          <option value="">All factions</option>
          {factions.map(name => <option key={name} value={name}>{name}</option>)}
        </CampaignDropdown>
      </label>
      <label className="min-w-0 space-y-1">
        <span className="text-muted-foreground">Hidden resource</span>
        <CampaignDropdown value={resource} onChange={event => onResourceChange(event.target.value)} aria-label="Filter settlements by hidden resource" className="h-7 w-full rounded border border-input bg-background px-1.5">
          <option value="">All hidden resources</option>
          {resources.map(name => <option key={name} value={name}>{name}</option>)}
        </CampaignDropdown>
      </label>
    </div>
    <div className="flex items-center justify-between gap-2">
      <span role="status" className="text-muted-foreground">{shown} of {total} settlements</span>
      {(faction || resource) && <button type="button" onClick={() => { onFactionChange(''); onResourceChange(''); }} className="hover:underline">Clear filters</button>}
    </div>
  </div>;
}