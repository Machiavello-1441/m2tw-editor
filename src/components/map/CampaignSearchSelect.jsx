import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';

export default function CampaignSearchSelect({ value = '', onChange, options = [], placeholder = 'Select…', disabled = false, allowClear = true }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const choices = [...new Set(options)].filter(option => option.toLowerCase().includes(query.trim().toLowerCase()));
  const select = option => { onChange(option); setOpen(false); };
  return (
    <Popover open={open} onOpenChange={next => { setOpen(next); setQuery(''); }}>
      <PopoverTrigger asChild>
        <button type="button" disabled={disabled} aria-label={placeholder} className="flex h-6 w-full min-w-0 items-center justify-between gap-1 rounded border border-input bg-background px-1.5 text-left text-[11px] text-foreground disabled:opacity-40">
          <span className="truncate">{value || placeholder}</span><ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="dark w-[var(--radix-popover-trigger-width)] min-w-40 p-0 text-[11px]">
        <input value={query} onChange={event => setQuery(event.target.value)} aria-label="Search options" placeholder="Search…" className="h-8 w-full rounded-t-md border-b border-input bg-background px-2 text-foreground outline-none" />
        <div className="max-h-48 overflow-y-auto p-1">
          {allowClear && <button type="button" onClick={() => select('')} className="w-full rounded px-2 py-1 text-left text-muted-foreground hover:bg-accent">— none —</button>}
          {choices.map(option => <button type="button" key={option} onClick={() => select(option)} className={`block w-full rounded px-2 py-1 text-left font-mono hover:bg-accent ${value === option ? 'bg-accent text-accent-foreground' : 'text-foreground'}`}>{option}</button>)}
          {!choices.length && <p className="px-2 py-2 text-muted-foreground">No matches</p>}
        </div>
      </PopoverContent>
    </Popover>
  );
}