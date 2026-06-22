import React, { useState } from 'react';
import { RefreshCw, Check, Download, AlertCircle, Waves } from 'lucide-react';
import { LAYER_DEFS, getLayerDimensions } from '@/lib/mapLayerStore';
import { rasterizeTiles } from './TileRasterizer';

// Tile URL templates to rasterize
const RASTER_SOURCES = [
  {
    id: 'heights',
    label: 'Heightmap (Terrarium)',
    url: 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
    grayscale: true,
  },
  {
    id: 'topo_ref',
    label: 'Topographic (OpenTopoMap)',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
  },
];

function getRasterSize(layerId, mapWidth, mapHeight) {
  if (layerId === 'heights' || layerId === 'topo_ref') {
    return { width: mapWidth * 2 + 1, height: mapHeight * 2 + 1 };
  }
  return { width: mapWidth, height: mapHeight };
}

const OSM_OVERPASS = 'https://overpass-api.de/api/interpreter';

/**
 * Flood-fill from all 4 border edges outward, marking "sea" pixels.
 * A pixel is sea-eligible if it has NOT been painted as land (i.e. it's still black/transparent or very dark).
 * After flood fill, all visited pixels become blue (0,0,255).
 * All remaining land pixels are clamped to minimum brightness 1,1,1.
 */
function applyCoastlineFill(imageData) {
  const { width, height, data } = imageData;

  const isLand = (i) => {
    // A pixel drawn by the coastline polygon fill or the grayscale heightmap is "land" if it's not sea-blue
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    if (a === 0) return false; // transparent = not yet determined
    // Pure blue = already sea
    if (r === 0 && g === 0 && b === 255) return false;
    // Anything else with alpha > 0 = land
    return true;
  };

  // Flood-fill from all border pixels that are NOT land
  const visited = new Uint8Array(width * height);
  const queue = [];

  const enqueue = (x, y) => {
    const idx = y * width + x;
    if (visited[idx]) return;
    const i = idx * 4;
    if (isLand(i)) return;
    visited[idx] = 1;
    queue.push(x, y);
  };

  for (let x = 0; x < width; x++) { enqueue(x, 0); enqueue(x, height - 1); }
  for (let y = 0; y < height; y++) { enqueue(0, y); enqueue(width - 1, y); }

  let qi = 0;
  while (qi < queue.length) {
    const x = queue[qi++], y = queue[qi++];
    const i = (y * width + x) * 4;
    data[i] = 0; data[i + 1] = 0; data[i + 2] = 255; data[i + 3] = 255;
    if (x > 0) enqueue(x - 1, y);
    if (x < width - 1) enqueue(x + 1, y);
    if (y > 0) enqueue(x, y - 1);
    if (y < height - 1) enqueue(x, y + 1);
  }

  // Clamp all remaining non-sea pixels to minimum 1,1,1 (M2TW land requirement)
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    if (a > 0 && !(r === 0 && g === 0 && b === 255)) {
      // Land pixel — ensure at least (1,1,1)
      if (r === 0 && g === 0 && b === 0) {
        data[i] = 1; data[i + 1] = 1; data[i + 2] = 1; data[i + 3] = 255;
      }
    }
  }

  return imageData;
}

// River detail levels: what waterway types to include
const RIVER_DETAIL_LEVELS = [
  { id: 'major',  label: 'Major rivers only',      filter: 'river' },
  { id: 'medium', label: 'Rivers + canals',         filter: 'river|canal' },
  { id: 'all',    label: 'Rivers, streams & canals', filter: 'river|stream|canal' },
];

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

/**
 * Post-process river ImageData:
 * - All river pixels become pure blue (0, 0, 255)
 * - Remove any river pixel that has more than 2 river neighbors (8-directional)
 *   by iterating until stable (max 5 passes)
 */
function postProcessRivers(imageData) {
  const { width, height, data } = imageData;

  const isRiver = (i) => data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 255 && data[i + 3] > 0;

  // First: set starting pixel (top-left-most river pixel) to white (255,255,255)
  // and ensure all river pixels are pure blue
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    // Any blue-dominant pixel → pure blue river
    if (a > 0 && b > 100 && b > r + 20 && b > g + 20) {
      data[i] = 0; data[i + 1] = 0; data[i + 2] = 255; data[i + 3] = 255;
    }
  }

  // Find the first river pixel (top-to-bottom, left-to-right) → mark as white (origin)
  let originSet = false;
  for (let y = 0; y < height && !originSet; y++) {
    for (let x = 0; x < width && !originSet; x++) {
      const i = (y * width + x) * 4;
      if (isRiver(i)) {
        data[i] = 255; data[i + 1] = 255; data[i + 2] = 255; data[i + 3] = 255;
        originSet = true;
      }
    }
  }

  // Thin rivers: remove pixels with > 2 river neighbors, up to 5 passes
  for (let pass = 0; pass < 5; pass++) {
    let changed = false;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        if (!isRiver(i)) continue;
        let count = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
            const ni = (ny * width + nx) * 4;
            if (isRiver(ni)) count++;
          }
        }
        if (count > 2) {
          data[i] = 0; data[i + 1] = 0; data[i + 2] = 0; data[i + 3] = 0;
          changed = true;
        }
      }
    }
    if (!changed) break;
  }

  return imageData;
}

export default function BboxLayerGenerator({ bbox, mapWidth, mapHeight, onLayerUpdate, onDone }) {
  const [status, setStatus] = useState('');
  const [generating, setGenerating] = useState(false);
  const [rasterProgress, setRasterProgress] = useState({});
  const [generated, setGenerated] = useState({});
  const [riverDetail, setRiverDetail] = useState('major');

  const bboxStr = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;

  const generateRivers = async () => {
    const detail = RIVER_DETAIL_LEVELS.find(d => d.id === riverDetail) ?? RIVER_DETAIL_LEVELS[0];
    setStatus(`Fetching rivers from OpenStreetMap (${detail.label})…`);

    // Fetch both ways AND relations (river relations group ways into continuous rivers)
    const osmQuery = `[out:json][timeout:90];
(
  way["waterway"~"^(${detail.filter})$"](${bboxStr});
  relation["waterway"~"^(${detail.filter})$"](${bboxStr});
);
out geom;`;

    const def = LAYER_DEFS.find(d => d.id === 'features') ?? LAYER_DEFS.find(d => d.id === 'map_features');
    const { width, height } = def
      ? getLayerDimensions(def, mapWidth, mapHeight)
      : { width: mapWidth, height: mapHeight };
    const { canvas, ctx, toXY } = makeBboxCanvas(bbox, width, height);

    ctx.clearRect(0, 0, width, height);

    let elements = [];
    try {
      const data = await fetchOverpass(osmQuery, OSM_OVERPASS);
      elements = (data.elements || []).filter(e =>
        (e.type === 'way' && e.geometry?.length > 1) ||
        (e.type === 'relation' && e.members?.some(m => m.geometry?.length > 1))
      );
    } catch (e) {
      setStatus(`Error fetching rivers: ${e.message}`);
      return;
    }

    if (elements.length === 0) {
      setStatus('No waterways found in this area for the selected detail level.');
      return;
    }

    // Collect all polylines (each is an array of {lat,lon} points)
    const polylines = [];
    for (const el of elements) {
      if (el.type === 'way' && el.geometry?.length > 1) {
        polylines.push(el.geometry);
      } else if (el.type === 'relation' && el.members) {
        for (const m of el.members) {
          if (m.type === 'way' && m.geometry?.length > 1) {
            polylines.push(m.geometry);
          }
        }
      }
    }

    // Chain polylines: connect segments that share an endpoint (within 1 coordinate unit)
    // This merges disconnected OSM ways belonging to the same river into continuous strokes.
    const key = (pt) => `${pt.lat.toFixed(5)},${pt.lon.toFixed(5)}`;
    const chains = chainPolylines(polylines);

    // Draw chains with round caps/joins for continuous coverage
    ctx.strokeStyle = 'rgb(0,0,255)';
    ctx.lineWidth = 1;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const chain of chains) {
      if (chain.length < 2) continue;
      ctx.beginPath();
      chain.forEach(({ lat, lon }, i) => {
        // Snap to pixel centers to avoid sub-pixel gaps
        const [x, y] = toXY(lat, lon);
        i === 0 ? ctx.moveTo(x + 0.5, y + 0.5) : ctx.lineTo(x + 0.5, y + 0.5);
      });
      ctx.stroke();
    }

    // Post-process: enforce 1px constraint and set origin pixel to white
    const imageData = ctx.getImageData(0, 0, width, height);
    postProcessRivers(imageData);

    setStatus(`Rivers generated (${chains.length} chains from ${polylines.length} segments, ${detail.label}).`);
    onLayerUpdate('features', { imageData, visible: true, opacity: 0.9, dirty: true });
    setGenerated(p => ({ ...p, features: true }));
  };

  /**
   * Greedily chain polylines that share endpoints into longer continuous strokes.
   * Returns an array of chained point arrays.
   */
  function chainPolylines(polylines) {
    if (polylines.length === 0) return [];
    const KEY_PREC = 4; // decimal places for endpoint matching
    const k = (pt) => `${pt.lat.toFixed(KEY_PREC)},${pt.lon.toFixed(KEY_PREC)}`;

    // Index: endpoint key → [polyline index, isStart]
    const endpointMap = new Map();
    const used = new Array(polylines.length).fill(false);

    const register = (idx) => {
      const pl = polylines[idx];
      const sk = k(pl[0]), ek = k(pl[pl.length - 1]);
      if (!endpointMap.has(sk)) endpointMap.set(sk, []);
      if (!endpointMap.has(ek)) endpointMap.set(ek, []);
      endpointMap.get(sk).push({ idx, isStart: true });
      endpointMap.get(ek).push({ idx, isStart: false });
    };
    polylines.forEach((_, i) => register(i));

    const chains = [];

    for (let start = 0; start < polylines.length; start++) {
      if (used[start]) continue;
      used[start] = true;
      let chain = [...polylines[start]];

      // Extend forward from chain's tail
      let extended = true;
      while (extended) {
        extended = false;
        const tail = k(chain[chain.length - 1]);
        const candidates = endpointMap.get(tail) ?? [];
        for (const { idx, isStart } of candidates) {
          if (used[idx]) continue;
          used[idx] = true;
          // Append, reversing if needed so the connection point aligns
          const seg = polylines[idx];
          if (isStart) {
            chain = chain.concat(seg.slice(1));
          } else {
            chain = chain.concat([...seg].reverse().slice(1));
          }
          extended = true;
          break;
        }
      }

      // Extend backward from chain's head
      extended = true;
      while (extended) {
        extended = false;
        const head = k(chain[0]);
        const candidates = endpointMap.get(head) ?? [];
        for (const { idx, isStart } of candidates) {
          if (used[idx]) continue;
          used[idx] = true;
          const seg = polylines[idx];
          if (isStart) {
            chain = [...seg].reverse().concat(chain.slice(1));
          } else {
            chain = seg.concat(chain.slice(1));
          }
          extended = true;
          break;
        }
      }

      chains.push(chain);
    }

    return chains;
  }

  const handleImportFile = (layerId, file) => {
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      const def = LAYER_DEFS.find(d => d.id === layerId);
      const { width, height } = def
        ? getLayerDimensions(def, mapWidth, mapHeight)
        : { width: mapWidth, height: mapHeight };
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

  const generateCoastline = async () => {
    const heightsLayer = LAYER_DEFS.find(d => d.id === 'heights');
    if (!heightsLayer) { setStatus('Generate the heightmap first.'); return; }

    setStatus('Fetching coastline from OpenStreetMap…');

    // natural=coastline ways define the land/sea boundary; ways run with land on the left
    const osmQuery = `[out:json][timeout:120];
(
  way["natural"="coastline"](${bboxStr});
);
out geom;`;

    let elements = [];
    try {
      const data = await fetchOverpass(osmQuery, OSM_OVERPASS);
      elements = (data.elements || []).filter(e => e.geometry?.length > 1);
    } catch (e) {
      setStatus(`Error fetching coastline: ${e.message}`);
      return;
    }

    // Get the current heightmap imageData to work on
    // We need to access it via a fresh canvas — retrieve from onLayerUpdate callback
    // Instead, we rasterize a fresh grayscale heightmap and then apply coastline on top
    const { width, height } = getRasterSize('heights', mapWidth, mapHeight);
    setStatus('Re-rasterizing heightmap for coastline processing…');
    setRasterProgress(p => ({ ...p, heights: { done: 0, total: 1 } }));

    let imageData;
    try {
      imageData = await rasterizeTiles(
        RASTER_SOURCES[0].url, bbox, width, height,
        (done, total) => setRasterProgress(p => ({ ...p, heights: { done, total } })),
        { grayscale: true }
      );
    } catch (e) {
      setStatus(`Error rasterizing heightmap: ${e.message}`);
      setRasterProgress(p => ({ ...p, heights: null }));
      return;
    }
    setRasterProgress(p => ({ ...p, heights: null }));

    const { canvas, ctx, toXY } = makeBboxCanvas(bbox, width, height);
    // Draw the grayscale heightmap first
    ctx.putImageData(imageData, 0, 0);

    if (elements.length > 0) {
      // Chain coastline ways into continuous rings/lines
      const polylines = elements.map(e => e.geometry);
      const chains = chainPolylines(polylines);

      // Draw coastline as filled polygons: OSM coastline has land on the LEFT of the way direction.
      // Strategy: draw each chain as a closed path and fill with a non-sea color to mark land,
      // then flood-fill from borders to find sea. We paint the coastline boundary itself as opaque.
      // First pass: paint coastline strokes as a "barrier" on a separate canvas
      const barrierCanvas = document.createElement('canvas');
      barrierCanvas.width = width; barrierCanvas.height = height;
      const bctx = barrierCanvas.getContext('2d');
      bctx.imageSmoothingEnabled = false;
      // Fill the whole barrier canvas transparent (sea by default)
      bctx.clearRect(0, 0, width, height);
      // Draw each coastline chain; OSM coastline: land is LEFT of direction.
      // We'll fill with white to mark land, using a winding rule approach.
      // Simple approach: draw all chains as closed paths with fill.
      bctx.fillStyle = 'rgba(128,128,128,1)';
      for (const chain of chains) {
        if (chain.length < 2) continue;
        bctx.beginPath();
        chain.forEach(({ lat, lon }, i) => {
          const [x, y] = toXY(lat, lon);
          i === 0 ? bctx.moveTo(x, y) : bctx.lineTo(x, y);
        });
        bctx.closePath();
        bctx.fill('evenodd');
      }
      // Also stroke barrier lines so gaps in coastline don't let sea bleed through
      bctx.strokeStyle = 'rgba(128,128,128,1)';
      bctx.lineWidth = 2;
      for (const chain of chains) {
        if (chain.length < 2) continue;
        bctx.beginPath();
        chain.forEach(({ lat, lon }, i) => {
          const [x, y] = toXY(lat, lon);
          i === 0 ? bctx.moveTo(x, y) : bctx.lineTo(x, y);
        });
        bctx.stroke();
      }

      // Merge: wherever barrier has a non-transparent pixel, keep the heightmap land pixel;
      // everywhere else, mark as potential sea (transparent = sea-eligible for flood fill)
      const barrierData = bctx.getImageData(0, 0, width, height);
      const hd = imageData.data;
      for (let i = 0; i < hd.length; i += 4) {
        if (barrierData.data[i + 3] === 0) {
          // Not inside coastline polygon — mark as transparent so flood fill will reach it
          hd[i] = 0; hd[i + 1] = 0; hd[i + 2] = 0; hd[i + 3] = 0;
        } else {
          // Inside land — ensure at least (1,1,1)
          if (hd[i] === 0 && hd[i + 1] === 0 && hd[i + 2] === 0) {
            hd[i] = 1; hd[i + 1] = 1; hd[i + 2] = 1;
          }
          hd[i + 3] = 255;
        }
      }
    } else {
      setStatus('No coastline found in this bbox — the area may be fully inland. Heightmap saved as-is with land clamping.');
    }

    // Apply flood-fill sea detection and land clamping
    applyCoastlineFill(imageData);

    setStatus(`Coastline applied — ${elements.length} ways, land clamped to ≥(1,1,1).`);
    onLayerUpdate('heights', { imageData, visible: true, opacity: 0.8, dirty: true });
    setGenerated(p => ({ ...p, heights: true, coastline: true }));
  };

  const rasterizeLayer = async (source) => {
    const { width, height } = getRasterSize(source.id, mapWidth, mapHeight);
    setStatus(`Rasterizing ${source.label} (${width}×${height} px)…`);
    setRasterProgress(p => ({ ...p, [source.id]: { done: 0, total: 1 } }));
    try {
      const imageData = await rasterizeTiles(
        source.url, bbox, width, height,
        (done, total) => setRasterProgress(p => ({ ...p, [source.id]: { done, total } })),
        { grayscale: source.grayscale }
      );
      onLayerUpdate(source.id, { imageData, visible: true, opacity: 0.8, dirty: true });
      setGenerated(p => ({ ...p, [source.id]: true }));
      setStatus(`${source.label} rasterized at ${width}×${height} px.`);
    } catch (e) {
      setStatus(`Error rasterizing ${source.label}: ${e.message}`);
    }
    setRasterProgress(p => ({ ...p, [source.id]: null }));
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

      {/* Heightmap */}
      <div>
        <p className="text-[10px] text-slate-400 font-semibold mb-1.5 uppercase tracking-wider">Heightmap (Terrarium)</p>
        <p className="text-[9px] text-slate-500 mb-2">
          Fetch raw elevation tiles. Land → grayscale. Then use "Apply OSM Coastline" below to correctly mark sea pixels.
        </p>
        <div className="space-y-1.5">
          {RASTER_SOURCES.map(src => {
            const prog = rasterProgress[src.id];
            const done = generated[src.id];
            const pct = prog ? Math.round((prog.done / Math.max(prog.total, 1)) * 100) : null;
            return (
              <div key={src.id} className="flex items-center gap-1">
                <button
                  onClick={() => { setGenerating(true); rasterizeLayer(src).finally(() => setGenerating(false)); }}
                  disabled={generating}
                  className={`flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded text-[10px] border transition-colors disabled:opacity-50 ${
                    done ? 'bg-green-800/30 border-green-600/40 text-green-300' : 'bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700'
                  }`}>
                  {done ? <Check className="w-3 h-3 shrink-0" /> : <Download className="w-3 h-3 shrink-0" />}
                  {src.label}
                  {pct !== null && <span className="ml-auto font-mono text-amber-300">{pct}%</span>}
                </button>
              </div>
            );
          })}
        </div>
        <p className="text-[9px] text-slate-500 mt-1">
          The OpenTopoMap is useful as a reference for ground type generation.
        </p>
      </div>

      {/* Coastline from OSM */}
      <div>
        <p className="text-[10px] text-slate-400 font-semibold mb-1.5 uppercase tracking-wider">Apply OSM Coastline</p>
        <p className="text-[9px] text-slate-500 mb-2">
          Fetches <code className="text-amber-300">natural=coastline</code> from OpenStreetMap, draws the coastline boundary, flood-fills sea outward from map edges, and clamps all inland pixels to at least <code className="text-amber-300">RGB(1,1,1)</code>. Replaces the heightmap with the corrected version.
        </p>
        <button
          onClick={async () => { setGenerating(true); await generateCoastline(); setGenerating(false); }}
          disabled={generating}
          className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded text-[11px] border transition-colors disabled:opacity-50 font-semibold ${
            generated.coastline
              ? 'bg-green-800/30 border-green-600/40 text-green-300 hover:bg-green-700/40'
              : 'bg-cyan-800 border-cyan-600 text-white hover:bg-cyan-700'
          }`}>
          <Waves className={`w-3.5 h-3.5 ${generating ? 'animate-pulse' : ''}`} />
          {generated.coastline ? '✓ Re-apply Coastline' : 'Fetch & Apply OSM Coastline'}
        </button>
        <p className="text-[9px] text-slate-500 mt-1">
          For inland-only maps (no coast), skip this step — land pixels are already ≥(1,1,1) from the heightmap.
        </p>
      </div>

      {/* Rivers from OSM */}
      <div>
        <p className="text-[10px] text-slate-400 font-semibold mb-1.5 uppercase tracking-wider">Generate Rivers (OSM)</p>
        <p className="text-[9px] text-slate-500 mb-2">
          Fetches connected river basin ways from OpenStreetMap (same dataset as WaterwayMap.org). Ways are chained into continuous strokes. Rendered as 1-pixel pure blue <code className="text-amber-300">(0,0,255)</code> lines; origin pixel set to white <code className="text-amber-300">(255,255,255)</code>.
        </p>

        <div className="bg-slate-800 border border-slate-700 rounded p-2 mb-2 space-y-1.5">
          <p className="text-[9px] text-slate-400 font-semibold">Level of detail</p>
          {RIVER_DETAIL_LEVELS.map(d => (
            <label key={d.id} className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="riverDetail" value={d.id}
                checked={riverDetail === d.id}
                onChange={() => setRiverDetail(d.id)}
                className="accent-amber-400" />
              <span className={`text-[10px] ${riverDetail === d.id ? 'text-amber-300' : 'text-slate-400'}`}>{d.label}</span>
            </label>
          ))}
          <p className="text-[9px] text-slate-500 pt-1">
            Start with Major only. Add streams only if you need fine detail — they can be very dense.
          </p>
        </div>

        <button onClick={async () => { setGenerating(true); await generateRivers(); setGenerating(false); }} disabled={generating}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded text-[11px] bg-blue-700 border border-blue-600 text-white hover:bg-blue-600 disabled:opacity-50 transition-colors font-semibold">
          <RefreshCw className={`w-3.5 h-3.5 ${generating ? 'animate-spin' : ''}`} />
          Fetch Rivers from OSM
        </button>
        {generated.features && (
          <p className="text-[10px] text-green-400 flex items-center gap-1 mt-1"><Check className="w-3 h-3" /> Rivers generated</p>
        )}
      </div>

      {/* Manual imports */}
      <div>
        <p className="text-[10px] text-slate-400 font-semibold mb-1 uppercase tracking-wider">Import Manually</p>
        <div className="space-y-1.5">
          {[
            { id: 'climates', label: 'Climates (PNG)' },
            { id: 'ground',   label: 'Ground Types (PNG)' },
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