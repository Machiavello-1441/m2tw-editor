import React from 'react';
import { Button } from '@/components/ui/button';

export default function BuildingRequirementResults({ result, onEdit }) {
  const errors = result.issues.filter(issue => issue.severity === 'error').length;
  const warnings = result.issues.length - errors;
  return <div className="space-y-2">
    <p role="status" className="text-xs">{result.checked} requirements scanned · {errors} broken references or invalid requirements · {warnings} unverified checks</p>
    {!result.issues.length && <p className="text-xs text-muted-foreground">No broken references found in the scanned requirements.</p>}
    {result.issues.length > 0 && <div className="max-h-96 overflow-y-auto space-y-2">
      {result.issues.map(issue => <div key={issue.id} className={issue.severity === 'error' ? 'rounded border border-destructive/40 bg-destructive/5 p-3 text-xs space-y-1' : 'rounded border border-border bg-muted p-3 text-xs space-y-1'}>
        <p className={issue.severity === 'error' ? 'font-semibold text-destructive' : 'font-semibold text-foreground'}>{issue.severity === 'error' ? 'Broken / invalid' : 'Needs verification'}: {issue.title}</p>
        {issue.context && <p className="font-mono text-[10px] break-words">{issue.context.building}{issue.context.level ? ` → ${issue.context.level}` : ''} · {issue.context.location}</p>}
        <p className="text-muted-foreground break-words">{issue.detail}</p>
        {issue.context && <Button size="sm" variant="outline" onClick={() => onEdit(issue.context)}>Edit building</Button>}
      </div>)}
    </div>}
  </div>;
}