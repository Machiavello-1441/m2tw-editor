import React, { useState } from 'react';
import { ExternalLink, RefreshCw, Check, Download, Mountain, Copy } from 'lucide-react';
import { LAYER_DEFS, getLayerDimensions } from '@/lib/mapLayerStore';

const OSM_OVERPASS = 'https://overpass-api.de/api/interpreter';
const OHM_OVERPASS = 'https://overpass.openhistoricalmap.org/api/interpreter';

async function fetchOverpass(query, endpoint) {
  const res = await fetch(endpoint, {
    method: 'POST',
    body: 'data=' + encodeURIComponent(query),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function makeBboxCanvas(bbox, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const toXY = (lat, lon) => [
    Math.round(((lon - bbox.west) / (bbox.east - bbox.west)) * (width - 1)),
    Math.round(((bbox.north - lat) / (bbox.north - bbox.south)) * (height - 1)),
  ];
  return { canvas, ctx, toXY };
}

export default function BboxLayerGenerator({ bbox, mapWidth, mapHeight, onLayerUpdate, onDone }) {
  const [status, setStatus] = useState('');
  const [generating, setGenerating] = useState(false);
  const [ohmYear, setOhmYear] = useState(1095);
  const ohmDate = `${ohmYear}-01-01`;
  const [generated, setGenerated] = useState({});
  const [copied, setCopied] = useState(false);

  const copyBbox = () => {
    const text = `N: ${bbox.north.toFixed(4)}  S: ${bbox.south.toFixed(4)}\nW: ${bbox.west.toFixed(4)}  E: ${bbox.east.toFixed(4)}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const bboxStr = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
  const ohmDateParam = `[date:"${ohmDate}"]`;

  const generateRivers = async () => {
    setStatus('Fetching rivers from OpenHistoricalMap…');

    const ohmQuery = `[out:json]${ohmDateParam}[bbox:${bboxStr}][timeout:60];
(
  way["waterway"~"^(river|stream|canal)$"];
);
out geom qt;`;

    // OSM fallback query
    const osmQuery = `[out:json][bbox:${bboxStr}][timeout:60];
(
  way["waterway"~"^(river|stream|canal)$"];
);
out geom qt;`;

    const def = LAYER_DEFS.find(d => d.id === 'map_features');
    const { width, height } = getLayerDimensions(def, mapWidth, mapHeight);
    const { canvas, ctx, toXY } = makeBboxCanvas(bbox, width, height);
    ctx.strokeStyle = '#0000ff';
    ctx.lineWidth = 1;

    let elements = [];
    let sourceLabel = 'OHM';

    try {
      const data = await fetchOverpass(ohmQuery, OHM_OVERPASS);
      elements = (data.elements || []).filter(e => e.geometry?.length > 1);
      if (elements.length === 0) throw new Error('No rivers in OHM');
    } catch (e) {
      setStatus('OHM unavailable — fetching OSM fallback…');
      sourceLabel = 'OSM';
      try {
        const data = await fetchOverpass(osmQuery, OSM_OVERPASS);
        elements = (data.elements || []).filter(e => e.geometry?.length > 1);
      } catch (e2) {
        setStatus(`Error fetching rivers: ${e2.message}`);
        return;
      }
    }

    elements.forEach(el => {
      ctx.beginPath();
      el.geometry.forEach(({ lat, lon }, i) => {
        const [x, y] = toXY(lat, lon);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.stroke();
    });

    setStatus(`Rivers generated (${elements.length} waterways from ${sourceLabel}).`);
    const imageData = ctx.getImageData(0, 0, width, height);
    onLayerUpdate('features', { imageData, visible: true, opacity: 0.9, dirty: true });
    setGenerated(p => ({ ...p, features: true }));
  };

  const handleImportFile = (layerId, file) => {
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      const def = LAYER_DEFS.find(d => d.id === layerId);
      const { width, height } = getLayerDimensions(def, mapWidth, mapHeight);
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, width, height);
      const imageData = ctx.getImageData(0, 0, width, height);
      onLayerUpdate(layerId, { imageData, visible: true, opacity: 0.85, dirty: true });
      setGenerated(p => ({ ...p, [layerId]: true }));
    };
    img.src = URL.createObjectURL(file);
  };

  const generateAll = async () => {
    setGenerating(true);
    await generateRivers();
    setGenerating(false);
    setStatus('Done. Import climates/ground types manually, then proceed to edit.');
  };

  return (
    <div className="space-y-4">
      {/* Bbox info */}
      <div className="bg-slate-800 rounded p-2 text-[10px] text-slate-400 space-y-0.5">
        <p className="text-slate-300 font-semibold mb-1">Bounding Box</p>
        <p>Lat: <span className="text-slate-200 font-mono">{bbox.south.toFixed(3)}° → {bbox.north.toFixed(3)}°</span></p>
        <p>Lng: <span className="text-slate-200 font-mono">{bbox.west.toFixed(3)}° → {bbox.east.toFixed(3)}°</span></p>
        <p>Output: <span className="text-amber-300 font-mono">{mapWidth}×{mapHeight}</span> (×2+1: <span className="text-amber-300 font-mono">{mapWidth*2+1}×{mapHeight*2+1}</span>)</p>
      </div>

      {/* OHM Date selector */}
      <div>
        <p className="text-[10px] text-slate-400 font-semibold mb-1.5 uppercase tracking-wider">Historical Date (OHM)</p>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] text-slate-500">500 AD</span>
          <span className="text-[11px] text-amber-300 font-mono font-semibold">{ohmYear} AD</span>
          <span className="text-[9px] text-slate-500">1600 AD</span>
        </div>
        <input
          type="range" min="500" max="1600" step="1"
          value={ohmYear}
          onChange={e => setOhmYear(Number(e.target.value))}
          className="w-full h-1.5 accent-amber-400 mb-1"
        />
        <div className="flex justify-between text-[8px] text-slate-600 px-0.5 mb-2">
          {[500,800,1000,1095,1200,1350,1500].map(y => (
            <button key={y} onClick={() => setOhmYear(y)}
              className={`transition-colors ${ohmYear === y ? 'text-amber-400' : 'hover:text-slate-400'}`}>
              {y}
            </button>
          ))}
        </div>
        <a href="https://www.openhistoricalmap.org/" target="_blank" rel="noreferrer"
          className="flex items-center gap-1.5 px-2 py-1.5 rounded text-[10px] bg-slate-800 border border-slate-600/50 text-amber-300 hover:bg-slate-700">
          <ExternalLink className="w-3 h-3" /> OpenHistoricalMap ↗
        </a>
      </div>

      {/* CotaMap heightmap workflow */}
      <div className="bg-amber-900/20 border border-amber-600/40 rounded-lg p-3 space-y-2.5">
        <div className="flex items-center gap-1.5 mb-1">
          <Mountain className="w-3.5 h-3.5 text-amber-400" />
          <p className="text-[11px] text-amber-300 font-bold uppercase tracking-wider">Heightmap via CotaMap</p>
        </div>
        <p className="text-[9px] text-slate-400 leading-relaxed">
          CotaMap generates real-world grayscale heightmaps. Enter your bbox coordinates in CotaMap's "Real Terrain" panel, export as PNG, then import it here.
        </p>

        {/* Bbox coords to copy */}
        <div className="bg-slate-900/60 rounded p-2 font-mono text-[10px] text-slate-300 space-y-0.5">
          <div className="flex justify-between"><span className="text-slate-500">North:</span><span className="text-amber-300">{bbox.north.toFixed(4)}°</span></div>
          <div className="flex justify-between"><span className="text-slate-500">South:</span><span className="text-amber-300">{bbox.south.toFixed(4)}°</span></div>
          <div className="flex justify-between"><span className="text-slate-500">West:</span> <span className="text-amber-300">{bbox.west.toFixed(4)}°</span></div>
          <div className="flex justify-between"><span className="text-slate-500">East:</span> <span className="text-amber-300">{bbox.east.toFixed(4)}°</span></div>
        </div>

        <button onClick={copyBbox}
          className={`w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-[10px] border transition-colors ${
            copied ? 'bg-green-800/30 border-green-600/40 text-green-300' : 'bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700'
          }`}>
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          {copied ? 'Copied!' : 'Copy Coordinates'}
        </button>

        <a href="https://cotamap.com/" target="_blank" rel="noreferrer"
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded text-[11px] bg-amber-600 border border-amber-500 text-white hover:bg-amber-500 transition-colors font-semibold">
          <ExternalLink className="w-3.5 h-3.5" /> Open CotaMap ↗
        </a>

        <ol className="text-[9px] text-slate-500 space-y-0.5 list-decimal list-inside leading-relaxed">
          <li>In CotaMap, click the <span className="text-amber-400 font-semibold">Globe</span> icon (Real Terrain)</li>
          <li>Enter the bbox coords above and generate</li>
          <li>Export as <span className="text-amber-400">PNG</span> (grayscale heightmap)</li>
          <li>Import it below as <span className="text-amber-400">Heights (PNG)</span></li>
        </ol>

        {/* Import the CotaMap heightmap */}
        <label className={`w-full flex items-center gap-2 px-2 py-2 rounded text-[11px] border cursor-pointer transition-colors font-semibold ${
          generated['heights']
            ? 'bg-green-800/30 border-green-600/40 text-green-300'
            : 'bg-slate-700 border-slate-600 text-slate-200 hover:bg-slate-600'
        }`}>
          {generated['heights'] ? <Check className="w-3.5 h-3.5 shrink-0" /> : <Download className="w-3.5 h-3.5 shrink-0" />}
          {generated['heights'] ? 'Heightmap Imported ✓' : 'Import CotaMap PNG → Heights'}
          <input type="file" accept="image/*" className="hidden" onChange={e => {
            handleImportFile('heights', e.target.files?.[0]);
            e.target.value = '';
          }} />
        </label>
      </div>

      {/* Auto-generate rivers */}
      <div>
        <p className="text-[10px] text-slate-400 font-semibold mb-1.5 uppercase tracking-wider">Auto-Generate Rivers</p>
        <p className="text-[9px] text-slate-500 mb-2">Fetches waterways from OHM (historical), falls back to OSM if unavailable.</p>
        <div className="space-y-1.5">
          <button onClick={generateAll} disabled={generating}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded text-[11px] bg-amber-600 border border-amber-500 text-white hover:bg-amber-500 disabled:opacity-50 transition-colors font-semibold">
            <RefreshCw className={`w-3.5 h-3.5 ${generating ? 'animate-spin' : ''}`} />
            Generate Rivers (OHM → OSM fallback)
          </button>
          {generated.features && (
            <p className="text-[10px] text-green-400 flex items-center gap-1"><Check className="w-3 h-3" /> Rivers generated</p>
          )}
        </div>
      </div>

      {/* Manual imports */}
      <div>
        <p className="text-[10px] text-slate-400 font-semibold mb-1 uppercase tracking-wider">Import Manually</p>
        <div className="space-y-1">
          <a href="https://soilexplorer.net/" target="_blank" rel="noreferrer"
            className="flex items-center gap-1.5 px-2 py-1.5 rounded text-[10px] bg-slate-800 border border-slate-600 text-amber-300 hover:bg-slate-700">
            <ExternalLink className="w-3 h-3" /> SoilExplorer → Ground Types
          </a>
        </div>
        <div className="space-y-1 mt-1.5">
          {[
            { id: 'climates', label: 'Climates (PNG)' },
            { id: 'ground', label: 'Ground Types (PNG)' },
          ].map(({ id, label }) => (
            <label key={id}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-[10px] border cursor-pointer transition-colors ${
                generated[id]
                  ? 'bg-green-800/30 border-green-600/40 text-green-300'
                  : 'bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700'
              }`}>
              {generated[id] ? <Check className="w-3 h-3 shrink-0" /> : null}
              {label}
              <input type="file" accept="image/*" className="hidden" onChange={e => {
                handleImportFile(id, e.target.files?.[0]);
                e.target.value = '';
              }} />
            </label>
          ))}
        </div>
      </div>

      {status && (
        <p className="text-[10px] text-amber-400 bg-amber-900/20 border border-amber-600/30 rounded px-2 py-1.5">{status}</p>
      )}

      <button onClick={onDone}
        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded text-[11px] bg-green-700 border border-green-600 text-white hover:bg-green-600 transition-colors font-semibold">
        <Check className="w-3.5 h-3.5" /> Proceed to Edit Layers →
      </button>
    </div>
  );
}