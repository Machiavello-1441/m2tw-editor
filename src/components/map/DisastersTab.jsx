import React, { useState } from 'react';
import { Plus, Trash2, ChevronDown, ChevronRight, Upload, Download } from 'lucide-react';
import { DISASTER_TYPES, serializeDisasters } from './disastersParser';
import { downloadBlob } from './tgaExporter';

const toCRLF = (text) => text.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');

const DISASTER_ICONS = {
  earthquake: '🌋', volcano: '🌋', flood: '🌊', storm: '⛈️',
  dustbowl: '🌪️', locusts: '🦗', plague: '☣️', horde: '⚔️',
};

const KNOWN_CLIMATES = ['rocky_desert','desert','semi_arid','mediterranean','central_european','highland','northern_european','alpine','steppe','unused1','swamp'];

function DisasterRow({ disaster, idx, regionNames, onChange, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const d = disaster;
  const set = (key, val) => onChange(idx, { ...d, [key]: val });

  const addItem = (key, val) => {
    if (!val) return;
    onChange(idx, { ...d, [key]: [...(d[key] || []), val] });
  };
  const removeItem = (key, val) => onChange(idx, { ...d, [key]: d[key].filter(x => x !== val) });

  return (
    <div className="rounded border border-slate-700/40 bg-slate-900/20">
      <div className="flex items-center gap-1.5 px-2 py-1.5 cursor-pointer" onClick={() => setExpanded(v => !v)}>
        {expanded ? <ChevronDown className="w-3 h-3 text-slate-500" /> : <ChevronRight className="w-3 h-3 text-slate-500" />}
        <span className="text-base shrink-0">{DISASTER_ICONS[d.eventType] || '💥'}</span>
        <span className="text-[11px] font-mono flex-1 text-slate-200">{d.eventType}</span>
        <span className="text-[9px] text-slate-500 font-mono">every {d.frequency}y</span>
        {d.warning && <span className="text-[8px] text-amber-400 font-mono ml-1">warn</span>}
        <button onClick={e => { e.stopPropagation(); onDelete(idx); }}
          className="p-0.5 text-slate-600 hover:text-red-400 transition-colors">
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      {expanded && (
        <div className="border-t border-slate-700/40 px-2 py-2 space-y-1.5">
          {/* Event type */}
          <div>
            <span className="text-[9px] text-slate-500">Event Type</span>
            <select value={d.eventType} onChange={e => set('eventType', e.target.value)}
              className="w-full h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200">
              {DISASTER_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>

          {/* Frequency + scale */}
          <div className="grid grid-cols-3 gap-1">
            <div>
              <span className="text-[9px] text-slate-500">Frequency (years)</span>
              <input type="number" min={1} value={d.frequency} onChange={e => set('frequency', parseInt(e.target.value) || 1)}
                className="w-full h-6 px-1 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 font-mono" />
            </div>
            <div>
              <span className="text-[9px] text-slate-500">Min Scale</span>
              <input type="number" min={1} max={10} value={d.minScale} onChange={e => set('minScale', parseInt(e.target.value) || 1)}
                className="w-full h-6 px-1 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 font-mono" />
            </div>
            <div>
              <span className="text-[9px] text-slate-500">Max Scale</span>
              <input type="number" min={1} max={10} value={d.maxScale} onChange={e => set('maxScale', parseInt(e.target.value) || 1)}
                className="w-full h-6 px-1 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 font-mono" />
            </div>
          </div>

          {/* Booleans */}
          <div className="flex gap-3">
            {['winter','summer','warning'].map(flag => (
              <label key={flag} className="flex items-center gap-1 cursor-pointer">
                <input type="checkbox" checked={!!d[flag]} onChange={e => set(flag, e.target.checked)}
                  className="w-3 h-3 accent-amber-500" />
                <span className="text-[10px] text-slate-400 font-mono">{flag}</span>
              </label>
            ))}
          </div>

          {/* Climates */}
          <div>
            <span className="text-[9px] text-slate-500">Climates</span>
            <div className="flex flex-wrap gap-0.5 mb-0.5">
              {(d.climates || []).map(c => (
                <span key={c} className="flex items-center gap-0.5 px-1 py-0.5 bg-slate-800/60 rounded text-[9px] text-cyan-400 font-mono">
                  {c}<button onClick={() => removeItem('climates', c)} className="text-slate-600 hover:text-red-400 ml-0.5">×</button>
                </span>
              ))}
            </div>
            <select defaultValue="" onChange={e => { if (e.target.value) addItem('climates', e.target.value); }}
              className="w-full h-5 px-1 text-[9px] bg-slate-800 border border-slate-600/40 rounded text-slate-200">
              <option value="">+ add climate…</option>
              {KNOWN_CLIMATES.filter(c => !(d.climates||[]).includes(c)).map(c => <option key={c}>{c}</option>)}
            </select>
          </div>

          {/* Regions */}
          <div>
            <span className="text-[9px] text-slate-500">Regions</span>
            <div className="flex flex-wrap gap-0.5 mb-0.5">
              {(d.regions || []).map(r => (
                <span key={r} className="flex items-center gap-0.5 px-1 py-0.5 bg-slate-800/60 rounded text-[9px] text-green-400 font-mono">
                  {r}<button onClick={() => removeItem('regions', r)} className="text-slate-600 hover:text-red-400 ml-0.5">×</button>
                </span>
              ))}
            </div>
            {regionNames?.length > 0 ? (
              <select defaultValue="" onChange={e => { if (e.target.value) addItem('regions', e.target.value); }}
                className="w-full h-5 px-1 text-[9px] bg-slate-800 border border-slate-600/40 rounded text-slate-200">
                <option value="">+ add region…</option>
                {regionNames.filter(r => !(d.regions||[]).includes(r)).map(r => <option key={r}>{r}</option>)}
              </select>
            ) : (
              <RegionInputAdd onAdd={v => addItem('regions', v)} />
            )}
          </div>

          {/* Positions */}
          <div>
            <span className="text-[9px] text-slate-500">Positions (x, y)</span>
            <div className="space-y-0.5 mb-0.5">
              {(d.positions || []).map((p, i) => (
                <div key={i} className="flex items-center gap-1">
                  <span className="text-[9px] text-slate-300 font-mono flex-1">{p}</span>
                  <button onClick={() => removeItem('positions', p)} className="text-slate-600 hover:text-red-400"><Trash2 className="w-2.5 h-2.5" /></button>
                </div>
              ))}
            </div>
            <PositionInputAdd onAdd={v => addItem('positions', v)} />
          </div>
        </div>
      )}
    </div>
  );
}

function RegionInputAdd({ onAdd }) {
  const [val, setVal] = useState('');
  return (
    <div className="flex gap-1">
      <input value={val} onChange={e => setVal(e.target.value)} placeholder="REGION_NAME"
        className="flex-1 h-5 px-1 text-[9px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 font-mono" />
      <button onClick={() => { if (val.trim()) { onAdd(val.trim()); setVal(''); } }}
        className="text-[9px] px-1.5 rounded bg-slate-700/60 border border-slate-600/40 text-slate-300 hover:text-slate-100">+</button>
    </div>
  );
}

function PositionInputAdd({ onAdd }) {
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

export default function DisastersTab({ disasters, onDisastersChange, regionNames }) {
  const handleChange = (idx, updated) => {
    const arr = [...disasters];
    arr[idx] = updated;
    onDisastersChange(arr);
  };

  const handleDelete = (idx) => {
    onDisastersChange(disasters.filter((_, i) => i !== idx));
  };

  const handleAdd = () => {
    onDisastersChange([...(disasters || []), {
      eventType: 'earthquake',
      frequency: 20,
      winter: false,
      summer: false,
      warning: false,
      climates: [],
      regions: [],
      positions: [],
      minScale: 2,
      maxScale: 5,
    }]);
  };

  const handleExport = () => {
    const text = toCRLF(serializeDisasters(disasters));
    downloadBlob(new Blob([text], { type: 'text/plain' }), 'descr_disasters.txt');
  };

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Disasters</p>
          <p className="text-[9px] text-slate-600 mt-0.5">descr_disasters.txt — random events on the campaign map</p>
        </div>
        <div className="flex gap-1">
          <button onClick={handleExport} disabled={!disasters?.length}
            className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded border text-[10px] transition-colors ${disasters?.length ? 'bg-amber-600/20 hover:bg-amber-600/40 border-amber-500/30 text-amber-400' : 'border-slate-700/30 text-slate-600 cursor-not-allowed opacity-40'}`}>
            <Download className="w-2.5 h-2.5" /> Export
          </button>
          <button onClick={handleAdd}
            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-slate-600/40 text-slate-300 hover:text-slate-100 text-[10px] bg-slate-700/40 transition-colors">
            <Plus className="w-2.5 h-2.5" /> Add
          </button>
        </div>
      </div>

      {(!disasters || disasters.length === 0) && (
        <div className="text-[10px] text-slate-600 text-center py-4 italic">
          No disasters loaded. Load descr_disasters.txt or add a new one.
        </div>
      )}

      <div className="space-y-1">
        {(disasters || []).map((d, idx) => (
          <DisasterRow
            key={idx}
            disaster={d}
            idx={idx}
            regionNames={regionNames}
            onChange={handleChange}
            onDelete={handleDelete}
          />
        ))}
      </div>
    </div>
  );
}