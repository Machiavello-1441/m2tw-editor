import React from 'react';
import CampaignDropdown from '@/components/map/CampaignDropdown';

export default function DiplomacyEntryType({ type, faction, kind, value, onChange }) {
  const standing = type === 'standings';
  return <div className="space-y-1">
    <p className="font-medium">2. {standing ? 'Standing value (−1 to +1)' : 'Relationship type'}</p>
    <CampaignDropdown aria-label={standing ? 'New standing level' : 'New relationship type'} value={kind} disabled={!faction}
      onChange={event => onChange(event.target.value, standing && event.target.value !== 'custom' ? event.target.value : '')}
      className="h-7 w-full rounded border border-input bg-background px-2 text-[11px] text-foreground">
      <option value="" disabled>{standing ? 'Select a standing level…' : 'Select relationship type…'}</option>
      {standing ? <>
        <option value="-1">Hostile (−1.00)</option><option value="0">Neutral (0.00)</option>
        <option value="1">Friendly (+1.00)</option><option value="custom">Custom value…</option>
      </> : <>
        <option value="at_war_with">at_war_with</option><option value="allied_to">allied_to</option>
        <option value="protectorate_of">protectorate_of</option><option value="client_of">client_of</option>
      </>}
    </CampaignDropdown>
    {standing && kind && <input type="number" required min="-1" max="1" step="any" aria-label="New standing value" placeholder="Enter a value from −1 to +1"
      value={value} onChange={event => onChange('custom', event.target.value)} className="h-7 w-full rounded border border-input bg-background px-2 text-[11px] text-foreground" />}
  </div>;
}