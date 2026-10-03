import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, Download, ShieldAlert, XCircle } from 'lucide-react';

const MAX_ROWS = 50;

function IssueRow({ issue }) {
  const isError = issue.severity === 'error';
  return (
    <div className={`flex items-start gap-2 p-2 rounded-lg border ${isError
      ? 'border-destructive/30 bg-destructive/5'
      : 'border-yellow-500/25 bg-yellow-500/5'}`}>
      {isError
        ? <XCircle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
        : <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 shrink-0 mt-0.5" />}
      <div className="min-w-0 flex-1">
        <p className={`text-[11px] font-medium ${isError ? 'text-destructive' : 'text-yellow-300'}`}>{issue.title}</p>
        {issue.detail && <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{issue.detail}</p>}
        {issue.category && (
          <p className="text-[9px] text-muted-foreground/70 mt-0.5 uppercase tracking-wider">{issue.category}</p>
        )}
      </div>
    </div>
  );
}

function IssueGroup({ label, issues, tone }) {
  if (!issues.length) return null;
  const shown = issues.slice(0, MAX_ROWS);
  return (
    <div className="space-y-1.5">
      <p className={`text-[10px] font-bold uppercase tracking-widest ${tone}`}>{label} · {issues.length}</p>
      {shown.map((issue) => <IssueRow key={issue.id} issue={issue} />)}
      {issues.length > shown.length && (
        <p className="text-[10px] text-muted-foreground pl-1">…and {issues.length - shown.length} more</p>
      )}
    </div>
  );
}

/**
 * Popup shown before the export runs, listing everything the automated
 * validation found so it can be corrected first.
 */
export default function ExportValidationDialog({ open, onOpenChange, result, onProceed, exportLabel }) {
  const errors = result?.errors || [];
  const warnings = result?.warnings || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <ShieldAlert className={`w-4 h-4 ${errors.length ? 'text-destructive' : 'text-yellow-400'}`} />
            Validation before export
          </DialogTitle>
        </DialogHeader>

        <p className="text-[11px] text-muted-foreground leading-relaxed">
          The automated check found{' '}
          <span className={errors.length ? 'text-destructive font-semibold' : 'text-foreground'}>
            {errors.length} error{errors.length !== 1 ? 's' : ''}
          </span>{' '}
          and{' '}
          <span className={warnings.length ? 'text-yellow-400 font-semibold' : 'text-foreground'}>
            {warnings.length} warning{warnings.length !== 1 ? 's' : ''}
          </span>
          . Fix what you can before exporting — invalid placements and broken references crash the
          campaign on load.
        </p>

        <ScrollArea className="max-h-[45vh] pr-2">
          <div className="space-y-4 py-1">
            <IssueGroup label="Errors" issues={errors} tone="text-destructive" />
            <IssueGroup label="Warnings" issues={warnings} tone="text-yellow-400" />
          </div>
        </ScrollArea>

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => onOpenChange(false)}>
            Back to fix
          </Button>
          <Button size="sm" className="h-8 text-xs gap-1.5" onClick={onProceed}>
            <Download className="w-3.5 h-3.5" />
            {exportLabel || 'Export anyway'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}