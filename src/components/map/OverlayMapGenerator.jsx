import React, { useState, useCallback } from 'react';
import { Map, Download, Eye, EyeOff, Loader2 } from 'lucide-react';

// HSL (h in degrees, s/l in 0-1) → [r,g,b] 0-255
function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360 / 360;
  let r, g, b;
  if (s === 0) { r = g = b = l; }
  else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

// Build an overlay ImageData the same size as the regions TGA. Each region's
// pixels are coloured based on the selected key:
//   hidden  — region contains the hidden resource (red)
//   religion — shaded by religion percentage (darker = higher)
//   owner   — region currently owned by the selected faction (faction colour)
//   creator — region created by the selected faction (faction colour)
// Sea / unknown pixels stay transparent.
function buildOverlay(regionsLayer, regionsData, category, key, stratData, factionColors) {
  if (!regionsLayer?.data || !regionsData?.length || !key) return null;
  const { data, width, height } = regionsLayer;
  const overlay = new Uint8ClampedArray(width * height * 4);

  // RGB → value lookup
  const lookup = new Map();
  if (category === 'owner' || category === 'creator') {
    // regionName → faction (owner or creator)
    const facMap = new Map();
    for (const item of (stratData?.items || [])) {
      if (item.category !== 'settlement' || !item.region) continue;
      if (category === 'owner') facMap.set(item.region, item.faction || '');
      else facMap.set(item.region, item.factionCreator || '');
    }
    // Creator fallback: descr_regions.txt factionCreator for regions without a strat settlement
    if (category === 'creator') {
      for (const reg of regionsData) {
        if (!facMap.has(reg.regionName) && reg.factionCreator) facMap.set(reg.regionName, reg.factionCreator);
      }
    }
    for (const reg of regionsData) {
      const r = reg.r ?? reg.color_r, g = reg.g ?? reg.color_g, b = reg.b ?? reg.color_b;
      if (r == null || g == null || b == null) continue;
      lookup.set(`${r},${g},${b}`, facMap.get(reg.regionName) || '');
    }
  } else {
    for (const reg of regionsData) {
      const r = reg.r ?? reg.color_r, g = reg.g ?? reg.color_g, b = reg.b ?? reg.color_b;
      if (r == null || g == null || b == null) continue;
      const k = `${r},${g},${b}`;
      if (category === 'hidden') {
        lookup.set(k, (reg.resources || []).includes(key) ? 1 : 0);
      } else { // religion
        const rel = reg.religions || {};
        let pct = 0;
        if (Array.isArray(rel)) { const e = rel.find(x => x.name === key); pct = e ? (e.percentage ?? 0) : 0; }
        else if (typeof rel === 'object') pct = rel[key] ?? 0;
        lookup.set(k, Math.max(0, Math.min(100, Number(pct) || 0)));
      }
    }
  }

  // Faction colour for owner/creator overlays (fall back to a distinct default)
  const facColor = factionColors?.[key]?.primaryColor;
  const factionColor = facColor || (category === 'creator' ? { r: 245, g: 158, b: 11 } : { r: 16, g: 185, b: 129 });

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const v = lookup.get(`${r},${g},${b}`);
    if (v === undefined) continue; // sea / unknown → transparent
    if (category === 'hidden') {
      if (v === 1) { overlay[i] = 220; overlay[i + 1] = 60; overlay[i + 2] = 60; overlay[i + 3] = 210; }
    } else if (category === 'religion') {
      const l = 0.9 - (v / 100) * 0.6; // 0% → light, 100% → dark
      const [rr, gg, bb] = hslToRgb(210, 0.85, l);
      overlay[i] = rr; overlay[i + 1] = gg; overlay[i + 2] = bb; overlay[i + 3] = 200;
    } else { // owner / creator
      if (v === key) {
        overlay[i] = factionColor.r; overlay[i + 1] = factionColor.g; overlay[i + 2] = factionColor.b; overlay[i + 3] = 210;
      }
    }
  }
  return new ImageData(overlay, width, height);
}

function imageDataToBlob(imageData) {
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  canvas.getContext('2d').putImageData(imageData, 0, 0);
  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const CATEGORIES = [
  { id: 'hidden',   label: 'Hidden Resource' },
  { id: 'religion', label: 'Religion' },
  { id: 'owner',    label: 'Owning Faction' },
  { id: 'creator',  label: 'Faction Creator' },
];

const HINTS = {
  hidden:   'Red = regions that contain the resource.',
  religion: 'Darker shade = higher religion percentage.',
  owner:    'Coloured = regions currently owned by this faction.',
  creator:  'Coloured = regions created by this faction.',
};

export default function OverlayMapGenerator({
  regionsLayer,
  regionsData,
  hiddenResourceList = [],
  religionList = [],
  factionList = [],
  stratData = null,
  factionColors = null,
  onShowOverlay,
  onClearOverlay,
  active = false,
}) {
  const [category, setCategory] = useState('hidden');
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [doneMsg, setDoneMsg] = useState(null);

  const list = category === 'hidden' ? hiddenResourceList
    : category === 'religion' ? religionList
    : factionList;

  const generate = useCallback(async (forDownload) => {
    setError(null);
    setDoneMsg(null);
    if (!selected) { setError('Select an item from the list first.'); return; }
    if (!regionsLayer?.data) { setError('Regions TGA (map_regions.tga) is not loaded.'); return; }
    if (!regionsData?.length) { setError('descr_regions.txt is not loaded.'); return; }
    setBusy(true);
    try {
      const img = buildOverlay(regionsLayer, regionsData, category, selected, stratData, factionColors);
      if (!img) { setError('Overlay build returned no data.'); return; }
      const blob = await imageDataToBlob(img);
      if (!blob) { setError('Failed to encode PNG from overlay.'); return; }
      const suffix = category === 'owner' ? '_owner' : category === 'creator' ? '_creator' : '';
      const filename = `${selected}${suffix}.png`;
      if (forDownload) {
        downloadBlob(blob, filename);
        setDoneMsg(`Downloaded ${filename}`);
      } else {
        const url = URL.createObjectURL(blob);
        onShowOverlay({ url, name: filename, mode: category });
        setDoneMsg('Overlay shown on map');
      }
    } catch (err) {
      console.error('[OverlayMapGenerator] generate failed:', err);
      setError(`Error: ${err?.message || String(err)}`);
    } finally {
      setBusy(false);
    }
  }, [selected, regionsLayer, regionsData, category, stratData, factionColors, onShowOverlay]);

  const hasRegions = !!regionsLayer?.data && !!regionsData?.length;
  const hasList = list.length > 0;
  const needsStrat = category === 'owner' || category === 'creator';
  const stratLoaded = !needsStrat || !!(stratData?.items?.length);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <Map className="w-3.5 h-3.5 text-purple-400" />
        <span className="text-xs font-semibold text-slate-200">Overlay Maps</span>
      </div>
      <p className="text-[10px] text-slate-500 leading-relaxed">
        Colour-code every region by a hidden resource, religion, owning faction, or faction creator — show it on the map or download it as a PNG named after the key (e.g. <span className="font-mono">area_italy.png</span>, <span className="font-mono">england_owner.png</span>).
      </p>

      <select
        value={category}
        onChange={e => { setCategory(e.target.value); setSelected(''); }}
        className="w-full h-7 px-2 text-[11px] bg-slate-800 border border-slate-700 rounded text-slate-200"
      >
        {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
      </select>

      {!hasRegions && (
        <p className="text-[10px] text-slate-600">Load the regions TGA and descr_regions.txt first.</p>
      )}
      {hasRegions && needsStrat && !stratLoaded && (
        <p className="text-[10px] text-slate-600">Load descr_strat.txt to map faction ownership.</p>
      )}
      {hasRegions && (!needsStrat || stratLoaded) && !hasList && (
        <p className="text-[10px] text-slate-600">
          No {category === 'hidden' ? 'hidden resources' : category === 'religion' ? 'religions' : 'factions'} found — {category === 'hidden' ? 'load the EDB file' : category === 'religion' ? 'load descr_religions.txt' : 'load descr_strat.txt'}.
        </p>
      )}

      {hasRegions && hasList && (!needsStrat || stratLoaded) && (
        <>
          <select
            value={selected}
            onChange={e => setSelected(e.target.value)}
            className="w-full h-7 px-2 text-[11px] bg-slate-800 border border-slate-700 rounded text-slate-200"
          >
            <option value="">— select {CATEGORIES.find(c => c.id === category)?.label.toLowerCase()} —</option>
            {list.map(name => <option key={name} value={name}>{name}</option>)}
          </select>

          <div className="flex gap-1.5">
            <button
              onClick={() => generate(false)}
              disabled={!selected || busy}
              className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-[10px] font-semibold bg-slate-700 hover:bg-slate-600 text-slate-100 disabled:opacity-40 transition-colors"
            >
              {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Eye className="w-3 h-3" />} Show
            </button>
            <button
              onClick={() => generate(true)}
              disabled={!selected || busy}
              className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-[10px] font-semibold bg-slate-700 hover:bg-slate-600 text-slate-100 disabled:opacity-40 transition-colors"
            >
              {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />} PNG
            </button>
            {active && (
              <button
                onClick={onClearOverlay}
                title="Hide overlay"
                className="flex items-center justify-center gap-1 px-2 py-1.5 rounded text-[10px] font-semibold bg-slate-800 border border-slate-700 text-slate-300 hover:text-slate-100 transition-colors"
              >
                <EyeOff className="w-3 h-3" />
              </button>
            )}
          </div>

          <p className="text-[10px] text-slate-500">{HINTS[category]}</p>
        </>
      )}

      {error && (
        <p className="text-[10px] text-red-400 bg-red-500/10 border border-red-500/30 rounded px-2 py-1">{error}</p>
      )}
      {doneMsg && !error && (
        <p className="text-[10px] text-green-400">{doneMsg}</p>
      )}
    </div>
  );
}