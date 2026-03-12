import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useCampaignMap } from './CampaignMapContext';
import { LAYER_ORDER, LAYER_DEFS } from './MapLayerDefs';

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 100;

export default function MapCanvas() {
  const canvasRef = useRef(null);
  const {
    layers, layerSettings, activeLayer,
    tool, selectedColor, brushSize,
    paintPixel, bucketFill,
  } = useCampaignMap();

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [isPainting, setIsPainting] = useState(false);
  const panStart = useRef(null);
  const panOrigin = useRef(null);
  const [hoveredPixel, setHoveredPixel] = useState(null);

  // Get primary map dimensions from heights or first loaded layer
  const primaryLayer = layers.heights || layers[Object.keys(layers)[0]];

  const getMapCoords = useCallback((e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const cx = (e.clientX - rect.left - pan.x) / zoom;
    const cy = (e.clientY - rect.top - pan.y) / zoom;
    return [Math.floor(cx), Math.floor(cy)];
  }, [zoom, pan]);

  // Composite render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !primaryLayer) return;
    const ctx = canvas.getContext('2d');
    const { width, height } = primaryLayer;
    canvas.width = width;
    canvas.height = height;

    ctx.clearRect(0, 0, width, height);

    for (const key of LAYER_ORDER) {
      const layer = layers[key];
      const settings = layerSettings[key];
      if (!layer || !settings.visible) continue;
      if (settings.opacity <= 0) continue;

      const def = LAYER_DEFS[key];
      const sourceData = layer.edited;
      const { width: lw, height: lh } = layer;

      // Build imageData applying transparency rules
      const imgData = ctx.createImageData(lw, lh);
      const src = sourceData;
      const dst = imgData.data;
      const tc = def.transparentColor;

      for (let i = 0; i < lw * lh; i++) {
        const si = i * 4;
        const r = src[si], g = src[si+1], b = src[si+2];
        if (tc && r === tc[0] && g === tc[1] && b === tc[2]) {
          dst[si+3] = 0; // transparent
        } else {
          dst[si] = r; dst[si+1] = g; dst[si+2] = b;
          dst[si+3] = Math.round(settings.opacity * 255);
        }
      }

      // Draw to offscreen then composite
      const offscreen = document.createElement('canvas');
      offscreen.width = lw;
      offscreen.height = lh;
      const offCtx = offscreen.getContext('2d');
      offCtx.putImageData(imgData, 0, 0);

      ctx.save();
      // Scale to primary layer size if needed
      if (lw !== width || lh !== height) {
        ctx.drawImage(offscreen, 0, 0, width, height);
      } else {
        ctx.drawImage(offscreen, 0, 0);
      }
      ctx.restore();
    }
  }, [layers, layerSettings, primaryLayer]);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    setZoom(z => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z * factor)));
  }, []);

  const handleMouseDown = useCallback((e) => {
    if (e.button === 1 || e.altKey) {
      setIsPanning(true);
      panStart.current = { x: e.clientX, y: e.clientY };
      panOrigin.current = { ...pan };
      return;
    }
    if (e.button === 0 && selectedColor && activeLayer) {
      setIsPainting(true);
      const [mx, my] = getMapCoords(e, canvasRef.current);
      const layer = layers[activeLayer];
      if (!layer) return;
      if (mx < 0 || my < 0 || mx >= layer.width || my >= layer.height) return;
      if (tool === 'bucket') {
        bucketFill(activeLayer, mx, my, selectedColor.rgb);
      } else {
        // pencil with brush size
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
  }, [pan, selectedColor, activeLayer, tool, brushSize, layers, getMapCoords, paintPixel, bucketFill]);

  const handleMouseMove = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const [mx, my] = getMapCoords(e, canvas);
    setHoveredPixel({ x: mx, y: my });

    if (isPanning && panStart.current) {
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      setPan({ x: panOrigin.current.x + dx, y: panOrigin.current.y + dy });
      return;
    }
    if (isPainting && selectedColor && activeLayer && tool === 'pencil') {
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
  }, [isPanning, isPainting, selectedColor, activeLayer, tool, brushSize, layers, getMapCoords, paintPixel]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
    setIsPainting(false);
    panStart.current = null;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  const cursorStyle = isPanning ? 'grabbing' : (tool === 'pencil' ? 'crosshair' : 'cell');

  return (
    <div className="relative w-full h-full overflow-hidden bg-black" style={{ minHeight: 0 }}>
      {!primaryLayer && (
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
          Load map files to view the campaign map
        </div>
      )}
      <div
        className="absolute inset-0"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: cursorStyle }}
      >
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            top: pan.y,
            left: pan.x,
            width: primaryLayer ? primaryLayer.width * zoom : 0,
            height: primaryLayer ? primaryLayer.height * zoom : 0,
            imageRendering: 'pixelated',
            transformOrigin: '0 0',
          }}
        />
      </div>
      {/* HUD */}
      <div className="absolute bottom-2 left-2 flex gap-3 text-[10px] text-white/70 bg-black/60 px-2 py-1 rounded font-mono pointer-events-none">
        <span>Zoom: {zoom.toFixed(1)}x</span>
        {hoveredPixel && <span>Pos: {hoveredPixel.x}, {hoveredPixel.y}</span>}
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