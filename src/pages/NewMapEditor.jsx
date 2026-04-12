import React, { useState, useCallback, useRef } from 'react';
import { getLayerDimensions, LAYER_DEFS, PRESET_RESOLUTIONS } from '@/lib/mapLayerStore';
import { Map, Download, FolderOpen, Settings, ChevronDown, ChevronRight } from 'lucide-react';
import LayerSidebar from '../components/newmap/LayerSidebar';
import ToolSettings from '../components/newmap/ToolSettings';
import MapStatusBar from '../components/newmap/MapStatusBar';
import GeoImporter from '../components/newmap/GeoImporter';
import ExportPanel from '../components/newmap/ExportPanel';
import SelectionPanel from '../components/newmap/SelectionPanel';
import MapCanvas from '../components/newmap/MapCanvas';


const PANELS = [
  { id: 'import', label: 'Import Data', icon: FolderOpen },
  { id: 'selection', label: 'Map Selection', icon: Map },
  { id: 'export', label: 'Export', icon: Download },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export default function NewMapEditor() {
  const [layers, setLayers] = useState({});
  const [activeLayerId, setActiveLayerId] = useState('map_regions');
  const [activeTool, setActiveTool] = useState('brush');
  const [brushSize, setBrushSize] = useState(8);
  const [color, setColor] = useState('#3a7ebf');
  const [coords, setCoords] = useState(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selection, setSelection] = useState(null);
  const [openPanel, setOpenPanel] = useState('import');
  const [baseResolution, setBaseResolution] = useState(512);
  const [regionName, setRegionName] = useState('');
  const mapRef = useRef(null);

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

  const togglePanel = (id) => setOpenPanel(prev => prev === id ? null : id);

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-200 overflow-hidden">
      {/* Header */}
      <div className="h-10 bg-slate-900 border-b border-slate-700 flex items-center gap-3 px-4 shrink-0">
        <Map className="w-4 h-4 text-amber-400" />
        <h1 className="text-sm font-bold text-slate-100">New Map Editor</h1>
        <span className="text-slate-600 text-xs">— M2TW Campaign Map Creator</span>
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
        {/* Left: Layer sidebar */}
        <LayerSidebar
          layers={layers}
          activeLayerId={activeLayerId}
          onSetActive={setActiveLayerId}
          onToggleVisible={handleToggleVisible}
          onOpacityChange={handleOpacityChange}
          onImport={handleImportFile}
        />

        {/* Center: Map */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <MapCanvas
            layers={layers}
            activeLayerId={activeLayerId}
            activeTool={activeTool}
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
        </div>

        {/* Right: Tool settings + collapsible panels */}
        <div className="flex flex-row h-full overflow-hidden">
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

          {/* Collapsible right panels */}
          <div className="w-60 bg-slate-900 border-l border-slate-700 flex flex-col overflow-y-auto">
            {PANELS.map(panel => (
              <div key={panel.id} className="border-b border-slate-700">
                <button
                  onClick={() => togglePanel(panel.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-[11px] text-slate-300 hover:text-slate-100 hover:bg-slate-800 transition-colors">
                  <panel.icon className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                  <span className="flex-1 text-left font-semibold">{panel.label}</span>
                  {openPanel === panel.id
                    ? <ChevronDown className="w-3 h-3 text-slate-500" />
                    : <ChevronRight className="w-3 h-3 text-slate-500" />}
                </button>
                {openPanel === panel.id && (
                  <div className="px-3 pb-3 pt-1">
                    {panel.id === 'import' && (
                      <GeoImporter
                        layers={layers}
                        onLayerUpdate={handleLayerUpdate}
                        baseResolution={baseResolution}
                      />
                    )}
                    {panel.id === 'selection' && (
                      <SelectionPanel
                        selectionMode={selectionMode}
                        onToggleSelection={() => setSelectionMode(m => !m)}
                        selection={selection}
                        onConfirmSelection={() => setSelectionMode(false)}
                        onClearSelection={() => { setSelection(null); setSelectionMode(false); }}
                      />
                    )}
                    {panel.id === 'export' && (
                      <ExportPanel
                        layers={layers}
                        baseResolution={baseResolution}
                      />
                    )}
                    {panel.id === 'settings' && (
                      <div className="space-y-2 text-[11px] text-slate-400">
                        <p>OSM tile reference layer and all painting tools are active.</p>
                        <p>Use <span className="text-amber-400">Import Data</span> to fetch geographic data from Natural Earth.</p>
                        <p>Use <span className="text-amber-400">Map Selection</span> to define the area to export.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}