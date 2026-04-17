import React, { useState, useCallback, useRef } from 'react';
import { getLayerDimensions, LAYER_DEFS } from '@/lib/mapLayerStore';
import { Map, Download, Crop, Edit3, MousePointer, ChevronDown, ChevronRight } from 'lucide-react';
import LayerSidebar from '../components/newmap/LayerSidebar';
import ToolSettings from '../components/newmap/ToolSettings';
import MapStatusBar from '../components/newmap/MapStatusBar';
import ExportPanel from '../components/newmap/ExportPanel';
import SelectionPanel from '../components/newmap/SelectionPanel';
import MapCanvas from '../components/newmap/MapCanvas';
import BboxLayerGenerator from '../components/newmap/BboxLayerGenerator';
import LayerPreviewPanel from '../components/newmap/LayerPreviewPanel';
import { useReferenceLayers, ReferenceLayerControls } from '../components/newmap/ReferenceLayers';
import { OhmOverlayControls } from '../components/newmap/OhmOverlay';

const PHASES = [
  { id: 'browse', label: 'Select Area', icon: MousePointer },
  { id: 'resolution', label: 'Set Resolution', icon: Map },
  { id: 'generate', label: 'Generate Layers', icon: Map },
  { id: 'preview', label: 'Preview Layers', icon: Map },
  { id: 'edit', label: 'Edit & Export', icon: Edit3 },
];

export default function NewMapEditor() {
  const [phase, setPhase] = useState('browse');
  const [layers, setLayers] = useState({});
  const [activeLayerId, setActiveLayerId] = useState('map_regions');
  const [activeTool, setActiveTool] = useState('brush');
  const [brushSize, setBrushSize] = useState(8);
  const [color, setColor] = useState('#0000ff');
  const [coords, setCoords] = useState(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selection, setSelection] = useState(null);
  const [openPanel, setOpenPanel] = useState(null);
  const [mapWidth, setMapWidth] = useState(512);
  const [mapHeight, setMapHeight] = useState(512);
  const [regionName, setRegionName] = useState('');
  const mapRef = useRef(null);

  // Reference tile layers (browse/generate phases)
  const { refLayers, toggleRef, setRefOpacity } = useReferenceLayers();

  // OHM overlay state (edit phase)
  const [ohmVisible, setOhmVisible] = useState(false);
  const [ohmYear, setOhmYear] = useState(1095);
  const [ohmOpacity, setOhmOpacity] = useState(0.5);

  const bbox = selection?.start && selection?.end ? {
    south: Math.min(selection.start.lat, selection.end.lat),
    north: Math.max(selection.start.lat, selection.end.lat),
    west: Math.min(selection.start.lng, selection.end.lng),
    east: Math.max(selection.start.lng, selection.end.lng),
  } : null;

  const handleLayerUpdate = useCallback((layerId, data) => {
    setLayers(prev => ({ ...prev, [layerId]: { ...prev[layerId], ...data } }));
  }, []);

  const handleToggleVisible = (layerId) => {
    setLayers(prev => ({
      ...prev,
      [layerId]: { ...prev[layerId], visible: !(prev[layerId]?.visible !== false) }
    }));
  };

  const handleOpacityChange = (layerId, opacity) => {
    setLayers(prev => ({ ...prev, [layerId]: { ...prev[layerId], opacity } }));
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
      handleLayerUpdate(layerId, { imageData, visible: true, opacity: 0.8, dirty: true });
    };
    img.src = URL.createObjectURL(file);
  };

  const handleSelectionUpdate = ({ start, end }) => {
    setSelection({ start, end });
  };

  const confirmSelection = () => {
    setSelectionMode(false);
    if (bbox) setPhase('resolution');
  };

  // Aspect ratio from bbox
  const bboxAspect = bbox ? ((bbox.east - bbox.west) / (bbox.north - bbox.south)) : 1;

  const handleWidthChange = (val) => {
    const w = Math.max(1, parseInt(val) || 0);
    setMapWidth(w);
    setMapHeight(Math.max(1, Math.round(w / bboxAspect)));
  };

  const handleHeightChange = (val) => {
    const h = Math.max(1, parseInt(val) || 0);
    setMapHeight(h);
    setMapWidth(Math.max(1, Math.round(h * bboxAspect)));
  };

  const confirmResolution = () => {
    if (mapWidth > 0 && mapHeight > 0) setPhase('generate');
  };

  const togglePanel = (id) => setOpenPanel(prev => prev === id ? null : id);

  const phaseIndex = PHASES.findIndex(p => p.id === phase);

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-200 overflow-hidden">
      {/* Header */}
      <div className="h-10 bg-slate-900 border-b border-slate-700 flex items-center gap-3 px-4 shrink-0">
        <Map className="w-4 h-4 text-amber-400" />
        <h1 className="text-sm font-bold text-slate-100">New Map Editor</h1>
        <span className="text-slate-600 text-xs">— M2TW Campaign Map Creator</span>

        <div className="flex items-center gap-1 ml-4">
          {PHASES.map((p, i) => (
            <React.Fragment key={p.id}>
              <button
                onClick={() => { if (i < phaseIndex) setPhase(p.id); }}
                className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                  phase === p.id
                    ? 'bg-amber-600 text-white'
                    : i < phaseIndex
                      ? 'bg-slate-700 text-slate-300 hover:bg-slate-600 cursor-pointer'
                      : 'text-slate-600 cursor-default'
                }`}>
                <p.icon className="w-3 h-3" />
                {p.label}
              </button>
              {i < PHASES.length - 1 && <span className="text-slate-700 text-xs">›</span>}
            </React.Fragment>
          ))}
        </div>

        {/* Show current dimensions in header once set */}
        {phase !== 'browse' && phase !== 'resolution' && (
          <div className="ml-2 flex items-center gap-1 text-[11px]">
            <span className="text-slate-500">Regions:</span>
            <span className="text-amber-400 font-mono">{mapWidth}×{mapHeight}</span>
            <span className="text-slate-600 ml-1">/ ×2+1 maps:</span>
            <span className="text-slate-400 font-mono">{mapWidth*2+1}×{mapHeight*2+1}</span>
          </div>
        )}
      </div>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">

        {phase === 'edit' && (
          <LayerSidebar
            layers={layers}
            activeLayerId={activeLayerId}
            onSetActive={setActiveLayerId}
            onToggleVisible={handleToggleVisible}
            onOpacityChange={handleOpacityChange}
            onImport={handleImportFile}
            mapWidth={mapWidth}
            mapHeight={mapHeight}
          />
        )}

        {/* Center: Map canvas always visible */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          <MapCanvas
            layers={layers}
            activeLayerId={activeLayerId}
            activeTool={phase === 'edit' ? activeTool : 'none'}
            brushSize={brushSize}
            color={color}
            onLayerUpdate={handleLayerUpdate}
            onCoordsChange={setCoords}
            selectionMode={selectionMode}
            selection={selection}
            onSelectionUpdate={handleSelectionUpdate}
            onPickColor={setColor}
            bboxBounds={bbox}
            refLayers={(phase === 'browse' || phase === 'generate' || phase === 'resolution') ? refLayers : null}
            ohmVisible={phase === 'edit' ? ohmVisible : false}
            ohmYear={ohmYear}
            ohmOpacity={ohmOpacity}
          />
          <MapStatusBar
            coords={coords}
            activeLayerId={activeLayerId}
            layers={layers}
            mapWidth={mapWidth}
            mapHeight={mapHeight}
          />

          {phase === 'browse' && !selectionMode && !bbox && (
            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 pointer-events-none">
              <div className="bg-slate-900/90 border border-amber-600/40 rounded-lg px-4 py-2 text-[12px] text-amber-300 text-center shadow-xl">
                Navigate the map, then click <strong>"Draw Selection Box"</strong> →
              </div>
            </div>
          )}
        </div>

        {/* Right panel */}
        <div className="w-64 bg-slate-900 border-l border-slate-700 flex flex-col overflow-y-auto">

          {phase === 'browse' && (
            <div className="p-3 space-y-3">
              <p className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider">Step 1 — Select Map Area</p>
              <p className="text-[11px] text-slate-400">Navigate to your target region, then draw a bounding box around it.</p>
              <SelectionPanel
                selectionMode={selectionMode}
                onToggleSelection={() => setSelectionMode(m => !m)}
                selection={selection}
                onConfirmSelection={confirmSelection}
                onClearSelection={() => { setSelection(null); setSelectionMode(false); }}
              />
              <div className="border-t border-slate-700 pt-3">
                <ReferenceLayerControls
                  refLayers={refLayers}
                  onToggle={toggleRef}
                  onOpacity={setRefOpacity}
                />
              </div>
            </div>
          )}

          {phase === 'resolution' && (
            <div className="p-3 space-y-4">
              <div className="border-b border-slate-700 pb-3">
                <ReferenceLayerControls
                  refLayers={refLayers}
                  onToggle={toggleRef}
                  onOpacity={setRefOpacity}
                />
              </div>
              <p className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider">Step 2 — Set Map Resolution</p>
              <p className="text-[11px] text-slate-400">
                Set the width or height for <span className="text-amber-300 font-mono">map_regions.tga</span>. The other dimension is locked to your selection's aspect ratio.
              </p>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <label className="text-[10px] text-slate-400 mb-1 block">Width (px)</label>
                    <input
                      type="number" min="64" max="4096" step="1"
                      value={mapWidth}
                      onChange={e => handleWidthChange(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-[13px] text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <span className="text-slate-500 mt-4">×</span>
                  <div className="flex-1">
                    <label className="text-[10px] text-slate-400 mb-1 block">Height (px)</label>
                    <input
                      type="number" min="64" max="4096" step="1"
                      value={mapHeight}
                      onChange={e => handleHeightChange(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-[13px] text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <p className="text-[9px] text-slate-500">Aspect ratio locked to your selected area ({bboxAspect.toFixed(3)}:1).</p>

                <div className="bg-slate-800 rounded p-2 text-[10px] text-slate-400 space-y-0.5">
                  <p className="text-slate-300 font-semibold mb-1">Resulting dimensions</p>
                  <p>map_regions / map_features: <span className="font-mono text-slate-200">{mapWidth}×{mapHeight}</span></p>
                  <p>map_heights / climates / ground: <span className="font-mono text-slate-200">{mapWidth*2+1}×{mapHeight*2+1}</span></p>
                </div>

                <button onClick={confirmResolution}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded text-[11px] bg-amber-600 border border-amber-500 text-white hover:bg-amber-500 transition-colors font-semibold">
                  Confirm &amp; Generate Layers →
                </button>
              </div>
            </div>
          )}

          {phase === 'generate' && bbox && (
            <div className="p-3">
              <p className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider mb-2">Step 3 — Generate Layers</p>
              <BboxLayerGenerator
                bbox={bbox}
                mapWidth={mapWidth}
                mapHeight={mapHeight}
                onLayerUpdate={handleLayerUpdate}
                onDone={() => setPhase('preview')}
              />
            </div>
          )}

          {phase === 'preview' && (
            <LayerPreviewPanel
              layers={layers}
              onToggleVisible={handleToggleVisible}
              onOpacityChange={handleOpacityChange}
              onProceed={() => setPhase('edit')}
            />
          )}

          {phase === 'edit' && (
            <>
              <div className="border-b border-slate-700">
                <button onClick={() => togglePanel('export')}
                  className="w-full flex items-center gap-2 px-3 py-2 text-[11px] text-slate-300 hover:text-slate-100 hover:bg-slate-800 transition-colors">
                  <Download className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                  <span className="flex-1 text-left font-semibold">Export</span>
                  {openPanel === 'export' ? <ChevronDown className="w-3 h-3 text-slate-500" /> : <ChevronRight className="w-3 h-3 text-slate-500" />}
                </button>
                {openPanel === 'export' && (
                  <div className="px-3 pb-3 pt-1">
                    <ExportPanel layers={layers} mapWidth={mapWidth} mapHeight={mapHeight} />
                  </div>
                )}
              </div>

              <div className="p-3 border-b border-slate-700">
                <button onClick={() => { setPhase('browse'); setSelection(null); setLayers({}); }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 rounded text-[11px] bg-slate-800 border border-slate-600 text-slate-300 hover:bg-slate-700 transition-colors">
                  <Crop className="w-3.5 h-3.5" /> Start Over / New Area
                </button>
              </div>

              <div className="p-3">
                <p className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider mb-1">Map Size</p>
                <p className="text-[10px] text-slate-500">Regions: <span className="font-mono text-slate-400">{mapWidth}×{mapHeight}</span></p>
                <p className="text-[10px] text-slate-500">×2 maps: <span className="font-mono text-slate-400">{mapWidth*2+1}×{mapHeight*2+1}</span></p>
              </div>

              <OhmOverlayControls
                ohmYear={ohmYear}
                setOhmYear={setOhmYear}
                visible={ohmVisible}
                setVisible={setOhmVisible}
                opacity={ohmOpacity}
                setOpacity={setOhmOpacity}
              />
            </>
          )}
        </div>

        {phase === 'edit' && (
          <ToolSettings
            activeTool={activeTool}
            onSetTool={setActiveTool}
            brushSize={brushSize}
            onBrushSize={setBrushSize}
            color={color}
            onColor={setColor}
            activeLayerId={activeLayerId}
            regionName={regionName}
            onRegionName={setRegionName}
          />
        )}
      </div>
    </div>
  );
}