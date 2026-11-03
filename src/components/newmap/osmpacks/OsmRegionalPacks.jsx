import React from 'react';
import OsmRegionDownloads from '@/components/newmap/osmpacks/OsmRegionDownloads';
import OsmPackImportControls from '@/components/newmap/osmpacks/OsmPackImportControls';
import OsmPackSources from '@/components/newmap/osmpacks/OsmPackSources';
import OsmPackClassList from '@/components/newmap/osmpacks/OsmPackClassList';
import useOsmRegionalPacks from '@/components/newmap/osmpacks/useOsmRegionalPacks';
import useOsmPackApply from '@/components/newmap/osmpacks/useOsmPackApply';

export default function OsmRegionalPacks({ bbox, groundLayer, onLayerUpdate, mapWidth, mapHeight }) {
  const state = useOsmRegionalPacks(bbox), painting = useOsmPackApply(state, groundLayer, onLayerUpdate, mapWidth, mapHeight);
  const disabled = state.busy || !state.initialized;
  const clear = async () => {
    if (!window.confirm('Clear regional polygon data and its local cache for this map? Painted ground will stay unchanged.')) return;
    if (await state.clear()) painting.reset();
  };
  return <section className="space-y-3 rounded border bg-card p-2 text-card-foreground" aria-label="Regional OSM data packs">
    <p className="text-[11px] font-semibold">Regional OSM packs · local processing</p>
    <OsmRegionDownloads bbox={bbox} />
    <OsmPackImportControls disabled={disabled || !bbox} onImport={state.loadFiles} />
    {!bbox && <p className="text-[10px] text-muted-foreground">Select a map area before importing.</p>}
    {!state.ready && bbox && <p role="status" className="text-[10px] text-muted-foreground">Opening local map cache…</p>}
    {state.busy && <div role="status" className="space-y-1 text-[10px]">
      <p>{state.progress?.label || 'Processing regional data…'}</p>
      <progress className="h-1.5 w-full" max="100" value={state.progress?.percent || 0} aria-label="Regional processing progress" />
      <button type="button" onClick={state.cancel} className="rounded border px-2 py-1">Cancel processing</button>
    </div>}
    {state.error && <p role="alert" className="break-words text-[10px] text-destructive">{state.error}</p>}
    {state.ready?.error && <button type="button" onClick={state.cancel} className="rounded border px-2 py-1 text-[10px]">Restart local processing</button>}
    {state.summary.warning && <p role="status" className="break-words text-[10px] text-muted-foreground">{state.summary.warning}</p>}
    {state.message && <p role="status" className="text-[10px] text-muted-foreground">{state.message}</p>}
    <OsmPackSources packs={state.summary.packs} disabled={disabled} onClear={clear} />
    <OsmPackClassList classes={state.summary.classes} preferences={state.preferences} setPreferences={state.setPreferences} disabled={disabled} />
    {!!state.summary.classes.length && <div className="space-y-1.5">
      <button type="button" disabled={disabled || !groundLayer?.imageData || (!painting.selected && !painting.applied)} onClick={() => painting.apply()} className="w-full rounded border bg-primary px-2 py-2 text-[11px] text-primary-foreground disabled:opacity-50">Apply {painting.selected} selected classes locally</button>
      {painting.applied && <button type="button" disabled={disabled || !groundLayer?.imageData} onClick={() => painting.apply(true)} className="w-full rounded border px-2 py-1 text-[10px]">Remove pack overlays</button>}
      {!groundLayer?.imageData && <p className="text-[9px] text-muted-foreground">Generate or import the ground layer before applying classes.</p>}
      <p className="text-[9px] text-muted-foreground">Selections and colours take effect on Apply. Later classes in the list paint over earlier ones; existing sea is protected.</p>
    </div>}
    <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="block text-[9px] text-muted-foreground underline">© OpenStreetMap contributors · Geofabrik extracts · ODbL 1.0</a>
  </section>;
}