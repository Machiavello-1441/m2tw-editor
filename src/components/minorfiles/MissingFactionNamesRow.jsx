import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import CampaignDropdown from '@/components/map/CampaignDropdown';

export default function MissingFactionNamesRow({ faction, names, onAdd }) {
  const [source, setSource] = useState('');
  const sources = Object.keys(names).filter(name =>
    ['characters', 'surnames', 'females'].some(section => names[name][section]?.length));
  return <div className="flex flex-wrap items-center gap-2 rounded border border-border p-2">
    <span className="min-w-28 font-mono">{faction}</span>
    <label className="flex items-center gap-2">
      <span className="text-muted-foreground">Source faction</span>
      <CampaignDropdown value={source} onChange={event => setSource(event.target.value)} disabled={!sources.length}
        aria-label={`Source faction for ${faction}`} className="w-44 rounded border border-input bg-background px-2 py-1 text-xs">
        <option value="">Select source…</option>
        {sources.map(name => <option key={name} value={name}>{name}</option>)}
      </CampaignDropdown>
    </label>
    <button type="button" disabled={!sources.includes(source)} onClick={() => onAdd(faction, source)}
      className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 hover:bg-accent disabled:opacity-40">
      <Plus className="h-3 w-3" /> Add faction names
    </button>
    {!sources.length && <span className="text-muted-foreground">Load a names list with source names first.</span>}
  </div>;
}