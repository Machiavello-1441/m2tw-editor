import React from 'react';
import { humanSize } from '@/components/newmap/osmpacks/osmPackDefaults';

export default function OsmPackSources({ packs, disabled, onClear }) {
  if (!packs.length) return null;
  return <div className="space-y-2 rounded border bg-muted/30 p-2 text-[10px]">
    <p className="font-medium">Loaded regional packs</p>
    {packs.map(pack => <div key={pack.name} className="break-words">
      <p>{pack.name}</p>
      <p className="text-muted-foreground">{humanSize(pack.bytes)} · {pack.archiveDate ? `Archive date ${pack.archiveDate.slice(0, 10)}` : 'Archive date unavailable'}</p>
      <p className="text-muted-foreground">{pack.layers.length} area layers; {pack.skipped.length} non-terrain layers skipped.</p>
    </div>)}
    <p className="text-muted-foreground">Only imported source regions are available. Gaps are never fetched automatically. Enlarging or moving the map requires another import.</p>
    <button type="button" disabled={disabled} onClick={onClear} className="rounded border px-2 py-1 text-muted-foreground hover:bg-accent">Clear loaded data and cache</button>
  </div>;
}