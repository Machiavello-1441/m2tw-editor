import React, { useEffect, useState } from 'react';

const LABELS = { block: 'Solid 2×2 blocks', loop: 'Fork/rejoin loops', diagonal: 'Diagonal-only connections', isolated: 'Isolated pixels', short: 'Rivers shorter than 3 pixels', source_position: 'Invalid source positions', missing_source: 'Networks missing sources', missing_outlet: 'Networks missing outlets', impure: 'Impure river colours', inland_outlet: 'Inland outlets (review)', source_water: 'Sources on water (review)' };
export default function RiverIssueBrowser({ result, onSelect }) {
  const [cursor, setCursor] = useState({ type: 'all', index: -1 });
  useEffect(() => { setCursor({ type: 'all', index: -1 }); onSelect?.(null); }, [result, onSelect]);
  if (!result?.issues.length) return null;
  const locations = type => type === 'all' ? result.issues : result.issues.filter(issue => issue.type === type);
  const entries = locations(cursor.type), active = entries[cursor.index];
  const visit = (type, index) => {
    const list = locations(type); if (!list.length) return;
    const position = (index + list.length) % list.length;
    setCursor({ type, index: position }); onSelect?.(list[position]);
  };
  return <div className="space-y-1.5 text-[10px]">
    <p className="text-muted-foreground">Click a category repeatedly to cycle through all its locations.</p>
    {Object.entries(result.counts).map(([type, count]) => <button key={type} onClick={() => visit(type, cursor.type === type ? cursor.index + 1 : 0)} className={`block w-full text-left underline underline-offset-2 ${type === 'inland_outlet' || type === 'source_water' ? 'text-muted-foreground' : 'text-destructive'}`}>
      {LABELS[type] || type}: {count.toLocaleString()}
    </button>)}
    <div className="flex gap-1">
      <button onClick={() => visit(cursor.type, cursor.index < 0 ? entries.length - 1 : cursor.index - 1)} className="flex-1 rounded border bg-secondary text-secondary-foreground p-1">Previous</button>
      <button onClick={() => visit(cursor.type, cursor.index + 1)} className="flex-1 rounded border bg-secondary text-secondary-foreground p-1">Next</button>
      <button onClick={() => visit('all', cursor.type === 'all' ? cursor.index + 1 : 0)} className="flex-1 rounded border bg-secondary text-secondary-foreground p-1">All issues</button>
    </div>
    {active && <p role="status" className="rounded border p-1.5 text-foreground">{cursor.index + 1} / {entries.length} · ({active.x}, {active.y})<br />{active.desc}</p>}
  </div>;
}