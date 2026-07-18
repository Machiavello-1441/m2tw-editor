import React, { useRef, useEffect, useCallback, useState } from 'react';
import { MapContainer, TileLayer, ImageOverlay, useMap, useMapEvents } from 'react-leaflet';
import { LAYER_DEFS } from './mapLayerConstants';
import MapPixelTooltip from './MapPixelTooltip';
import StratOverlay from './StratOverlay';
import 'leaflet/dist/leaflet.css';

const DRAW_ORDER = ['heights', 'ground', 'climates', 'regions', 'features', 'fog'];

const CURSOR_PENCIL  = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Crect x='10' y='2' width='4' height='3' rx='1' fill='%23f59e0b' stroke='%23000' stroke-width='1' transform='rotate(-45 12 12)'/%3E%3Crect x='10' y='5' width='4' height='11' fill='%23fff' stroke='%23000' stroke-width='1' transform='rotate(-45 12 12)'/%3E%3Cpolygon points='10,16 14,16 12,20' fill='%23f5c842' stroke='%23000' stroke-width='1' transform='rotate(-45 12 12)'/%3E%3Cpolygon points='10.5,19 13.5,19 12,22' fill='%23333' transform='rotate(-45 12 12)'/%3E%3C/svg%3E") 2 22, crosshair`;
const CURSOR_PIPETTE = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Crect x='9' y='3' width='6' height='10' rx='3' fill='%2338bdf8' stroke='%23000' stroke-width='1.2'/%3E%3Crect x='10.5' y='13' width='3' height='5' fill='%2338bdf8' stroke='%23000' stroke-width='1'/%3E%3Cpolygon points='10.5,18 13.5,18 12,22' fill='%2338bdf8' stroke='%23000' stroke-width='1'/%3E%3Crect x='10' y='5' width='4' height='1.5' rx='0.5' fill='white' opacity='0.6'/%3E%3C/svg%3E") 12 22, crosshair`;
const CURSOR_BUCKET  = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cpath d='M3 8 L8 3 L11 6 L6 11 Z' fill='%23f59e0b' stroke='%23000' stroke-width='1'/%3E%3Crect x='9' y='8' width='3' height='7' rx='1' fill='%23ccc' stroke='%23000' stroke-width='0.8' transform='rotate(-45 10.5 11.5)'/%3E%3Cpath d='M13 11 Q18 13 19 16 Q21 20 18 21 Q15 22 14 19 Q13 16 13 11 Z' fill='%2338bdf8' stroke='%23000' stroke-width='1'/%3E%3Ccircle cx='17.5' cy='20' r='1.5' fill='%2338bdf8' stroke='%23000' stroke-width='0.8'/%3E%3C/svg%3E") 20 20, crosshair`;

export function floodFillRGB(data, width, height, sx, sy, nr, ng, nb, tolerance = 4) {
  const startI = (sy * width + sx) * 4;
  const tr = data[startI], tg = data[startI+1], tb = data[startI+2];
  if (tr === nr && tg === ng && tb === nb) return;
  const stack = [[sx, sy]];
  const visited = new Uint8Array(width * height);
  while (stack.length) {
    const [x, y] = stack.pop();
    if (x < 0 || y < 0 || x >= width || y >= height) continue;
    const pi = y * width + x;
    if (visited[pi]) continue;
    visited[pi] = 1;
    const i = pi * 4;
    if (Math.abs(data[i]-tr) > tolerance || Math.abs(data[i+1]-tg) > tolerance || Math.abs(data[i+2]-tb) > tolerance) continue;
    data[i] = nr; data[i+1] = ng; data[i+2] = nb;
    stack.push([x+1,y],[x-1,y],[x,y+1],[x,y-1]);
  }
}

function makeBlackTransparent(data, width, height) {
  const rgba = new Uint8ClampedArray(data);
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i] < 12 && rgba[i+1] < 12 && rgba[i+2] < 12) rgba[i+3] = 0;
  }
  return createImageBitmap(new ImageData(rgba, width, height));
}

function makeWhiteTransparent(data, width, height) {
  const rgba = new Uint8ClampedArray(data);
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i] > 243 && rgba[i+1] > 243 && rgba[i+2] > 243) rgba[i+3] = 0;
  }
  return createImageBitmap(new ImageData(rgba, width, height));
}

function buildCitiesPortsBitmap(data, width, height) {
  const out = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i+1], b = data[i+2];
    const isCity = r < 12 && g < 12 && b < 12;
    const isPort = r > 243 && g > 243 && b > 243;
    if (isCity || isPort) { out[i]=r; out[i+1]=g; out[i+2]=b; out[i+3]=255; }
  }
  return createImageBitmap(new ImageData(out, width, height));
}

/** Convert a layer's bitmap to a data URL for ImageOverlay */
function bitmapToDataURL(bitmap) {
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width; canvas.height = bitmap.height;
  canvas.getContext('2d').drawImage(bitmap, 0, 0);
  return canvas.toDataURL();
}

/** Get map pixel dimensions from loaded layers */
function getMapSize(layers) {
  const reg = layers['regions'];
  if (reg?.bitmap) return { w: reg.bitmap.width, h: reg.bitmap.height };
  let w = 0, h = 0;
  for (const def of LAYER_DEFS) {
    const s = layers[def.id];
    if (s?.bitmap) { if (s.bitmap.width > w) w = s.bitmap.width; if (s.bitmap.height > h) h = s.bitmap.height; }
  }
  return { w, h };
}

// ── Sub-components that must live inside MapContainer ──────────────────────

/** Syncs Leaflet map view changes to the parent via onTransformChange */
function MapSyncHandler({ onTransformChange, jumpRef, osmBbox }) {
  const map = useMap();

  // Expose jumpRef so parent can jump to a pixel coordinate
  useEffect(() => {
    if (!jumpRef || !osmBbox) return;
    jumpRef.current = (mapX, mapY, mapW, mapH) => {
      if (!osmBbox || !mapW || !mapH) return;
      const z = map.getZoom();
      const swPx = map.project([osmBbox.south, osmBbox.west], z);
      const nePx = map.project([osmBbox.north, osmBbox.east], z);
      const projX = swPx.x + (mapX / mapW) * (nePx.x - swPx.x);
      const projY = nePx.y + (mapY / mapH) * (swPx.y - nePx.y);
      const latlng = map.unproject([projX, projY], z);
      map.setView(latlng, z);
    };
  }, [jumpRef, map, osmBbox]);

  useMapEvents({
    move() {
      const c = map.getCenter();
      const z = map.getZoom();
      if (onTransformChange) onTransformChange({ center: [c.lat, c.lng], zoom: z });
    },
    zoom() {
      const c = map.getCenter();
      const z = map.getZoom();
      if (onTransformChange) onTransformChange({ center: [c.lat, c.lng], zoom: z });
    },
  });
  return null;
}

/** Handles painting on a transparent canvas overlaid on Leaflet */
function PaintCanvas({
  layers, paintState, onPaint, osmBbox,
  onRegionClick, showTooltip, regionsData, settlementNames,
  showPixelGrid,
}) {
  const map = useMap();
  const canvasRef = useRef(null);
  const isPainting = useRef(false);
  const didDrag = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const rafRef = useRef(null);
  const pendingPaint = useRef(null);
  const cursorPosRef = useRef(null); // current map px for cursor preview
  const [probe, setProbe] = useState(null);
  const { w: mapW, h: mapH } = getMapSize(layers);

  // Dimensions to use for the grid and cursor preview:
  // when painting, use the active layer's own dimensions;
  // otherwise use the topmost visible layer's dimensions.
  const getGridDims = useCallback(() => {
    if (paintState?.active && paintState.layerId) {
      const l = layers[paintState.layerId];
      if (l?.width && l?.height) return { gW: l.width, gH: l.height };
    }
    // topmost visible layer (reverse draw order)
    for (const id of [...DRAW_ORDER].reverse()) {
      const l = layers[id];
      if (l?.bitmap && (l.visible ?? true)) return { gW: l.width || l.bitmap.width, gH: l.height || l.bitmap.height };
    }
    return { gW: mapW, gH: mapH };
  }, [paintState, layers, mapW, mapH]);

  // Keep canvas sized to the Leaflet container
  useEffect(() => {
    const container = map.getContainer();
    const resize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width  = container.clientWidth;
      canvas.height = container.clientHeight;
      drawCanvas();
    };
    resize();
    map.on('resize', resize);
    map.on('move zoom', drawCanvas);
    return () => {
      map.off('resize', resize);
      map.off('move zoom', drawCanvas);
    };
  }, [map]); // eslint-disable-line

  // Convert screen point → map pixel coordinate. Going through
  // latLngToContainerPoint keeps hit-testing consistent with what Leaflet
  // actually paints (no separate scale/bounds bookkeeping that drifts on
  // sub-pixel zoom levels, which previously made the preview cell shorter
  // than the pixel underneath it).
  const screenToMapPx = useCallback((clientX, clientY) => {
    if (!osmBbox || !mapW || !mapH) return null;
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const sx = clientX - rect.left, sy = clientY - rect.top;
    const swC = map.latLngToContainerPoint([osmBbox.south, osmBbox.west]);
    const neC = map.latLngToContainerPoint([osmBbox.north, osmBbox.east]);
    const imageW = neC.x - swC.x;
    const imageH = swC.y - neC.y; // south sits below north in container space
    if (!imageW || !imageH) return null;
    const fracX = (sx - swC.x) / imageW;
    const fracY = (sy - neC.y) / imageH;
    const px = Math.floor(fracX * mapW);
    const py = Math.floor(fracY * mapH);
    return { px, py, fracX, fracY };
  }, [map, osmBbox, mapW, mapH]);

  // Map-pixel centre → Leaflet LatLng for client-image-alignment tools.
  const mapPxToScreen = useCallback((px, py) => {
    if (!osmBbox || !mapW || !mapH) return null;
    const swC = map.latLngToContainerPoint([osmBbox.south, osmBbox.west]);
    const neC = map.latLngToContainerPoint([osmBbox.north, osmBbox.east]);
    const cx = swC.x + ((px + 0.5) / mapW) * (neC.x - swC.x);
    const cy = neC.y + ((py + 0.5) / mapH) * (swC.y - neC.y);
    return map.containerPointToLatLng([cx, cy]);
  }, [map, osmBbox, mapW, mapH]);

  // Draw pixel-grid + cursor preview on the canvas. All math goes through
  // latLngToContainerPoint (= what Leaflet actually paints), so the brush
  // preview lines up one-to-one with the pixel underneath the cursor — no
  // extra scale/bounds bookkeeping that previously shrank the cell from the
  // bottom on sub-pixel zoom levels.
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!osmBbox || !mapW || !mapH) return;

    const swC = map.latLngToContainerPoint([osmBbox.south, osmBbox.west]);
    const neC = map.latLngToContainerPoint([osmBbox.north, osmBbox.east]);
    const baseX = swC.x;
    const baseY = neC.y; // top of the image in container space (north is up)
    const imageW = neC.x - swC.x;
    const imageH = swC.y - neC.y; // positive: south sits below north

    // Helper: map-image pixel → screen rect (NO Math.max(1) clipping — that
    // was inflating sub-pixel cells and shaving the visible bottom edge).
    const cellRect = (gW, gH, px, py) => {
      const x0 = baseX + (px       / gW) * imageW;
      const x1 = baseX + ((px + 1) / gW) * imageW;
      const y0 = baseY + (py       / gH) * imageH;
      const y1 = baseY + ((py + 1) / gH) * imageH;
      return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    };

    // ── Pixel grid ─────────────────────────────────────────────────────────
    if (showPixelGrid) {
      const { gW, gH } = getGridDims();
      if (imageW > 0 && imageH > 0 && Math.abs(imageW / gW) >= 4) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        for (let gx = 0; gx <= gW; gx++) {
          const sx = baseX + (gx / gW) * imageW;
          ctx.moveTo(sx, 0); ctx.lineTo(sx, canvas.height);
        }
        for (let gy = 0; gy <= gH; gy++) {
          const sy = baseY + (gy / gH) * imageH;
          ctx.moveTo(0, sy); ctx.lineTo(canvas.width, sy);
        }
        ctx.stroke();
        ctx.restore();
      }
    }

    // ── Cursor / brush preview ─────────────────────────────────────────────
    const cur = cursorPosRef.current;
    if (cur && paintState?.active && paintState.tool === 'pencil') {
      const { gW, gH } = getGridDims();
      const cpx = Math.floor(cur.fracX * gW);
      const cpy = Math.floor(cur.fracY * gH);
      const { paintColor, brushSize = 1 } = paintState;
      const half = Math.floor(brushSize / 2);
      ctx.save();
      ctx.lineWidth = 1;
      for (let dy = -half; dy <= half; dy++) {
        for (let dx = -half; dx <= half; dx++) {
          const bx = cpx + dx, by = cpy + dy;
          if (bx < 0 || by < 0 || bx >= gW || by >= gH) continue;
          const { x, y, w, h } = cellRect(gW, gH, bx, by);
          ctx.fillStyle = `rgba(${paintColor.r},${paintColor.g},${paintColor.b},0.6)`;
          ctx.fillRect(x, y, w, h);
          ctx.strokeStyle = 'rgba(255,255,255,0.9)';
          ctx.strokeRect(x + 0.5, y + 0.5, Math.max(0, w - 1), Math.max(0, h - 1));
        }
      }
      ctx.restore();
    }
  }, [map, osmBbox, mapW, mapH, showPixelGrid, paintState, getGridDims]);

  // Redraw canvas whenever relevant state changes
  useEffect(() => { drawCanvas(); }, [drawCanvas]);

  const doPaint = useCallback((clientX, clientY, tool) => {
    if (!paintState?.active || !onPaint) return;
    const pos = screenToMapPx(clientX, clientY);
    if (!pos) return;
    const { layerId, paintColor, brushSize } = paintState;
    const layer = layers[layerId];
    if (!layer?.data) return;
    // Go directly from geographic fractions → layer pixel space to avoid
    // any intermediate rounding through mapW/mapH (which may differ in resolution)
    const lx = Math.floor(pos.fracX * layer.width);
    const ly = Math.floor(pos.fracY * layer.height);
    if (lx < 0 || ly < 0 || lx >= layer.width || ly >= layer.height) return;
    if (tool === 'bucket') {
      onPaint('bucket', layerId, paintColor, null, { x: lx, y: ly });
    } else if (tool === 'pipette') {
      const i = (ly * layer.width + lx) * 4;
      onPaint('pipette', layerId, { r: layer.data[i], g: layer.data[i+1], b: layer.data[i+2] }, null, null);
    } else {
      const half = Math.floor((brushSize || 1) / 2);
      const patches = [];
      for (let dy = -half; dy <= half; dy++) {
        for (let dx = -half; dx <= half; dx++) {
          const px2 = lx + dx, py2 = ly + dy;
          if (px2 >= 0 && py2 >= 0 && px2 < layer.width && py2 < layer.height) patches.push({ x: px2, y: py2 });
        }
      }
      onPaint('pencil', layerId, paintColor, patches, null);
    }
  }, [paintState, onPaint, screenToMapPx, layers, mapW, mapH]);

  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    didDrag.current = false;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    if (paintState?.active) {
      isPainting.current = true;
      map.dragging.disable();
      if (paintState.tool === 'bucket') doPaint(e.clientX, e.clientY, 'bucket');
      else if (paintState.tool === 'pipette') doPaint(e.clientX, e.clientY, 'pipette');
      else doPaint(e.clientX, e.clientY, 'pencil');
    }
  }, [paintState, doPaint, map]);

  const handleMouseMove = useCallback((e) => {
    const dx = e.clientX - lastMouse.current.x, dy = e.clientY - lastMouse.current.y;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) didDrag.current = true;
    lastMouse.current = { x: e.clientX, y: e.clientY };

    // Update cursor preview position (store fracs so drawCanvas uses active layer dims)
    if (osmBbox && mapW > 0) {
      const pos = screenToMapPx(e.clientX, e.clientY);
      cursorPosRef.current = pos && pos.fracX >= 0 && pos.fracX <= 1 && pos.fracY >= 0 && pos.fracY <= 1 ? pos : null;
    }

    // Throttle paint calls via RAF
    if (isPainting.current && paintState?.active && paintState.tool === 'pencil') {
      pendingPaint.current = { x: e.clientX, y: e.clientY };
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null;
          if (pendingPaint.current) {
            doPaint(pendingPaint.current.x, pendingPaint.current.y, 'pencil');
            pendingPaint.current = null;
          }
          drawCanvas();
        });
      }
    } else {
      drawCanvas();
    }

    // Probe for tooltip
    if (mapW > 0 && osmBbox) {
      const pos = screenToMapPx(e.clientX, e.clientY);
      if (pos && pos.px >= 0 && pos.py >= 0 && pos.px < mapW && pos.py < mapH) {
        const canvas = canvasRef.current;
        const rect = canvas?.getBoundingClientRect();
        const sx = e.clientX - (rect?.left ?? 0), sy = e.clientY - (rect?.top ?? 0);
        const pixelData = {};
        for (const def of LAYER_DEFS) {
          const state = layers[def.id];
          if (!state?.data) continue;
          const nx = Math.floor(pos.fracX * state.width);
          const ny = Math.floor(pos.fracY * state.height);
          const idx = (ny * state.width + nx) * 4;
          pixelData[def.id] = { r: state.data[idx], g: state.data[idx+1], b: state.data[idx+2], a: state.data[idx+3] };
        }
        setProbe({ x: pos.px, y: pos.py, screenX: sx, screenY: sy, pixelData });
      } else {
        setProbe(null);
      }
    }
  }, [paintState, doPaint, drawCanvas, screenToMapPx, layers, mapW, mapH, osmBbox]);

  const handleMouseUp = useCallback((e) => {
    if (isPainting.current) {
      isPainting.current = false;
      map.dragging.enable();
      return;
    }
    if (!didDrag.current && mapW > 0 && onRegionClick && osmBbox) {
      const pos = screenToMapPx(e.clientX, e.clientY);
      if (pos) {
        const regL = layers['regions'];
        const rx = Math.floor(pos.fracX * (regL?.width || mapW));
        const ry = Math.floor(pos.fracY * (regL?.height || mapH));
        if (rx >= 0 && ry >= 0) onRegionClick(rx, ry);
      }
    }
    didDrag.current = false;
  }, [map, mapW, mapH, onRegionClick, screenToMapPx, layers, osmBbox]);

  const handleMouseLeave = useCallback(() => {
    if (isPainting.current) {
      isPainting.current = false;
      map.dragging.enable();
    }
    cursorPosRef.current = null;
    drawCanvas();
    setProbe(null);
  }, [map, drawCanvas]);

  // Use crosshair cursor always — the canvas draws the preview
  const cursorStyle = paintState?.active && paintState.tool === 'pipette' ? CURSOR_PIPETTE
    : paintState?.active && paintState.tool === 'bucket' ? CURSOR_BUCKET
    : 'crosshair';

  const regLayer = layers['regions'];
  const dispW = regLayer?.width || mapW;
  const dispH = regLayer?.height || mapH;

  return (
    <>
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute', inset: 0, zIndex: 500,
          cursor: cursorStyle, pointerEvents: 'all',
          width: '100%', height: '100%',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      />
      {probe && showTooltip && (
        <MapPixelTooltip probe={probe} layers={layers} mapWidth={dispW} mapHeight={dispH} regionsData={regionsData} settlementNames={settlementNames} />
      )}
    </>
  );
}

/** Renders TGA layer bitmaps as Leaflet ImageOverlays */
function TgaLayerOverlays({ layers, regionsMode, osmBbox }) {
  const [dataUrls, setDataUrls] = useState({});
  const [transparentBitmaps, setTransparentBitmaps] = useState({});

  // Build transparent variants for features/fog/regions-cities
  useEffect(() => {
    const featState = layers['features'];
    if (featState?.data && transparentBitmaps.features?.src !== featState.data) {
      makeBlackTransparent(featState.data, featState.width, featState.height)
        .then(bmp => setTransparentBitmaps(p => ({ ...p, features: { bmp, src: featState.data } })));
    }
    const fogState = layers['fog'];
    if (fogState?.data && transparentBitmaps.fog?.src !== fogState.data) {
      makeWhiteTransparent(fogState.data, fogState.width, fogState.height)
        .then(bmp => setTransparentBitmaps(p => ({ ...p, fog: { bmp, src: fogState.data } })));
    }
    const regState = layers['regions'];
    if (regState?.data && transparentBitmaps.citiesports?.src !== regState.data) {
      buildCitiesPortsBitmap(regState.data, regState.width, regState.height)
        .then(bmp => setTransparentBitmaps(p => ({ ...p, citiesports: { bmp, src: regState.data } })));
    }
  }, [layers]);

  // Convert bitmaps → data URLs for changed layers
  useEffect(() => {
    const updates = {};
    for (const id of DRAW_ORDER) {
      const state = layers[id];
      if (!state?.bitmap) continue;
      if (!(state.visible ?? LAYER_DEFS.find(d => d.id === id)?.defaultVisible)) continue;
      let bmp = state.bitmap;
      if (id === 'features' && transparentBitmaps.features?.bmp) bmp = transparentBitmaps.features.bmp;
      else if (id === 'fog' && transparentBitmaps.fog?.bmp) bmp = transparentBitmaps.fog.bmp;
      else if (id === 'regions' && regionsMode === 'citiesports' && transparentBitmaps.citiesports?.bmp) bmp = transparentBitmaps.citiesports.bmp;
      updates[id] = bitmapToDataURL(bmp);
    }
    setDataUrls(updates);
  }, [layers, regionsMode, transparentBitmaps]);

  if (!osmBbox) return null;
  const bounds = [[osmBbox.south, osmBbox.west], [osmBbox.north, osmBbox.east]];

  return (
    <>
      {DRAW_ORDER.map(id => {
        const state = layers[id];
        const def = LAYER_DEFS.find(d => d.id === id);
        if (!state?.bitmap) return null;
        if (!(state.visible ?? def?.defaultVisible)) return null;
        const url = dataUrls[id];
        if (!url) return null;
        return (
          <ImageOverlay
            key={id}
            url={url}
            bounds={bounds}
            opacity={state.opacity ?? def?.defaultOpacity ?? 1}
            className="pixelated-overlay"
            zIndex={DRAW_ORDER.indexOf(id) + 200}
          />
        );
      })}
    </>
  );
}

// ── Main exported component ────────────────────────────────────────────────

export default function MapCanvas({
  layers, regionsMode = 'fill',
  onRegionClick, jumpRef,
  paintState, onPaint,
  showPixelGrid = false,
  showTooltip = true,
  osmBbox = null,
  osmOpacity = 0.6,
  showOsm = true,
  showTopo = true,
  onTransformChange,
  regionsData,
  settlementNames,
  highlightRegion,
  // Strat overlay props
  overlayItems = [],
  visibleCategories,
  selectedId,
  onSelectItem,
  onMoveItem,
  onDoubleClickItem,
}) {
  const { w: mapW, h: mapH } = getMapSize(layers);
  const anyLoaded = Object.values(layers).some(s => s?.bitmap);

  // When no bbox_coords.txt is loaded, synthesize an equatorial bounding box
  // whose aspect ratio matches the TGA. That keeps Leaflet's pan/zoom + paint
  // + tooltip logic working — without it the no-bbox view was a dead static
  // canvas where zoom was unavailable.
  const synthBbox = React.useMemo(() => {
    if (osmBbox || !mapW || !mapH) return null;
    const aspect = mapW / mapH;
    const span = 4; // degrees of latitude near the equator — keeps Mercator
                    // distortion negligible so cell sizes stay uniform
    return {
      north: 2 + span / 2,
      south: 2 - span / 2,
      east:  (span * aspect) / 2,
      west: -(span * aspect) / 2,
      _synth: true,
    };
  }, [osmBbox, mapW, mapH]);
  const effectiveBbox = osmBbox || synthBbox;

  if (!effectiveBbox) {
    return (
      <div className="relative w-full h-full bg-slate-950">
        <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm flex-col gap-3 pointer-events-none">
          <div className="text-4xl">🗺️</div>
          <div className="bg-slate-900/80 rounded px-4 py-2 text-center">
            Load TGA map files to begin painting, or import a <strong>bbox_coords.txt</strong> to align with the OSM map
          </div>
        </div>
      </div>
    );
  }

  const center = [
    (effectiveBbox.north + effectiveBbox.south) / 2,
    (effectiveBbox.east + effectiveBbox.west) / 2,
  ];
  const zoom = effectiveBbox._synth ? 3 : 5;

  return (
    <div className="relative w-full h-full">
      <MapContainer
        key={`${effectiveBbox.north}-${effectiveBbox.west}-${effectiveBbox._synth ? 'synth' : 'real'}`}
        center={center}
        zoom={zoom}
        minZoom={1}
        maxZoom={effectiveBbox._synth ? 12 : 19}
        style={{ width: '100%', height: '100%', background: '#1e293b' }}
        zoomControl={true}
      >
        {/* OSM tile layers only make sense for a real geographic bbox —
            silenced under the synthetic bounds */}
        {osmBbox && (
          <TileLayer
            url="https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png"
            attribution='&copy; OpenStreetMap contributors, HOT'
            opacity={showOsm ? osmOpacity : 0}
            maxZoom={19}
          />
        )}
        {osmBbox && (
          <TileLayer
            url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
            attribution='&copy; OpenTopoMap contributors'
            opacity={showTopo ? Math.max(0, osmOpacity - 0.3) : 0}
            maxZoom={17}
          />
        )}

        <TgaLayerOverlays layers={layers} regionsMode={regionsMode} osmBbox={effectiveBbox} />

        <MapSyncHandler onTransformChange={onTransformChange} jumpRef={jumpRef} osmBbox={effectiveBbox} />

        <StratOverlay
          items={overlayItems}
          osmBbox={effectiveBbox}
          mapW={mapW}
          mapH={mapH}
          visibleCategories={visibleCategories}
          selectedId={selectedId}
          onSelect={onSelectItem}
          onMoveItem={onMoveItem}
          onDoubleClick={onDoubleClickItem}
        />

        <PaintCanvas
          layers={layers}
          paintState={paintState}
          onPaint={onPaint}
          osmBbox={effectiveBbox}
          onRegionClick={onRegionClick}
          showTooltip={showTooltip}
          regionsData={regionsData}
          settlementNames={settlementNames}
          showPixelGrid={showPixelGrid}
        />
      </MapContainer>

      {anyLoaded && (
        <div className="absolute bottom-3 left-3 text-[10px] text-slate-400 font-mono bg-slate-900/70 rounded px-2 py-1 z-[600] pointer-events-none">
          {mapW}×{mapH}
          {effectiveBbox._synth && <span className="ml-1 text-slate-500">— synthetic bounds</span>}
          {paintState?.active && <span className="text-amber-500 ml-2">● PAINT [{paintState.tool}]</span>}
        </div>
      )}
    </div>
  );
}