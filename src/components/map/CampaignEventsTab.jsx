import React, { useState } from 'react';
import { Plus, Trash2, ChevronDown, ChevronRight, Download } from 'lucide-react';
import { EVENT_TYPES, serializeCampaignEvents } from './campaignEventsParser';
import { downloadBlob } from './tgaExporter';

const toCRLF = (text) => text.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');

const EVENT_ICONS = {
  historic: '📜', earthquake: '🌋', volcano: '🌋', flood: '🌊',
  storm: '⛈️', horde: '⚔️', dustbowl: '🌪️', locusts: '🦗', plague: '☣️',
};

function EventRow({ event, idx, regionNames, onChange, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const ev = event;
  const set = (key, val) => onChange(idx, { ...ev, [key]: val });

  const addPos = (val) => { if (!val) return; onChange(idx, { ...ev, positions: [...(ev.positions || []), val] }); };
  const removePos = (val) => onChange(idx, { ...ev, positions: ev.positions.filter(p => p !== val) });

  return (
    <div className="rounded border border-slate-700/40 bg-slate-900/20">
      <div className="flex items-center gap-1.5 px-2 py-1.5 cursor-pointer" onClick={() => setExpanded(v => !v)}>
        {expanded ? <ChevronDown className="w-3 h-3 text-slate-500" /> : <ChevronRight className="w-3 h-3 text-slate-500" />}
        <span className="text-base shrink-0">{EVENT_ICONS[ev.eventType] || '📌'}</span>
        <span className={`text-[9px] font-mono shrink-0 ${ev.eventType === 'historic' ? 'text-amber-500' : 'text-red-400'}`}>{ev.eventType}</span>
        <span className="text-[11px] font-mono flex-1 truncate text-slate-200">{ev.name || '—'}</span>
        <span className="text-[9px] text-slate-500 font-mono shrink-0">yr {ev.date}</span>
        <button onClick={e => { e.stopPropagation(); onDelete(idx); }}
          className="p-0.5 text-slate-600 hover:text-red-400 transition-colors">
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      {expanded && (
        <div className="border-t border-slate-700/40 px-2 py-2 space-y-1.5">
          {/* Type + Name */}
          <div className="grid grid-cols-2 gap-1.5">
            <div>
              <span className="text-[9px] text-slate-500">Event Type</span>
              <select value={ev.eventType} onChange={e => set('eventType', e.target.value)}
                className="w-full h-6 px-1 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200">
                {EVENT_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <span className="text-[9px] text-slate-500">Internal Name</span>
              <input value={ev.name} onChange={e => set('name', e.target.value)}
                placeholder="event_name"
                className="w-full h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 font-mono" />
            </div>
          </div>

          {/* Date */}
          <div>
            <span className="text-[9px] text-slate-500">Date (year offset, or range "128 144")</span>
            <input value={ev.date} onChange={e => set('date', e.target.value)}
              placeholder="50"
              className="w-full h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 font-mono" />
          </div>

          {/* Movie */}
          <div>
            <span className="text-[9px] text-slate-500">Movie (optional, relative to data/fmv/)</span>
            <input value={ev.movie || ''} onChange={e => set('movie', e.target.value)}
              placeholder="event/gunpowder_invented.bik"
              className="w-full h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 font-mono" />
          </div>

          {/* Positions */}
          <div>
            <span className="text-[9px] text-slate-500">Positions (x, y — optional)</span>
            <div className="space-y-0.5 mb-0.5">
              {(ev.positions || []).map((p, i) => (
                <div key={i} className="flex items-center gap-1">
                  <span className="text-[9px] text-slate-300 font-mono flex-1">{p}</span>
                  <button onClick={() => removePos(p)} className="text-slate-600 hover:text-red-400"><Trash2 className="w-2.5 h-2.5" /></button>
                </div>
              ))}
            </div>
            <PositionInput onAdd={addPos} />
          </div>

          {/* Hint */}
          <p className="text-[9px] text-slate-600 italic">
            Note: add matching strings in historic_events.txt.strings.bin with keys {'{'}NAME_TITLE{'}'} and {'{'}NAME_BODY{'}'}
          </p>
        </div>
      )}
    </div>
  );
}

function PositionInput({ onAdd }) {
  const [x, setX] = useState('');
  const [y, setY] = useState('');
  return (
    <div className="flex gap-1">
      <input type="number" value={x} onChange={e => setX(e.target.value)} placeholder="X"
        className="flex-1 h-5 px-1 text-[9px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 font-mono" />
      <input type="number" value={y} onChange={e => setY(e.target.value)} placeholder="Y"
        className="flex-1 h-5 px-1 text-[9px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 font-mono" />
      <button onClick={() => { if (x && y) { onAdd(`${x}, ${y}`); setX(''); setY(''); } }}
        className="text-[9px] px-1.5 rounded bg-slate-700/60 border border-slate-600/40 text-slate-300 hover:text-slate-100">+</button>
    </div>
  );
}

export default function CampaignEventsTab({ events, onEventsChange, regionNames }) {
  const handleChange = (idx, updated) => {
    const arr = [...events];
    arr[idx] = updated;
    onEventsChange(arr);
  };

  const handleDelete = (idx) => onEventsChange(events.filter((_, i) => i !== idx));

  const handleAdd = () => {
    onEventsChange([...(events || []), {
      eventType: 'historic',
      name: 'new_event',
      date: '100',
      positions: [],
      movie: '',
    }]);
  };

  const handleExport = () => {
    const text = toCRLF(serializeCampaignEvents(events));
    downloadBlob(new Blob([text], { type: 'text/plain' }), 'descr_events.txt');
  };

  // Sort by date for display (non-destructive)
  const sorted = [...(events || [])].sort((a, b) => {
    const da = parseInt(a.date) || 0;
    const db = parseInt(b.date) || 0;
    return da - db;
  });

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Campaign Events</p>
          <p className="text-[9px] text-slate-600 mt-0.5">descr_events.txt — date-triggered events</p>
        </div>
        <div className="flex gap-1">
          <button onClick={handleExport} disabled={!events?.length}
            className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded border text-[10px] transition-colors ${events?.length ? 'bg-amber-600/20 hover:bg-amber-600/40 border-amber-500/30 text-amber-400' : 'border-slate-700/30 text-slate-600 cursor-not-allowed opacity-40'}`}>
            <Download className="w-2.5 h-2.5" /> Export
          </button>
          <button onClick={handleAdd}
            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-slate-600/40 text-slate-300 hover:text-slate-100 text-[10px] bg-slate-700/40 transition-colors">
            <Plus className="w-2.5 h-2.5" /> Add
          </button>
        </div>
      </div>

      {(!events || events.length === 0) && (
        <div className="text-[10px] text-slate-600 text-center py-4 italic">
          No events loaded. Load descr_events.txt from the Campaign Files tab or add a new one.
        </div>
      )}

      <div className="space-y-1">
        {sorted.map((ev) => {
          const originalIdx = events.indexOf(ev);
          return (
            <EventRow
              key={originalIdx}
              event={ev}
              idx={originalIdx}
              regionNames={regionNames}
              onChange={handleChange}
              onDelete={handleDelete}
            />
          );
        })}
      </div>
    </div>
  );
}