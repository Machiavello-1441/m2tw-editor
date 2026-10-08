import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import NewCharacterNameForm from '@/components/map/NewCharacterNameForm';
import { addCharacterName } from '@/lib/characterNames';

export default function CharacterNameSelect({ value, onChange, options, faction, section, descrNames, namesDisplayMap = {} }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [newDisplay, setNewDisplay] = useState(null);
  const display = key => namesDisplayMap[key] || key;
  const choices = [...new Set(options)].filter(key => `${key} ${display(key)}`.toLowerCase().includes(query.trim().toLowerCase()));
  const canAdd = faction && query.trim() && !options.some(key => display(key).toLowerCase() === query.trim().toLowerCase());
  const select = key => { onChange(key); setOpen(false); };
  return <div className="space-y-1">
    <Popover open={open} onOpenChange={next => { setOpen(next); setQuery(''); }}>
      <PopoverTrigger asChild>
        <button type="button" className="flex h-6 w-full items-center justify-between rounded border border-input bg-background px-1.5 text-[11px] text-foreground">
          <span className="truncate">{value ? display(value) : 'Select or add name…'}</span><ChevronDown className="h-3 w-3 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="dark z-[1101] w-[var(--radix-popover-trigger-width)] min-w-48 p-1 text-[11px]">
        <input aria-label="Search names" placeholder="Search display or internal name…" value={query} onChange={e => setQuery(e.target.value)} className="h-8 w-full border-b border-input bg-background px-1.5 text-foreground" />
        <div className="max-h-48 overflow-y-auto">
          <button type="button" onClick={() => select('')} className="w-full rounded px-2 py-1 text-left text-muted-foreground hover:bg-accent">— none —</button>
          {canAdd && <button type="button" onClick={() => { setNewDisplay(query.trim()); setOpen(false); }} className="w-full rounded px-2 py-1 text-left text-primary hover:bg-accent">+ new name “{query.trim()}”</button>}
          {choices.map(key => <button type="button" key={key} onClick={() => select(key)} className="block w-full rounded px-2 py-1 text-left text-foreground hover:bg-accent">{display(key)}{display(key) !== key && <span className="block font-mono text-[9px] text-muted-foreground">{key}</span>}</button>)}
          {!choices.length && !canAdd && <p className="p-2 text-muted-foreground">{faction ? 'Type a name to add it' : 'Select a faction first'}</p>}
        </div>
      </PopoverContent>
    </Popover>
    {value && <p className="text-[9px] font-mono text-muted-foreground">Internal: {value}</p>}
    {newDisplay !== null && <NewCharacterNameForm initialDisplay={newDisplay} faction={faction} section={section} onCancel={() => setNewDisplay(null)} onSave={(internalName, displayName) => {
      const key = addCharacterName({ faction, section, internalName, displayName, descrNames, namesDisplayMap });
      onChange(key); setNewDisplay(null);
    }} />}
  </div>;
}