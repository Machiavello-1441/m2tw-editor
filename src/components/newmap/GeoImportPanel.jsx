import React, { useState } from 'react';
import { Upload, Globe, Download } from 'lucide-react';
import { hexToRgb } from '@/lib/mapLayerStore';

/**
 * GeoImportPanel
 * - Import GeoJSON (rivers/regions) and paint onto canvas
 * - Fetch heightmap tiles from online sources (Tangram Heightmapper concept)
 * - Provides the rasterization pipeline
 */
export default function GeoImportPanel({ onRasterizeGeoJSON, onFetchHeightmap, selectionBounds }) {
  const [geoJson, setGeoJson] = useState(null);
  const [geoFileName, setGeoFileName] = useState('');
  const [heightSource, setHeightSource] = useState('tangram');
  const [status, setStatus] = useState('');
  const [featureType, setFeatureType] = useState('rivers');
  const [featureColor, setFeatureColor] = useState('#2196f3');

  const loadGeoJson = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setGeoFileName(file.name);
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const json = JSON.parse(ev.target.result);
        setGeoJson(json);
        setStatus(`✓ Loaded ${json.features?.length ?? 0} features from ${file.name}`);
      } catch {
        setStatus('✗ Invalid GeoJSON file');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleRasterize = () => {
    if (!geoJson) { setStatus('Load a GeoJSON file first'); return; }
    if (!selectionBounds) { setStatus('Select a map area first using the selection tool'); return; }
    onRasterizeGeoJSON(geoJson, featureType, featureColor);
    setStatus(`✓ Rasterizing ${geoJson.features?.length ?? 0} features as ${featureType}...`);
  };

  const handleFetchHeight = () => {
    if (!selectionBounds) { setStatus('Select a map area first'); return; }
    setStatus('Fetching heightmap data...');
    onFetchHeightmap(selectionBounds, heightSource).then(() => {
      setStatus('✓ Heightmap fetched and applied');
    }).catch(err => {
      setStatus(`✗ ${err.message}`);
    });
  };

  return (
    <div className="bg-slate-900 border-t border-slate-700 p-3 space-y-3">
      <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">Geographic Data Import</p>

      {/* GeoJSON import */}
      <div className="space-y-2">
        <p className="text-[10px] text-slate-400 font-medium">Vector Data (GeoJSON)</p>
        <div className="flex items-center gap-2 flex-wrap">
          <label className="cursor-pointer flex items-center gap-1 px-2 py-1 rounded text-[10px] bg-slate-800 border border-slate-600 text-slate-300 hover:bg-slate-700 transition-colors">
            <Upload className="w-3 h-3" /> Load GeoJSON
            <input type="file" accept=".geojson,.json" className="hidden" onChange={loadGeoJson} />
          </label>
          <select value={featureType} onChange={e => setFeatureType(e.target.value)}
            className="h-6 px-1.5 text-[10px] bg-slate-800 border border-slate-600 rounded text-slate-300 focus:outline-none">
            <option value="rivers">→ Rivers (map_features)</option>
            <option value="regions">→ Regions (map_regions)</option>
            <option value="climates">→ Climates (map_climates)</option>
          </select>
          <input type="color" value={featureColor} onChange={e => setFeatureColor(e.target.value)}
            className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent" title="Feature color" />
          <button onClick={handleRasterize} disabled={!geoJson}
            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] bg-amber-600/70 text-white hover:bg-amber-500 disabled:opacity-30 transition-colors">
            Rasterize
          </button>
        </div>
        {geoFileName && <p className="text-[9px] text-slate-500">File: {geoFileName}</p>}
      </div>

      {/* Heightmap fetch */}
      <div className="space-y-2">
        <p className="text-[10px] text-slate-400 font-medium">Online Heightmap</p>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={heightSource} onChange={e => setHeightSource(e.target.value)}
            className="h-6 px-1.5 text-[10px] bg-slate-800 border border-slate-600 rounded text-slate-300 focus:outline-none">
            <option value="tangram">Tangram Heightmapper (SRTM)</option>
            <option value="osm">OpenTopoData SRTM30</option>
            <option value="mapbox">Mapbox Terrain (token needed)</option>
          </select>
          <button onClick={handleFetchHeight}
            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] bg-blue-700/70 text-white hover:bg-blue-600 transition-colors">
            <Globe className="w-3 h-3" /> Fetch for Selection
          </button>
        </div>
        <p className="text-[9px] text-slate-600">
          Select a region on the map first, then fetch elevation data for that area.
        </p>
      </div>

      {/* Demis link */}
      <div className="space-y-1">
        <p className="text-[10px] text-slate-400 font-medium">Reference Maps</p>
        <div className="flex gap-2 flex-wrap">
          <a href="https://www2.demis.nl/worldmap/mapper.asp" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 px-2 py-1 rounded text-[9px] bg-slate-800 border border-slate-700 text-blue-400 hover:border-blue-500 transition-colors">
            <Globe className="w-3 h-3" /> Demis Worldmapper
          </a>
          <a href="https://tangrams.github.io/heightmapper/" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 px-2 py-1 rounded text-[9px] bg-slate-800 border border-slate-700 text-blue-400 hover:border-blue-500 transition-colors">
            <Globe className="w-3 h-3" /> Tangram Heightmapper
          </a>
          <a href="https://geojson.io" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 px-2 py-1 rounded text-[9px] bg-slate-800 border border-slate-700 text-blue-400 hover:border-blue-500 transition-colors">
            <Globe className="w-3 h-3" /> GeoJSON.io (draw regions)
          </a>
        </div>
      </div>

      {status && (
        <p className={`text-[10px] ${status.startsWith('✓') ? 'text-green-400' : status.startsWith('✗') ? 'text-red-400' : 'text-yellow-400'}`}>
          {status}
        </p>
      )}
    </div>
  );
}