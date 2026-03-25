import React, { useState, useRef, useEffect } from 'react';

/**
 * Lightweight searchable dropdown.
 * Props:
 *   value: string
 *   onChange: (val: string) => void
 *   options: string[]
 *   placeholder?: string
 *   className?: string
 */
export default function SearchableCombobox({ value, onChange, options, placeholder = '', className = '' }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef();
  const inputRef = useRef();

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = query
    ? options.filter(o => o.toLowerCase().includes(query.toLowerCase()))
    : options;

  const BASE = 'flex items-center gap-1 w-full h-6 px-1.5 text-[11px] font-mono bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary';

  return (
    <div ref={ref} className={`relative ${className}`}>
      <div
        className={`${BASE} cursor-pointer justify-between`}
        onClick={() => { setOpen(o => !o); setTimeout(() => inputRef.current?.focus(), 0); }}
      >
        <span className={value ? 'text-foreground' : 'text-muted-foreground'}>
          {value || placeholder || '(none)'}
        </span>
        <span className="text-muted-foreground text-[9px]">▼</span>
      </div>
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-0.5 bg-card border border-border rounded shadow-lg max-h-52 flex flex-col">
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search…"
            className="h-7 px-2 text-[11px] font-mono bg-background border-b border-border focus:outline-none text-foreground shrink-0"
          />
          <div className="overflow-y-auto flex-1">
            {/* Allow clearing / empty */}
            <button
              className="w-full text-left px-2 py-1 text-[11px] text-muted-foreground hover:bg-accent transition-colors"
              onMouseDown={e => { e.preventDefault(); onChange(''); setOpen(false); }}
            >
              (none)
            </button>
            {filtered.length === 0 && (
              <div className="px-2 py-1.5 text-[11px] text-muted-foreground">No matches</div>
            )}
            {filtered.map(o => (
              <button
                key={o}
                className={`w-full text-left px-2 py-1 text-[11px] font-mono transition-colors hover:bg-accent ${o === value ? 'bg-primary/10 text-primary' : 'text-foreground'}`}
                onMouseDown={e => { e.preventDefault(); onChange(o); setOpen(false); }}
              >
                {o}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}