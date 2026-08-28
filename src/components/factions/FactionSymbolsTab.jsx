import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, Image } from 'lucide-react';
import { decodeTgaToDataUrl } from '@/components/shared/tgaDecoder';
import { getSymbol, setSymbol } from '@/lib/factionSymbolStore';
import SymbolGenerator from './SymbolGenerator';

const SYMBOL_GROUPS = [
  {
    label: 'Symbol 24',
    folder: 'data\\menu\\symbols\\fe_buttons_24',
    base: 24,
    slots: [
      { key: 'symbol24',        suffix: '',        filename: (f) => `symbol24_${f}.tga` },
      { key: 'symbol24_grey',   suffix: '_grey',   filename: (f) => `symbol24_${f}_grey.tga` },
      { key: 'symbol24_roll',   suffix: '_roll',   filename: (f) => `symbol24_${f}_roll.tga` },
      { key: 'symbol24_select', suffix: '_select', filename: (f) => `symbol24_${f}_select.tga` },
    ],
  },
  {
    label: 'Symbol 48',
    folder: 'data\\menu\\symbols\\fe_buttons_48',
    base: 48,
    slots: [
      { key: 'symbol48',        suffix: '',        filename: (f) => `symbol48_${f}.tga` },
      { key: 'symbol48_grey',   suffix: '_grey',   filename: (f) => `symbol48_${f}_grey.tga` },
      { key: 'symbol48_roll',   suffix: '_roll',   filename: (f) => `symbol48_${f}_roll.tga` },
      { key: 'symbol48_select', suffix: '_select', filename: (f) => `symbol48_${f}_select.tga` },
    ],
  },
  {
    label: 'Faction Unit',
    folder: 'data\\menu\\symbols\\fe_faction_units',
    slots: [
      { key: 'faction_unit', suffix: '', filename: (f) => `${f}.tga` },
    ],
  },
  {
    label: 'Symbol 80',
    folder: 'data\\menu\\symbols\\fe_symbols_80',
    base: 80,
    slots: [
      { key: 'symbol80', suffix: '', filename: (f) => `${f}.tga` },
    ],
  },
];

function SymbolSlot({ label, filename, imageUrl, onLoad, size }) {
  const inputRef = useRef();

  const handleFile = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const buffer = await file.arrayBuffer();
    const url = decodeTgaToDataUrl(buffer);
    if (url) onLoad(url, buffer);
    e.target.value = '';
  }, [onLoad]);

  return (
    <div className="flex flex-col items-center gap-1.5" style={size ? { width: Math.max(size, 64) } : undefined}>
      <div
        className={`relative rounded border border-slate-600 bg-slate-900 flex items-center justify-center cursor-pointer group overflow-hidden ${size ? '' : 'w-full aspect-square'}`}
        style={size ? { width: size, height: size } : { minWidth: 48, minHeight: 48 }}
        onClick={() => inputRef.current?.click()}
        title={`Load ${filename}`}
      >
        {imageUrl ? (
          <img src={imageUrl} alt={label} className="w-full h-full object-contain" style={{ imageRendering: 'pixelated' }} />
        ) : (
          <Image className="w-5 h-5 text-slate-600 group-hover:text-slate-400 transition-colors" />
        )}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <Upload className="w-4 h-4 text-white" />
        </div>
        <input ref={inputRef} type="file" accept=".tga" className="hidden" onChange={handleFile} />
      </div>
      <span className="text-[9px] text-slate-500 text-center leading-tight break-all">{filename}</span>
    </div>
  );
}

const pathFor = (group, slot, factionName) =>
  `${group.folder.replace(/\\/g, '/')}/${slot.filename(factionName)}`;

export default function FactionSymbolsTab({ factionName }) {
  // Store dataURLs keyed by slot key — restored from the shared symbol store
  // so previews survive switching factions (kept until a bulk download).
  const [images, setImages] = useState({});

  useEffect(() => {
    const restored = {};
    for (const group of SYMBOL_GROUPS) {
      for (const slot of group.slots) {
        const s = getSymbol(pathFor(group, slot, factionName));
        if (s?.dataUrl) restored[slot.key] = s.dataUrl;
      }
    }
    setImages(restored);
  }, [factionName]);

  const setImage = useCallback((key, url) => {
    setImages(prev => ({ ...prev, [key]: url }));
  }, []);

  return (
    <div className="space-y-5">
      <div className="border-b border-slate-600 pb-2">
        <p className="text-sm font-semibold text-slate-200">Faction Symbols</p>
        <p className="text-xs text-slate-400">Preview and load .tga symbol files for <span className="font-mono text-amber-400">{factionName}</span></p>
      </div>

      <SymbolGenerator factionName={factionName} />

      {SYMBOL_GROUPS.map((group) => (
        <div key={group.label} className="space-y-2">
          <div>
            <p className="text-[11px] font-semibold text-slate-300">{group.label}</p>
            <p className="text-[9px] text-slate-500 font-mono">{group.folder}</p>
          </div>
          <div className={`grid gap-3 ${group.slots.length === 4 ? 'grid-cols-4' : 'grid-cols-2'}`}>
            {group.slots.map((slot) => (
              <SymbolSlot
                key={slot.key}
                label={slot.key}
                filename={slot.filename(factionName)}
                imageUrl={images[slot.key] || null}
                onLoad={(url, buffer) => {
                  setSymbol(pathFor(group, slot, factionName), url, buffer);
                  setImage(slot.key, url);
                }}
              />
            ))}
          </div>
        </div>
      ))}

      <p className="text-[10px] text-slate-600 italic pt-1">
        Click any slot to load the corresponding .tga file. Loaded symbols stay in memory and are included in the bulk zip download.
      </p>
    </div>
  );
}