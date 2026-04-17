import React, { useState } from 'react';
import { Waves, Map, ExternalLink, RefreshCw, Check } from 'lucide-react';
import { LAYER_DEFS, getLayerDimensions } from '@/lib/mapLayerStore';

const OHM_OVERPASS = 'https://overpass.openhistoricalmap.org/api/interpreter';
const NE_OVERPASS = 'https://overpass-api.de/api/interpreter';

async function fetchOverpass(query, historical = false) {
  const endpoint = historical ? OHM_OVERPASS : NE_OVERPASS;
  const res = await fetch(endpoint, {
    method: 'POST',
    body: 'data=' + encodeURIComponent(query),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function uniqueColor(used) {
  let hex, tries = 0;
  do {
    const r = 30 + Math.floor(Math.random() * 200);
    const g = 30 + Math.floor(Math.random() * 200);
    const b = 30 + Math.floor(Math.random() * 200);
    hex = '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
    tries++;
  } while (used.has(hex) && tries < 2000);
  used.add(hex);
  return hex;
}

// Nearest-neighbor rasterizer — maps lat/lon within bbox to pixel coords
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
  // OHM date: year as number for slider, converted to ISO string for queries
  const [ohmYear, setOhmYear] = useState(1095);
  const ohmDate = `${ohmYear}-01-01`;
  const [generated, setGenerated] = useState({});

  const bboxStr = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
  const tangramUrl = `https://tangrams.github.io/heightmapper/#${((bbox.south + bbox.north) / 2).toFixed(2)},${((bbox.west + bbox.east) / 2).toFixed(2)},7`;
  const ohmDateParam = ohmDate ? `[date:"${ohmDate}"]` : '';

  const generateRegions = async () => {
    setStatus('Fetching administrative boundaries from OpenHistoricalMap…');
    const query = `[out:json]${ohmDateParam}[bbox:${bboxStr}][timeout:60];
(
  way["boundary"="administrative"]["admin_level"~"^[2-6]$"];
  relation["boundary"="administrative"]["admin_level"~"^[2-6]$"];
);
out geom qt;`;

    const def = LAYER_DEFS.find(d => d.id === 'map_regions');
    const { width, height } = getLayerDimensions(def, mapWidth, mapHeight);
    const { canvas, ctx, toXY } = makeBboxCanvas(bbox, width, height);
    const used = new Set(['#000000']);

    try {
      const data = await fetchOverpass(query, true);
      const elements = (data.elements || []).filter(e => e.geometry?.length > 2);
      if (elements.length === 0) throw new Error('No elements returned');

      elements.forEach(el => {
        const c = uniqueColor(used);
        ctx.fillStyle = c;
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.beginPath();
        el.geometry.forEach(({ lat, lon }, i) => {
          const [x, y] = toXY(lat, lon);
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      });
      setStatus(`Regions generated (${elements.length} OHM boundaries).`);
    } catch (e) {
      // Fallback: Natural Earth countries clipped to bbox
      setStatus('OHM unavailable — fetching Natural Earth fallback…');
      const res = await fetch('https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson');
      const geojson = await res.json();
      const drawRing = (ring) => {
        ctx.beginPath();
        ring.forEach(([lng, lat], i) => {
          const [x, y] = toXY(lat, lng);
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
        ctx.closePath();
        ctx.fill();
      };
      geojson.features.forEach(f => {
        ctx.fillStyle = uniqueColor(used);
        const g = f.geometry;
        if (g.type === 'Polygon') drawRing(g.coordinates[0]);
        else if (g.type === 'MultiPolygon') g.coordinates.forEach(p => drawRing(p[0]));
      });
      setStatus('Regions generated (Natural Earth fallback).');
    }

    const imageData = ctx.getImageData(0, 0, width, height);
    onLayerUpdate('map_regions', { imageData, visible: true, opacity: 0.85, dirty: true });
    setGenerated(p => ({ ...p, map_regions: true }));
  };

  const generateRivers = async () => {
    setStatus('Fetching rivers from OpenHistoricalMap…');
    const query = `[out:json]${ohmDateParam}[bbox:${bboxStr}][timeout:60];
(
  way["waterway"~"^(river|stream|canal)$"];
);
out geom qt;`;

    const def = LAYER_DEFS.find(d => d.id === 'map_features');
    const { width, height } = getLayerDimensions(def, mapWidth, mapHeight);
    const { canvas, ctx, toXY } = makeBboxCanvas(bbox, width, height);
    ctx.strokeStyle = '#1565c0';
    ctx.lineWidth = 2;

    // Rivers in map_features.tga must be pure blue RGB(0,0,255) per M2TW spec
    ctx.strokeStyle = '#0000ff';
    ctx.lineWidth = 1;

    try {
      const data = await fetchOverpass(query, true);
      const elements = (data.elements || []).filter(e => e.geometry?.length > 1);
      if (elements.length === 0) throw new Error('No rivers');

      elements.forEach(el => {
        ctx.beginPath();
        el.geometry.forEach(({ lat, lon }, i) => {
          const [x, y] = toXY(lat, lon);
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
        ctx.stroke();
      });
      setStatus(`Rivers generated (${elements.length} waterways).`);
    } catch (e) {
      // Natural Earth rivers fallback
      setStatus('OHM rivers unavailable — fetching Natural Earth fallback…');
      const res = await fetch('https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_rivers_lake_centerlines.geojson');
      const geojson = await res.json();
      geojson.features.forEach(f => {
        const coords = f.geometry?.type === 'LineString' ? [f.geometry.coordinates]
          : f.geometry?.type === 'MultiLineString' ? f.geometry.coordinates : [];
        coords.forEach(line => {
          ctx.beginPath();
          line.forEach(([lng, lat], i) => {
            const [x, y] = toXY(lat, lng);
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
          });
          ctx.stroke();
        });
      });
      setStatus('Rivers generated (Natural Earth fallback).');
    }

    const imageData = ctx.getImageData(0, 0, width, height);
    onLayerUpdate('map_features', { imageData, visible: true, opacity: 0.9, dirty: true });
    setGenerated(p => ({ ...p, map_features: true }));
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
    await generateRegions();
    await generateRivers();
    setGenerating(false);
    setStatus('Done. Import heightmap/climate manually below, then proceed to edit.');
  };

  const genBtn = (label, fn, key, blue = false) => (
    <button
      onClick={async () => { setGenerating(true); await fn(); setGenerating(false); }}
      disabled={generating}
      className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-[10px] border transition-colors disabled:opacity-50 ${
        generated[key]
          ? 'bg-green-800/40 border-green-600/50 text-green-300'
          : blue
            ? 'bg-blue-900/40 border-blue-600/40 text-blue-300 hover:bg-blue-800/40'
            : 'bg-slate-700 border-slate-600 text-slate-200 hover:bg-slate-600'
      }`}>
      {generated[key] ? <Check className="w-3 h-3" /> : null} {label}
    </button>
  );

  return (
    <div className="space-y-4">
      {/* Bbox info */}
      <div className="bg-slate-800 rounded p-2 text-[10px] text-slate-400 space-y-0.5">
        <p className="text-slate-300 font-semibold mb-1">Selected Bounding Box</p>
        <p>Lat: <span className="text-slate-200 font-mono">{bbox.south.toFixed(2)}° → {bbox.north.toFixed(2)}°</span></p>
        <p>Lng: <span className="text-slate-200 font-mono">{bbox.west.toFixed(2)}° → {bbox.east.toFixed(2)}°</span></p>
      </div>

      {/* OHM Date selector — timeline slider */}
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
        {/* Era tick marks */}
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

      {/* Auto-generate */}
      <div>
        <p className="text-[10px] text-slate-400 font-semibold mb-1.5 uppercase tracking-wider">Auto-Generate from OHM</p>
        <div className="space-y-1.5">
          <button onClick={generateAll} disabled={generating}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded text-[11px] bg-amber-600 border border-amber-500 text-white hover:bg-amber-500 disabled:opacity-50 transition-colors font-semibold">
            <RefreshCw className={`w-3.5 h-3.5 ${generating ? 'animate-spin' : ''}`} />
            Generate All Layers
          </button>
          <div className="flex gap-1">
            {genBtn('Regions', generateRegions, 'map_regions')}
            {genBtn('Rivers', generateRivers, 'map_features', true)}
          </div>
          <p className="text-[9px] text-slate-500">Data from <a href="https://openhistoricalmap.org" target="_blank" rel="noreferrer" className="text-amber-400 underline">OpenHistoricalMap</a> · falls back to Natural Earth if unavailable.</p>
        </div>
      </div>

      {/* Manual imports */}
      <div>
        <p className="text-[10px] text-slate-400 font-semibold mb-1 uppercase tracking-wider">Import Manually</p>
        <p className="text-[9px] text-slate-500 mb-1.5">Export a screenshot from each site matching your area, then import here.</p>
        <div className="space-y-1">
          <a href={tangramUrl} target="_blank" rel="noreferrer"
            className="flex items-center gap-1.5 px-2 py-1.5 rounded text-[10px] bg-slate-800 border border-slate-600 text-amber-300 hover:bg-slate-700">
            <ExternalLink className="w-3 h-3" /> Tangram Heightmapper
          </a>
          <a href="https://soilexplorer.net/" target="_blank" rel="noreferrer"
            className="flex items-center gap-1.5 px-2 py-1.5 rounded text-[10px] bg-slate-800 border border-slate-600 text-amber-300 hover:bg-slate-700">
            <ExternalLink className="w-3 h-3" /> SoilExplorer → Ground Types
          </a>
        </div>
        <div className="space-y-1 mt-1.5">
          {[
            { id: 'map_heights', label: 'Heights (PNG/TGA)' },
            { id: 'map_climates', label: 'Climates (PNG)' },
            { id: 'map_ground_types', label: 'Ground Types (PNG)' },
          ].map(({ id, label }) => (
            <label key={id}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-[10px] border cursor-pointer transition-colors ${
                generated[id]
                  ? 'bg-green-800/30 border-green-600/40 text-green-300'
                  : 'bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700'
              }`}>
              {generated[id] ? <Check className="w-3 h-3 shrink-0" /> : <Map className="w-3 h-3 shrink-0" />}
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