import React, { useState } from 'react';
import { Plus, Trash2, Copy, Swords } from 'lucide-react';

const CATEGORY_COLORS = {
  infantry: 'text-blue-400',
  cavalry: 'text-amber-400',
  siege: 'text-red-400',
  ship: 'text-cyan-400',
};

export default function UnitList({ units, activeIndex, onSelect, onAdd, onDelete, onDuplicate }) {
  const [search, setSearch] = useState('');

  const filtered = units.map((u, i) => ({ u, i })).filter(({ u }) =>
    !search || u.type.toLowerCase().includes(search.toLowerCase()) || u.category.includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full">
      <div className="p-2 border-b border-border space-y-1.5 shrink-0">
        <div className="flex items-center gap-2">
          <Swords className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-semibold text-foreground flex-1">Units ({units.length})</span>
          <button onClick={onAdd} className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors" title="New unit">
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search units…"
          className="w-full h-6 px-2 text-[11px] bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
      <div className="flex-1 overflow-y-auto p-1 space-y-0.5">
        {filtered.map(({ u, i }) => (
          <div
            key={i}
            className={`group flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors ${activeIndex === i ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'}`}
            onClick={() => onSelect(i)}
          >
            <Swords className={`w-3 h-3 shrink-0 ${CATEGORY_COLORS[u.category] || 'text-muted-foreground'}`} />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-mono truncate">{u.type}</p>
              <p className="text-[9px] text-muted-foreground">{u.category} · {u.class}</p>
            </div>
            <div className="opacity-0 group-hover:opacity-100 flex gap-0.5">
              <button
                onClick={e => { e.stopPropagation(); onDuplicate(i); }}
                className="p-0.5 rounded hover:bg-accent"
                title="Duplicate"
              >
                <Copy className="w-3 h-3" />
              </button>
              <button
                onClick={e => { e.stopPropagation(); onDelete(i); }}
                className="p-0.5 rounded hover:bg-destructive/20 hover:text-destructive"
                title="Delete"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-[11px] text-muted-foreground text-center py-6">
            {search ? 'No matches.' : 'No units — load a file or add one.'}
          </p>
        )}
      </div>
    </div>
  );
}