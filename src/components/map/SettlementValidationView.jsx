import React from 'react';
import SettlementMechanicsStatus from '@/components/map/SettlementMechanicsStatus';
import SettlementValidationResults from '@/components/map/SettlementValidationResults';
import useSettlementValidation from '@/components/map/useSettlementValidation';

export default function SettlementValidationView({ settlements, edbData, onApply }) {
  const { reports, corrected, mechanics, hasEDB } = useSettlementValidation(settlements, edbData, onApply);
  const errors = reports.filter(report => report.error).length;
  const valid = reports.filter(report => !report.error && !report.waiting && !report.changed).length;
  const fixed = reports.filter(report => corrected[report.key] && !report.error && !report.waiting && !report.changed).length;
  return <section className="space-y-3 text-card-foreground" aria-label="Settlement validation">
    <div className="space-y-1">
      <h2 className="text-sm font-semibold">Settlement validation</h2>
      <p className="text-[11px] text-muted-foreground">While this view is open, every city and castle is automatically checked against population upgrade thresholds. Incorrect levels and missing or mismatched core buildings are corrected in the campaign and included in your next save or export.</p>
      <p className="text-[10px] text-muted-foreground">Cities above village receive core_building; castles receive core_castle_building. Other buildings and population sizes are left unchanged.</p>
    </div>
    <SettlementMechanicsStatus />
    {!hasEDB && <p className="text-[11px] text-muted-foreground">Load export_descr_buildings.txt from Home to verify the core building levels available in your mod.</p>}
    {!settlements.length ? <p className="py-4 text-center text-[11px] text-muted-foreground">Load a campaign with descr_strat.txt to validate its settlements.</p> : <>
      <p role="status" className="text-[11px]">{mechanics && hasEDB ? `${valid}/${reports.length} valid · ${fixed} corrected` : `${reports.length} settlements awaiting validation`}{errors > 0 ? ` · ${errors} issues need attention` : ''}</p>
      <SettlementValidationResults reports={reports} corrected={corrected} />
    </>}
  </section>;
}