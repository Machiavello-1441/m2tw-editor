import React, { useMemo, useState } from 'react';
import OsmPackClassRow from '@/components/newmap/osmpacks/OsmPackClassRow';
import { layerLabel } from '@/components/newmap/osmpacks/osmPackDefaults';

export default function OsmPackClassList({ classes, preferences, setPreferences, disabled }) {
  const [search, setSearch] = useState('');
  const groups = useMemo(() => {
    const grouped = new Map(), query = search.trim().toLowerCase();
    for (const item of classes) {
      if (query && !`${item.classification} ${layerLabel(item.layer)}`.toLowerCase().includes(query)) continue;
      if (!grouped.has(item.layer)) grouped.set(item.layer, []);
      grouped.get(item.layer).push(item);
    }
    return [...grouped];
  }, [classes, search]);
  if (!classes.length) return null;
  return <div className="space-y-2">
    <p className="text-[11px] font-medium">2. Discovered pack classes</p>
    <p className="text-[9px] text-muted-foreground">These are Geofabrik classifications, not reconstructed raw OSM tags. Unlisted classes are not available from these packs. Assign a ground type, tick classes, then Apply; nothing is painted automatically.</p>
    <input aria-label="Search imported OSM classes" placeholder="Search classes or layers…" value={search} onChange={event => setSearch(event.target.value)} className="w-full rounded border bg-background px-2 py-1.5 text-[10px]" />
    {!groups.length && <p className="text-[10px] text-muted-foreground">No classes match this search.</p>}
    <div className="max-h-96 space-y-1 overflow-y-auto">
      {groups.map(([layer, items]) => <details key={layer} open className="rounded border px-2">
        <summary className="cursor-pointer py-1.5 text-[10px] font-medium capitalize">{layerLabel(layer)} · {items.length} classes</summary>
        {items.map(item => <OsmPackClassRow key={item.key} item={item} value={preferences[item.key]} disabled={disabled} onChange={value => setPreferences(previous => ({ ...previous, [item.key]: value }))} />)}
      </details>)}
    </div>
  </div>;
}