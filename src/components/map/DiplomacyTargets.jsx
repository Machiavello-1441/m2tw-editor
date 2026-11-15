import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export default function DiplomacyTargets({ value = [], options = [], onChange, single = false, label = 'Target factions' }) {
  const [open, setOpen] = useState(false), [query, setQuery] = useState('');
  const choices = [...new Set([...value, ...options])].filter(name => name && name.toLowerCase().includes(query.trim().toLowerCase()));
  const choose = name => {
    onChange(single ? [name] : value.includes(name) ? value.filter(target => target !== name) : [...value, name]);
    if (single) setOpen(false);
  };
  return <Popover open={open} onOpenChange={next => { setOpen(next); setQuery(''); }}>
    <PopoverTrigger asChild>
      <button type="button" aria-label={label} title={value.join(', ')} className="flex h-5 min-w-0 flex-1 items-center justify-between gap-1 rounded border border-input bg-background px-1 text-left text-[9px] text-foreground">
        <span className="truncate">{value.join(', ') || 'Choose targets…'}</span><ChevronDown className="h-3 w-3 shrink-0" />
      </button>
    </PopoverTrigger>
    <PopoverContent align="end" className="dark z-[1101] w-64 max-w-[calc(100vw-2rem)] p-0 text-xs">
      <input autoFocus type="search" aria-label={`Search ${label}`} placeholder="Search factions…" value={query} onChange={event => setQuery(event.target.value)} className="h-8 w-full border-b border-input bg-background px-2 text-foreground" />
      <p className="px-2 py-1 text-[10px] text-muted-foreground">{single ? 'Choose one suzerain.' : 'Choose multiple factions. Use × on the row to remove all.'}</p>
      <div className="max-h-60 overflow-y-auto p-1">
        {choices.map(name => <label key={name} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-accent">
          <input type="checkbox" checked={value.includes(name)} disabled={!single && value.length === 1 && value.includes(name)} onChange={() => choose(name)} />
          <span className="min-w-0 break-all font-mono">{name}</span>
        </label>)}
        {!choices.length && <p className="p-2 text-muted-foreground">No matching factions</p>}
      </div>
    </PopoverContent>
  </Popover>;
}