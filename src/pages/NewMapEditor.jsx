import React, { useState, useCallback, useRef } from 'react';
import { getLayerDimensions, LAYER_DEFS, PRESET_RESOLUTIONS } from '@/lib/mapLayerStore';
import { Map, Download, Settings, ChevronDown, ChevronRight, Crop, Edit3, MousePointer } from 'lucide-react';
import LayerSidebar from '../components/newmap/LayerSidebar';
import ToolSettings from '../components/newmap/ToolSettings';
import MapStatusBar from '../components/newmap/MapStatusBar';
import ExportPanel from '../components/newmap/ExportPanel';
import SelectionPanel from '../components/newmap/SelectionPanel';
import MapCanvas from '../components/newmap/MapCanvas';
import BboxLayerGenerator from '../components/newmap/BboxLayerGenerator';

// Phase 1: Browse & select area
// Phase 2: Generate / import layers for selected bbox
// Phase 3: Edit layers manually + export

const PHASES = [
  { id: 'browse', label: 'Select Area', icon: MousePointer },
  { id: 'generate', label: 'Generate Layers', icon: Map },
  { id: 'edit', label: 'Edit & Export', icon: Edit3 },
];

export default function NewMapEditor() {
  const [phase, setPhase] = useState('browse');
  const [layers, setLayers] = useState({});
  const [activeLayerId, setActiveLayerId] = useState('map_regions');
  const [activeTool, setActiveTool] = useState('brush');
  const [brushSize, setBrushSize] = useState(8);
  const [color, setColor] = useState('#3a7ebf');
  const [coords, setCoords] = useState(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selection, setSelection] = useState(null);
  const [openPanel, setOpenPanel] = useState(null);
  const [baseResolution, setBaseResolution] = useState(512);
  const [regionName, setRegionName] = useState('');
  const mapRef = useRef(null);

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
      const { width, height } = getLayerDimensions(def, baseResolution);
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

  const handleSelectionUpdate = ({ start, end, confirmed }) => {
    setSelection({ start, end });
    if (confirmed) setSelectionMode(false);
  };

  const confirmSelection = () => {
    setSelectionMode(false);
    if (bbox) setPhase('generate');
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

        {/* Phase stepper */}
        <div className="flex items-center gap-1 ml-4">
          {PHASES.map((p, i) => (
            <React.Fragment key={p.id}>
              <button
                onClick={() => { if (i <= phaseIndex || (p.id === 'generate' && bbox)) setPhase(p.id); }}
                className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                  phase === p.id
                    ? 'bg-amber-600 text-white'
                    : i < phaseIndex
                      ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      : 'text-slate-600 cursor-default'
                }`}>
                <p.icon className="w-3 h-3" />
                {p.label}
              </button>
              {i < PHASES.length - 1 && (
                <span className="text-slate-700 text-xs">›</span>
              )}
            </React.Fragment>
          ))}
        </div>

        <div className="flex-1" />
        <div className="flex items-center gap-2 text-[11px]">
          <span className="text-slate-500">Resolution:</span>
          <select value={baseResolution} onChange={e => setBaseResolution(Number(e.target.value))}
            className="bg-slate-800 border border-slate-600 rounded px-2 py-0.5 text-slate-200 text-[11px] focus:outline-none">
            {PRESET_RESOLUTIONS.map(r => (
              <option key={r.base} value={r.base}>{r.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">

        {/* Phase 1 & 3: show layer sidebar only in edit */}
        {phase === 'edit' && (
          <LayerSidebar
            layers={layers}
            activeLayerId={activeLayerId}
            onSetActive={setActiveLayerId}
            onToggleVisible={handleToggleVisible}
            onOpacityChange={handleOpacityChange}
            onImport={handleImportFile}
          />
        )}

        {/* Center: Map canvas — always visible */}
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
            onMapRef={ref => { mapRef.current = ref; }}
            onPickColor={setColor}
          />
          <MapStatusBar
            coords={coords}
            activeLayerId={activeLayerId}
            layers={layers}
            baseResolution={baseResolution}
          />

          {/* Phase 1 overlay instructions */}
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

          {/* Phase 1: Selection */}
          {phase === 'browse' && (
            <div className="p-3 space-y-3">
              <p className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider">Step 1 — Select Map Area</p>
              <p className="text-[11px] text-slate-400">Navigate to your desired region, then draw a bounding box to define the map extent.</p>
              <SelectionPanel
                selectionMode={selectionMode}
                onToggleSelection={() => setSelectionMode(m => !m)}
                selection={selection}
                onConfirmSelection={confirmSelection}
                onClearSelection={() => { setSelection(null); setSelectionMode(false); }}
              />
            </div>
          )}

          {/* Phase 2: Generate */}
          {phase === 'generate' && bbox && (
            <div className="p-3">
              <p className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider mb-2">Step 2 — Generate Layers</p>
              <BboxLayerGenerator
                bbox={bbox}
                baseResolution={baseResolution}
                onLayerUpdate={handleLayerUpdate}
                onDone={() => setPhase('edit')}
              />
            </div>
          )}

          {/* Phase 3: Edit tools */}
          {phase === 'edit' && (
            <>
              {/* Export */}
              <div className="border-b border-slate-700">
                <button onClick={() => togglePanel('export')}
                  className="w-full flex items-center gap-2 px-3 py-2 text-[11px] text-slate-300 hover:text-slate-100 hover:bg-slate-800 transition-colors">
                  <Download className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                  <span className="flex-1 text-left font-semibold">Export</span>
                  {openPanel === 'export' ? <ChevronDown className="w-3 h-3 text-slate-500" /> : <ChevronRight className="w-3 h-3 text-slate-500" />}
                </button>
                {openPanel === 'export' && (
                  <div className="px-3 pb-3 pt-1">
                    <ExportPanel layers={layers} baseResolution={baseResolution} />
                  </div>
                )}
              </div>

              {/* Re-select area */}
              <div className="p-3 border-b border-slate-700">
                <button onClick={() => { setPhase('browse'); setSelection(null); }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 rounded text-[11px] bg-slate-800 border border-slate-600 text-slate-300 hover:bg-slate-700 transition-colors">
                  <Crop className="w-3.5 h-3.5" /> Change Area / Re-generate
                </button>
              </div>

              {/* Settings */}
              <div className="p-3">
                <p className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider mb-2">Settings</p>
                <p className="text-[10px] text-slate-500">Use tools on the left to paint layers. All layers use nearest-neighbor (bitmap) rendering for M2TW compatibility.</p>
              </div>
            </>
          )}
        </div>

        {/* Edit mode: tool settings on the far right */}
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