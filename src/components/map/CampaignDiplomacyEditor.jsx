import React, { useMemo, useState } from 'react';
import useCampaignDiplomacy from '@/components/map/useCampaignDiplomacy';
import filterDiplomacyRows from '@/components/map/filterDiplomacyRows';
import validateCampaignDiplomacy from '@/components/map/validateCampaignDiplomacy';
import ClientStateRulesNotice from '@/components/map/ClientStateRulesNotice';
import DiplomacyEntryForm from '@/components/map/DiplomacyEntryForm';
import DiplomacyRows from '@/components/map/DiplomacyRows';
import DiplomacyCheckResults from '@/components/map/DiplomacyCheckResults';
import DiplomacyStandingUpdater from '@/components/map/DiplomacyStandingUpdater';

export default function CampaignDiplomacyEditor({ stratData, allFactionNames, onStratDataChange }) {
  const [tab, setTab] = useState('standings'), [adding, setAdding] = useState(false), [checked, setChecked] = useState(false);
  const [search, setSearch] = useState({ standings: '', relationships: '' });
  const data = useCampaignDiplomacy({ stratData, onStratDataChange });
  const { standings, relationships, metadata, relationshipIssues, rejectedMessage } = data;
  const rows = tab === 'standings' ? standings : relationships;
  const entries = filterDiplomacyRows(rows, search[tab]);
  const diagnostics = useMemo(() => checked ? validateCampaignDiplomacy({ standings, relationships, factionNames: allFactionNames, metadata }) : [], [checked, standings, relationships, allFactionNames, metadata]);
  return <div className="flex h-full flex-col space-y-2">
    <div className="flex shrink-0 overflow-hidden rounded border border-border">
      {['standings', 'relationships'].map(id => <button type="button" key={id} onClick={() => { setTab(id); setAdding(false); }}
        className={`flex-1 px-1 py-1 text-[10px] font-semibold ${tab === id ? 'bg-accent text-accent-foreground' : 'bg-card text-muted-foreground hover:bg-accent'}`}>
        {id === 'standings' ? `Standings (${standings.length})` : `Relationships (${relationships.length})`}
      </button>)}
    </div>
    <input type="search" aria-label={`Filter ${tab} by faction`} placeholder="Filter factions on either side…" value={search[tab]}
      onChange={event => setSearch({ ...search, [tab]: event.target.value })} className="h-6 w-full shrink-0 rounded border border-input bg-background px-2 text-[11px] text-foreground" />
    <div className="flex flex-wrap items-center justify-between gap-1">
      <button type="button" onClick={() => setAdding(true)} disabled={allFactionNames.length < 2} className="rounded border border-input px-2 py-1 text-[10px] text-foreground hover:bg-accent disabled:opacity-40">+ Add {tab === 'standings' ? 'standing' : 'relationship'}</button>
      <button type="button" onClick={() => setChecked(true)} className="rounded border border-input px-2 py-1 text-[10px] text-foreground hover:bg-accent">Check diplomacy</button>
    </div>
    {adding && <DiplomacyEntryForm key={tab} type={tab} factionNames={allFactionNames} onAdd={entry => data.addEntry(tab, entry)} onCancel={() => setAdding(false)} />}
    {checked && <DiplomacyCheckResults issues={diagnostics} />}
    {tab === 'standings' ? <DiplomacyStandingUpdater factionNames={allFactionNames} standings={standings} relationships={relationships} metadata={metadata} onApply={data.applyStandings} /> : <>
      <p className="text-[9px] text-muted-foreground">Wars and alliances are automatically mirrored for each target, including edits and removals. protectorate_of (requires M2EX): the left faction is the protectorate and the right faction is its overlord.</p>
      <ClientStateRulesNotice issues={relationshipIssues} rejectedMessage={rejectedMessage} />
    </>}
    <DiplomacyRows entries={entries} type={tab} factionNames={allFactionNames} total={rows.length}
      onUpdate={tab === 'standings' ? data.updateStanding : data.updateRelationship} onRemove={tab === 'standings' ? data.removeStanding : data.removeRelationship} />
  </div>;
}