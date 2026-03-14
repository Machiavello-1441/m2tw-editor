import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { WHEN_TO_TEST_OPTIONS } from './conditionDefs';

export default function WhenToTestSelect({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = WHEN_TO_TEST_OPTIONS.filter(o => o.toLowerCase().includes(query.toLowerCase()));

  const select = (opt) => { onChange(opt); setOpen(false); setQuery(''); };

  return (
    <div ref={ref} className="relative mt-0.5">
      <button
        type="button"
        onClick={() => setOpen(p => !p)}
        className="w-full flex items-center justify-between h-7 px-2 rounded bg-background border border-border text-xs font-mono text-white focus:outline-none focus:ring-1 focus:ring-primary"
      >
        <span className={value ? 'text-white' : 'text-muted-foreground'}>{value || 'Select event…'}</span>
        <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-card border border-border rounded shadow-xl overflow-hidden">
          <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-border">
            <Search className="w-3 h-3 text-muted-foreground shrink-0" />
            <input
              autoFocus
              className="flex-1 bg-transparent text-xs text-white placeholder-muted-foreground focus:outline-none"
              placeholder="Search event…"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
          <div className="max-h-56 overflow-y-auto">
            {filtered.length === 0 && (
              <p className="text-[11px] text-muted-foreground px-3 py-2">No matches</p>
            )}
            {filtered.map(opt => (
              <button
                key={opt}
                type="button"
                onClick={() => select(opt)}
                className={`w-full text-left px-3 py-1.5 text-xs font-mono hover:bg-accent transition-colors ${opt === value ? 'bg-primary/15 text-primary' : 'text-white'}`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}