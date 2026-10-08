import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { settlementLevelLabel } from '@/components/map/settlementBuildings';

export default function SettlementCorrectionPreview({ open, onOpenChange, changes, unresolved, onApply }) {
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="dark flex max-h-[85vh] w-[calc(100%_-_2rem)] max-w-3xl flex-col bg-background text-foreground">
      <DialogHeader>
        <DialogTitle>Proposed settlement corrections</DialogTitle>
        <DialogDescription>{changes.length} settlements will be updated. Nothing changes until you click Apply corrections; population and unrelated buildings stay unchanged.</DialogDescription>
      </DialogHeader>
      {unresolved > 0 && <p className="text-xs text-muted-foreground">{unresolved} settlements with unresolved issues will not be changed.</p>}
      <div className="min-h-0 overflow-y-auto space-y-2">
        {!changes.length && <p className="text-sm text-muted-foreground">No corrections are available.</p>}
        {changes.map(report => {
          const { settlement, expectedLevel, currentCore, expectedCore } = report;
          const label = level => settlementLevelLabel(level || 'village', settlement.castle);
          return <div key={report.key} className="rounded border border-border p-3 text-xs space-y-1">
            <p className="font-semibold">{settlement.region || 'Unnamed settlement'} · {settlement.faction}</p>
            <p className="text-muted-foreground">{settlement.castle ? 'Castle' : 'City'} · Population {settlement.population}</p>
            {settlement.level !== expectedLevel && <p>Level: {label(settlement.level)} → {label(expectedLevel)}</p>}
            {JSON.stringify(currentCore) !== JSON.stringify(expectedCore) && <p className="break-words">Core building: <span className="font-mono">{currentCore.join(', ') || 'None'} → {expectedCore.join(', ') || 'Not required'}</span></p>}
          </div>;
        })}
      </div>
      <DialogFooter className="gap-2">
        <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
        <Button disabled={!changes.length} onClick={onApply}>Apply corrections ({changes.length})</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}