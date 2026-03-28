import React, { useState, useMemo } from 'react';
import { X, Search, Copy, BookMarked, ChevronDown, ChevronRight } from 'lucide-react';
import { SCRIPT_EVENTS, SCRIPT_CONDITIONS, SCRIPT_COMMANDS, CONSOLE_COMMANDS } from './scriptReferenceData';

const TABS = [
  { id: 'events', label: 'Events', color: 'text-sky-400', badge: 'bg-sky-500/20', data: SCRIPT_EVENTS },
  { id: 'conditions', label: 'Conditions', color: 'text-orange-400', badge: 'bg-orange-500/20', data: SCRIPT_CONDITIONS },
  { id: 'commands', label: 'Commands', color: 'text-green-400', badge: 'bg-green-500/20', data: SCRIPT_COMMANDS },
  { id: 'console', label: 'Console', color: 'text-violet-400', badge: 'bg-violet-500/20', data: CONSOLE_COMMANDS },
];

function EntryCard({ item, tab, onInsert }) {
  const [open, setOpen] = useState(false);

  const insertText = useMemo(() => {
    if (tab === 'events') return `monitor_event ${item.id} I_TurnNumber > 0\n  ; -- your conditions here\nend_monitor`;
    if (tab === 'conditions') return item.sample || item.id;
    if (tab === 'commands') return item.sample || item.id;
    if (tab === 'console') return item.sample || item.id;
    return item.id;
  }, [tab, item]);

  return (
    <div className="border-b border-slate-800/30">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full text-left px-4 py-2 hover:bg-slate-800/40 flex items-start gap-2"
      >
        {open ? <ChevronDown className="w-3 h-3 mt-0.5 shrink-0 text-slate-500" /> : <ChevronRight className="w-3 h-3 mt-0.5 shrink-0 text-slate-500" />}
        <div className="min-w-0">
          <div className="text-[11px] font-mono font-semibold text-slate-200 truncate">{item.id}</div>
          {item.description && <div className="text-[10px] text-slate-500 mt-0.5 leading-snug">{item.description}</div>}
        </div>
      </button>
      {open && (
        <div className="px-4 pb-2 space-y-1.5 bg-slate-950/30">
          {item.params && (
            <div className="text-[10px]">
              <span className="text-slate-600">params: </span>
              <span className="text-slate-300 font-mono">{item.params}</span>
            </div>
          )}
          {item.exports && (
            <div className="text-[10px]">
              <span className="text-slate-600">exports: </span>
              <span className="text-sky-300 font-mono">{item.exports}</span>
            </div>
          )}
          {item.requires && (
            <div className="text-[10px]">
              <span className="text-slate-600">requires: </span>
              <span className="text-amber-300 font-mono">{item.requires}</span>
            </div>
          )}
          {(item.context || item.usedIn) && (
            <div className="text-[10px]">
              <span className="text-slate-600">context: </span>
              <span className="text-purple-300">{item.context || item.usedIn}</span>
            </div>
          )}
          {item.sample && (
            <pre className="text-[10px] text-slate-400 bg-slate-950 rounded p-1.5 overflow-x-auto whitespace-pre border border-slate-800 mt-1">
              {item.sample}
            </pre>
          )}
          <button
            onClick={() => onInsert(insertText)}
            className="mt-1 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-medium bg-emerald-700/40 hover:bg-emerald-700/60 text-emerald-300 border border-emerald-600/30 transition-colors"
          >
            <Copy className="w-3 h-3" /> Insert
          </button>
        </div>
      )}
    </div>
  );
}

export default function ScriptReferenceSidebar({ onInsert, onClose }) {
  const [tab, setTab] = useState('events');
  const [search, setSearch] = useState('');

  const current = TABS.find(t => t.id === tab);

  const filtered = useMemo(() => {
    if (!search.trim()) return current.data;
    const q = search.toLowerCase();
    return current.data.filter(item =>
      item.id.toLowerCase().includes(q) ||
      item.description?.toLowerCase().includes(q) ||
      item.params?.toLowerCase().includes(q) ||
      item.exports?.toLowerCase().includes(q) ||
      item.sample?.toLowerCase().includes(q)
    );
  }, [current.data, search]);

  return (
    <div className="h-full flex flex-col bg-slate-900 border-l border-slate-700 w-80">
      {/* header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700 shrink-0">
        <div className="flex items-center gap-2">
          <BookMarked className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-semibold text-slate-200">Script Reference</span>
          <span className="text-[9px] text-slate-500">{filtered.length}</span>
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* tabs */}
      <div className="flex border-b border-slate-800 shrink-0">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setSearch(''); }}
            className={`flex-1 py-1.5 text-[9px] font-semibold border-b-2 transition-colors ${
              tab === t.id ? `border-current ${t.color}` : 'border-transparent text-slate-600 hover:text-slate-400'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* search */}
      <div className="px-3 py-2 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-slate-800 border border-slate-700">
          <Search className="w-3 h-3 text-slate-500 shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={`Search ${current.label.toLowerCase()}...`}
            className="bg-transparent text-xs text-slate-200 outline-none w-full placeholder:text-slate-600"
          />
        </div>
      </div>

      {/* list */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {filtered.length === 0 ? (
          <div className="p-6 text-center text-slate-500 text-xs">No results</div>
        ) : (
          filtered.map(item => (
            <EntryCard key={item.id} item={item} tab={tab} onInsert={onInsert} />
          ))
        )}
      </div>
    </div>
  );
}