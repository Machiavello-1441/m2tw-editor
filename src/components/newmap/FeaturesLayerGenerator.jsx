import React, { useState, useRef } from 'react';
import { Check, Mountain, Download, Waves } from 'lucide-react';
import { LAYER_DEFS, getLayerDimensions } from '@/lib/mapLayerStore';
import HydroRiversPanel from '@/components/newmap/hydrorivers/HydroRiversPanel';

const OSM_OVERPASS_MIRRORS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

async function fetchOverpass(query) {
  let lastErr;
  for (const mirror of OSM_OVERPASS_MIRRORS) {
    try {
      const res = await fetch(mirror, {
        method: 'POST',
        body: 'data=' + encodeURIComponent(query),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) { lastErr = e; }
  }
  throw new Error(`All Overpass mirrors failed: ${lastErr?.message}`);
}

function latToMercN(lat) {
  return Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 180 / 2));
}

function makeToXY(bbox, W, H) {
  const mercNorth = latToMercN(bbox.north);
  const mercSouth = latToMercN(bbox.south);
  const mercRange = mercNorth - mercSouth;
  return (lat, lon) => [
    Math.round(((lon - bbox.west) / (bbox.east - bbox.west)) * (W - 1)),
    Math.round(((mercNorth - latToMercN(lat)) / mercRange) * (H - 1)),
  ];
}

function bresenhamLine(data, width, height, x0, y0, x1, y1, r, g, b) {
  let dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  let sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  while (true) {
    if (x0 >= 0 && x0 < width && y0 >= 0 && y0 < height) {
      const i = (y0 * width + x0) * 4;
      data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255;
    }
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x0 += sx; }
    if (e2 < dx) { err += dx; y0 += sy; }
  }
}





function StatusMsg({ msg }) {
  if (!msg) return null;
  const cls = msg.startsWith('✓') ? 'bg-green-900/20 border-green-600/30 text-green-400'
    : msg.startsWith('Error') ? 'bg-red-900/20 border-red-600/30 text-red-400'
    : 'bg-slate-800/60 border-slate-600/30 text-slate-400';
  return <p className={`text-[9px] px-2 py-1 rounded border ${cls}`}>{msg}</p>;
}

export default function FeaturesLayerGenerator({ bbox, mapWidth, mapHeight, onLayerUpdate, featuresLayer, heightLayer, onRiverPreviewChange }) {
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState({});

  const [cliffStatus, setCliffStatus] = useState('');
  const [volcanoStatus, setVolcanoStatus] = useState('');

  // Tracks the accumulated features ImageData across all sub-steps
  const featuresImageDataRef = useRef(null);

  const bboxStr = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;

  const getFeatDims = () => {
    const def = LAYER_DEFS.find(d => d.id === 'features');
    return def ? getLayerDimensions(def, mapWidth, mapHeight) : { width: mapWidth, height: mapHeight };
  };

  const downloadImageData = (imageData, filename) => {
    const canvas = document.createElement('canvas');
    canvas.width = imageData.width; canvas.height = imageData.height;
    canvas.getContext('2d').putImageData(imageData, 0, 0);
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png'); a.download = filename; a.click();
  };

  const applyHydroRivers = ({ imageData, hydroRiverPatch }) => {
    featuresImageDataRef.current = imageData;
    onLayerUpdate('features', { imageData, hydroRiverPatch, visible: true, opacity: 0.9, dirty: true });
  };

  // ── Cliffs ────────────────────────────────────────────────────────────────
  const generateCliffs = async () => {
    setCliffStatus('Fetching cliffs from OpenStreetMap…');
    const { width, height } = getFeatDims();
    const rToXY = makeToXY(bbox, width, height);
    const osmQuery = `[out:json][timeout:90];\n(\n  way["natural"="cliff"](${bboxStr});\n  relation["natural"="cliff"](${bboxStr});\n);\nout geom;`;

    let elements = [];
    try {
      const data = await fetchOverpass(osmQuery);
      elements = (data.elements || []).filter(e =>
        (e.type === 'way' && e.geometry?.length > 1) ||
        (e.type === 'relation' && e.members?.some(m => m.geometry?.length > 1))
      );
    } catch (e) { setCliffStatus(`Error: ${e.message}`); return; }

    if (!elements.length) { setCliffStatus('No cliffs found in this area.'); return; }

    const base = featuresLayer?.imageData || featuresImageDataRef.current
      || new ImageData(new Uint8ClampedArray(width * height * 4), width, height);
    const merged = new ImageData(new Uint8ClampedArray(base.data), width, height);
    const d = merged.data;

    for (const el of elements) {
      const segs = [];
      if (el.type === 'way') segs.push(el.geometry);
      else if (el.type === 'relation') for (const m of el.members) if (m.type === 'way' && m.geometry?.length > 1) segs.push(m.geometry);
      for (const seg of segs) {
        for (let s = 0; s < seg.length - 1; s++) {
          const [x0, y0] = rToXY(seg[s].lat, seg[s].lon);
          const [x1, y1] = rToXY(seg[s + 1].lat, seg[s + 1].lon);
          bresenhamLine(d, width, height, x0, y0, x1, y1, 255, 255, 0);
        }
      }
    }

    setCliffStatus(`✓ ${elements.length} cliff features painted (yellow).`);
    featuresImageDataRef.current = merged;
    onLayerUpdate('features', { imageData: merged, visible: true, opacity: 0.9, dirty: true });
    setGenerated(p => ({ ...p, cliffs: true }));
  };

  // ── Volcanoes ─────────────────────────────────────────────────────────────
  const generateVolcanoes = async () => {
    setVolcanoStatus('Fetching volcanoes from OpenStreetMap…');
    const { width, height } = getFeatDims();
    const rToXY = makeToXY(bbox, width, height);
    const osmQuery = `[out:json][timeout:60];\n(\n  node["natural"="volcano"](${bboxStr});\n  way["natural"="volcano"](${bboxStr});\n  relation["natural"="volcano"](${bboxStr});\n);\nout geom;`;

    let elements = [];
    try {
      const data = await fetchOverpass(osmQuery);
      elements = data.elements || [];
    } catch (e) { setVolcanoStatus(`Error: ${e.message}`); return; }

    if (!elements.length) { setVolcanoStatus('No volcanoes found in this area.'); return; }

    const base = featuresLayer?.imageData || featuresImageDataRef.current
      || new ImageData(new Uint8ClampedArray(width * height * 4), width, height);
    const merged = new ImageData(new Uint8ClampedArray(base.data), width, height);
    const d = merged.data;

    let count = 0;
    for (const el of elements) {
      let cx = null, cy = null;
      if (el.type === 'node') {
        [cx, cy] = rToXY(el.lat, el.lon);
      } else if (el.type === 'way' && el.geometry?.length > 0) {
        const lats = el.geometry.map(p => p.lat); const lons = el.geometry.map(p => p.lon);
        [cx, cy] = rToXY((Math.min(...lats) + Math.max(...lats)) / 2, (Math.min(...lons) + Math.max(...lons)) / 2);
      } else if (el.type === 'relation' && el.members) {
        const pts = el.members.flatMap(m => m.geometry || []);
        if (pts.length) {
          const lats = pts.map(p => p.lat); const lons = pts.map(p => p.lon);
          [cx, cy] = rToXY((Math.min(...lats) + Math.max(...lats)) / 2, (Math.min(...lons) + Math.max(...lons)) / 2);
        }
      }
      if (cx !== null && cx >= 0 && cx < width && cy >= 0 && cy < height) {
        const i = (cy * width + cx) * 4;
        d[i] = 255; d[i + 1] = 0; d[i + 2] = 0; d[i + 3] = 255;
        count++;
      }
    }

    setVolcanoStatus(`✓ ${count} volcano(es) marked (red pixel).`);
    featuresImageDataRef.current = merged;
    onLayerUpdate('features', { imageData: merged, visible: true, opacity: 0.9, dirty: true });
    setGenerated(p => ({ ...p, volcanoes: true }));
  };

  const run = async (fn) => { setGenerating(true); await fn(); setGenerating(false); };

  return (
    <div className="space-y-3">
      <p className="text-[9px] text-slate-500 leading-relaxed">
        Import rivers from HydroRIVERS; fetch cliffs and volcanoes from OSM. Manual painting remains available in the Layers tab.
      </p>

      <HydroRiversPanel bbox={bbox} mapWidth={mapWidth} mapHeight={mapHeight}
        featuresLayer={featuresLayer} heightLayer={heightLayer} onApply={applyHydroRivers} onRiverPreviewChange={onRiverPreviewChange} />

      {/* Cliffs */}
      <div className="border border-slate-700 rounded p-2.5 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-bold bg-yellow-700 text-white rounded-full w-4 h-4 flex items-center justify-center shrink-0">∧</span>
          <p className="text-[10px] text-slate-300 font-semibold">Cliffs</p>
          {generated.cliffs && <Check className="w-3 h-3 text-green-400 ml-auto" />}
        </div>
        <StatusMsg msg={cliffStatus} />
        <p className="text-[9px] text-slate-500">
          Fetches <code className="text-amber-300">natural=cliff</code> lines as yellow <code className="text-amber-300">(255,255,0)</code> on the features layer.
        </p>
        <button onClick={() => run(generateCliffs)} disabled={generating}
          className={`w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded text-[10px] border transition-colors disabled:opacity-50 font-semibold ${generated.cliffs ? 'bg-green-800/30 border-green-600/40 text-green-300 hover:bg-green-700/40' : 'bg-yellow-800 border-yellow-600 text-white hover:bg-yellow-700'}`}>
          <Mountain className={`w-3 h-3 ${generating ? 'animate-pulse' : ''}`} />
          {generated.cliffs ? '✓ Re-fetch Cliffs' : 'Fetch Cliffs'}
        </button>
      </div>

      {/* Volcanoes */}
      <div className="border border-slate-700 rounded p-2.5 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-bold bg-red-700 text-white rounded-full w-4 h-4 flex items-center justify-center shrink-0">▲</span>
          <p className="text-[10px] text-slate-300 font-semibold">Volcanoes</p>
          {generated.volcanoes && <Check className="w-3 h-3 text-green-400 ml-auto" />}
        </div>
        <StatusMsg msg={volcanoStatus} />
        <p className="text-[9px] text-slate-500">
          Fetches <code className="text-amber-300">natural=volcano</code> nodes and marks each centre as red <code className="text-amber-300">(255,0,0)</code>.
        </p>
        <button onClick={() => run(generateVolcanoes)} disabled={generating}
          className={`w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded text-[10px] border transition-colors disabled:opacity-50 font-semibold ${generated.volcanoes ? 'bg-green-800/30 border-green-600/40 text-green-300 hover:bg-green-700/40' : 'bg-red-800 border-red-600 text-white hover:bg-red-700'}`}>
          <Waves className={`w-3 h-3 ${generating ? 'animate-pulse' : ''}`} />
          {generated.volcanoes ? '✓ Re-fetch Volcanoes' : 'Fetch Volcanoes'}
        </button>
      </div>

      {/* Download combined features */}
      {featuresImageDataRef.current && (
        <button onClick={() => downloadImageData(featuresLayer?.imageData || featuresImageDataRef.current, 'map_features.png')}
          className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded text-[10px] border transition-colors font-semibold bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600">
          <Download className="w-3 h-3" /> Download Features Layer (PNG)
        </button>
      )}
    </div>
  );
}