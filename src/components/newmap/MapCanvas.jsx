import React, { useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Rectangle, useMapEvents, ImageOverlay, useMap } from 'react-leaflet';
import { hexToRgb } from '@/lib/mapLayerStore';
import 'leaflet/dist/leaflet.css';

// Paints onto a layer's canvas at a given lat/lng
function usePainter({ mapRef, canvasRef, activeTool, brushSize, color, onLayerUpdate, activeLayerId, layers }) {
  const painting = useRef(false);

  const getPixelFromLatLng = (map, latlng, canvas) => {
    if (!map || !canvas) return null;
    const bounds = map.getBounds();
    const mapW = bounds.getEast() - bounds.getWest();
    const mapH = bounds.getNorth() - bounds.getSouth();
    const px = Math.round(((latlng.lng - bounds.getWest()) / mapW) * canvas.width);
    const py = Math.round(((bounds.getNorth() - latlng.lat) / mapH) * canvas.height);
    return { px, py };
  };

  const paint = useCallback((latlng) => {
    const layer = layers[activeLayerId];
    if (!layer?.imageData || !mapRef.current || !canvasRef.current) return;
    const map = mapRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const pos = getPixelFromLatLng(map, latlng, canvas);
    if (!pos) return;

    const { px, py } = pos;
    const { r, g, b } = activeTool === 'eraser' ? { r: 0, g: 0, b: 0 } : hexToRgb(color);

    if (activeTool === 'fill') {
      // Flood fill on imageData
      floodFill(layer.imageData, px, py, [r, g, b, 255]);
      onLayerUpdate(activeLayerId, { ...layer, imageData: layer.imageData, dirty: true });
    } else {
      ctx.globalCompositeOperation = activeTool === 'eraser' ? 'destination-out' : 'source-over';
      ctx.fillStyle = activeTool === 'eraser' ? 'rgba(0,0,0,1)' : `rgb(${r},${g},${b})`;
      const radius = brushSize / 2;
      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.fill();
      const updated = ctx.getImageData(0, 0, canvas.width, canvas.height);
      onLayerUpdate(activeLayerId, { ...layer, imageData: updated, dirty: true });
    }
  }, [activeTool, brushSize, color, layers, activeLayerId, onLayerUpdate]);

  return { paint, painting };
}

function floodFill(imageData, startX, startY, fillColor) {
  const { data, width, height } = imageData;
  const idx = (y, x) => (y * width + x) * 4;
  const si = idx(startY, startX);
  const targetColor = [data[si], data[si+1], data[si+2], data[si+3]];
  if (targetColor.every((v, i) => v === fillColor[i])) return;
  const stack = [[startX, startY]];
  const match = (i) => data[i]===targetColor[0] && data[i+1]===targetColor[1] && data[i+2]===targetColor[2];
  while (stack.length) {
    const [x, y] = stack.pop();
    if (x < 0 || x >= width || y < 0 || y >= height) continue;
    const i = idx(y, x);
    if (!match(i)) continue;
    data[i]=fillColor[0]; data[i+1]=fillColor[1]; data[i+2]=fillColor[2]; data[i+3]=fillColor[3];
    stack.push([x+1,y],[x-1,y],[x,y+1],[x,y-1]);
  }
}

// Disable map drag during selection mode
function DragController({ selectionMode }) {
  const map = useMap();
  useEffect(() => {
    if (selectionMode) {
      map.dragging.disable();
      map.scrollWheelZoom.disable();
    } else {
      map.dragging.enable();
      map.scrollWheelZoom.enable();
    }
  }, [selectionMode, map]);
  return null;
}

// Map event handler component
function MapEventHandler({ activeTool, onMapClick, onMapMove, onCoordsChange, selectionMode, onSelectionUpdate }) {
  const selecting = useRef(false);
  const startLatLng = useRef(null);

  useMapEvents({
    mousemove(e) {
      onCoordsChange(e.latlng);
      if (selectionMode && selecting.current) {
        onSelectionUpdate({ start: startLatLng.current, end: e.latlng });
      }
    },
    mousedown(e) {
      if (selectionMode) {
        selecting.current = true;
        startLatLng.current = e.latlng;
      } else {
        onMapMove(e.latlng, true);
      }
    },
    mouseup(e) {
      if (selectionMode) {
        selecting.current = false;
        onSelectionUpdate({ start: startLatLng.current, end: e.latlng, confirmed: true });
      } else {
        onMapMove(e.latlng, false);
      }
    },
    click(e) {
      if (!selectionMode) onMapClick(e.latlng);
    },
  });
  return null;
}

export default function MapCanvas({
  layers, activeLayerId, activeTool, brushSize, color,
  onLayerUpdate, onCoordsChange, selectionMode, selection, onSelectionUpdate,
  onPickColor, bboxBounds
}) {
  const mapRef = useRef(null);
  const canvasRef = useRef(null);
  const isPainting = useRef(false);

  useEffect(() => {}, []);  // no-op, map ref used internally

  const handleMapMove = (latlng, start) => {
    if (start) isPainting.current = true;
    if (isPainting.current && (activeTool === 'brush' || activeTool === 'eraser' || activeTool === 'river')) {
      paintAt(latlng);
    }
    if (!start) isPainting.current = false;
  };

  const handleMapClick = (latlng) => {
    if (activeTool === 'picker') {
      pickColorAt(latlng);
    } else {
      paintAt(latlng);
    }
  };

  const getPixel = (latlng, canvas) => {
    const map = mapRef.current;
    if (!map || !canvas) return null;
    const bounds = map.getBounds();
    const mapW = bounds.getEast() - bounds.getWest();
    const mapH = bounds.getNorth() - bounds.getSouth();
    const px = Math.round(((latlng.lng - bounds.getWest()) / mapW) * canvas.width);
    const py = Math.round(((bounds.getNorth() - latlng.lat) / mapH) * canvas.height);
    return { px, py };
  };

  const paintAt = (latlng) => {
    const layer = layers[activeLayerId];
    if (!layer?.imageData) return;
    const canvas = document.createElement('canvas');
    canvas.width = layer.imageData.width;
    canvas.height = layer.imageData.height;
    const ctx = canvas.getContext('2d');
    ctx.putImageData(layer.imageData, 0, 0);
    const pos = getPixel(latlng, canvas);
    if (!pos) return;
    const { px, py } = pos;
    const rgb = activeTool === 'eraser' ? { r: 0, g: 0, b: 0 } : hexToRgb(color);
    const { r, g, b } = rgb;
    if (activeTool === 'fill') {
      floodFill(layer.imageData, px, py, [r, g, b, 255]);
      onLayerUpdate(activeLayerId, { ...layer, imageData: layer.imageData, dirty: true });
    } else {
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.beginPath();
      ctx.arc(px, py, brushSize / 2, 0, Math.PI * 2);
      ctx.fill();
      const updated = ctx.getImageData(0, 0, canvas.width, canvas.height);
      onLayerUpdate(activeLayerId, { ...layer, imageData: updated, dirty: true });
    }
  };

  const pickColorAt = (latlng) => {
    const layer = layers[activeLayerId];
    if (!layer?.imageData) return;
    const canvas = document.createElement('canvas');
    canvas.width = layer.imageData.width; canvas.height = layer.imageData.height;
    const ctx = canvas.getContext('2d');
    ctx.putImageData(layer.imageData, 0, 0);
    const pos = getPixel(latlng, canvas);
    if (!pos) return;
    const { px, py } = pos;
    const d = layer.imageData.data;
    const i = (py * layer.imageData.width + px) * 4;
    const hex = '#' + [d[i],d[i+1],d[i+2]].map(v => v.toString(16).padStart(2,'0')).join('');
    onPickColor(hex);
  };

  const getLayerDataURL = (layerId) => {
    const layer = layers[layerId];
    if (!layer?.imageData || layer.visible === false) return null;
    const canvas = document.createElement('canvas');
    canvas.width = layer.imageData.width; canvas.height = layer.imageData.height;
    const ctx = canvas.getContext('2d');
    ctx.putImageData(layer.imageData, 0, 0);
    return canvas.toDataURL();
  };

  // If a confirmed bbox exists, overlay layers only within that bbox
  const layerBounds = bboxBounds
    ? [[bboxBounds.south, bboxBounds.west], [bboxBounds.north, bboxBounds.east]]
    : [[-85.051129, -180], [85.051129, 180]];

  return (
    <MapContainer
      center={[45, 15]} zoom={4}
      style={{ width: '100%', height: '100%' }}
      zoomControl={true}
      ref={mapRef}
    >
      {/* Base reference tiles — OpenTopoMap (topography + rivers + borders) */}
      <TileLayer
        url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://opentopomap.org">OpenTopoMap</a> contributors'
        opacity={0.75}
        maxZoom={17}
      />

      {/* Render each visible layer as an image overlay within the bbox */}
      {Object.entries(layers).map(([id, layer]) => {
        if (!layer?.imageData || layer.visible === false) return null;
        const url = getLayerDataURL(id);
        if (!url) return null;
        return (
          <ImageOverlay key={id} url={url} bounds={layerBounds}
            opacity={layer.opacity ?? 0.7}
            className="pixelated-overlay"
          />
        );
      })}

      {/* Always show confirmed bbox if present */}
      {bboxBounds && (
        <Rectangle
          bounds={[[bboxBounds.south, bboxBounds.west], [bboxBounds.north, bboxBounds.east]]}
          pathOptions={{ color: '#f59e0b', weight: 2, fillOpacity: 0, dashArray: '6 3' }}
        />
      )}

      {/* Selection rectangle while drawing */}
      {selectionMode && selection?.start && selection?.end && (
        <Rectangle
          bounds={[
            [Math.min(selection.start.lat, selection.end.lat), Math.min(selection.start.lng, selection.end.lng)],
            [Math.max(selection.start.lat, selection.end.lat), Math.max(selection.start.lng, selection.end.lng)],
          ]}
          pathOptions={{ color: '#f59e0b', weight: 2, fillOpacity: 0.15 }}
        />
      )}

      <DragController selectionMode={selectionMode} />
      <MapEventHandler
        activeTool={activeTool}
        onMapClick={handleMapClick}
        onMapMove={handleMapMove}
        onCoordsChange={onCoordsChange}
        selectionMode={selectionMode}
        onSelectionUpdate={onSelectionUpdate}
      />
    </MapContainer>
  );
}