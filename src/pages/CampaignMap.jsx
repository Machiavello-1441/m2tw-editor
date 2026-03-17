import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Map, Layers, CheckSquare, Globe, FolderOpen, Box, Code2 } from 'lucide-react';
import ScriptingPanel from '../components/map/ScriptingPanel';
import Map3DPreview from '../components/map/Map3DPreview';
import MapCanvas, { floodFillRGB } from '../components/map/MapCanvas';
import MapLayerPanel from '../components/map/MapLayerPanel';
import MapPaintToolbar from '../components/map/MapPaintToolbar';
import MapValidationPanel from '../components/map/MapValidationPanel';
import StratOverlay from '../components/map/StratOverlay';
import StratPanel from '../components/map/StratPanel';
import { loadTGA } from '../components/map/tgaLoader';
import { exportTGA, downloadBlob } from '../components/map/tgaExporter';
import { LAYER_DEFS } from '../components/map/mapLayerConstants';
import { parseDescrStrat, parseDescrRegions, parseSettlementNames, parseDescrSmFactions, computeSettlementPositions, serializeDescrStrat } from '../components/map/stratParser';

const INITIAL_PAINT = {
  active: false,
  layerId: 'heights',
  paintColor: { r: 128, g: 128, b: 128 },
  tool: 'pencil',
  brushSize: 1,
};

// Files we recognize in a campaign/base folder
const TGA_MAP = {
  'map_heights.tga':     'heights',
  'map_ground_types.tga':'ground',
  'map_climates.tga':    'climates',
  'map_regions.tga':     'regions',
  'map_features.tga':    'features',
  'map_fog.tga':         'fog',
};
const TXT_MAP = {
  'descr_strat.txt':     'strat',
  'descr_regions.txt':   'regions',
  'descr_sm_factions.txt':'factions',
};

export default function CampaignMap() {
  const [layers, setLayers] = useState(() =>
    Object.fromEntries(LAYER_DEFS.map(d => [d.id, { visible: d.defaultVisible, opacity: d.defaultOpacity }]))
  );
  const [dirtyLayers, setDirtyLayers] = useState(new Set());
  const [overlayDirty, setOverlayDirty] = useState(false);
  const [paintState, setPaintState] = useState(INITIAL_PAINT);
  const [activeTab, setActiveTab] = useState('layers');
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [showPixelGrid, setShowPixelGrid] = useState(false);
  const [regionsMode, setRegionsMode] = useState('fill');

  // Strat overlay state — initialize from sessionStorage if available
  const [stratData, setStratDataRaw] = useState(() => {
    try {
      const raw = sessionStorage.getItem('m2tw_strat_raw');
      if (raw) { const p = parseDescrStrat(raw); return p; }
    } catch {}
    return null;
  });
  const [regionsData, setRegionsDataRaw] = useState(() => {
    try {
      const raw = sessionStorage.getItem('m2tw_regions_raw');
      if (raw) return parseDescrRegions(raw);
    } catch {}
    return null;
  });
  const [settlementNames, setSettlementNamesRaw] = useState(() => {
    try {
      const raw = sessionStorage.getItem('m2tw_names_raw');
      if (raw) return parseSettlementNames(raw);
    } catch {}
    return null;
  });
  const [factionColors, setFactionColorsRaw] = useState(() => {
    try {
      const raw = sessionStorage.getItem('m2tw_factions_raw');
      if (raw) return parseDescrSmFactions(raw);
    } catch {}
    return null;
  });
  const [overlayItems, setOverlayItems] = useState(() => {
    try {
      const raw = sessionStorage.getItem('m2tw_strat_raw');
      if (raw) { const p = parseDescrStrat(raw); return p.items || []; }
    } catch {}
    return [];
  });
  const [selectedItem, setSelectedItem] = useState(null);
  const [visibleCategories, setVisibleCategories] = useState(new Set(['settlement', 'resource', 'character', 'fortification']));
  const [editedSettlements, setEditedSettlements] = useState({});
  const [pendingPlace, setPendingPlace] = useState(null); // item waiting to be placed on click

  // Compute settlement positions once we have both strat + regions layer
  const applySettlementPositions = React.useCallback((stratParsed, regData, regLayer) => {
    if (!stratParsed?.items?.length) return stratParsed;
    const settlements = stratParsed.items.filter(i => i.category === 'settlement');
    const withPos = computeSettlementPositions(settlements, regData, regLayer);
    const posMap = Object.fromEntries(withPos.map(s => [s.id, s]));
    const items = stratParsed.items.map(i => posMap[i.id] || i);
    return { ...stratParsed, items };
  }, []);

  // Wrappers that also persist to sessionStorage
  const setStratData = (data) => {
    setStratDataRaw(data);
    try { if (data?.raw) sessionStorage.setItem('m2tw_strat_raw', data.raw); } catch {}
  };
  const setRegionsData = (data) => {
    setRegionsDataRaw(data);
  };
  const setSettlementNames = (data) => {
    setSettlementNamesRaw(data);
  };
  const setFactionColors = (data) => {
    setFactionColorsRaw(data);
  };

  const jumpRef = useRef(null);
  const folderInputRef = useRef();

  // ── Save/Revert snapshot ───────────────────────────────────────────────────
  // savedSnapshot holds deep copies of layers pixel data + overlayItems at last save
  const savedSnapshot = useRef(null);

  // Auto-load files pre-staged from Home page (keep them in window for re-navigation)
  React.useEffect(() => {
    const cached = window._m2tw_map_files;
    if (cached && cached.length > 0) {
      handleFolderImport({ files: cached, target: { value: '' } });
    }

    // Auto-restore campaign text files from localStorage
    try {
      const stratRaw = localStorage.getItem('m2tw_campaign_strat');
      if (stratRaw && !sessionStorage.getItem('m2tw_strat_raw')) {
        sessionStorage.setItem('m2tw_strat_raw', stratRaw);
        const parsed = parseDescrStrat(stratRaw);
        setStratDataRaw(parsed);
        setOverlayItems(parsed.items || []);
      }
    } catch {}

    const handler = (e) => {
      if (e.detail?.files) handleFolderImport({ files: e.detail.files, target: { value: '' } });
    };
    window.addEventListener('m2tw-map-folder-loaded', handler);
    return () => window.removeEventListener('m2tw-map-folder-loaded', handler);
  }, []); // eslint-disable-line

  // ── Layer loading ──────────────────────────────────────────────────────────
  const loadLayerFile = useCallback(async (layerId, file) => {
    const buf = await file.arrayBuffer();
    const result = await loadTGA(buf);
    if (!result) return;
    setLayers(prev => ({
      ...prev,
      [layerId]: { ...prev[layerId], ...result },
    }));
  }, []);

  // ── Bulk folder import ─────────────────────────────────────────────────────
  const handleFolderImport = useCallback(async (e) => {
    const files = Array.from(e.files || e.target?.files || []);
    try { if (e.target) e.target.value = ''; } catch {}

    for (const file of files) {
      const name = file.name.toLowerCase();
      if (TGA_MAP[name]) {
        const buf = await file.arrayBuffer();
        const result = await loadTGA(buf);
        if (result) setLayers(prev => ({ ...prev, [TGA_MAP[name]]: { ...prev[TGA_MAP[name]], ...result } }));
      }
      if (name === 'descr_strat.txt') {
        const text = await file.text();
        try { sessionStorage.setItem('m2tw_strat_raw', text); } catch {}
        const parsed = parseDescrStrat(text);
        // Try to apply positions immediately if we already have regions data
        setRegionsDataRaw(prevReg => {
          setLayers(prevLayers => {
            const enriched = applySettlementPositions(parsed, prevReg, prevLayers['regions']);
            setStratDataRaw(enriched);
            setOverlayItems(enriched.items);
            return prevLayers;
          });
          return prevReg;
        });
      }
      if (name === 'descr_regions.txt') {
        const text = await file.text();
        try { sessionStorage.setItem('m2tw_regions_raw', text); } catch {}
        const regData = parseDescrRegions(text);
        setRegionsDataRaw(regData);
        // Re-enrich settlements if strat already loaded
        setStratDataRaw(prev => {
          if (!prev) return prev;
          setLayers(prevLayers => {
            const enriched = applySettlementPositions(prev, regData, prevLayers['regions']);
            setStratDataRaw(enriched);
            setOverlayItems(enriched.items);
            return prevLayers;
          });
          return prev;
        });
      }
      if (name === 'descr_sm_factions.txt') {
        const text = await file.text();
        try { sessionStorage.setItem('m2tw_factions_raw', text); } catch {}
        setFactionColorsRaw(parseDescrSmFactions(text));
      }
      if (name.endsWith('_regions_and_settlement_names.txt')) {
        const text = await file.text();
        try { sessionStorage.setItem('m2tw_names_raw', text); } catch {}
        setSettlementNamesRaw(parseSettlementNames(text));
      }
    }
  }, []);

  // ── Painting ───────────────────────────────────────────────────────────────
  const handlePaint = useCallback((type, layerId, color, patches, bucketCoord) => {
    setLayers(prev => {
      const layer = prev[layerId];
      if (!layer?.data) return prev;
      const newData = new Uint8ClampedArray(layer.data);
      if (type === 'pencil') {
        for (const { x, y } of patches) {
          const i = (y * layer.width + x) * 4;
          newData[i] = color.r; newData[i+1] = color.g; newData[i+2] = color.b;
        }
      } else if (type === 'bucket') {
        floodFillRGB(newData, layer.width, layer.height, bucketCoord.x, bucketCoord.y, color.r, color.g, color.b);
      } else if (type === 'pipette') {
        setPaintState(ps => ({ ...ps, paintColor: color }));
        return prev;
      }
      // Rebuild bitmap
      createImageBitmap(new ImageData(newData, layer.width, layer.height)).then(bitmap => {
        setLayers(p => ({ ...p, [layerId]: { ...p[layerId], bitmap, data: newData } }));
      });
      return { ...prev, [layerId]: { ...layer, data: newData } };
    });
    if (type !== 'pipette') {
      setDirtyLayers(prev => new Set([...prev, layerId]));
    }
  }, []);

  // Derive map dimensions from loaded layers
  const mapH = (() => {
    const reg = layers['regions'];
    if (reg?.bitmap) return reg.bitmap.height;
    for (const def of LAYER_DEFS) { const s = layers[def.id]; if (s?.bitmap) return s.bitmap.height; }
    return 0;
  })();
  const mapW2 = (() => {
    const reg = layers['regions'];
    if (reg?.bitmap) return reg.bitmap.width;
    for (const def of LAYER_DEFS) { const s = layers[def.id]; if (s?.bitmap) return s.bitmap.width; }
    return 0;
  })();

  // ── Canvas click (for placing strat items) — Y is flipped ─────────────────
  const handleRegionClick = useCallback((rx, ry) => {
    if (!pendingPlace) return;
    // ry from MapCanvas is in pixel-space (y=0 top), flip to M2TW space
    const stratY = mapH > 0 ? mapH - 1 - ry : ry;
    const newItem = { ...pendingPlace, id: Date.now(), x: rx, y: stratY };
    setOverlayItems(prev => [...prev, newItem]);
    setStratData(prev => prev ? { ...prev, items: [...(prev.items || []), newItem] } : prev);
    setPendingPlace(null);
    setSelectedItem(newItem);
    setOverlayDirty(true);
  }, [pendingPlace, mapH]);

  const handleAddItem = (itemTemplate) => {
    setPendingPlace(itemTemplate);
    setSelectedItem(null);
  };

  const handleDeleteItem = (id) => {
    setOverlayItems(prev => prev.filter(i => i.id !== id));
    setStratData(prev => prev ? { ...prev, items: (prev.items || []).filter(i => i.id !== id) } : prev);
    setSelectedItem(null);
    setOverlayDirty(true);
  };

  // ── Move item (drag or click-to-reposition) ────────────────────────────────
  const handleMoveItem = useCallback((id, mx, my, commit = false) => {
    const clampedX = Math.max(0, mx);
    const clampedY = Math.max(0, my);
    setOverlayItems(prev => prev.map(i => i.id === id ? { ...i, x: clampedX, y: clampedY } : i));
    setSelectedItem(prev => prev?.id === id ? { ...prev, x: clampedX, y: clampedY } : prev);
    if (commit) {
      setStratDataRaw(prev => prev ? { ...prev, items: (prev.items || []).map(i => i.id === id ? { ...i, x: clampedX, y: clampedY } : i) } : prev);
      setOverlayDirty(true);
    }
  }, []);

  const handleToggleCategory = (catId) => {
    setVisibleCategories(prev => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId); else next.add(catId);
      return next;
    });
  };

  // ── Save / Revert / Export TGA ─────────────────────────────────────────────
  const handleSave = useCallback(() => {
    // Snapshot current layer pixel data + overlay items
    const layerSnap = {};
    for (const [id, layer] of Object.entries(layers)) {
      if (layer?.data) {
        layerSnap[id] = {
          data: new Uint8ClampedArray(layer.data),
          width: layer.width,
          height: layer.height,
        };
      }
    }
    savedSnapshot.current = {
      layers: layerSnap,
      overlayItems: JSON.parse(JSON.stringify(overlayItems)),
      stratRaw: stratData?.raw ?? null,
    };
    setDirtyLayers(new Set());
    setOverlayDirty(false);
  }, [layers, overlayItems, stratData]);

  const handleRevert = useCallback(() => {
    const snap = savedSnapshot.current;
    if (!snap) return;
    // Restore layer pixel data + bitmaps
    const promises = Object.entries(snap.layers).map(([id, { data, width, height }]) =>
      createImageBitmap(new ImageData(new Uint8ClampedArray(data), width, height)).then(bitmap => ({ id, data, width, height, bitmap }))
    );
    Promise.all(promises).then(results => {
      setLayers(prev => {
        const next = { ...prev };
        for (const { id, data, width, height, bitmap } of results) {
          next[id] = { ...prev[id], data: new Uint8ClampedArray(data), width, height, bitmap };
        }
        return next;
      });
    });
    // Restore overlay items
    const restoredItems = JSON.parse(JSON.stringify(snap.overlayItems));
    setOverlayItems(restoredItems);
    if (snap.stratRaw) {
      try { sessionStorage.setItem('m2tw_strat_raw', snap.stratRaw); } catch {}
      setStratDataRaw(prev => prev ? { ...prev, items: restoredItems, raw: snap.stratRaw } : prev);
    }
    setSelectedItem(null);
    setDirtyLayers(new Set());
    setOverlayDirty(false);
  }, []);
  const handleExportTGA = () => {
    dirtyLayers.forEach(layerId => {
      const layer = layers[layerId];
      if (!layer?.data) return;
      const def = LAYER_DEFS.find(d => d.id === layerId);
      const blob = exportTGA(layer.data, layer.width, layer.height);
      downloadBlob(blob, def?.filename || `${layerId}.tga`);
    });
    // Also export descr_strat.txt if it has changes
    if (stratData?.raw && overlayDirty) {
      const text = serializeDescrStrat(stratData, overlayItems, editedSettlements);
      downloadBlob(new Blob([text], { type: 'text/plain' }), 'descr_strat.txt');
    }
  };

  const tabs = [
    { id: 'layers',     label: 'Layers',   Icon: Layers },
    { id: 'strat',      label: 'Strat',    Icon: Globe },
    { id: 'script',     label: 'Script',   Icon: Code2 },
    { id: 'validation', label: 'Validate', Icon: CheckSquare },
    { id: '3d',         label: '3D',       Icon: Box },
  ];

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-slate-200">
      {/* Toolbar */}
      <div className="h-9 border-b border-slate-800 flex items-center px-3 gap-2 shrink-0 bg-slate-900/80">
        <Map className="w-3.5 h-3.5 text-primary shrink-0" />
        <span className="text-xs font-semibold">Campaign Map Editor</span>
        <span className="text-[10px] text-slate-500 font-mono hidden lg:block">— M2TW map_*.tga + descr_strat.txt</span>

        {/* Bulk folder import */}
        <label className="ml-auto cursor-pointer flex items-center gap-1 px-2 py-1 rounded text-[11px] bg-slate-800 border border-slate-600/40 text-slate-300 hover:bg-slate-700 transition-colors">
          <FolderOpen className="w-3 h-3" />
          Import folder
          <input ref={folderInputRef} type="file" className="hidden" webkitdirectory="" directory="" multiple onChange={handleFolderImport} />
        </label>

        {/* Pixel grid toggle */}
        <button
          onClick={() => setShowPixelGrid(v => !v)}
          className={`px-2 py-1 rounded text-[10px] border transition-colors ${showPixelGrid ? 'border-amber-500/40 text-amber-400 bg-amber-500/10' : 'border-slate-600/40 text-slate-500 hover:text-slate-200'}`}
        >Grid</button>

        {/* Regions mode */}
        <select
          value={regionsMode}
          onChange={e => setRegionsMode(e.target.value)}
          className="h-6 px-1.5 text-[10px] bg-slate-800 border border-slate-600/40 rounded text-slate-300"
        >
          <option value="fill">Regions: fill</option>
          <option value="citiesports">Regions: cities+ports</option>
        </select>

        {/* Pending place indicator */}
        {pendingPlace && (
          <span className="flex items-center gap-1 px-2 py-1 rounded bg-amber-500/20 border border-amber-500/40 text-amber-400 text-[10px] font-semibold animate-pulse">
            Click map to place {pendingPlace.type || pendingPlace.charType}
            <button onClick={() => setPendingPlace(null)} className="ml-1 text-amber-600 hover:text-amber-400">✕</button>
          </span>
        )}
      </div>

      {/* Paint toolbar */}
      <MapPaintToolbar
        paintState={paintState}
        onPaintChange={setPaintState}
        onSave={handleSave}
        onRevert={handleRevert}
        onExport={handleExportTGA}
        hasUnsaved={dirtyLayers.size > 0 || overlayDirty}
        hasSavedSnapshot={savedSnapshot.current !== null}
        dirtyLayers={dirtyLayers}
      />

      {/* Body */}
      <div className="flex-1 flex min-h-0">
        {/* Canvas */}
        <div className="flex-1 relative min-w-0">
          <MapCanvas
            layers={layers}
            regionsMode={regionsMode}
            onRegionClick={pendingPlace ? handleRegionClick : null}
            jumpRef={jumpRef}
            paintState={paintState}
            onPaint={handlePaint}
            showPixelGrid={showPixelGrid}
            showTooltip={!paintState.active}
            onTransformChange={setTransform}
          />
          {/* Strat SVG overlay */}
          <StratOverlay
            items={overlayItems}
            transform={transform}
            mapH={mapH}
            visibleCategories={visibleCategories}
            selectedId={selectedItem?.id}
            onSelect={setSelectedItem}
            onMoveItem={handleMoveItem}
          />
        </div>

        {/* Right panel */}
        <div className="w-64 xl:w-72 border-l border-slate-800 flex flex-col shrink-0">
          {/* Tab bar */}
          <div className="flex border-b border-slate-800 shrink-0">
            {tabs.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex-1 flex items-center justify-center gap-1 py-2 text-[10px] font-semibold border-b-2 transition-colors ${
                  activeTab === id ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-300'
                }`}
              >
                <Icon className="w-3 h-3" />{label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-hidden">
            {activeTab === 'layers' && (
              <div className="h-full overflow-y-auto p-2">
                <MapLayerPanel
                  layers={layers}
                  onToggleVisible={(id) => setLayers(prev => ({ ...prev, [id]: { ...prev[id], visible: !(prev[id]?.visible ?? LAYER_DEFS.find(d => d.id === id)?.defaultVisible) } }))}
                  onOpacityChange={(id, v) => setLayers(prev => ({ ...prev, [id]: { ...prev[id], opacity: v } }))}
                  onFileLoad={loadLayerFile}
                  dirtyLayers={dirtyLayers}
                />
              </div>
            )}
            {activeTab === 'strat' && (
              <div className="h-full overflow-hidden">
                <StratPanel
                  stratData={stratData}
                  regionsData={regionsData}
                  settlementNames={settlementNames}
                  factionColors={factionColors}
                  onStratLoad={(text) => {
                    try { sessionStorage.setItem('m2tw_strat_raw', text); } catch {}
                    const p = parseDescrStrat(text);
                    const enriched = applySettlementPositions(p, regionsData, layers['regions']);
                    setStratDataRaw(enriched);
                    setOverlayItems(enriched.items);
                  }}
                  onRegionsLoad={(text) => {
                    try { sessionStorage.setItem('m2tw_regions_raw', text); } catch {}
                    const regData = parseDescrRegions(text);
                    setRegionsDataRaw(regData);
                    if (stratData) {
                      const enriched = applySettlementPositions(stratData, regData, layers['regions']);
                      setStratDataRaw(enriched);
                      setOverlayItems(enriched.items);
                    }
                  }}
                  onNamesLoad={(text) => { try { sessionStorage.setItem('m2tw_names_raw', text); } catch {} setSettlementNamesRaw(parseSettlementNames(text)); }}
                  onFactionsLoad={(text) => { try { sessionStorage.setItem('m2tw_factions_raw', text); } catch {} setFactionColorsRaw(parseDescrSmFactions(text)); }}
                  onRegionsDataUpdate={(updatedRegions) => { setRegionsDataRaw(updatedRegions); }}
                  onSettlementChange={(id, edits) => {
                    setEditedSettlements(prev => ({ ...prev, [id]: { ...(prev[id] || {}), ...edits } }));
                    setOverlayItems(prev => prev.map(i => i.id === id ? { ...i, ...edits } : i));
                    setStratDataRaw(prev => prev ? { ...prev, items: (prev.items||[]).map(i => i.id === id ? { ...i, ...edits } : i) } : prev);
                    setOverlayDirty(true);
                  }}
                  overlayItems={overlayItems}
                  selectedItem={selectedItem}
                  onSelectItem={(item) => { setSelectedItem(item); if (jumpRef.current && item.x != null) jumpRef.current(item.x, mapH > 0 ? mapH - 1 - item.y : item.y); }}
                  visibleCategories={visibleCategories}
                  onToggleCategory={handleToggleCategory}
                  onDeleteItem={handleDeleteItem}
                  onAddItem={handleAddItem}
                />
              </div>
            )}
            {activeTab === 'validation' && (
              <div className="h-full overflow-hidden">
                <MapValidationPanel layers={layers} onJumpTo={(x, y) => jumpRef.current?.(x, y)} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3D Preview — full-screen overlay when active */}
      {activeTab === '3d' && (
        <div className="absolute inset-0 z-10" style={{ top: '6.5rem' }}>
          <Map3DPreview layers={layers} />
        </div>
      )}
    </div>
  );
}