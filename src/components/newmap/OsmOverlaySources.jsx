import React, { useState } from 'react';
import OsmTagOverlayEditor from '@/components/newmap/OsmTagOverlayEditor';
import OsmRegionalPacks from '@/components/newmap/osmpacks/OsmRegionalPacks';
import { bboxKey } from '@/components/newmap/osmpacks/osmPackGeometry';

export default function OsmOverlaySources(props) {
  const [source, setSource] = useState('packs');
  return <div className="space-y-2">
    <div role="group" aria-label="OSM overlay source" className="grid grid-cols-2 gap-1 text-[10px]">
      {[['packs', 'Regional ZIP packs'], ['live', 'Live Overpass']].map(([id, label]) => <button key={id} type="button" aria-pressed={source === id} onClick={() => setSource(id)} className={source === id ? 'rounded border bg-primary px-2 py-1.5 text-primary-foreground' : 'rounded border bg-secondary px-2 py-1.5 text-secondary-foreground'}>{label}</button>)}
    </div>
    <div hidden={source !== 'packs'}><OsmRegionalPacks key={bboxKey(props.bbox)} {...props} /></div>
    <div hidden={source !== 'live'}><OsmTagOverlayEditor {...props} /></div>
  </div>;
}