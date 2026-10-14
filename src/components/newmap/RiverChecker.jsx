import React from 'react';
import { Loader2, RefreshCw, Wand2 } from 'lucide-react';
import useRiverValidator from '@/components/newmap/useRiverValidator';
import RiverValidationResult from '@/components/newmap/RiverValidationResult';

export default function RiverChecker({ featuresLayer, onLayerUpdate }) {
  const validator = useRiverValidator(featuresLayer, onLayerUpdate);
  return <section className="space-y-2 rounded border bg-card text-card-foreground p-2" aria-label="River validator">
    <h3 className="text-[10px] font-semibold uppercase tracking-wider">River Validator</h3>
    {!featuresLayer?.imageData ? <p className="text-[10px] text-muted-foreground">No features layer loaded yet.</p> : <>
      <div className="flex gap-1">
        <button onClick={validator.check} disabled={validator.running} className="flex-1 flex justify-center items-center gap-1 rounded border bg-secondary text-secondary-foreground p-1.5 text-[10px] disabled:opacity-50"><RefreshCw className="w-3 h-3" />Check Rivers</button>
        <button onClick={validator.repair} disabled={validator.running} className="flex-1 flex justify-center items-center gap-1 rounded border bg-primary text-primary-foreground p-1.5 text-[10px] disabled:opacity-50"><Wand2 className="w-3 h-3" />Auto-Fix</button>
      </div>
      {validator.running && <p role="status" className="flex items-center gap-1 text-[10px] text-muted-foreground"><Loader2 className="w-3 h-3 animate-spin" />Processing river topology…</p>}
      {validator.error && <p role="alert" className="text-[10px] text-destructive">{validator.error}</p>}
      <RiverValidationResult result={validator.result} repairs={validator.repairs} />
      {validator.undo && <button disabled={validator.running} onClick={validator.restore} className="w-full border rounded bg-secondary text-secondary-foreground p-1.5 text-[10px]">Undo last river repair</button>}
      <p className="text-[9px] text-muted-foreground">Repair preserves channel connections and endpoints instead of deleting branch pixels. Reapply the HydroRIVERS draft to recover stretches removed by the old fixer; missing geography cannot be reconstructed from scattered pixels.</p>
    </>}
  </section>;
}