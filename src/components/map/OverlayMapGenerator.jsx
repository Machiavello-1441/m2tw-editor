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
// pixels are coloured based on the selected hidden resource (present/absent)
// or religion (shaded by percentage). Sea / unknown pixels stay transparent.
function buildOverlay(regionsLayer, regionsData, mode, key) {
  if (!regionsLayer?.data || !regionsData?.length || !key) return null;
  const { data, width, height } = regionsLayer;
  const overlay = new Uint8ClampedArray(width * height * 4);

  // Lookup: "r,g,b" → value (0/1 for hidden, 0-100 for religion)
  const lookup = new Map();
  for (const reg of regionsData) {
    const r = reg.r ?? reg.color_r;
    const g = reg.g ?? reg.color_g;
    const b = reg.b ?? reg.color_b;
    if (r == null || g == null || b == null) continue;
    const k = `${r},${g},${b}`;
    if (mode === 'hidden') {
      lookup.set(k, (reg.resources || []).includes(key) ? 1 : 0);
    } else {
      const rel = reg.religions || {};
      let pct = 0;
      if (Array.isArray(rel)) {
        const entry = rel.find(x => x.name === key);
        pct = entry ? (entry.percentage ?? 0) : 0;
      } else if (typeof rel === 'object') {
        pct = rel[key] ?? 0;
      }
      lookup.set(k, Math.max(0, Math.min(100, Number(pct) || 0)));
    }
  }

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const v = lookup.get(`${r},${g},${b}`);
    if (v === undefined) continue; // sea / unknown → transparent
    if (mode === 'hidden') {
      if (v === 1) {
        overlay[i] = 220; overlay[i + 1] = 60; overlay[i + 2] = 60; overlay[i + 3] = 210;
      }
    } else {
      // Lightness 0.90 (0%) → 0.30 (100%): darker = higher percentage
      const l = 0.9 - (v / 100) * 0.6;
      const [rr, gg, bb] = hslToRgb(210, 0.85, l);
      overlay[i] = rr; overlay[i + 1] = gg; overlay[i + 2] = bb; overlay[i + 3] = 200;
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

export default function OverlayMapGenerator({
  regionsLayer,
  regionsData,
  hiddenResourceList = [],
  religionList = [],
  onShowOverlay,
  onClearOverlay,
  active = false,
}) {
  const [mode, setMode] = useState('hidden'); // 'hidden' | 'religion'
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false);

  const list = mode === 'hidden' ? hiddenResourceList : religionList;

  const generate = useCallback(async (forDownload) => {
    if (!selected || !regionsLayer?.data) return;
    setBusy(true);
    try {
      const img = buildOverlay(regionsLayer, regionsData, mode, selected);
      if (!img) return;
      const blob = await imageDataToBlob(img);
      if (forDownload) {
        downloadBlob(blob, `${selected}.png`);
      } else {
        const url = URL.createObjectURL(blob);
        onShowOverlay({ url, name: selected, mode });
      }
    } finally {
      setBusy(false);
    }
  }, [selected, regionsLayer, regionsData, mode, onShowOverlay]);

  const hasRegions = !!regionsLayer?.data && !!regionsData?.length;
  const hasList = list.length > 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <Map className="w-3.5 h-3.5 text-purple-400" />
        <span className="text-xs font-semibold text-slate-200">Overlay Maps</span>
      </div>
      <p className="text-[10px] text-slate-500 leading-relaxed">
        Colour-code every region by a hidden resource or religion, show it on the map, or download it as a PNG named after the key (e.g. <span className="font-mono">area_italy.png</span>).
      </p>

      <div className="flex gap-1">
        <button
          onClick={() => { setMode('hidden'); setSelected(''); }}
          className={`flex-1 px-2 py-1 rounded text-[10px] font-semibold border transition-colors ${mode === 'hidden' ? 'bg-purple-600/30 border-purple-500/50 text-purple-200' : 'border-slate-700 text-slate-400 hover:text-slate-200'}`}
        >
          Hidden Resource
        </button>
        <button
          onClick={() => { setMode('religion'); setSelected(''); }}
          className={`flex-1 px-2 py-1 rounded text-[10px] font-semibold border transition-colors ${mode === 'religion' ? 'bg-blue-600/30 border-blue-500/50 text-blue-200' : 'border-slate-700 text-slate-400 hover:text-slate-200'}`}
        >
          Religion
        </button>
      </div>

      {!hasRegions && (
        <p className="text-[10px] text-slate-600">Load the regions TGA and descr_regions.txt first.</p>
      )}
      {hasRegions && !hasList && (
        <p className="text-[10px] text-slate-600">
          No {mode === 'hidden' ? 'hidden resources' : 'religions'} found — {mode === 'hidden' ? 'load the EDB file' : 'load descr_religions.txt'}.
        </p>
      )}

      {hasList && (
        <>
          <select
            value={selected}
            onChange={e => setSelected(e.target.value)}
            className="w-full h-7 px-2 text-[11px] bg-slate-800 border border-slate-700 rounded text-slate-200"
          >
            <option value="">— select {mode === 'hidden' ? 'hidden resource' : 'religion'} —</option>
            {list.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
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

          {mode === 'religion' && (
            <p className="text-[10px] text-slate-500">Darker shade = higher religion percentage.</p>
          )}
          {mode === 'hidden' && (
            <p className="text-[10px] text-slate-500">Red = regions that contain the resource.</p>
          )}
        </>
      )}
    </div>
  );
}