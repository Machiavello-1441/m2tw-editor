import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import SettlementCorrectionPreview from '@/components/map/SettlementCorrectionPreview';
import SettlementMechanicsStatus from '@/components/map/SettlementMechanicsStatus';
import SettlementValidationResults from '@/components/map/SettlementValidationResults';
import useSettlementValidation from '@/components/map/useSettlementValidation';

export default function SettlementValidationView({ settlements, edbData, onApply }) {
  const { reports, corrected, mechanics, hasEDB, changes, applyCorrections } = useSettlementValidation(settlements, edbData, onApply);
  const [previewOpen, setPreviewOpen] = useState(false);
  const apply = () => { applyCorrections(); setPreviewOpen(false); };
  const unresolved = reports.filter(report => report.error || report.waiting).length;
  const errors = reports.filter(report => report.error).length;
  const valid = reports.filter(report => !report.error && !report.waiting && !report.changed).length;
  const fixed = reports.filter(report => corrected[report.key] && !report.error && !report.waiting && !report.changed).length;
  return <section className="space-y-3 text-card-foreground" aria-label="Settlement validation">
    <div className="space-y-1">
      <h2 className="text-sm font-semibold">Settlement validation</h2>
      <p className="text-[11px] text-muted-foreground">Every city and castle is checked against population upgrade thresholds. Review proposed corrections in a popup, or apply them using the button below. Opening this tab never changes your campaign.</p>
      <p className="text-[10px] text-muted-foreground">Cities above village receive core_building; castles receive core_castle_building. Other buildings and population sizes are left unchanged.</p>
    </div>
    <SettlementMechanicsStatus />
    {!hasEDB && <p className="text-[11px] text-muted-foreground">Load export_descr_buildings.txt from Home to verify the core building levels available in your mod.</p>}
    {!settlements.length ? <p className="py-4 text-center text-[11px] text-muted-foreground">Load a campaign with descr_strat.txt to validate its settlements.</p> : <>
      <p role="status" className="text-[11px]">{mechanics && hasEDB ? `${valid}/${reports.length} valid · ${changes.length} proposed corrections · ${fixed} corrected` : `${reports.length} settlements awaiting validation`}{errors > 0 ? ` · ${errors} issues need attention` : ''}</p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={!changes.length} onClick={() => setPreviewOpen(true)}>Preview corrections</Button>
        <Button size="sm" disabled={!changes.length} onClick={apply}>Apply corrections ({changes.length})</Button>
      </div>
      {changes.length > 0 && unresolved > 0 && <p className="text-[10px] text-muted-foreground">Settlements with unresolved issues will not be changed.</p>}
      {reports.some(report => report.changed || report.error || report.waiting) && <div className="max-h-96 overflow-y-auto"><SettlementValidationResults reports={reports} corrected={corrected} /></div>}
    </>}
    <SettlementCorrectionPreview open={previewOpen} onOpenChange={setPreviewOpen} changes={changes} unresolved={unresolved} onApply={apply} />
  </section>;
}