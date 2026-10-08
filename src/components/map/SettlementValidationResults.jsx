import React from 'react';
import { settlementLevelLabel } from '@/components/map/settlementBuildings';

export default function SettlementValidationResults({ reports, corrected }) {
  return <div className="overflow-x-auto rounded border border-border">
    <table className="w-full text-left text-[10px]">
      <thead className="bg-muted text-muted-foreground"><tr>
        {['Settlement', 'Population', 'Level', 'Core building', 'Result'].map(label => <th key={label} className="p-2 align-top font-medium">{label}</th>)}
      </tr></thead>
      <tbody>{reports.map(report => {
        const { settlement, expectedLevel, error, waiting } = report;
        const previous = corrected[report.key];
        const label = level => settlementLevelLabel(level || 'village', settlement.castle);
        return <tr key={report.key} className="border-t border-border">
          <td className="p-2 align-top"><strong>{settlement.region || 'Unnamed settlement'}</strong><div className="text-muted-foreground">{settlement.faction} · {settlement.castle ? 'Castle' : 'City'}</div></td>
          <td className="p-2 align-top font-mono">{settlement.population ?? 'Missing'}</td>
          <td className="p-2 align-top">{previous && previous.level !== settlement.level && <div className="text-muted-foreground">{label(previous.level)} →</div>}{label(settlement.level)}{expectedLevel && expectedLevel !== settlement.level && <div className="text-muted-foreground">Expected: {label(expectedLevel)}</div>}</td>
          <td className="p-2 align-top font-mono">{previous && JSON.stringify(previous.core) !== JSON.stringify(report.currentCore) && <div className="text-muted-foreground">{previous.core.join(', ') || 'Missing'} →</div>}{report.currentCore.join(', ') || (settlement.level === 'village' && !settlement.castle ? 'Not required' : 'Missing')}</td>
          <td className={`p-2 align-top ${error ? 'text-destructive' : 'text-foreground'}`}>{error || waiting || (report.changed ? 'Correcting…' : previous ? 'Corrected' : 'Valid')}</td>
        </tr>;
      })}</tbody>
    </table>
  </div>;
}