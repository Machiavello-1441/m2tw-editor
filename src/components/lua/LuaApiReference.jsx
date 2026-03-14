import React, { useState, useMemo } from 'react';
import { EOP_API, EOP_EVENTS, API_CATEGORIES } from './m2tweop_api';
import { Search, Zap, BookOpen, ChevronDown, ChevronRight, Copy } from 'lucide-react';

function Badge({ children, color = 'blue' }) {
  const colors = {
    blue: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    green: 'bg-green-500/20 text-green-300 border-green-500/30',
    purple: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    orange: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
    gray: 'bg-secondary text-muted-foreground border-border',
  };
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono border ${colors[color]}`}>
      {children}
    </span>
  );
}

function ApiEntry({ entry, onInsert }) {
  const [open, setOpen] = useState(false);
  const catColor = { Core: 'blue', Limits: 'orange', Map: 'green', Faction: 'purple', GameState: 'gray', Texture: 'gray', Stratmap: 'green', Camera: 'blue', Models: 'orange', ImGUI: 'purple' };
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-accent/30 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        {open ? <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" /> : <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />}
        <code className="text-[12px] text-primary font-mono flex-1 truncate">{entry.sig}</code>
        <Badge color={catColor[entry.category] || 'gray'}>{entry.category}</Badge>
        {entry.returns && <Badge color="gray">{entry.returns}</Badge>}
      </button>
      {open && (
        <div className="px-3 pb-3 pt-1 bg-accent/10 border-t border-border space-y-2">
          <p className="text-xs text-muted-foreground">{entry.desc}</p>
          {entry.params && entry.params.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-semibold text-foreground uppercase tracking-wider">Parameters</p>
              {entry.params.map(p => (
                <div key={p.name} className="flex items-start gap-2 text-[11px]">
                  <code className="text-primary font-mono shrink-0">{p.name}</code>
                  <span className="text-muted-foreground font-mono shrink-0">({p.type})</span>
                  <span className="text-foreground/70">{p.desc}</span>
                </div>
              ))}
            </div>
          )}
          <button
            onClick={() => onInsert(entry.sig)}
            className="flex items-center gap-1.5 text-[11px] text-primary hover:text-primary/80 transition-colors"
          >
            <Copy className="w-3 h-3" />
            Insert into editor
          </button>
        </div>
      )}
    </div>
  );
}

function EventEntry({ event, onInsert }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-accent/30 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        {open ? <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" /> : <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />}
        <Zap className="w-3 h-3 text-green-400 shrink-0" />
        <code className="text-[12px] text-green-400 font-mono flex-1">{event.name}</code>
        <Badge color="green">event</Badge>
      </button>
      {open && (
        <div className="px-3 pb-3 pt-1 bg-accent/10 border-t border-border space-y-2">
          <p className="text-xs text-muted-foreground">{event.description}</p>
          {event.params.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-semibold text-foreground uppercase tracking-wider">Parameters</p>
              {event.params.map(p => (
                <div key={p.name} className="flex items-start gap-2 text-[11px]">
                  <code className="text-green-400 font-mono shrink-0">{p.name}</code>
                  <span className="text-muted-foreground font-mono shrink-0">({p.type})</span>
                  <span className="text-foreground/70">{p.desc}</span>
                </div>
              ))}
            </div>
          )}
          {event.example && (
            <div className="space-y-1">
              <p className="text-[10px] font-semibold text-foreground uppercase tracking-wider">Example</p>
              <pre className="bg-background rounded p-2 text-[11px] text-foreground/80 font-mono overflow-auto">{event.example}</pre>
            </div>
          )}
          <button
            onClick={() => onInsert(event.example || `function ${event.name}()\nend`)}
            className="flex items-center gap-1.5 text-[11px] text-green-400 hover:text-green-300 transition-colors"
          >
            <Copy className="w-3 h-3" />
            Insert into editor
          </button>
        </div>
      )}
    </div>
  );
}

export default function LuaApiReference({ onInsert }) {
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('api'); // 'api' | 'events'
  const [category, setCategory] = useState('All');

  const filteredApi = useMemo(() => {
    return EOP_API.filter(e => {
      const matchCat = category === 'All' || e.category === category;
      const matchSearch = !search || e.sig.toLowerCase().includes(search.toLowerCase()) || e.desc.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [search, category]);

  const filteredEvents = useMemo(() => {
    return EOP_EVENTS.filter(e =>
      !search || e.name.toLowerCase().includes(search.toLowerCase()) || e.description.toLowerCase().includes(search.toLowerCase())
    );
  }, [search]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-border space-y-2 shrink-0">
        <div className="flex items-center gap-2">
          <BookOpen className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="text-xs font-semibold text-foreground">M2TWEOP API Reference</span>
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search functions…"
            className="w-full h-7 pl-7 pr-3 text-xs bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="flex gap-1">
          <button onClick={() => setTab('api')} className={`flex-1 py-1 text-[11px] rounded font-medium transition-colors ${tab === 'api' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
            Functions ({EOP_API.length})
          </button>
          <button onClick={() => setTab('events')} className={`flex-1 py-1 text-[11px] rounded font-medium transition-colors ${tab === 'events' ? 'bg-green-500/20 text-green-400' : 'text-muted-foreground hover:text-foreground'}`}>
            Events ({EOP_EVENTS.length})
          </button>
        </div>
        {tab === 'api' && (
          <div className="flex gap-1 flex-wrap">
            {API_CATEGORIES.map(c => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`px-2 py-0.5 text-[10px] rounded transition-colors ${category === c ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {tab === 'api' ? (
          filteredApi.length > 0
            ? filteredApi.map(e => <ApiEntry key={e.sig} entry={e} onInsert={onInsert} />)
            : <p className="text-xs text-muted-foreground text-center py-8">No functions match your search.</p>
        ) : (
          filteredEvents.length > 0
            ? filteredEvents.map(e => <EventEntry key={e.name} event={e} onInsert={onInsert} />)
            : <p className="text-xs text-muted-foreground text-center py-8">No events match your search.</p>
        )}
      </div>
    </div>
  );
}