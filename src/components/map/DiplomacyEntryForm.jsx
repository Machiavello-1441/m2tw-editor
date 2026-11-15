import React, { useState } from 'react';
import CampaignDropdown from '@/components/map/CampaignDropdown';
import DiplomacyEntryType from '@/components/map/DiplomacyEntryType';
import DiplomacyTargets from '@/components/map/DiplomacyTargets';

export default function DiplomacyEntryForm({ type, factionNames, onAdd, onCancel }) {
  const [draft, setDraft] = useState({ faction: '', kind: '', value: '', targets: [] });
  const [error, setError] = useState('');
  const standing = type === 'standings', number = Number(draft.value);
  const validValue = !standing || (draft.value !== '' && Number.isFinite(number) && number >= -1 && number <= 1);
  const valid = draft.faction && draft.kind && draft.targets.length > 0 && validValue;
  const submit = event => {
    event.preventDefault();
    if (!valid) return;
    const entry = { faction: draft.faction, targets: draft.targets, ...(standing ? { value: number, valueStr: String(number) } : { relation: draft.kind }) };
    const rejected = onAdd(entry);
    if (rejected) setError(rejected); else onCancel();
  };
  return <form onSubmit={submit} className="space-y-2 rounded border border-border bg-card p-2 text-[10px] text-foreground">
    <p className="font-semibold">New {standing ? 'faction standing' : 'relationship'}</p>
    <label className="block space-y-1"><span className="font-medium">1. Source faction</span>
      <CampaignDropdown aria-label="New source faction" value={draft.faction} onChange={event => { setDraft({ faction: event.target.value, kind: '', value: '', targets: [] }); setError(''); }}
        className="h-7 w-full rounded border border-input bg-background px-2 text-[11px] text-foreground">
        <option value="" disabled>Select a faction first…</option>{factionNames.map(name => <option key={name}>{name}</option>)}
      </CampaignDropdown>
    </label>
    <DiplomacyEntryType type={type} faction={draft.faction} kind={draft.kind} value={draft.value}
      onChange={(kind, value) => { setDraft({ ...draft, kind, value, targets: standing ? draft.targets : [] }); setError(''); }} />
    <div className="space-y-1"><p className="font-medium">3. Target faction(s)</p><div className="flex">
      <DiplomacyTargets value={draft.targets} options={factionNames.filter(name => name !== draft.faction)} single={draft.kind === 'client_of'} allowEmpty
        disabled={!draft.faction || !draft.kind || !validValue} label="New target factions" onChange={targets => { setDraft({ ...draft, targets }); setError(''); }} />
    </div></div>
    {error && <p role="alert" className="text-destructive">{error}</p>}
    <div className="flex justify-end gap-2">
      <button type="button" onClick={onCancel} className="rounded border border-input px-2 py-1 hover:bg-accent">Cancel</button>
      <button type="submit" disabled={!valid} className="rounded bg-primary px-2 py-1 text-primary-foreground disabled:opacity-40">Add {standing ? 'standing' : 'relationship'}</button>
    </div>
  </form>;
}