import React, { useState } from 'react';
import { Upload, Globe, Mountain, Waves } from 'lucide-react';
import { PRESET_RESOLUTIONS, getLayerDimensions, LAYER_DEFS, hexToRgb } from '@/lib/mapLayerStore';
import { normalizeGrayscale } from '@/lib/tgaEncoder';

// Rasterise a GeoJSON feature collection onto a canvas ImageData
function rasterizeGeoJSON(geojson, width, height, color, lineWidth = 2) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');

  const toPixel = (lng, lat) => {
    const x = ((lng + 180) / 360) * width;
    const y = ((90 - lat) / 180) * height;
    return [x, y];
  };

  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';

  const drawGeometry = (geom) => {
    if (!geom) return;
    if (geom.type === 'LineString') {
      ctx.beginPath();
      geom.coordinates.forEach(([lng, lat], i) => {
        const [x, y] = toPixel(lng, lat);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.stroke();
    } else if (geom.type === 'MultiLineString') {
      geom.coordinates.forEach(line => {
        ctx.beginPath();
        line.forEach(([lng, lat], i) => {
          const [x, y] = toPixel(lng, lat);
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
        ctx.stroke();
      });
    } else if (geom.type === 'Polygon') {
      ctx.beginPath();
      geom.coordinates[0].forEach(([lng, lat], i) => {
        const [x, y] = toPixel(lng, lat);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    } else if (geom.type === 'MultiPolygon') {
      geom.coordinates.forEach(poly => {
        ctx.beginPath();
        poly[0].forEach(([lng, lat], i) => {
          const [x, y] = toPixel(lng, lat);
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
      });
    } else if (geom.type === 'GeometryCollection') {
      geom.geometries.forEach(drawGeometry);
    }
  };

  if (geojson.type === 'FeatureCollection') {
    geojson.features.forEach(f => drawGeometry(f.geometry));
  } else if (geojson.type === 'Feature') {
    drawGeometry(geojson.geometry);
  } else {
    drawGeometry(geojson);
  }

  return ctx.getImageData(0, 0, width, height);
}

export default function GeoImporter({ onLayerUpdate, layers, baseResolution }) {
  const [status, setStatus] = useState('');
  const [fetching, setFetching] = useState(false);

  const handleHeightmapFile = (file) => {
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      const def = LAYER_DEFS.find(d => d.id === 'map_heights');
      const { width, height } = getLayerDimensions(def, baseResolution);
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      let imageData = ctx.getImageData(0, 0, width, height);
      imageData = normalizeGrayscale(imageData);
      onLayerUpdate('map_heights', { imageData, visible: true, opacity: 0.8, dirty: true });
      setStatus('Heightmap imported and normalized.');
    };
    img.src = URL.createObjectURL(file);
  };

  const handleGeoJSONFile = (file, targetLayer) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const geojson = JSON.parse(e.target.result);
      const def = LAYER_DEFS.find(d => d.id === targetLayer);
      const { width, height } = getLayerDimensions(def, baseResolution);
      const color = targetLayer === 'map_features' ? '#2196f3' : '#ffffff';
      const imageData = rasterizeGeoJSON(geojson, width, height, color, 2);
      onLayerUpdate(targetLayer, { imageData, visible: true, opacity: 0.8, dirty: true });
      setStatus(`GeoJSON imported → ${def.filename}`);
    };
    reader.readAsText(file);
  };

  const handleRasterFile = (file, targetLayer) => {
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      const def = LAYER_DEFS.find(d => d.id === targetLayer);
      const { width, height } = getLayerDimensions(def, baseResolution);
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      const imageData = ctx.getImageData(0, 0, width, height);
      onLayerUpdate(targetLayer, { imageData, visible: true, opacity: 0.8, dirty: true });
      setStatus(`Raster imported → ${def.filename}`);
    };
    img.src = URL.createObjectURL(file);
  };

  // Fetch Natural Earth river data (GeoJSON) from a public CDN
  const fetchRivers = async () => {
    setFetching(true);
    setStatus('Fetching rivers from Natural Earth…');
    const url = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_rivers_lake_centerlines.geojson';
    const res = await fetch(url);
    const geojson = await res.json();
    const def = LAYER_DEFS.find(d => d.id === 'map_features');
    const { width, height } = getLayerDimensions(def, baseResolution);
    const imageData = rasterizeGeoJSON(geojson, width, height, '#3b82f6', 2);
    onLayerUpdate('map_features', { imageData, visible: true, opacity: 0.9, dirty: true });
    setStatus(`Rivers loaded (${geojson.features?.length ?? '?'} features).`);
    setFetching(false);
  };

  // Fetch Natural Earth land polygons for regions baseline
  const fetchLandmass = async () => {
    setFetching(true);
    setStatus('Fetching land polygons from Natural Earth…');
    const url = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_land.geojson';
    const res = await fetch(url);
    const geojson = await res.json();
    const def = LAYER_DEFS.find(d => d.id === 'map_regions');
    const { width, height } = getLayerDimensions(def, baseResolution);
    const imageData = rasterizeGeoJSON(geojson, width, height, '#5a8a3a', 3);
    onLayerUpdate('map_regions', { imageData, visible: true, opacity: 0.8, dirty: true });
    setStatus(`Land polygons loaded (${geojson.features?.length ?? '?'} features).`);
    setFetching(false);
  };

  // Fetch country boundaries for region outlines
  const fetchCountries = async () => {
    setFetching(true);
    setStatus('Fetching country boundaries…');
    const url = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson';
    const res = await fetch(url);
    const geojson = await res.json();
    const def = LAYER_DEFS.find(d => d.id === 'map_regions');
    const { width, height } = getLayerDimensions(def, baseResolution);
    // Colour each country with a unique random color
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d');
    const usedColors = new Set();
    geojson.features.forEach((f, idx) => {
      let hex;
      do {
        const r = 20 + Math.floor(Math.random() * 200);
        const g = 20 + Math.floor(Math.random() * 200);
        const b = 20 + Math.floor(Math.random() * 200);
        hex = '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
      } while (usedColors.has(hex));
      usedColors.add(hex);
      const single = { type: 'FeatureCollection', features: [f] };
      const tmp = rasterizeGeoJSON(single, width, height, hex, 2);
      const tmpCanvas = document.createElement('canvas');
      tmpCanvas.width = width; tmpCanvas.height = height;
      const tCtx = tmpCanvas.getContext('2d');
      tCtx.putImageData(tmp, 0, 0);
      ctx.drawImage(tmpCanvas, 0, 0);
    });
    const imageData = ctx.getImageData(0, 0, width, height);
    onLayerUpdate('map_regions', { imageData, visible: true, opacity: 0.8, dirty: true });
    setStatus(`Country boundaries loaded — ${geojson.features.length} regions colored.`);
    setFetching(false);
  };

  return (
    <div className="space-y-4">
      {/* Online data sources */}
      <div>
        <p className="text-[10px] text-slate-400 font-semibold mb-2 uppercase tracking-wider">Online Sources (Natural Earth)</p>
        <div className="space-y-1.5">
          <button onClick={fetchLandmass} disabled={fetching}
            className="w-full flex items-center gap-2 px-3 py-2 rounded text-[11px] bg-slate-700 border border-slate-600 text-slate-200 hover:bg-slate-600 disabled:opacity-50 transition-colors">
            <Globe className="w-3.5 h-3.5 shrink-0" /> Fetch Land Polygons → Regions
          </button>
          <button onClick={fetchCountries} disabled={fetching}
            className="w-full flex items-center gap-2 px-3 py-2 rounded text-[11px] bg-slate-700 border border-slate-600 text-slate-200 hover:bg-slate-600 disabled:opacity-50 transition-colors">
            <Globe className="w-3.5 h-3.5 shrink-0" /> Fetch Countries (unique colors)
          </button>
          <button onClick={fetchRivers} disabled={fetching}
            className="w-full flex items-center gap-2 px-3 py-2 rounded text-[11px] bg-blue-800/50 border border-blue-600/40 text-blue-300 hover:bg-blue-700/50 disabled:opacity-50 transition-colors">
            <Waves className="w-3.5 h-3.5 shrink-0" /> Fetch Rivers → Features
          </button>
        </div>
      </div>

      {/* File imports */}
      <div>
        <p className="text-[10px] text-slate-400 font-semibold mb-2 uppercase tracking-wider">Import from File</p>
        <div className="space-y-1.5">
          <label className="w-full flex items-center gap-2 px-3 py-2 rounded text-[11px] bg-slate-700 border border-slate-600 text-slate-200 hover:bg-slate-600 transition-colors cursor-pointer">
            <Mountain className="w-3.5 h-3.5 shrink-0" /> Heightmap (PNG/TIFF/TGA)
            <input type="file" accept="image/*" className="hidden" onChange={e => handleHeightmapFile(e.target.files?.[0])} />
          </label>
          <label className="w-full flex items-center gap-2 px-3 py-2 rounded text-[11px] bg-slate-700 border border-slate-600 text-slate-200 hover:bg-slate-600 transition-colors cursor-pointer">
            <Waves className="w-3.5 h-3.5 shrink-0" /> GeoJSON Rivers → Features
            <input type="file" accept=".json,.geojson" className="hidden"
              onChange={e => handleGeoJSONFile(e.target.files?.[0], 'map_features')} />
          </label>
          <label className="w-full flex items-center gap-2 px-3 py-2 rounded text-[11px] bg-slate-700 border border-slate-600 text-slate-200 hover:bg-slate-600 transition-colors cursor-pointer">
            <Upload className="w-3.5 h-3.5 shrink-0" /> GeoJSON Regions
            <input type="file" accept=".json,.geojson" className="hidden"
              onChange={e => handleGeoJSONFile(e.target.files?.[0], 'map_regions')} />
          </label>
          <label className="w-full flex items-center gap-2 px-3 py-2 rounded text-[11px] bg-slate-700 border border-slate-600 text-slate-200 hover:bg-slate-600 transition-colors cursor-pointer">
            <Upload className="w-3.5 h-3.5 shrink-0" /> Raster Climate Map
            <input type="file" accept="image/*" className="hidden"
              onChange={e => handleRasterFile(e.target.files?.[0], 'map_climates')} />
          </label>
          <label className="w-full flex items-center gap-2 px-3 py-2 rounded text-[11px] bg-slate-700 border border-slate-600 text-slate-200 hover:bg-slate-600 transition-colors cursor-pointer">
            <Upload className="w-3.5 h-3.5 shrink-0" /> Raster Land Cover → Ground Types
            <input type="file" accept="image/*" className="hidden"
              onChange={e => handleRasterFile(e.target.files?.[0], 'map_ground_types')} />
          </label>
        </div>
      </div>

      {status && (
        <p className="text-[10px] text-amber-400 bg-amber-900/20 border border-amber-600/30 rounded px-2 py-1.5">{status}</p>
      )}
    </div>
  );
}