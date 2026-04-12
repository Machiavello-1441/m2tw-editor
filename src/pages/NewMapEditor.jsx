import React, { useState, useCallback, useEffect } from 'react';
import LayerSidebar from '../components/newmap/LayerSidebar';
import ToolSettings from '../components/newmap/ToolSettings';
import MapEditorCanvas from '../components/newmap/MapEditorCanvas';
import MapStatusBar from '../components/newmap/MapStatusBar';
import ExportPanel from '../components/newmap/ExportPanel';
import GeoImportPanel from '../components/newmap/GeoImportPanel';
import { LAYER_DEFS, getLayerDimensions, hexToRgb, createBlankImageData } from '@/lib/mapLayerStore';
import { imageToImageData } from '@/lib/tgaEncoder';
import { Map } from 'lucide-react';

const INITIAL_LAYERS = Object.fromEntries(
  LAYER_DEFS.map(def => [def.id, { visible: true, opacity: 1, imageData: null }])
);

export default function NewMapEditor() {
  const [layers, setLayers] = useState(INITIAL_LAYERS);
  const [activeLayerId, setActiveLayerId] = useState('map_regions');
  const [activeTool, setActiveTool] = useState('brush');
  const [brushSize, setBrushSize] = useState(8);
  const [paintColor, setPaintColor] = useState('#3a7ebf');
  const [baseResolution, setBaseResolution] = useState(512);
  const [coords, setCoords] = useState(null);
  const [zoom, setZoom] = useState(4);
  const [selection, setSelection] = useState(null);
  const [regionName, setRegionName] = useState('');
  const [showGeoPanel, setShowGeoPanel] = useState(false);
  const [showExport, setShowExport] = useState(false);

  // Listen for color picker events from canvas
  useEffect(() => {
    const handler = e => setPaintColor(`#${[e.detail.r, e.detail.g, e.detail.b].map(v => v.toString(16).padStart(2,'0')).join('')}`);
    window.addEventListener('map-color-picked', handler);
    return () => window.removeEventListener('map-color-picked', handler);
  }, []);

  const setLayerData = useCallback((layerId, imageData) => {
    setLayers(prev => ({ ...prev, [layerId]: { ...prev[layerId], imageData } }));
  }, []);

  const toggleVisible = useCallback((layerId) => {
    setLayers(prev => ({ ...prev, [layerId]: { ...prev[layerId], visible: !prev[layerId].visible } }));
  }, []);

  const setOpacity = useCallback((layerId, opacity) => {
    setLayers(prev => ({ ...prev, [layerId]: { ...prev[layerId], opacity } }));
  }, []);

  const importLayerFile = useCallback((layerId, file) => {
    if (!file) return;
    const layerDef = LAYER_DEFS.find(d => d.id === layerId);
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const dims = getLayerDimensions(layerDef, baseResolution);
      const imageData = imageToImageData(img, dims.width, dims.height);
      setLayerData(layerId, imageData);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }, [baseResolution, setLayerData]);

  // Rasterize GeoJSON features onto the correct target layer
  const rasterizeGeoJSON = useCallback(async (geoJson, featureType, color) => {
    const targetLayerId = featureType === 'rivers' ? 'map_features' : featureType === 'regions' ? 'map_regions' : 'map_climates';
    const targetDef = LAYER_DEFS.find(d => d.id === targetLayerId);
    const dims = getLayerDimensions(targetDef, baseResolution);
    if (!selection) return;

    const canvas = document.createElement('canvas');
    canvas.width = dims.width; canvas.height = dims.height;
    const ctx = canvas.getContext('2d');

    // Start with existing data
    const existing = layers[targetLayerId]?.imageData;
    if (existing) ctx.putImageData(existing, 0, 0);

    const latToY = lat => ((selection.north - lat) / (selection.north - selection.south)) * dims.height;
    const lngToX = lng => ((lng - selection.west) / (selection.east - selection.west)) * dims.width;

    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = featureType === 'rivers' ? 2 : 1;

    geoJson.features?.forEach(feature => {
      const geom = feature.geometry;
      if (!geom) return;
      const drawLine = (coords) => {
        ctx.beginPath();
        coords.forEach(([lng, lat], i) => {
          const x = lngToX(lng), y = latToY(lat);
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
        ctx.stroke();
      };
      const drawPoly = (rings) => {
        rings.forEach(ring => { ctx.beginPath(); ring.forEach(([lng,lat],i) => { const x=lngToX(lng),y=latToY(lat); i===0?ctx.moveTo(x,y):ctx.lineTo(x,y); }); ctx.closePath(); ctx.fill(); });
      };
      if (geom.type === 'LineString') drawLine(geom.coordinates);
      else if (geom.type === 'MultiLineString') geom.coordinates.forEach(drawLine);
      else if (geom.type === 'Polygon') drawPoly(geom.coordinates);
      else if (geom.type === 'MultiPolygon') geom.coordinates.forEach(drawPoly);
    });

    const imageData = ctx.getImageData(0, 0, dims.width, dims.height);
    setLayerData(targetLayerId, imageData);
  }, [selection, baseResolution, layers, setLayerData]);

  // Fetch heightmap from online source
  const fetchHeightmap = useCallback(async (bounds, source) => {
    const heightDef = LAYER_DEFS.find(d => d.id === 'map_heights');
    const dims = getLayerDimensions(heightDef, baseResolution);

    if (source === 'osm') {
      // OpenTopoData SRTM30 grid sampled across the selection
      const steps = Math.min(20, dims.width);
      const latStep = (bounds.north - bounds.south) / steps;
      const lngStep = (bounds.east - bounds.west) / steps;
      const locations = [];
      for (let row = 0; row < steps; row++) {
        for (let col = 0; col < steps; col++) {
          locations.push(`${(bounds.north - row * latStep).toFixed(4)},${(bounds.west + col * lngStep).toFixed(4)}`);
        }
      }
      // Batch in groups of 100
      const batches = [];
      for (let i = 0; i < locations.length; i += 100) batches.push(locations.slice(i, i + 100));
      const elevations = [];
      for (const batch of batches) {
        const res = await fetch(`https://api.opentopodata.org/v1/srtm30m?locations=${batch.join('|')}`);
        const json = await res.json();
        json.results?.forEach(r => elevations.push(r.elevation ?? 0));
      }
      // Build canvas from sampled elevations
      const canvas = document.createElement('canvas');
      canvas.width = dims.width; canvas.height = dims.height;
      const ctx = canvas.getContext('2d');
      const minE = Math.min(...elevations);
      const maxE = Math.max(...elevations) || 1;
      const stepW = dims.width / steps, stepH = dims.height / steps;
      for (let row = 0; row < steps; row++) {
        for (let col = 0; col < steps; col++) {
          const e = elevations[row * steps + col] ?? 0;
          const v = Math.round(((e - minE) / (maxE - minE)) * 255);
          ctx.fillStyle = `rgb(${v},${v},${v})`;
          ctx.fillRect(Math.round(col * stepW), Math.round(row * stepH), Math.ceil(stepW), Math.ceil(stepH));
        }
      }
      const imageData = ctx.getImageData(0, 0, dims.width, dims.height);
      setLayerData('map_heights', imageData);
    } else {
      // For Tangram/Mapbox: guide user to download and import manually
      throw new Error('For Tangram Heightmapper: capture the screen export, then import it via the layer import button.');
    }
  }, [baseResolution, setLayerData]);

  const initBlankLayer = (layerId) => {
    const def = LAYER_DEFS.find(d => d.id === layerId);
    const dims = getLayerDimensions(def, baseResolution);
    const [r,g,b] = hexToRgb(def.defaultColor);
    const imageData = createBlankImageData(dims.width, dims.height, [r,g,b,255]);
    setLayerData(layerId, imageData);
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-200">
      {/* Header */}
      <div className="h-10 bg-slate-900 border-b border-slate-700 flex items-center px-4 gap-3 shrink-0">
        <Map className="w-4 h-4 text-amber-400" />
        <span className="text-sm font-semibold text-slate-100">New Map Editor</span>
        <span className="text-[10px] text-slate-500">M2TW Campaign Map Creator</span>
        <div className="flex-1" />
        <button onClick={() => setShowGeoPanel(p => !p)}
          className={`px-3 py-1 rounded text-[11px] transition-colors ${showGeoPanel ? 'bg-blue-700 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>
          Geographic Import
        </button>
        <button onClick={() => setShowExport(p => !p)}
          className={`px-3 py-1 rounded text-[11px] transition-colors ${showExport ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>
          Export
        </button>
        <button onClick={() => initBlankLayer(activeLayerId)}
          className="px-3 py-1 rounded text-[11px] bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors">
          New Layer
        </button>
      </div>

      {/* Main layout */}
      <div className="flex flex-1 min-h-0">
        <LayerSidebar
          layers={layers}
          activeLayerId={activeLayerId}
          onSetActive={setActiveLayerId}
          onToggleVisible={toggleVisible}
          onOpacityChange={setOpacity}
          onImport={importLayerFile}
        />

        <div className="flex-1 flex flex-col min-w-0">
          <MapEditorCanvas
            layers={layers}
            activeLayerId={activeLayerId}
            activeTool={activeTool}
            brushSize={brushSize}
            paintColor={paintColor}
            baseResolution={baseResolution}
            onLayersUpdate={setLayerData}
            onCoordsChange={setCoords}
            onZoomChange={setZoom}
            selection={selection}
            onSelection={setSelection}
          />

          {showGeoPanel && (
            <GeoImportPanel
              selectionBounds={selection}
              onRasterizeGeoJSON={rasterizeGeoJSON}
              onFetchHeightmap={fetchHeightmap}
            />
          )}
          {showExport && (
            <ExportPanel layers={layers} baseResolution={baseResolution} />
          )}
        </div>

        <ToolSettings
          activeTool={activeTool}
          onSetTool={setActiveTool}
          brushSize={brushSize}
          onBrushSize={setBrushSize}
          color={paintColor}
          onColor={setPaintColor}
          activeLayerId={activeLayerId}
          regionName={regionName}
          onRegionName={setRegionName}
        />
      </div>

      <MapStatusBar
        coords={coords}
        zoom={zoom}
        activeLayerId={activeLayerId}
        baseResolution={baseResolution}
        onResolutionChange={setBaseResolution}
      />
    </div>
  );
}