import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import CampaignDropdown from '@/components/map/CampaignDropdown';
import useGeofabrikRegions from '@/components/newmap/osmpacks/useGeofabrikRegions';
import { overlaps } from '@/components/newmap/osmpacks/osmPackGeometry';
import { humanSize } from '@/components/newmap/osmpacks/osmPackDefaults';

export default function OsmRegionDownloads({ bbox }) {
  const catalogue = useGeofabrikRegions(), [selectedId, setSelectedId] = useState('');
  const regions = catalogue.data || [];
  const nearby = useMemo(() => {
    const candidates = regions.filter(region => region.url && bbox && overlaps(region.bounds, bbox));
    const parents = new Set(candidates.map(region => region.parent));
    return candidates.filter(region => !parents.has(region.id)).sort((a, b) => a.name.localeCompare(b.name));
  }, [regions, bbox?.west, bbox?.east, bbox?.south, bbox?.north]);
  const selected = regions.find(region => region.id === selectedId) || nearby[0] || regions.find(region => region.url);
  const metadata = useQuery({ queryKey: ['geofabrik-zip-metadata', selected?.id], enabled: !!selected?.url, staleTime: 3600000, retry: false,
    queryFn: async () => { const { data } = await base44.functions.invoke('geofabrikRegions', { action: 'metadata', regionId: selected.id }); if (data.error) throw new Error(data.error); return data; } });
  const label = region => `${region.name}${region.parent ? ` (${regions.find(parent => parent.id === region.parent)?.name || region.parent})` : ''}`;
  const nearIds = new Set(nearby.map(region => region.id));
  return <div className="space-y-1.5 rounded border p-2 text-[10px]">
    <p className="font-medium">1. Download official regional data</p>
    {catalogue.isLoading && <p role="status" className="text-muted-foreground">Loading Geofabrik regions…</p>}
    {catalogue.isError && <div role="alert"><p>Could not load the region catalogue.</p><button type="button" onClick={() => catalogue.refetch()} className="underline">Retry catalogue</button></div>}
    {selected && <>
      <CampaignDropdown aria-label="Geofabrik download region" value={selected.id} onChange={event => setSelectedId(event.target.value)} className="w-full rounded border bg-background p-1.5 text-[10px]">
        <optgroup label="Nearby subregions (approximate extents)">{nearby.map(region => <option key={region.id} value={region.id}>{label(region)}</option>)}</optgroup>
        <optgroup label="Other regions">{regions.filter(region => !nearIds.has(region.id)).sort((a, b) => a.name.localeCompare(b.name)).map(region => <option key={region.id} value={region.id}>{label(region)}{!region.url ? ' — choose subregions' : ''}</option>)}</optgroup>
      </CampaignDropdown>
      {selected.url ? <>
        <a href={metadata.data?.url || selected.url} target="_blank" rel="noopener noreferrer" className="block rounded border bg-secondary p-1.5 text-center text-secondary-foreground">Download official shapefile ZIP</a>
        <p className="text-muted-foreground">{metadata.isLoading ? 'Checking ZIP size and date…' : metadata.data ? `${humanSize(metadata.data.bytes)} · Modified ${metadata.data.modified ? new Date(metadata.data.modified).toISOString().slice(0, 10) : 'date unavailable'}` : 'Size/date could not be checked; the official link is still available.'}</p>
      </> : <p>No shapefile ZIP is offered for this region. Select smaller subregions.</p>}
    </>}
    <p className="text-muted-foreground">Keep the ZIP intact, then import it below. Nearby suggestions use approximate extents, not a guarantee of complete map coverage.</p>
    <a href="https://download.geofabrik.de/" target="_blank" rel="noopener noreferrer" className="underline text-muted-foreground">Browse all official Geofabrik downloads</a>
  </div>;
}