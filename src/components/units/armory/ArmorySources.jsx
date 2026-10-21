import React, { useState } from 'react';
import CampaignDropdown from '@/components/map/CampaignDropdown';

export default function ArmorySources({ db, units, unit, busy, onAdd }) {
  const [entryName, setEntryName] = useState(unit.soldier_model || ''), [lod, setLod] = useState('0'), [faction, setFaction] = useState('');
  const entry = db?.entries?.find(item => item.name === entryName);
  const unitNames = new Map(units.map(item => [item.soldier_model, item.type]));
  return <div className="flex flex-wrap items-end gap-2 text-xs">
    <label className="min-w-40 flex-1">Unit / donor model<CampaignDropdown value={entryName} disabled={busy} onChange={event => { setEntryName(event.target.value); setLod('0'); setFaction(''); }} className="w-full rounded border border-input bg-background p-1.5 text-xs"><option value="">Select a model…</option>{(db?.entries || []).map(item => <option key={item.name} value={item.name}>{unitNames.has(item.name) ? `${unitNames.get(item.name)} — ` : ''}{item.name}</option>)}</CampaignDropdown></label>
    <label>LOD<CampaignDropdown value={lod} disabled={busy || !entry} onChange={event => setLod(event.target.value)} className="rounded border border-input bg-background p-1.5 text-xs">{entry?.meshes?.map((mesh, index) => <option key={index} value={index}>LOD {index} ({mesh.dist})</option>)}</CampaignDropdown></label>
    <label>Faction skin<CampaignDropdown value={faction || entry?.factions?.[0]?.faction || ''} disabled={busy || !entry} onChange={event => setFaction(event.target.value)} className="rounded border border-input bg-background p-1.5 text-xs">{entry?.factions?.map((skin, index) => <option key={index} value={skin.faction}>{skin.faction}</option>)}</CampaignDropdown></label>
    <button type="button" disabled={busy || !entry} onClick={() => onAdd({ entry: entryName, lod: Number(lod), faction })} className="rounded bg-primary px-3 py-1.5 text-primary-foreground disabled:opacity-50">Add model parts</button>
  </div>;
}