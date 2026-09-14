import React, { useState } from 'react';
import { Plus, Layers } from 'lucide-react';
import { CLIMATE_PALETTE } from '@/lib/mapLayerStore';
import { KOPPEN_ZONES, KOPPEN_RGB, rgbToHex } from '@/lib/koppenZones';
import { addCustomClimates } from '@/lib/climateStore';

const koppenId = (code) => `koppen_${code.toLowerCase()}`;

export default function CustomClimateForm() {
  const [sourceId, setSourceId] = useState(CLIMATE_PALETTE[0].id);
  const [id, setId] = useState('');
  const [label, setLabel] = useState('');
  const [color, setColor] = useState('#b200ff');
  const [koppen, setKoppen] = useState('');

  // Picking a Köppen zone pre-fills codename, label, colour AND source climate
  const pickKoppen = (code) => {
    setKoppen(code);
    const z = KOPPEN_ZONES.find(x => x.code === code);
    if (!z) return;
    setId(koppenId(code)); setLabel(`${z.label} (${code})`);
    setColor(rgbToHex(KOPPEN_RGB[code])); setSourceId(z.defaultClimate);
  };

  const add = () => {
    const clean = id.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (!clean) return;
    addCustomClimates([{ id: clean, label: label.trim() || clean, color, sourceId, koppenCode: koppen || undefined }]);
    setId(''); setLabel(''); setKoppen('');
  };

  const addAllKoppen = () => addCustomClimates(KOPPEN_ZONES.map(z => ({
    id: koppenId(z.code), label: `${z.label} (${z.code})`, color: rgbToHex(KOPPEN_RGB[z.code]),
    sourceId: z.defaultClimate, koppenCode: z.code,
  })));

  const inp = 'w-full h-6 px-1.5 text-[9px] bg-slate-800 border border-slate-600 rounded text-slate-200 focus:outline-none focus:border-amber-500';
  return (
    <div className="space-y-1.5">
      <select value={koppen} onChange={e => pickKoppen(e.target.value)} className={inp}>
        <option value="">Preset from Köppen zone… (optional)</option>
        {KOPPEN_ZONES.map(z => <option key={z.code} value={z.code}>{z.code} — {z.label}</option>)}
      </select>
      <div className="grid grid-cols-2 gap-1">
        <input value={id} onChange={e => setId(e.target.value)} placeholder="codename e.g. frozen_arctic" className={inp} />
        <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Display name" className={inp} />
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[9px] text-slate-500 shrink-0">Copy of</span>
        <select value={sourceId} onChange={e => setSourceId(e.target.value)} className={inp}>
          {CLIMATE_PALETTE.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
        <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-6 h-6 rounded border-0 bg-transparent cursor-pointer shrink-0" title="map_climates.tga colour" />
      </div>
      <div className="flex gap-1">
        <button onClick={add} disabled={!id.trim()}
          className="flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded text-[9px] bg-blue-700 border border-blue-600 text-white hover:bg-blue-600 disabled:opacity-50 font-semibold">
          <Plus className="w-3 h-3" /> Add climate
        </button>
        <button onClick={addAllKoppen} title="One custom climate per Köppen zone, using the official Köppen colours"
          className="flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded text-[9px] bg-slate-700 border border-slate-600 text-slate-200 hover:bg-slate-600 font-semibold">
          <Layers className="w-3 h-3" /> All Köppen zones
        </button>
      </div>
    </div>
  );
}