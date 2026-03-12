import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useCampaignMap } from './CampaignMapContext';
import { LAYER_ORDER, LAYER_DEFS } from './MapLayerDefs';
import MapPixelTooltip from './MapPixelTooltip';

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 100;

// Grid sizes: regions/features use 1-tile grid (every pixel boundary visible at zoom >= 4),
// other layers use a coarser grid (every 2 pixels)
const GRID_THRESHOLD_ZOOM = 4;

export default function MapCanvas() {
  const canvasRef = useRef(null);
  const overlayRef = useRef(null); // for grid overlay
  const containerRef = useRef(null);
  const {
    layers, layerSettings, activeLayer,
    tool, selectedColor, brushSize,
    paintPixel, bucketFill,
    gridSettings,
  } = useCampaignMap();

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [isPainting, setIsPainting] = useState(false);
  const panStart = useRef(null);
  const panOrigin = useRef(null);
  const panRef = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(1);
  const [probe, setProbe] = useState(null); // tooltip

  // Keep refs in sync for event handlers that need latest values
  useEffect(() => { panRef.current = pan; }, [pan]);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);

  const primaryLayer = layers.heights || layers[Object.keys(layers)[0]] || null;

  // Convert mouse event → map pixel coords using actual canvas bounding rect
  const getMapCoords = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return [0, 0];
    const rect = canvas.getBoundingClientRect();
    const cx = (e.clientX - rect.left) / zoomRef.current;
    const cy = (e.clientY - rect.top) / zoomRef.current;
    return [Math.floor(cx), Math.floor(cy)];
  }, []);

  // ── Composite render ──────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !primaryLayer) return;
    const ctx = canvas.getContext('2d');
    const { width, height } = primaryLayer;
    canvas.width = width;
    canvas.height = height;

    ctx.clearRect(0, 0, width, height);
    ctx.imageSmoothingEnabled = false;

    for (const key of LAYER_ORDER) {
      const layer = layers[key];
      const settings = layerSettings[key];
      if (!layer || !settings.visible) continue;
      if (settings.opacity <= 0) continue;

      const def = LAYER_DEFS[key];
      const src = layer.edited;
      const { width: lw, height: lh } = layer;

      // Regions overlay mode: only paint city/port pixels solid + optional region highlight
      if (key === 'regions' && settings.overlayMode) {
        const imgData = ctx.createImageData(lw, lh);
        const dst = imgData.data;
        const highlightRgb = settings.highlightColor; // [r,g,b] or null

        for (let i = 0; i < lw * lh; i++) {
          const si = i * 4;
          const r = src[si], g = src[si + 1], b = src[si + 2];
          const isCity = r === 0 && g === 0 && b === 0;
          const isPort = r === 255 && g === 255 && b === 255;
          if (isCity || isPort) {
            dst[si] = r; dst[si + 1] = g; dst[si + 2] = b; dst[si + 3] = 255;
          } else if (highlightRgb && r === highlightRgb[0] && g === highlightRgb[1] && b === highlightRgb[2]) {
            dst[si] = r; dst[si + 1] = g; dst[si + 2] = b;
            dst[si + 3] = Math.round(settings.opacity * 200);
          } else {
            dst[si + 3] = 0;
          }
        }

        const offscreen = document.createElement('canvas');
        offscreen.width = lw; offscreen.height = lh;
        const offCtx = offscreen.getContext('2d');
        offCtx.imageSmoothingEnabled = false;
        offCtx.putImageData(imgData, 0, 0);
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        if (lw !== width || lh !== height) {
          ctx.drawImage(offscreen, 0, 0, width, height);
        } else {
          ctx.drawImage(offscreen, 0, 0);
        }
        ctx.restore();
        continue;
      }

      const imgData = ctx.createImageData(lw, lh);
      const dst = imgData.data;
      const tc = def.transparentColor;

      for (let i = 0; i < lw * lh; i++) {
        const si = i * 4;
        const r = src[si], g = src[si + 1], b = src[si + 2];
        if (tc && r === tc[0] && g === tc[1] && b === tc[2]) {
          dst[si + 3] = 0;
        } else {
          dst[si] = r; dst[si + 1] = g; dst[si + 2] = b;
          dst[si + 3] = Math.round(settings.opacity * 255);
        }
      }

      const offscreen = document.createElement('canvas');
      offscreen.width = lw; offscreen.height = lh;
      const offCtx = offscreen.getContext('2d');
      offCtx.imageSmoothingEnabled = false;
      offCtx.putImageData(imgData, 0, 0);

      ctx.save();
      ctx.imageSmoothingEnabled = false;
      if (lw !== width || lh !== height) {
        ctx.drawImage(offscreen, 0, 0, width, height);
      } else {
        ctx.drawImage(offscreen, 0, 0);
      }
      ctx.restore();
    }
  }, [layers, layerSettings, primaryLayer]);

  // ── Grid overlay ──────────────────────────────────────────────────────────
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay || !primaryLayer) return;
    const { width, height } = primaryLayer;
    // size the overlay canvas to match displayed size
    overlay.width = Math.round(width * zoom);
    overlay.height = Math.round(height * zoom);
    const ctx = overlay.getContext('2d');
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    const drawGrid = (gridPixelSize, color) => {
      if (zoom < GRID_THRESHOLD_ZOOM) return;
      const step = gridPixelSize * zoom;
      ctx.strokeStyle = color;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      for (let x = 0; x <= width; x += gridPixelSize) {
        const sx = Math.round(x * zoom) + 0.5;
        ctx.moveTo(sx, 0);
        ctx.lineTo(sx, overlay.height);
      }
      for (let y = 0; y <= height; y += gridPixelSize) {
        const sy = Math.round(y * zoom) + 0.5;
        ctx.moveTo(0, sy);
        ctx.lineTo(overlay.width, sy);
      }
      ctx.stroke();
    };

    if (gridSettings?.showGridRegionsFeatures) {
      drawGrid(1, 'rgba(255,255,100,0.35)');
    }
    if (gridSettings?.showGridOther) {
      drawGrid(2, 'rgba(100,200,255,0.25)');
    }
  }, [zoom, primaryLayer, gridSettings]);

  // ── WASD / Arrow key panning ───────────────────────────────────────────────
  useEffect(() => {
    const PAN_STEP = 40;
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      let dx = 0, dy = 0;
      switch (e.key) {
        case 'ArrowLeft': case 'a': dx = PAN_STEP; break;
        case 'ArrowRight': case 'd': dx = -PAN_STEP; break;
        case 'ArrowUp': case 'w': dy = PAN_STEP; break;
        case 'ArrowDown': case 's': dy = -PAN_STEP; break;
        default: return;
      }
      e.preventDefault();
      setPan(p => ({ x: p.x + dx, y: p.y + dy }));
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // ── Mouse wheel zoom ───────────────────────────────────────────────────────
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    setZoom(z => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z * factor)));
  }, []);

  // ── Mouse interactions ────────────────────────────────────────────────────
  const handleMouseDown = useCallback((e) => {
    if (e.button === 1 || e.altKey) {
      setIsPanning(true);
      panStart.current = { x: e.clientX, y: e.clientY };
      panOrigin.current = { ...panRef.current };
      e.preventDefault();
      return;
    }
    if (e.button === 0 && selectedColor && activeLayer) {
      setIsPainting(true);
      const [mx, my] = getMapCoords(e);
      const layer = layers[activeLayer];
      if (!layer) return;
      if (mx < 0 || my < 0 || mx >= layer.width || my >= layer.height) return;
      if (tool === 'bucket') {
        bucketFill(activeLayer, mx, my, selectedColor.rgb);
      } else {
        const half = Math.floor(brushSize / 2);
        for (let dy = -half; dy <= half; dy++) {
          for (let dx = -half; dx <= half; dx++) {
            const px = mx + dx, py = my + dy;
            if (px >= 0 && py >= 0 && px < layer.width && py < layer.height) {
              paintPixel(activeLayer, px, py, selectedColor.rgb);
            }
          }
        }
      }
    }
  }, [selectedColor, activeLayer, tool, brushSize, layers, getMapCoords, paintPixel, bucketFill]);

  const handleMouseMove = useCallback((e) => {
    if (isPanning && panStart.current) {
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      setPan({ x: panOrigin.current.x + dx, y: panOrigin.current.y + dy });
    }

    if (isPainting && selectedColor && activeLayer && tool === 'pencil') {
      const [mx, my] = getMapCoords(e);
      const layer = layers[activeLayer];
      if (!layer) return;
      if (mx < 0 || my < 0 || mx >= layer.width || my >= layer.height) return;
      const half = Math.floor(brushSize / 2);
      for (let dy2 = -half; dy2 <= half; dy2++) {
        for (let dx2 = -half; dx2 <= half; dx2++) {
          const px = mx + dx2, py = my + dy2;
          if (px >= 0 && py >= 0 && px < layer.width && py < layer.height) {
            paintPixel(activeLayer, px, py, selectedColor.rgb);
          }
        }
      }
    }

    // Build tooltip probe
    const [mx, my] = getMapCoords(e);
    if (primaryLayer && mx >= 0 && my >= 0 && mx < primaryLayer.width && my < primaryLayer.height) {
      const pixelData = {};
      for (const key of LAYER_ORDER) {
        const layer = layers[key];
        if (!layer) continue;
        // Map coords may differ for layers with different sizes
        const lx = Math.floor(mx * layer.width / primaryLayer.width);
        const ly = Math.floor(my * layer.height / primaryLayer.height);
        const idx = (ly * layer.width + lx) * 4;
        pixelData[key] = [layer.edited[idx], layer.edited[idx + 1], layer.edited[idx + 2]];
      }
      setProbe({ x: mx, y: my, screenX: e.clientX, screenY: e.clientY, pixelData });
    } else {
      setProbe(null);
    }
  }, [isPanning, isPainting, selectedColor, activeLayer, tool, brushSize, layers, primaryLayer, getMapCoords, paintPixel]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
    setIsPainting(false);
    panStart.current = null;
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsPanning(false);
    setIsPainting(false);
    panStart.current = null;
    setProbe(null);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  const cursorStyle = isPanning ? 'grabbing' : (tool === 'pencil' ? 'crosshair' : 'cell');

  const canvasW = primaryLayer ? primaryLayer.width * zoom : 0;
  const canvasH = primaryLayer ? primaryLayer.height * zoom : 0;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden bg-black"
      style={{ minHeight: 0 }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      {!primaryLayer && (
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
          Load map files to view the campaign map
        </div>
      )}

      {/* Map canvas */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: pan.y,
          left: pan.x,
          width: canvasW,
          height: canvasH,
          imageRendering: 'pixelated',
        }}
      />

      {/* Grid overlay canvas */}
      <canvas
        ref={overlayRef}
        style={{
          position: 'absolute',
          top: pan.y,
          left: pan.x,
          width: canvasW,
          height: canvasH,
          pointerEvents: 'none',
          imageRendering: 'pixelated',
        }}
      />

      {/* Tooltip */}
      {probe && (
        <MapPixelTooltip
          probe={probe}
          layers={layers}
          mapWidth={primaryLayer?.width}
          mapHeight={primaryLayer?.height}
        />
      )}

      {/* HUD */}
      <div className="absolute bottom-2 left-2 flex gap-3 text-[10px] text-white/70 bg-black/60 px-2 py-1 rounded font-mono pointer-events-none">
        <span>Zoom: {zoom.toFixed(1)}×</span>
        {probe && <span>({probe.x}, {probe.y})</span>}
        <span className="text-white/40">WASD/↑↓←→ pan</span>
      </div>

      {/* Zoom buttons */}
      <div className="absolute top-2 right-2 flex flex-col gap-1">
        <button onClick={() => setZoom(z => Math.min(MAX_ZOOM, z * 1.5))} className="w-7 h-7 bg-black/60 text-white rounded text-lg flex items-center justify-center hover:bg-black/80">+</button>
        <button onClick={() => setZoom(1)} className="w-7 h-7 bg-black/60 text-white rounded text-[10px] flex items-center justify-center hover:bg-black/80">1:1</button>
        <button onClick={() => setZoom(z => Math.max(MIN_ZOOM, z / 1.5))} className="w-7 h-7 bg-black/60 text-white rounded text-lg flex items-center justify-center hover:bg-black/80">−</button>
      </div>
    </div>
  );
}