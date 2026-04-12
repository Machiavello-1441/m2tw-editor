import React, { useState } from 'react';
import { LAYER_DEFS, getLayerDimensions } from '@/lib/mapLayerStore';
import { Zap, ExternalLink } from 'lucide-react';

// ── Projection helpers (Mercator, bbox-relative) ──────────────────────────────

function latToMerc(lat) {
  const r = Math.PI / 180;
  return Math.log(Math.tan(Math.PI / 4 + lat * r / 2));
}

function bboxToPixel(lng, lat, bbox, width, height) {
  const mercNorth = latToMerc(bbox.north);
  const mercSouth = latToMerc(bbox.south);
  const x = Math.round(((lng - bbox.west) / (bbox.east - bbox.west)) * (width - 1));
  const y = Math.round(((mercNorth - latToMerc(lat)) / (mercNorth - mercSouth)) * (height - 1));
  return { x, y };
}

// ── Pixelated (nearest-neighbor) rasterizer ───────────────────────────────────
// Returns ImageData with hard-edge pixel fill — no anti-aliasing

function rasterizeGeojsonToBbox(geojson, bbox, width, height, color, lineWidthPx = 2) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const toXY = (lng, lat) => {
    const { x, y } = bboxToPixel(lng, lat, bbox, width, height);
    return [x, y];
  };

  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = lineWidthPx;
  ctx.lineCap = 'square'; // pixelated style

  const drawGeom = (geom) => {
    if (!geom) return;
    if (geom.type === 'Point') {
      const [x, y] = toXY(geom.coordinates[0], geom.coordinates[1]);
      ctx.fillRect(x - 1, y - 1, 3, 3);
    } else if (geom.type === 'LineString') {
      ctx.beginPath();
      geom.coordinates.forEach(([lng, lat], i) => {
        const [x, y] = toXY(lng, lat);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.stroke();
    } else if (geom.type === 'MultiLineString') {
      geom.coordinates.forEach(line => {
        ctx.beginPath();
        line.forEach(([lng, lat], i) => {
          const [x, y] = toXY(lng, lat);
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
        ctx.stroke();
      });
    } else if (geom.type === 'Polygon') {
      ctx.beginPath();
      geom.coordinates[0].forEach(([lng, lat], i) => {
        const [x, y] = toXY(lng, lat);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.fill();
    } else if (geom.type === 'MultiPolygon') {
      geom.coordinates.forEach(poly => {
        ctx.beginPath();
        poly[0].forEach(([lng, lat], i) => {
          const [x, y] = toXY(lng, lat);
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
        ctx.closePath();
        ctx.fill();
      });
    } else if (geom.type === 'GeometryCollection') {
      geom.geometries.forEach(drawGeom);
    }
  };

  if (geojson.type === 'FeatureCollection') geojson.features.forEach(f => { ctx.fillStyle = color; ctx.strokeStyle = color; drawGeom(f.geometry); });
  else if (geojson.type === 'Feature') drawGeom(geojson.geometry);
  else drawGeom(geojson);

  return ctx.getImageData(0, 0, width, height);
}

function coloredCountries(geojson, bbox, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const toXY = (lng, lat) => {
    const { x, y } = bboxToPixel(lng, lat, bbox, width, height);
    return [x, y];
  };

  const usedColors = new Set(['#000000']);
  geojson.features.forEach(f => {
    let hex;
    do {
      const r = 30 + Math.floor(Math.random() * 200);
      const g = 30 + Math.floor(Math.random() * 200);
      const b = 30 + Math.floor(Math.random() * 200);
      hex = '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
    } while (usedColors.has(hex));
    usedColors.add(hex);

    ctx.fillStyle = hex;
    ctx.strokeStyle = hex;
    const geom = f.geometry;
    if (!geom) return;
    const drawPoly = (rings) => {
      ctx.beginPath();
      rings[0].forEach(([lng, lat], i) => {
        const [x, y] = toXY(lng, lat);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.fill();
    };
    if (geom.type === 'Polygon') drawPoly(geom.coordinates);
    else if (geom.type === 'MultiPolygon') geom.coordinates.forEach(drawPoly);
  });

  return ctx.getImageData(0, 0, width, height);
}

// ── Overpass query builder ─────────────────────────────────────────────────────

function overpassUrl(query) {
  return `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
}

function makeOverpassQuery(type, bbox) {
  const bboxStr = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
  if (type === 'rivers') {
    return `[out:json][timeout:30];(way["waterway"~"river|stream"](${bboxStr}););out geom;`;
  }
  if (type === 'coastline') {
    return `[out:json][timeout:30];(way["natural"="coastline"](${bboxStr}););out geom;`;
  }
  return '';
}

// Convert Overpass JSON → GeoJSON
function overpassToGeojson(data) {
  const features = [];
  for (const el of data.elements || []) {
    if (el.type === 'way' && el.geometry) {
      const coords = el.geometry.map(n => [n.lon, n.lat]);
      features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: coords }, properties: el.tags || {} });
    }
  }
  return { type: 'FeatureCollection', features };
}

// ── Main component ─────────────────────────────────────────────────────────────

const SOURCES = [
  {
    id: 'ohm_regions',
    label: 'OHM Regions (modern)',
    description: 'Country boundaries from OpenHistoricalMap/OSM within your bbox.',
    layer: 'map_regions',
    color: 'colored',
  },
  {
    id: 'ohm_rivers',
    label: 'OHM Rivers & Waterways',
    description: 'Rivers, streams from OpenHistoricalMap within your bbox.',
    layer: 'map_features',
    color: '#3b82f6',
  },
  {
    id: 'ohm_coastline',
    label: 'Coastline',
    description: 'Coastline ways from OpenStreetMap within your bbox.',
    layer: 'map_regions',
    color: '#5a8a3a',
  },
  {
    id: 'ne_land',
    label: 'Natural Earth Land (low-res)',
    description: 'Global land polygons — fast, low-res starting point.',
    layer: 'map_regions',
    color: '#5a8a3a',
  },
  {
    id: 'ne_rivers',
    label: 'Natural Earth Rivers (low-res)',
    description: 'Global rivers — quick fallback.',
    layer: 'map_features',
    color: '#3b82f6',
  },
];

export default function BBoxGenerator({ bbox, baseResolution, onLayerUpdate }) {
  const [status, setStatus] = useState({});
  const [era, setEra] = useState('medieval');

  const setLayerStatus = (id, msg, isError) =>
    setStatus(prev => ({ ...prev, [id]: { msg, isError: !!isError } }));

  const fetchAndRasterize = async (sourceId) => {
    setLayerStatus(sourceId, 'Fetching…');
    const source = SOURCES.find(s => s.id === sourceId);
    const def = LAYER_DEFS.find(d => d.id === source.layer);
    const { width, height } = getLayerDimensions(def, baseResolution);

    try {
      let imageData;

      if (sourceId === 'ohm_regions') {
        // Overpass OSM country boundaries
        const q = `[out:json][timeout:60];(relation["boundary"="administrative"]["admin_level"="2"](${bbox.south},${bbox.west},${bbox.north},${bbox.east}););out geom;`;
        const res = await fetch(overpassUrl(q));
        const data = await res.json();
        const geojson = { type: 'FeatureCollection', features: [] };
        for (const el of data.elements || []) {
          if (el.type === 'relation' && el.members) {
            const outer = el.members.filter(m => m.type === 'way' && m.role === 'outer' && m.geometry);
            if (outer.length > 0) {
              const coords = outer[0].geometry.map(n => [n.lon, n.lat]);
              if (coords.length > 2) {
                geojson.features.push({
                  type: 'Feature',
                  geometry: { type: 'Polygon', coordinates: [coords] },
                  properties: el.tags || {}
                });
              }
            }
          }
        }
        if (geojson.features.length === 0) {
          setLayerStatus(sourceId, 'No boundary relations found. Try rivers or NE land.', true);
          return;
        }
        imageData = coloredCountries(geojson, bbox, width, height);
        setLayerStatus(sourceId, `${geojson.features.length} regions rasterized.`);
      } else if (sourceId === 'ohm_rivers') {
        const q = makeOverpassQuery('rivers', bbox);
        const res = await fetch(overpassUrl(q));
        const data = await res.json();
        const geojson = overpassToGeojson(data);
        imageData = rasterizeGeojsonToBbox(geojson, bbox, width, height, '#3b82f6', 2);
        setLayerStatus(sourceId, `${geojson.features.length} waterways.`);
      } else if (sourceId === 'ohm_coastline') {
        const q = makeOverpassQuery('coastline', bbox);
        const res = await fetch(overpassUrl(q));
        const data = await res.json();
        const geojson = overpassToGeojson(data);
        imageData = rasterizeGeojsonToBbox(geojson, bbox, width, height, '#5a8a3a', 3);
        setLayerStatus(sourceId, `${geojson.features.length} coastline ways.`);
      } else if (sourceId === 'ne_land') {
        const url = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_land.geojson';
        const res = await fetch(url);
        const geojson = await res.json();
        imageData = rasterizeGeojsonToBbox(geojson, bbox, width, height, '#5a8a3a', 3);
        setLayerStatus(sourceId, `Land polygons loaded.`);
      } else if (sourceId === 'ne_rivers') {
        const url = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_rivers_lake_centerlines.geojson';
        const res = await fetch(url);
        const geojson = await res.json();
        imageData = rasterizeGeojsonToBbox(geojson, bbox, width, height, '#3b82f6', 2);
        setLayerStatus(sourceId, `Rivers loaded.`);
      }

      if (imageData) {
        onLayerUpdate(source.layer, { imageData, visible: true, opacity: 0.85, dirty: true });
      }
    } catch (err) {
      setLayerStatus(sourceId, `Error: ${err.message}`, true);
    }
  };

  return (
    <div className="space-y-4 pt-2">
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Era</span>
        <select value={era} onChange={e => setEra(e.target.value)}
          className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-[11px] text-slate-200 focus:outline-none">
          <option value="medieval">Medieval (~1000–1500)</option>
          <option value="ancient">Ancient Roman (~0–500)</option>
        </select>
      </div>

      {era === 'ancient' && (
        <div className="bg-amber-900/20 border border-amber-600/30 rounded p-2 text-[10px] text-amber-300 space-y-1">
          <p className="font-semibold">Ancient Roman era selected</p>
          <p>For historical borders, use <strong>Imperium Hoc Est</strong>:</p>
          <a href="https://imperium.ahlfeldt.se/" target="_blank" rel="noreferrer"
            className="flex items-center gap-1 text-amber-400 underline hover:text-amber-300">
            <ExternalLink className="w-3 h-3" /> imperium.ahlfeldt.se
          </a>
          <p className="mt-1">Export a PNG of your area then import it manually via the layer sidebar after generating.</p>
          <p className="mt-1">OpenHistoricalMap may also have ancient data — try the OHM source below.</p>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Generate Layers</p>
        {SOURCES.map(source => (
          <div key={source.id} className="bg-slate-800 border border-slate-700 rounded p-2 space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-slate-200 font-medium leading-tight">{source.label}</p>
                <p className="text-[9px] text-slate-500 mt-0.5 leading-tight">{source.description}</p>
                <p className="text-[9px] text-amber-600 mt-0.5">→ {source.layer}</p>
              </div>
              <button onClick={() => fetchAndRasterize(source.id)}
                className="shrink-0 flex items-center gap-1 px-2 py-1 rounded text-[10px] bg-amber-600/20 border border-amber-500/30 text-amber-300 hover:bg-amber-600/40 transition-colors">
                <Zap className="w-3 h-3" /> Generate
              </button>
            </div>
            {status[source.id] && (
              <p className={`text-[9px] ${status[source.id].isError ? 'text-red-400' : 'text-green-400'}`}>
                {status[source.id].msg}
              </p>
            )}
          </div>
        ))}
      </div>

      <p className="text-[9px] text-slate-600 leading-relaxed">
        All layers are rasterized with nearest-neighbor (pixelated) rendering, matching M2TW's hard-edge bitmap requirements. Use the layer sidebar to refine with painting tools.
      </p>
    </div>
  );
}