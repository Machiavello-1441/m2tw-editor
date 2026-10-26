import React, { useEffect, useState } from 'react';
import { ListChecks } from 'lucide-react';
import { getFile } from '@/lib/bigFileStore';
import { FILES_CHANGED_EVENT } from '@/lib/modFileRegistry';

export default function FactionNamesCheck({ names }) {
  const [checked, setChecked] = useState(false);
  const [raw, setRaw] = useState(() => getFile('m2tw_factions_file') || '');
  useEffect(() => {
    const refresh = () => setRaw(getFile('m2tw_factions_file') || '');
    window.addEventListener(FILES_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(FILES_CHANGED_EVENT, refresh);
  }, []);
  const factions = [...new Set(raw.split(/\r\n|\r|\n/).flatMap(line => {
    const match = line.replace(/;.*$/, '').trim().match(/^faction\s+([^\s,]+)/i);
    return match ? [match[1]] : [];
  }))];
  const byName = new Map(Object.entries(names).map(([name, data]) => [name.toLowerCase(), data]));
  const missing = factions.filter(name => !byName.has(name.toLowerCase()));
  const empty = factions.filter(name => {
    const data = byName.get(name.toLowerCase());
    return data && !['characters', 'surnames', 'females'].some(section => data[section]?.length);
  });
  return <div className="rounded border border-border bg-card p-3 text-xs text-foreground space-y-2">
    <button type="button" onClick={() => setChecked(true)} className="inline-flex items-center gap-2 rounded border border-border px-2.5 py-1.5 hover:bg-accent">
      <ListChecks className="h-3.5 w-3.5" /> Check faction names
    </button>
    {checked && <div role="status" className="space-y-1">
      {!factions.length ? <p>Load descr_sm_factions.txt to check faction names.</p> : <>
        <p>{factions.length - missing.length - empty.length} of {factions.length} factions have name entries.</p>
        {missing.length > 0 && <p><strong>Missing from descr_names.txt:</strong> {missing.join(', ')}</p>}
        {empty.length > 0 && <p><strong>Names list is empty:</strong> {empty.join(', ')}</p>}
        {!missing.length && !empty.length && <p>All factions in descr_sm_factions.txt have names in the list.</p>}
      </>}
    </div>}
  </div>;
}