import { useEffect, useRef } from 'react';

/**
 * OsmBackground — renders OSM tiles behind TGA layers.
 * Rendered inside MapCanvas's container div, absolutely positioned to fill it.
 */

const TILE_SOURCES = [
  'https://tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
  'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
];

function latToMercY(lat) {
  const r = lat * Math.PI / 180;
  return Math.log(Math.tan(Math.PI / 4 + r / 2));
}
function latToTileY(lat, zoom) {
  const n = Math.pow(2, zoom);
  const r = lat * Math.PI / 180;
  return (n * (1 - Math.log(Math.tan(Math.PI / 4 + r / 2)) / Math.PI)) / 2;
}
function lonToTileX(lon, zoom) {
  return ((lon + 180) / 360) * Math.pow(2, zoom);
}

function chooseBestZoom(bbox, mapW, scale) {
  const screenW = mapW * Math.max(scale, 0.05);
  // Clamp to a safe range; OSM max is 19
  for (let z = Math.min(19, 18); z >= 1; z--) {
    const tileCount = lonToTileX(bbox.east, z) - lonToTileX(bbox.west, z);
    if (tileCount <= 0) continue;
    const pxPerTile = screenW / tileCount;
    if (pxPerTile >= 64) return z;
  }
  return 1;
}

// Global tile cache: url → HTMLImageElement (loaded) | Promise | null (failed)
const tileCache = new Map();

function loadTile(url) {
  const cached = tileCache.get(url);
  if (cached instanceof HTMLImageElement) return Promise.resolve(cached);
  if (cached instanceof Promise) return cached;

  const p = new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { tileCache.set(url, img); resolve(img); };
    img.onerror = () => {
      // Try standard OSM as fallback
      const fallback = url.includes('hot')
        ? url.replace('tile.openstreetmap.fr/hot', 'tile.openstreetmap.org')
        : null;
      if (fallback) {
        const img2 = new Image();
        img2.crossOrigin = 'anonymous';
        img2.onload = () => { tileCache.set(url, img2); resolve(img2); };
        img2.onerror = () => { tileCache.set(url, null); resolve(null); };
        img2.src = fallback;
      } else {
        tileCache.set(url, null);
        resolve(null);
      }
    };
    img.src = url;
  });
  tileCache.set(url, p);
  return p;
}

export default function OsmBackground({ bbox, mapW, mapH, transform, opacity = 0.6 }) {
  const canvasRef   = useRef(null);
  const renderIdRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !bbox) return;

    // Use the canvas element's rendered size (layout size) as the draw surface
    const W = canvas.clientWidth;
    const H = canvas.clientHeight;
    if (W <= 0 || H <= 0) return;

    canvas.width  = W;
    canvas.height = H;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);

    const effW = mapW > 0 ? mapW : W;
    const effH = mapH > 0 ? mapH : H;

    const zoom = chooseBestZoom(bbox, effW, transform.scale);
    const n    = Math.pow(2, zoom);

    const txMin = Math.floor(lonToTileX(bbox.west,  zoom));
    const txMax = Math.ceil( lonToTileX(bbox.east,  zoom));
    const tyMin = Math.floor(latToTileY(bbox.north, zoom));
    const tyMax = Math.ceil( latToTileY(bbox.south, zoom));

    const mercNorth  = latToMercY(bbox.north);
    const mercSouth  = latToMercY(bbox.south);
    const mercRange  = mercNorth - mercSouth;
    const lonWest    = bbox.west  * Math.PI / 180;
    const lonRange   = (bbox.east - bbox.west) * Math.PI / 180;

    const tileToMercN  = ty => Math.PI * (1 - 2 * ty / n);
    const tileToLonRad = tx => (tx / n) * 2 * Math.PI - Math.PI;

    const geoToScreen = (mercN, lonRad) => ({
      x: ((lonRad - lonWest) / lonRange) * effW * transform.scale + transform.x,
      y: ((mercNorth - mercN) / mercRange) * effH * transform.scale + transform.y,
    });

    const renderId = ++renderIdRef.current;

    const drawTiles = (tiles) => {
      if (renderIdRef.current !== renderId) return;
      ctx.clearRect(0, 0, W, H);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      for (const { img, tx, ty } of tiles) {
        if (!img) continue;
        const tl = geoToScreen(tileToMercN(ty),     tileToLonRad(tx));
        const br = geoToScreen(tileToMercN(ty + 1), tileToLonRad(tx + 1));
        const dw = br.x - tl.x;
        const dh = br.y - tl.y;
        if (dw <= 0 || dh <= 0) continue;
        try { ctx.drawImage(img, tl.x, tl.y, dw, dh); } catch {}
      }
    };

    // Collect all tile jobs; also do an optimistic draw with cached ones
    const cachedNow = [];
    const jobs = [];
    for (let tx = txMin; tx < txMax; tx++) {
      for (let ty = tyMin; ty < tyMax; ty++) {
        const url = TILE_SOURCES[0]
          .replace('{z}', zoom)
          .replace('{x}', tx)
          .replace('{y}', ty);
        const c = tileCache.get(url);
        if (c instanceof HTMLImageElement) cachedNow.push({ img: c, tx, ty });
        jobs.push(loadTile(url).then(img => ({ img, tx, ty })));
      }
    }

    if (cachedNow.length > 0) drawTiles(cachedNow);
    Promise.all(jobs).then(drawTiles);

    return () => { renderIdRef.current++; };
  }, [bbox, mapW, mapH, transform, opacity]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        display: 'block',
        pointerEvents: 'none',
        zIndex: 0,
        opacity,
        transition: 'opacity 0.15s',
      }}
    />
  );
}