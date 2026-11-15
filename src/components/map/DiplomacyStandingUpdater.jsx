import React, { useState } from 'react';
import CampaignDropdown from '@/components/map/CampaignDropdown';
import diplomacyStandings from '@/components/map/diplomacyStandings';

export default function DiplomacyStandingUpdater({ factionNames, standings, relationships, metadata, onApply }) {
  const [mode, setMode] = useState('recalculate'), [updated, setUpdated] = useState(false);
  const missing = factionNames.filter(name => !metadata[name]?.religion || !metadata[name]?.culture);
  const apply = () => {
    onApply(diplomacyStandings({ factionNames, standings, relationships, metadata, mode }));
    setUpdated(true);
  };
  return <section aria-label="Automatic standings" className="space-y-2 rounded border border-border bg-card p-2 text-[10px]">
    <p className="font-semibold text-foreground">Update standings from faction relationships</p>
    <p className="text-muted-foreground">Same/different religion: +0.15 / −0.15. Same/different culture group: +0.10 / −0.10. Alliance: +0.20. War: an additional −0.50.</p>
    <CampaignDropdown aria-label="Standings update mode" value={mode} onChange={event => { setMode(event.target.value); setUpdated(false); }}
      className="h-7 w-full rounded border border-input bg-background px-2 text-[11px] text-foreground">
      <option value="recalculate">Recalculate from zero</option><option value="add">Add to existing standings</option>
    </CampaignDropdown>
    <p className="text-muted-foreground">Updates every campaign faction pair in both directions, not just search results. Missing pairs start at 0. Totals stay between −1 and +1. {mode === 'add' ? 'Each click adds the modifiers again.' : 'Existing pair values are replaced by the calculated totals.'}</p>
    {missing.length > 0 && <p className="text-muted-foreground">{missing.length} factions lack religion or culture data. Missing modifiers are skipped, never guessed; load faction definitions to include them. Use Validate all relations for details.</p>}
    <button type="button" onClick={apply} disabled={factionNames.length < 2} className="rounded bg-primary px-2 py-1 text-primary-foreground disabled:opacity-40">Update standings</button>
    {updated && <p role="status" className="text-muted-foreground">Standings updated. Save the campaign to keep these changes.</p>}
  </section>;
}