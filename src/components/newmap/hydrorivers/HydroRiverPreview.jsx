import React from 'react';

export default function HydroRiverPreview({ draft, busy, minOrder, maxOrder, onOrderChange, onApply, onShow, onHide }) {
  return (
    <div className="space-y-2">
      <label className="block text-[10px]">Tributary density
        <input type="range" min="1" max={maxOrder} value={maxOrder - minOrder + 1} disabled={!!busy && !draft} onChange={event => onOrderChange(maxOrder - Number(event.target.value) + 1)} className="block w-full mt-1 accent-primary" />
      </label>
      <div className="flex justify-between text-[9px] text-muted-foreground"><span>Main channels</span><span>More tributaries</span></div>
      <p className="text-[9px] text-muted-foreground">Minimum Strahler order: {minOrder}. Downstream connections are retained. Maximum detail is limited by the source dataset.</p>
      {draft && <>
        <img src={draft.url} alt="HydroRIVERS draft for the selected map area" className="w-full max-h-48 object-contain bg-background border rounded" style={{ imageRendering: 'pixelated' }} />
        <p className="text-[9px] text-muted-foreground">Draft: {draft.stats.selected.toLocaleString()} / {draft.stats.available.toLocaleString()} reaches; {draft.stats.origins} source markers. Overlay is not saved until applied.</p>
        {!draft.stats.selected && <p className="text-[10px] text-muted-foreground">No visible reaches at this density. Include more tributaries.</p>}
        <p className="text-[9px] text-muted-foreground">Automatically repaired {draft.stats.repairs.blocksThinned.toLocaleString()} thick-block pixels and {draft.stats.repairs.loopsOpened} loop pixels; relocated {draft.stats.repairs.relocated} sources and merged {draft.stats.repairs.merged} coincident heads.</p>
        {!!draft.stats.issues && <p className="text-[10px] text-destructive">{draft.stats.issues} issues remain after safe repair ({draft.stats.blocks} solid blocks, {draft.stats.loops} loops, {draft.stats.unresolved} source issues). Check the applied layer with River Validator.</p>}
        {(!!draft.stats.repairs.inferred || !!draft.stats.directionAmbiguities) && <p className="text-[9px] text-muted-foreground">Some source/outlet direction was inferred from endpoints ({draft.stats.directionAmbiguities} ambiguous reaches). Review geographic direction, not thousands of thick blocks.</p>}
        <div className="flex gap-1">
          <button onClick={onShow} disabled={!!busy} className="flex-1 border rounded bg-secondary text-secondary-foreground p-1 text-[9px]">Show draft</button>
          <button onClick={onHide} className="flex-1 border rounded bg-secondary text-secondary-foreground p-1 text-[9px]">Hide draft</button>
        </div>
        <button onClick={onApply} disabled={!!busy || !draft.stats.selected} className="w-full border rounded bg-primary text-primary-foreground p-1.5 text-[10px] disabled:opacity-50">Apply river draft to Features</button>
        <p className="text-[9px] text-muted-foreground">Applying another density replaces only unchanged pixels from the previous HydroRIVERS draft; existing manual work and other features are kept.</p>
      </>}
    </div>
  );
}