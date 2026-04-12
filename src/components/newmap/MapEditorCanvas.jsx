import React, { useEffect, useRef, useState, useCallback } from 'react';
import { MapContainer, TileLayer, useMapEvents, Rectangle, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { hexToRgb, LAYER_DEFS, getLayerDimensions } from '@/lib/mapLayerStore';

/**
 * Leaflet map + painting canvas overlay
 * - Shows OSM tiles as real-world reference (read-only)
 * - Overlays the active layer canvas on top at current selection bounds
 * - Allows painting on the canvas overlay
 */

function CoordTracker({ onCoordsChange, onZoomChange }) {
  useMapEvents({
    mousemove: e => onCoordsChange(e.latlng),
    zoom: e => onZoomChange(e.target.getZoom()),
  });
  return null;
}

function SelectionControl({ selecting, onSelectionComplete }) {
  const [start, setStart] = useState(null);
  const [current, setCurrent] = useState(null);
  const map = useMap();

  useEffect(() => {
    if (!selecting) { setStart(null); setCurrent(null); return; }
    const onDown = e => setStart(e.latlng);
    const onMove = e => { if (start) setCurrent(e.latlng); };
    const onUp = e => {
      if (start) {
        onSelectionComplete({ north: Math.max(start.lat, e.latlng.lat), south: Math.min(start.lat, e.latlng.lat), east: Math.max(start.lng, e.latlng.lng), west: Math.min(start.lng, e.latlng.lng) });
        setStart(null); setCurrent(null);
      }
    };
    map.on('mousedown', onDown);
    map.on('mousemove', onMove);
    map.on('mouseup', onUp);
    map.dragging.disable();
    return () => { map.off('mousedown', onDown); map.off('mousemove', onMove); map.off('mouseup', onUp); map.dragging.enable(); };
  }, [selecting, start, map, onSelectionComplete]);

  if (!start || !current) return null;
  const bounds = [[Math.min(start.lat, current.lat), Math.min(start.lng, current.lng)], [Math.max(start.lat, current.lat), Math.max(start.lng, current.lng)]];
  return <Rectangle bounds={bounds} pathOptions={{ color: '#f59e0b', weight: 2, fillOpacity: 0.15 }} />;
}

export default function MapEditorCanvas({
  layers, activeLayerId, activeTool, brushSize, paintColor,
  baseResolution, onLayersUpdate, onCoordsChange, onZoomChange,
  selection, onSelection,
}) {
  const canvasRef = useRef(null);
  const paintingRef = useRef(false);
  const [selecting, setSelecting] = useState(false);
  const layerDef = LAYER_DEFS.find(d => d.id === activeLayerId);

  // Draw all visible layers onto the canvas
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !layerDef) return;
    const dims = getLayerDimensions(layerDef, baseResolution);
    canvas.width = dims.width;
    canvas.height = dims.height;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, dims.width, dims.height);

    // Draw layers bottom-up
    LAYER_DEFS.slice().reverse().forEach(def => {
      const layer = layers[def.id];
      if (!layer?.imageData || layer.visible === false) return;
      const opacity = layer.opacity ?? 1;
      ctx.globalAlpha = opacity;
      // Render at this layer's native size into the canvas
      const tmpCanvas = document.createElement('canvas');
      tmpCanvas.width = layer.imageData.width;
      tmpCanvas.height = layer.imageData.height;
      tmpCanvas.getContext('2d').putImageData(layer.imageData, 0, 0);
      ctx.drawImage(tmpCanvas, 0, 0, dims.width, dims.height);
    });
    ctx.globalAlpha = 1;
  }, [layers, activeLayerId, baseResolution, layerDef]);

  useEffect(() => { redrawCanvas(); }, [redrawCanvas]);

  // Paint on canvas
  const paint = useCallback((x, y) => {
    const canvas = canvasRef.current;
    if (!canvas || !layerDef) return;
    const ctx = canvas.getContext('2d');

    if (activeTool === 'eraser') {
      ctx.clearRect(x - brushSize/2, y - brushSize/2, brushSize, brushSize);
    } else if (activeTool === 'brush' || activeTool === 'river') {
      ctx.fillStyle = paintColor;
      ctx.beginPath();
      ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (activeTool === 'fill') {
      ctx.fillStyle = paintColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Sync back to ImageData
    const dims = getLayerDimensions(layerDef, baseResolution);
    const imageData = ctx.getImageData(0, 0, dims.width, dims.height);
    onLayersUpdate(activeLayerId, imageData);
  }, [activeTool, brushSize, paintColor, activeLayerId, layerDef, baseResolution, onLayersUpdate]);

  const getCanvasCoords = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const onMouseDown = (e) => {
    if (activeTool === 'picker') {
      const { x, y } = getCanvasCoords(e);
      const ctx = canvasRef.current.getContext('2d');
      const p = ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data;
      // Dispatch color pick up to parent - use event for simplicity
      window.dispatchEvent(new CustomEvent('map-color-picked', { detail: { r: p[0], g: p[1], b: p[2] } }));
      return;
    }
    paintingRef.current = true;
    const { x, y } = getCanvasCoords(e);
    paint(x, y);
  };
  const onMouseMove = (e) => {
    if (!paintingRef.current) return;
    const { x, y } = getCanvasCoords(e);
    paint(x, y);
  };
  const onMouseUp = () => { paintingRef.current = false; };

  return (
    <div className="flex-1 relative overflow-hidden bg-slate-950">
      {/* Leaflet reference map */}
      <MapContainer center={[45, 15]} zoom={4} style={{ width: '100%', height: '100%' }} zoomControl={true}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          opacity={0.4}
        />
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}"
          attribution="Esri"
          opacity={0.3}
        />
        <CoordTracker onCoordsChange={onCoordsChange} onZoomChange={onZoomChange} />
        <SelectionControl selecting={selecting} onSelectionComplete={bounds => { onSelection(bounds); setSelecting(false); }} />
        {selection && (
          <Rectangle
            bounds={[[selection.south, selection.west], [selection.north, selection.east]]}
            pathOptions={{ color: '#f59e0b', weight: 2, fillOpacity: 0.1, dashArray: '6 3' }}
          />
        )}
      </MapContainer>

      {/* Canvas paint overlay */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <canvas
          ref={canvasRef}
          className="pointer-events-auto"
          style={{
            maxWidth: '100%', maxHeight: '100%',
            cursor: activeTool === 'picker' ? 'crosshair' : activeTool === 'eraser' ? 'cell' : 'crosshair',
            opacity: 0.85,
            imageRendering: 'pixelated',
          }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
        />
      </div>

      {/* Selection toggle button */}
      <button onClick={() => setSelecting(s => !s)}
        className={`absolute top-3 right-3 z-[1000] px-3 py-1.5 rounded text-[11px] font-medium transition-colors ${
          selecting ? 'bg-amber-500 text-white' : 'bg-slate-800/90 text-slate-300 border border-slate-600 hover:bg-slate-700'
        }`}>
        {selecting ? '✕ Cancel Selection' : '⬚ Select Region'}
      </button>

      {/* Layer canvas label */}
      {layerDef && (
        <div className="absolute bottom-10 left-3 z-[999] bg-slate-900/80 rounded px-2 py-1 text-[10px] text-slate-400">
          Editing: <span className="text-amber-400">{layerDef.label}</span>
        </div>
      )}
    </div>
  );
}