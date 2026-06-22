import React, { useState } from 'react';
import { RefreshCw, Check, Download, Waves, Droplets } from 'lucide-react';
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
 * Pixels that are transparent or pure-black (alpha=0 or land=false) are sea candidates.
 * After flood fill, all visited pixels become blue (0,0,255).
 * All remaining non-sea pixels are clamped to minimum 1,1,1.
 */
function applyCoastlineFill(imageData) {
  const { width, height, data } = imageData;

  const isLand = (i) => {
    const a = data[i + 3];
    if (a === 0) return false;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    if (r === 0 && g === 0 && b === 255) return false; // already sea
    return true;
  };

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

  // Clamp all remaining non-sea pixels to minimum 1,1,1
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] > 0 && !(data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 255)) {
      if (data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 0) {
        data[i] = 1; data[i + 1] = 1; data[i + 2] = 1; data[i + 3] = 255;
      }
    }
  }

  return imageData;
}

// River detail levels
const RIVER_DETAIL_LEVELS = [
  { id: 'major',  label: 'Major rivers only',       filter: 'river' },
  { id: 'medium', label: 'Rivers + canals',          filter: 'river|canal' },
  { id: 'all',    label: 'Rivers, streams & canals', filter: 'river|stream|canal' },
];

async function fetchOverpass(query) {
  const res = await fetch(OSM_OVERPASS, {
    method: 'POST',
    body: 'data=' + encodeURIComponent(query),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/**
 * Convert lat/lon to canvas pixel coordinates (NO rounding — sub-pixel accuracy for smooth polygon fills).
 */
function makeBboxCanvas(bbox, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  // Sub-pixel coords for smooth polygon boundaries
  const toXY = (lat, lon) => [
    ((lon - bbox.west) / (bbox.east - bbox.west)) * width,
    ((bbox.north - lat) / (bbox.north - bbox.south)) * height,
  ];
  return { canvas, ctx, toXY };
}

/**
 * Normalize river pixels to pure blue and set the topmost-leftmost to white (origin).
 * No thinning — the canvas stroke already produces correct 1px lines.
 */
function postProcessRivers(imageData) {
  const { width, height, data } = imageData;

  // Normalize: any blue-dominant pixel → pure blue
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    if (a > 0 && b > 100 && b > r + 20 && b > g + 20) {
      data[i] = 0; data[i + 1] = 0; data[i + 2] = 255; data[i + 3] = 255;
    }
  }

  // Set the topmost-leftmost river pixel as white (M2TW origin requirement)
  const isRiver = (i) => data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 255 && data[i + 3] === 255;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (isRiver(i)) {
        data[i] = 255; data[i + 1] = 255; data[i + 2] = 255; data[i + 3] = 255;
        return imageData;
      }
    }
  }
  return imageData;
}

/**
 * Greedily chain polylines that share endpoints into longer continuous strokes.
 */
function chainPolylines(polylines) {
  if (polylines.length === 0) return [];
  const KEY_PREC = 4;
  const k = (pt) => `${pt.lat.toFixed(KEY_PREC)},${pt.lon.toFixed(KEY_PREC)}`;

  const endpointMap = new Map();
  const used = new Array(polylines.length).fill(false);

  polylines.forEach((pl, idx) => {
    const sk = k(pl[0]), ek = k(pl[pl.length - 1]);
    if (!endpointMap.has(sk)) endpointMap.set(sk, []);
    if (!endpointMap.has(ek)) endpointMap.set(ek, []);
    endpointMap.get(sk).push({ idx, isStart: true });
    endpointMap.get(ek).push({ idx, isStart: false });
  });

  const chains = [];

  for (let start = 0; start < polylines.length; start++) {
    if (used[start]) continue;
    used[start] = true;
    let chain = [...polylines[start]];

    // Extend forward
    let extended = true;
    while (extended) {
      extended = false;
      for (const { idx, isStart } of (endpointMap.get(k(chain[chain.length - 1])) ?? [])) {
        if (used[idx]) continue;
        used[idx] = true;
        chain = isStart
          ? chain.concat(polylines[idx].slice(1))
          : chain.concat([...polylines[idx]].reverse().slice(1));
        extended = true;
        break;
      }
    }

    // Extend backward
    extended = true;
    while (extended) {
      extended = false;
      for (const { idx, isStart } of (endpointMap.get(k(chain[0])) ?? [])) {
        if (used[idx]) continue;
        used[idx] = true;
        chain = isStart
          ? [...polylines[idx]].reverse().concat(chain.slice(1))
          : polylines[idx].concat(chain.slice(1));
        extended = true;
        break;
      }
    }

    chains.push(chain);
  }

  return chains;
}

/**
 * Draw filled polygons (from OSM way/relation geometry) onto a canvas context as blue sea pixels.
 * Handles both ways (array of {lat,lon}) and relations with member ways.
 */
function drawWaterPolygons(ctx, toXY, elements) {
  ctx.fillStyle = 'rgb(0,0,255)';
  for (const el of elements) {
    const rings = [];
    if (el.type === 'way' && el.geometry?.length > 2) {
      rings.push(el.geometry);
    } else if (el.type === 'relation' && el.members) {
      for (const m of el.members) {
        if (m.type === 'way' && m.geometry?.length > 2) rings.push(m.geometry);
      }
    }
    for (const ring of rings) {
      ctx.beginPath();
      ring.forEach(({ lat, lon }, i) => {
        const [x, y] = toXY(lat, lon);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.fill('evenodd');
    }
  }
}

export default function BboxLayerGenerator({ bbox, mapWidth, mapHeight, onLayerUpdate, onDone }) {
  const [status, setStatus] = useState('');
  const [generating, setGenerating] = useState(false);
  const [rasterProgress, setRasterProgress] = useState({});
  const [generated, setGenerated] = useState({});
  const [riverDetail, setRiverDetail] = useState('major');
  const [includeLakes, setIncludeLakes] = useState(true);
  const [includeWaterRiver, setIncludeWaterRiver] = useState(false);

  const bboxStr = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;

  const generateRivers = async () => {
    const detail = RIVER_DETAIL_LEVELS.find(d => d.id === riverDetail) ?? RIVER_DETAIL_LEVELS[0];
    setStatus(`Fetching rivers from OpenStreetMap (${detail.label})…`);

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
      const data = await fetchOverpass(osmQuery);
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

    // Collect all polylines
    const polylines = [];
    for (const el of elements) {
      if (el.type === 'way' && el.geometry?.length > 1) {
        polylines.push(el.geometry);
      } else if (el.type === 'relation' && el.members) {
        for (const m of el.members) {
          if (m.type === 'way' && m.geometry?.length > 1) polylines.push(m.geometry);
        }
      }
    }

    const chains = chainPolylines(polylines);

    // Draw with round caps/joins — produces continuous 1px lines without gaps
    ctx.strokeStyle = 'rgb(0,0,255)';
    ctx.lineWidth = 1;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const chain of chains) {
      if (chain.length < 2) continue;
      ctx.beginPath();
      chain.forEach(({ lat, lon }, i) => {
        const [x, y] = toXY(lat, lon);
        // Use sub-pixel coords + 0.5 offset to center on pixel grid
        i === 0 ? ctx.moveTo(x + 0.5, y + 0.5) : ctx.lineTo(x + 0.5, y + 0.5);
      });
      ctx.stroke();
    }

    const imageData = ctx.getImageData(0, 0, width, height);
    postProcessRivers(imageData);

    setStatus(`Rivers generated (${chains.length} chains from ${polylines.length} segments).`);
    onLayerUpdate('features', { imageData, visible: true, opacity: 0.9, dirty: true });
    setGenerated(p => ({ ...p, features: true }));
  };

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
    setStatus('Fetching coastline from OpenStreetMap…');

    const osmQuery = `[out:json][timeout:120];
(
  way["natural"="coastline"](${bboxStr});
);
out geom;`;

    let coastElements = [];
    try {
      const data = await fetchOverpass(osmQuery);
      coastElements = (data.elements || []).filter(e => e.geometry?.length > 1);
    } catch (e) {
      setStatus(`Error fetching coastline: ${e.message}`);
      return;
    }

    // Fetch optional water bodies
    let waterElements = [];
    if (includeLakes || includeWaterRiver) {
      setStatus('Fetching water bodies from OpenStreetMap…');
      const waterTypes = [
        includeLakes && 'lake',
        includeWaterRiver && 'river',
      ].filter(Boolean).join('|');
      const waterQuery = `[out:json][timeout:120];
(
  way["natural"="water"]["water"~"^(${waterTypes})$"](${bboxStr});
  relation["natural"="water"]["water"~"^(${waterTypes})$"](${bboxStr});
);
out geom;`;
      try {
        const wdata = await fetchOverpass(waterQuery);
        waterElements = (wdata.elements || []).filter(e =>
          (e.type === 'way' && e.geometry?.length > 2) ||
          (e.type === 'relation' && e.members?.some(m => m.geometry?.length > 2))
        );
      } catch (e) {
        // non-fatal — continue without water bodies
        console.warn('Water bodies fetch failed:', e.message);
      }
    }

    const { width, height } = getRasterSize('heights', mapWidth, mapHeight);
    setStatus('Re-rasterizing heightmap…');
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

    // Sub-pixel canvas for smooth fills
    const { canvas, ctx, toXY } = makeBboxCanvas(bbox, width, height);
    ctx.putImageData(imageData, 0, 0);

    if (coastElements.length > 0) {
      // Build barrier canvas using sub-pixel coords for smooth coastline polygon fills
      const barrierCanvas = document.createElement('canvas');
      barrierCanvas.width = width; barrierCanvas.height = height;
      const bctx = barrierCanvas.getContext('2d');
      bctx.imageSmoothingEnabled = false;
      bctx.clearRect(0, 0, width, height);

      const polylines = coastElements.map(e => e.geometry);
      const chains = chainPolylines(polylines);

      // Fill land polygons — sub-pixel toXY gives smooth edges
      bctx.fillStyle = 'rgba(128,128,128,1)';
      for (const chain of chains) {
        if (chain.length < 2) continue;
        bctx.beginPath();
        chain.forEach(({ lat, lon }, i) => {
          const [x, y] = toXY(lat, lon); // sub-pixel, no rounding
          i === 0 ? bctx.moveTo(x, y) : bctx.lineTo(x, y);
        });
        bctx.closePath();
        bctx.fill('evenodd');
      }

      // Stroke coastline barrier thick enough to seal any polygon gaps
      bctx.strokeStyle = 'rgba(128,128,128,1)';
      bctx.lineWidth = 3;
      bctx.lineCap = 'round';
      bctx.lineJoin = 'round';
      for (const chain of chains) {
        if (chain.length < 2) continue;
        bctx.beginPath();
        chain.forEach(({ lat, lon }, i) => {
          const [x, y] = toXY(lat, lon);
          i === 0 ? bctx.moveTo(x, y) : bctx.lineTo(x, y);
        });
        bctx.stroke();
      }

      // Merge barrier with heightmap
      const barrierData = bctx.getImageData(0, 0, width, height);
      const hd = imageData.data;
      for (let i = 0; i < hd.length; i += 4) {
        if (barrierData.data[i + 3] === 0) {
          // Outside coastline polygon → potential sea (transparent for flood fill)
          hd[i] = 0; hd[i + 1] = 0; hd[i + 2] = 0; hd[i + 3] = 0;
        } else {
          if (hd[i] === 0 && hd[i + 1] === 0 && hd[i + 2] === 0) {
            hd[i] = 1; hd[i + 1] = 1; hd[i + 2] = 1;
          }
          hd[i + 3] = 255;
        }
      }
    } else {
      setStatus('No coastline found — area may be fully inland. Applying land clamping only.');
    }

    // Flood-fill sea from edges
    applyCoastlineFill(imageData);

    // Paint water bodies (lakes / water=river) as blue sea pixels on top
    if (waterElements.length > 0) {
      const wc = document.createElement('canvas');
      wc.width = width; wc.height = height;
      const wctx = wc.getContext('2d');
      wctx.imageSmoothingEnabled = false;
      drawWaterPolygons(wctx, toXY, waterElements);
      const wd = wctx.getImageData(0, 0, width, height);
      const hd = imageData.data;
      for (let i = 0; i < wd.data.length; i += 4) {
        if (wd.data[i + 3] > 0 && wd.data[i] === 0 && wd.data[i + 2] === 255) {
          hd[i] = 0; hd[i + 1] = 0; hd[i + 2] = 255; hd[i + 3] = 255;
        }
      }
    }

    const wbDesc = waterElements.length > 0 ? `, ${waterElements.length} water bodies` : '';
    setStatus(`Coastline applied — ${coastElements.length} ways${wbDesc}, land clamped to ≥(1,1,1).`);
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
          Fetch raw elevation tiles. Land → grayscale. Use "Apply OSM Coastline" below to correctly mark sea/water pixels.
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
        <p className="text-[9px] text-slate-500 mt-1">OpenTopoMap is useful as a reference for ground type generation.</p>
      </div>

      {/* Coastline + water bodies from OSM */}
      <div>
        <p className="text-[10px] text-slate-400 font-semibold mb-1.5 uppercase tracking-wider">Apply OSM Coastline & Water</p>
        <p className="text-[9px] text-slate-500 mb-2">
          Fetches <code className="text-amber-300">natural=coastline</code>, flood-fills sea from map edges, and optionally paints inland water bodies as sea pixels <code className="text-amber-300">(0,0,255)</code>.
        </p>

        {/* Water body options */}
        <div className="bg-slate-800 border border-slate-700 rounded p-2 mb-2 space-y-1.5">
          <p className="text-[9px] text-slate-400 font-semibold flex items-center gap-1"><Droplets className="w-3 h-3" /> Include inland water bodies</p>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={includeLakes} onChange={e => setIncludeLakes(e.target.checked)} className="accent-cyan-400" />
            <span className={`text-[10px] ${includeLakes ? 'text-cyan-300' : 'text-slate-400'}`}>
              <code className="text-amber-300">water=lake</code> → sea pixels
            </span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={includeWaterRiver} onChange={e => setIncludeWaterRiver(e.target.checked)} className="accent-cyan-400" />
            <span className={`text-[10px] ${includeWaterRiver ? 'text-cyan-300' : 'text-slate-400'}`}>
              <code className="text-amber-300">water=river</code> → sea pixels <span className="text-slate-500">(wide riverbeds)</span>
            </span>
          </label>
        </div>

        <button
          onClick={async () => { setGenerating(true); await generateCoastline(); setGenerating(false); }}
          disabled={generating}
          className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded text-[11px] border transition-colors disabled:opacity-50 font-semibold ${
            generated.coastline
              ? 'bg-green-800/30 border-green-600/40 text-green-300 hover:bg-green-700/40'
              : 'bg-cyan-800 border-cyan-600 text-white hover:bg-cyan-700'
          }`}>
          <Waves className={`w-3.5 h-3.5 ${generating ? 'animate-pulse' : ''}`} />
          {generated.coastline ? '✓ Re-apply Coastline & Water' : 'Fetch & Apply OSM Coastline'}
        </button>
        <p className="text-[9px] text-slate-500 mt-1">
          For inland-only maps, skip this — land pixels are already ≥(1,1,1) from the heightmap.
        </p>
      </div>

      {/* Rivers from OSM */}
      <div>
        <p className="text-[10px] text-slate-400 font-semibold mb-1.5 uppercase tracking-wider">Generate Rivers (OSM)</p>
        <p className="text-[9px] text-slate-500 mb-2">
          Fetches waterway ways, chains them into continuous strokes, renders as 1-pixel pure blue <code className="text-amber-300">(0,0,255)</code> lines with origin pixel white <code className="text-amber-300">(255,255,255)</code>.
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
          <p className="text-[9px] text-slate-500 pt-1">Start with Major only. Streams can be very dense.</p>
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