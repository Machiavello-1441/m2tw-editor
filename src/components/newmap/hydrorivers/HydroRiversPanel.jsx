import React from 'react';
import { Loader2 } from 'lucide-react';
import useHydroRivers from '@/components/newmap/hydrorivers/useHydroRivers';
import HydroRegionImport from '@/components/newmap/hydrorivers/HydroRegionImport';
import HydroRiverPreview from '@/components/newmap/hydrorivers/HydroRiverPreview';
import HydroRiverRulesNotice from '@/components/newmap/hydrorivers/HydroRiverRulesNotice';

export default function HydroRiversPanel(props) {
  const river = useHydroRivers(props);
  return (
    <section className="border rounded bg-card text-card-foreground p-2.5 space-y-3" aria-label="HydroRIVERS river import">
      <h3 className="text-[11px] font-semibold">Rivers · HydroRIVERS regional import</h3>
      <HydroRegionImport busy={river.busy} names={river.names} onImport={river.loadFiles} />
      {river.busy && <p role="status" className="flex gap-1 items-center text-[10px] text-muted-foreground"><Loader2 className="w-3 h-3 animate-spin shrink-0" />{river.busy}</p>}
      {river.error && <p role="alert" className="text-[10px] text-destructive">{river.error}</p>}
      {river.message && <p role="status" className="text-[10px] text-muted-foreground">{river.message}</p>}
      {!!river.names.length && <HydroRiverPreview draft={river.draft} busy={river.busy} minOrder={river.minOrder} maxOrder={river.maxOrder} onOrderChange={river.setMinOrder} onApply={river.apply} onShow={river.showPreview} onHide={river.hidePreview} />}
      <HydroRiverRulesNotice />
    </section>
  );
}