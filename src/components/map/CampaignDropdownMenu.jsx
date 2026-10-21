import React, { useRef } from 'react';

export default function CampaignDropdownMenu({ options, current, query, setQuery, choose }) {
  const list = useRef(null);
  const move = event => {
    const buttons = [...list.current.querySelectorAll('button:not(:disabled)')];
    if (event.key === 'Enter' && event.target.tagName === 'INPUT') {
      event.preventDefault(); buttons[0]?.click();
    }
    if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
    event.preventDefault();
    const index = buttons.indexOf(document.activeElement);
    const next = index < 0 ? (event.key === 'ArrowDown' ? 0 : buttons.length - 1) : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next]?.focus();
  };
  const matches = options.filter(option => `${option.label} ${option.value} ${option.group}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <div onKeyDown={move}>
    <input autoFocus aria-label="Search options" placeholder="Search…" value={query} onChange={event => setQuery(event.target.value)} className="h-8 w-full border-b border-input bg-background px-2 text-xs text-foreground outline-none" />
    <div ref={list} role="listbox" aria-label="Options" className="max-h-60 overflow-y-auto p-1">
      {matches.map((option, index) => <button key={`${option.value}-${index}`} type="button" role="option" aria-selected={option.value === current} disabled={option.disabled} onClick={() => choose(option.value)} className={`block w-full rounded px-2 py-1.5 text-left text-xs hover:bg-accent focus:bg-accent focus:outline-none disabled:opacity-40 ${option.value === current ? 'bg-accent text-accent-foreground' : 'text-foreground'}`}>
        {option.group && <span className="mr-1 text-muted-foreground">{option.group}:</span>}{option.label}
      </button>)}
      {!matches.length && <p className="px-2 py-2 text-xs text-muted-foreground">No matches</p>}
    </div>
  </div>;
}