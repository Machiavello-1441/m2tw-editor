import React, { useState, useMemo, useRef } from 'react';
import { Plus, Trash2, ChevronDown, ChevronRight, Download, Upload, Image, X } from 'lucide-react';
import { EVENT_TYPES, serializeCampaignEvents } from './campaignEventsParser';
import { downloadBlob, exportTGA } from './tgaExporter';
import PositionPickerButton from './PositionPickerButton';
import ImageCropModal from '../edb/ImageCropModal';
import { getStringsBinStore } from '../../lib/stringsBinStore';
import { encodeStringsBin } from '../strings/stringsBinCodec';

const toCRLF = (text) => text.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');

const EVENT_ICONS = {
  historic: '📜', earthquake: '🌋', volcano: '🌋', flood: '🌊',
  storm: '⛈️', horde: '⚔️', dustbowl: '🌪️', locusts: '🦗', plague: '☣️',
};

// Read historic_events.txt.strings.bin from the strings store
function getHistoricEventStrings() {
  try {
    const store = getStringsBinStore();
    for (const [fname, binData] of Object.entries(store)) {
      if (fname.toLowerCase().includes('historic_events')) {
        const map = {};
        for (const { key, value } of (binData.entries || [])) {
          if (key) map[key.toUpperCase()] = value;
        }
        return { map, fname, entries: binData.entries || [] };
      }
    }
    // Also try sessionStorage
    const raw = sessionStorage.getItem('m2tw_historic_events_strings');
    if (raw) return { map: JSON.parse(raw), fname: null, entries: [] };
  } catch {}
  return { map: {}, fname: null, entries: [] };
}

function EventRow({ event, idx, onChange, onDelete, onPickFromMap }) {
  const [expanded, setExpanded] = useState(false);
  const [cropOpen, setCropOpen] = useState(false);
  const [pendingDataUrl, setPendingDataUrl] = useState(null);
  const [imgW, setImgW] = useState(256);
  const [imgH, setImgH] = useState(256);
  const fileRef = useRef();

  const ev = event;
  const set = (key, val) => onChange(idx, { ...ev, [key]: val });

  const addPos = (val) => { if (!val) return; onChange(idx, { ...ev, positions: [...(ev.positions || []), val] }); };
  const removePos = (val) => onChange(idx, { ...ev, positions: ev.positions.filter(p => p !== val) });

  // Strings from bin store
  const { map: stringsMap } = useMemo(() => getHistoricEventStrings(), []);
  const nameUpper = (ev.name || '').toUpperCase();
  const titleKey = `${nameUpper}_TITLE`;
  const bodyKey = `${nameUpper}_BODY`;

  const titleFromBin = stringsMap[titleKey] || '';
  const bodyFromBin = stringsMap[bodyKey] || '';

  // Title / body: stored on the event object for editing, fall back to bin store
  const titleValue = ev._title !== undefined ? ev._title : titleFromBin;
  const bodyValue = ev._body !== undefined ? ev._body : bodyFromBin;

  const handleImageFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const reader = new FileReader();
    reader.onload = (ev2) => {
      setPendingDataUrl(ev2.target.result);
      setCropOpen(true);
    };
    reader.readAsDataURL(file);
  };

  const handleCropConfirm = (dataUrl, canvas) => {
    setCropOpen(false);
    setPendingDataUrl(null);
    // Store the canvas pixel data as RGBA array for TGA export
    const ctx = canvas.getContext('2d');
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    set('_imageData', { data: Array.from(imgData.data), width: canvas.width, height: canvas.height, dataUrl });
  };

  const handleExportImage = () => {
    const img = ev._imageData;
    if (!img) return;
    const clampedData = new Uint8ClampedArray(img.data);
    const blob = exportTGA(clampedData, img.width, img.height);
    const fname = `${ev.name || 'event'}.tga`;
    downloadBlob(blob, fname);
  };

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

          {/* Title and Body from strings.bin */}
          <div>
            <div className="flex items-center gap-1 mb-0.5">
              <span className="text-[9px] text-slate-500">Title</span>
              <span className="text-[8px] text-cyan-600 font-mono">{titleKey}</span>
            </div>
            <input
              value={titleValue}
              onChange={e => set('_title', e.target.value)}
              placeholder={titleFromBin || 'Load historic_events.txt.strings.bin…'}
              className="w-full h-6 px-1.5 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200"
            />
          </div>
          <div>
            <div className="flex items-center gap-1 mb-0.5">
              <span className="text-[9px] text-slate-500">Body</span>
              <span className="text-[8px] text-cyan-600 font-mono">{bodyKey}</span>
            </div>
            <textarea
              value={bodyValue}
              onChange={e => set('_body', e.target.value)}
              placeholder={bodyFromBin || 'Enter event text…'}
              rows={3}
              className="w-full px-1.5 py-1 text-[11px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 resize-y font-mono"
            />
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

          {/* Picture / Image */}
          <div>
            <div className="flex items-center gap-1 mb-1">
              <span className="text-[9px] text-slate-500 uppercase font-semibold">Picture (.tga)</span>
              <div className="flex gap-1 ml-auto">
                {ev._imageData && (
                  <button onClick={handleExportImage}
                    className="flex items-center gap-0.5 h-5 px-1.5 rounded bg-amber-600/20 border border-amber-500/30 text-amber-400 hover:bg-amber-600/40 text-[9px] transition-colors">
                    <Download className="w-2.5 h-2.5" /> Export .tga
                  </button>
                )}
                {ev._imageData && (
                  <button onClick={() => set('_imageData', null)}
                    className="h-5 px-1 rounded bg-red-800/20 border border-red-600/30 text-red-400 hover:bg-red-800/40 text-[9px]">
                    <X className="w-2.5 h-2.5" />
                  </button>
                )}
                <label className="cursor-pointer flex items-center gap-0.5 h-5 px-1.5 rounded bg-slate-700/60 border border-slate-600/40 text-slate-300 hover:text-slate-100 text-[9px]">
                  <Upload className="w-2.5 h-2.5" />
                  {ev._imageData ? 'Replace' : 'Upload'}
                  <input ref={fileRef} type="file" accept="image/*,.tga" className="hidden" onChange={handleImageFile} />
                </label>
              </div>
            </div>
            {/* Size inputs */}
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[9px] text-slate-600">Size:</span>
              <input type="number" value={imgW} onChange={e => setImgW(parseInt(e.target.value) || 256)} min={1} max={1024}
                className="w-14 h-5 px-1 text-[9px] bg-slate-800 border border-slate-600/40 rounded text-slate-300 font-mono" />
              <span className="text-[9px] text-slate-600">×</span>
              <input type="number" value={imgH} onChange={e => setImgH(parseInt(e.target.value) || 256)} min={1} max={1024}
                className="w-14 h-5 px-1 text-[9px] bg-slate-800 border border-slate-600/40 rounded text-slate-300 font-mono" />
              <span className="text-[8px] text-slate-700 font-mono">px</span>
            </div>
            {ev._imageData ? (
              <img src={ev._imageData.dataUrl} alt="event" className="w-full max-h-24 object-contain rounded border border-slate-600/40" />
            ) : (
              <div className="flex items-center justify-center h-12 rounded border border-dashed border-slate-700/40 bg-slate-800/20">
                <Image className="w-4 h-4 text-slate-700" />
              </div>
            )}
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
            <PositionPickerButton onAdd={addPos} onPickFromMap={onPickFromMap} />
          </div>
        </div>
      )}

      {/* Image crop modal */}
      {cropOpen && pendingDataUrl && (
        <ImageCropModal
          open={cropOpen}
          onClose={() => { setCropOpen(false); setPendingDataUrl(null); }}
          onConfirm={handleCropConfirm}
          sourceDataUrl={pendingDataUrl}
          targetW={imgW}
          targetH={imgH}
          slotLabel={`${ev.name || 'event'} picture`}
        />
      )}
    </div>
  );
}

export default function CampaignEventsTab({ events, onEventsChange, onPickFromMap }) {
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

  // Export updated strings.bin with any edited title/body fields
  const handleExportStringsBin = () => {
    const { map: existing, entries: existingEntries, fname } = getHistoricEventStrings();
    const updated = { ...existing };
    for (const ev of (events || [])) {
      const nameUpper = (ev.name || '').toUpperCase();
      if (ev._title !== undefined) updated[`${nameUpper}_TITLE`] = ev._title;
      if (ev._body !== undefined) updated[`${nameUpper}_BODY`] = ev._body;
    }
    const entries = Object.entries(updated).map(([key, value]) => ({ key, value }));
    const buf = encodeStringsBin(entries);
    downloadBlob(new Blob([buf]), fname || 'historic_events.txt.strings.bin');
  };

  const hasStringsEdits = (events || []).some(ev => ev._title !== undefined || ev._body !== undefined);

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
        <div className="flex gap-1 flex-wrap justify-end">
          {hasStringsEdits && (
            <button onClick={handleExportStringsBin}
              className="flex items-center gap-0.5 px-1.5 py-0.5 rounded border text-[10px] bg-cyan-600/20 hover:bg-cyan-600/40 border-cyan-500/30 text-cyan-400 transition-colors">
              <Download className="w-2.5 h-2.5" /> Strings
            </button>
          )}
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
              onChange={handleChange}
              onDelete={handleDelete}
              onPickFromMap={onPickFromMap}
            />
          );
        })}
      </div>
    </div>
  );
}