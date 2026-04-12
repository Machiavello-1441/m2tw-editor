import React, { useState, useCallback } from 'react';
import { LAYER_DEFS, PRESET_RESOLUTIONS, getLayerDimensions } from '@/lib/mapLayerStore';
import { Map, Download, Settings, Layers, ChevronDown, ChevronRight, Crop, RefreshCw } from 'lucide-react';
import LayerSidebar from '../components/newmap/LayerSidebar';
import ToolSettings from '../components/newmap/ToolSettings';
import MapStatusBar from '../components/newmap/MapStatusBar';
import ExportPanel from '../components/newmap/ExportPanel';
import SelectionPanel from '../components/newmap/SelectionPanel';
import BBoxGenerator from '../components/newmap/BBoxGenerator';
import MapCanvas from '../components/newmap/MapCanvas';

// Phases: 'explore' → draw bbox → 'selected' → generate → 'editing'

export default function NewMapEditor() {
  const [layers, setLayers] = useState({});
  const [activeLayerId, setActiveLayerId] = useState('map_regions');
  const [activeTool, setActiveTool] = useState('brush');
  const [brushSize, setBrushSize] = useState(8);
  const [color, setColor] = useState('#3a7ebf');
  const [coords, setCoords] = useState(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selection, setSelection] = useState(null); // {start, end} latlng
  const [bboxConfirmed, setBboxConfirmed] = useState(false);
  const [baseResolution, setBaseResolution] = useState(512);
  const [regionName, setRegionName] = useState('');
  const [openPanel, setOpenPanel] = useState('export');

  // Derived bbox in south/west/north/east form
  const bbox = bboxConfirmed && selection?.start && selection?.end ? {
    south: Math.min(selection.start.lat, selection.end.lat),
    north: Math.max(selection.start.lat, selection.end.lat),
    west:  Math.min(selection.start.lng, selection.end.lng),
    east:  Math.max(selection.start.lng, selection.end.lng),
  } : null;

  const phase = !bboxConfirmed ? 'explore' : (Object.keys(layers).length === 0 ? 'selected' : 'editing');

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
    if (confirmed) setBboxConfirmed(false); // still drawing
  };

  const handleConfirmBbox = () => {
    if (selection?.start && selection?.end) {
      setBboxConfirmed(true);
    }
  };

  const handleResetBbox = () => {
    setSelection(null);
    setBboxConfirmed(false);
    setSelectionMode(false);
    setLayers({});
  };

  const togglePanel = (id) => setOpenPanel(prev => prev === id ? null : id);

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-200 overflow-hidden">
      {/* Header */}
      <div className="h-10 bg-slate-900 border-b border-slate-700 flex items-center gap-3 px-4 shrink-0">
        <Map className="w-4 h-4 text-amber-400" />
        <h1 className="text-sm font-bold text-slate-100">New Map Editor</h1>
        <span className="text-slate-600 text-xs">— M2TW Campaign Map Creator</span>

        {/* Phase indicator */}
        <div className="flex items-center gap-1 ml-4">
          {['explore', 'selected', 'editing'].map((p, i) => (
            <React.Fragment key={p}>
              <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                phase === p ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-500'
              }`}>
                {i + 1}. {p === 'explore' ? 'Explore' : p === 'selected' ? 'Select Area' : 'Edit Layers'}
              </span>
              {i < 2 && <span className="text-slate-600 text-[10px]">→</span>}
            </React.Fragment>
          ))}
        </div>

        <div className="flex-1" />

        {bbox && (
          <button onClick={handleResetBbox}
            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] bg-slate-800 border border-slate-600 text-slate-400 hover:text-red-400 hover:border-red-600 transition-colors">
            <RefreshCw className="w-3 h-3" /> Reset
          </button>
        )}

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
        {/* Left: Layer sidebar — only in editing phase */}
        {phase === 'editing' && (
          <LayerSidebar
            layers={layers}
            activeLayerId={activeLayerId}
            onSetActive={setActiveLayerId}
            onToggleVisible={handleToggleVisible}
            onOpacityChange={handleOpacityChange}
            onImport={handleImportFile}
          />
        )}

        {/* Center: Map (always visible) */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <MapCanvas
            layers={layers}
            activeLayerId={activeLayerId}
            activeTool={phase === 'editing' ? activeTool : 'none'}
            brushSize={brushSize}
            color={color}
            onLayerUpdate={handleLayerUpdate}
            onCoordsChange={setCoords}
            selectionMode={selectionMode}
            selection={selection}
            onSelectionUpdate={handleSelectionUpdate}
            onPickColor={setColor}
            bboxBounds={bbox}
          />
          <MapStatusBar
            coords={coords}
            activeLayerId={activeLayerId}
            layers={layers}
            baseResolution={baseResolution}
          />
        </div>

        {/* Right panel */}
        <div className="w-72 bg-slate-900 border-l border-slate-700 flex flex-col overflow-y-auto shrink-0">

          {/* Phase: Explore / Select */}
          {phase !== 'editing' && (
            <div className="p-3 space-y-3">
              <p className="text-[10px] text-slate-400 leading-relaxed">
                {phase === 'explore'
                  ? 'Navigate the map to your target region. Then draw a bounding box to define the area you want to build a campaign map for.'
                  : 'Area selected. Now choose your data sources and generate the map layers within the bounding box.'}
              </p>

              <SelectionPanel
                selectionMode={selectionMode}
                onToggleSelection={() => setSelectionMode(m => !m)}
                selection={selection}
                onConfirmSelection={handleConfirmBbox}
                onClearSelection={() => { setSelection(null); setBboxConfirmed(false); setSelectionMode(false); }}
                bboxConfirmed={bboxConfirmed}
              />

              {bboxConfirmed && bbox && (
                <BBoxGenerator
                  bbox={bbox}
                  baseResolution={baseResolution}
                  onLayerUpdate={handleLayerUpdate}
                />
              )}
            </div>
          )}

          {/* Phase: Editing — collapsible panels */}
          {phase === 'editing' && (
            <>
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
              {[
                { id: 'export', label: 'Export', icon: Download },
                { id: 'settings', label: 'Settings', icon: Settings },
              ].map(panel => (
                <div key={panel.id} className="border-t border-slate-700">
                  <button onClick={() => togglePanel(panel.id)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-[11px] text-slate-300 hover:text-slate-100 hover:bg-slate-800 transition-colors">
                    <panel.icon className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                    <span className="flex-1 text-left font-semibold">{panel.label}</span>
                    {openPanel === panel.id
                      ? <ChevronDown className="w-3 h-3 text-slate-500" />
                      : <ChevronRight className="w-3 h-3 text-slate-500" />}
                  </button>
                  {openPanel === panel.id && (
                    <div className="px-3 pb-3 pt-1">
                      {panel.id === 'export' && (
                        <ExportPanel layers={layers} baseResolution={baseResolution} />
                      )}
                      {panel.id === 'settings' && (
                        <div className="text-[11px] text-slate-400 space-y-1">
                          <p>Layers are rendered with nearest-neighbor (pixelated) scaling as required by M2TW.</p>
                          <p>Use the layer sidebar to toggle visibility and adjust opacity.</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}