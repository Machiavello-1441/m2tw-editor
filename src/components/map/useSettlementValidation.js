import { useEffect, useMemo, useState } from 'react';
import { extractBuildingLevelsFromEDB } from '@/components/map/additionalParsers';
import { useSettlementMechanics } from '@/components/map/settlementMechanics';
import { inspectSettlement } from '@/components/map/settlementValidation';

export default function useSettlementValidation(settlements, edbData, onApply) {
  const mechanics = useSettlementMechanics();
  const [corrected, setCorrected] = useState({});
  const hasEDB = useMemo(() => extractBuildingLevelsFromEDB(edbData).length > 0, [edbData]);
  const reports = useMemo(() => settlements.map(settlement => inspectSettlement(settlement, mechanics, edbData, hasEDB)), [settlements, mechanics, edbData, hasEDB]);
  useEffect(() => {
    const changes = reports.filter(report => report.changed && !report.error);
    if (!changes.length) return;
    onApply(changes.map(report => ({ id: report.settlement.id, edits: report.edits })));
    setCorrected(previous => ({ ...previous, ...Object.fromEntries(changes.map(report => [report.key, { level: report.settlement.level, core: report.currentCore }])) }));
  }, [reports, onApply]);
  return { reports, corrected, mechanics, hasEDB };
}