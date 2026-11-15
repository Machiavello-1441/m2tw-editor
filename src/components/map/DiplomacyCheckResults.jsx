import React from 'react';

export default function DiplomacyCheckResults({ issues }) {
  const errors = issues.filter(issue => issue.severity === 'error').length;
  return <section aria-label="Diplomacy check results" aria-live="polite" className="space-y-1 rounded border border-border bg-card p-2 text-[10px]">
    <p className="font-semibold text-foreground">Diplomacy check: {errors} errors, {issues.length - errors} warnings</p>
    {!issues.length && <p className="text-muted-foreground">No diplomacy errors or discrepancies found.</p>}
    <ul className="max-h-48 space-y-1 overflow-y-auto pl-3">
      {issues.map(issue => <li key={issue.id} className={issue.severity === 'error' ? 'list-disc text-destructive' : 'list-disc text-muted-foreground'}>
        <span className="font-semibold">{issue.severity === 'error' ? 'Error' : 'Warning'}: </span>{issue.message}
      </li>)}
    </ul>
    <p className="text-muted-foreground">Checks both tabs and all factions, including hidden search results. This check does not change data.</p>
  </section>;
}