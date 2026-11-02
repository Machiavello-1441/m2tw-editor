import React, { useState } from 'react';
import { History, Undo2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export default function CampaignUndoControls({ entries, onUndo, disabled }) {
  const [open, setOpen] = useState(false);
  const undo = index => { setOpen(false); onUndo(index); };
  const buttonClass = 'flex items-center gap-1 rounded border border-border bg-secondary px-2 py-1 text-[10px] text-secondary-foreground hover:bg-accent disabled:text-muted-foreground';
  return <div className="flex items-center gap-1">
    <button type="button" onClick={() => undo(entries.length - 1)} disabled={disabled || !entries.length}
      title={entries.length ? `Undo: ${entries[entries.length - 1].label}` : 'No unsaved changes to undo'} className={buttonClass}>
      <Undo2 className="h-3 w-3" /> Undo {entries.length > 0 && <span>({entries.length})</span>}
    </button>
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild><button type="button" disabled={disabled} className={buttonClass} aria-label="Open undo history" title="Recent unsaved changes"><History className="h-3 w-3" /></button></PopoverTrigger>
      <PopoverContent align="end" className="dark z-[1101] w-80 p-3">
        <h3 className="text-xs font-semibold text-foreground">Undo history</h3>
        <p className="mt-1 text-[10px] text-muted-foreground">Up to 50 recent changes. Saving starts a new history.</p>
        {!entries.length ? <p className="py-5 text-center text-xs text-muted-foreground">No changes to undo.</p> :
          <ol className="mt-2 max-h-64 space-y-1 overflow-y-auto">
            {entries.map((entry, index) => <li key={entry.id}>
              <button type="button" onClick={() => undo(index)} title="Undo this change and all newer changes"
                className="flex w-full items-center justify-between gap-2 rounded px-2 py-2 text-left text-xs text-foreground hover:bg-accent">
                <span>{entry.label}</span><span className="shrink-0 text-[10px] text-muted-foreground">{new Date(entry.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </button>
            </li>).reverse()}
          </ol>}
        {!!entries.length && <p className="mt-2 text-[10px] text-muted-foreground">Choose a change to undo it and everything after it.</p>}
      </PopoverContent>
    </Popover>
  </div>;
}