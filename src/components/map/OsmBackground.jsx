import { useEffect, useRef, useState } from 'react';

const TILE_URL = 'https://tile.openstreetmap.fr/hot/{z}/{x}/{y}.png';
const TILE_URL_FALLBACK = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

// OSM tile zoom caps at 19 for HOT, but we cap at 15 for performance
const MAX_ZOOM = 15;

function latToMercY(lat) {
  const r = lat * Math.PI / 180;
  return Math.log(Math.tan(Math.PI / 4 + r / 2));
}
function latToTileY(lat, z) {
  const n = Math.pow(2, z);
  return (n * (1 - latToMercY(lat) / Math.PI)) / 2;
}
function lonToTileX(lon, z) {
  return ((lon + 180) / 360) * Math.pow(2, z);
}

/**
 * Choose the OSM tile zoom level so each tile is between 128–512 screen pixels wide.
 * At very high map-zoom we clamp to MAX_ZOOM (tiles just get upscaled — still crisp).
 * At very low map-zoom we clamp to zoom 1.
 */
function chooseBestZoom(bbox, screenW) {
  for (let z = MAX_ZOOM; z >= 1; z--) {
    const tileCount = lonToTileX(bbox.east, z) - lonToTileX(bbox.west, z);
    const pxPerTile = screenW / tileCount;
    if (pxPerTile >= 128) return z;
  }
  return 1;
}

// Global tile cache: url → HTMLImageElement (resolved) | Promise
const tileCache = new Map();

function loadTile(url) {
  const hit = tileCache.get(url);
  if (hit instanceof HTMLImageElement) return Promise.resolve(hit);
  if (hit instanceof Promise) return hit;
  const p = new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload  = () => { tileCache.set(url, img); resolve(img); };
    img.onerror = () => {
      // try fallback tile server
      const url2 = url.includes('hot')
        ? url.replace('tile.openstreetmap.fr/hot', 'tile.openstreetmap.org')
        : null;
      if (url2) {
        const img2 = new Image();
        img2.crossOrigin = 'anonymous';
        img2.onload  = () => { tileCache.set(url, img2); resolve(img2); };
        img2.onerror = () => { tileCache.set(url, null); resolve(null); };
        img2.src = url2;
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
  const containerRef = useRef(null);
  const canvasRef    = useRef(null);
  const sizeRef      = useRef({ w: 0, h: 0 });
  const [, forceUpdate] = useState(0);

  // Track container size via ResizeObserver
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      const w = Math.round(width), h = Math.round(height);
      if (w !== sizeRef.current.w || h !== sizeRef.current.h) {
        sizeRef.current = { w, h };
        forceUpdate(v => v + 1);
      }
    });
    ro.observe(el);
    sizeRef.current = { w: el.clientWidth, h: el.clientHeight };
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !bbox) return;

    const { w: W, h: H } = sizeRef.current;
    if (W <= 0 || H <= 0) return;

    // Size the canvas backing store to the container (only when changed)
    if (canvas.width !== W || canvas.height !== H) {
      canvas.width  = W;
      canvas.height = H;
    }

    const ctx = canvas.getContext('2d');

    const effectiveMapW = mapW > 0 ? mapW : W;
    const effectiveMapH = mapH > 0 ? mapH : H;

    // Screen width covered by the full map at current zoom
    const screenMapW = effectiveMapW * transform.scale;
    const zoom = chooseBestZoom(bbox, screenMapW);
    const n    = Math.pow(2, zoom);

    // Tile range covering the bbox
    const txMin = Math.floor(lonToTileX(bbox.west,  zoom));
    const txMax = Math.ceil( lonToTileX(bbox.east,  zoom));
    const tyMin = Math.floor(latToTileY(bbox.north, zoom));
    const tyMax = Math.ceil( latToTileY(bbox.south, zoom));

    // Geo→screen projection helpers
    const mercNorth = latToMercY(bbox.north);
    const mercSouth = latToMercY(bbox.south);
    const mercRange = mercNorth - mercSouth;
    const lonWest   = bbox.west * Math.PI / 180;
    const lonRange  = (bbox.east - bbox.west) * Math.PI / 180;

    const tileMercN  = ty => Math.PI * (1 - 2 * ty / n);
    const tileLonRad = tx => (tx / n) * 2 * Math.PI - Math.PI;

    const geoToScreen = (mercN, lonRad) => ({
      x: ((lonRad - lonWest) / lonRange) * screenMapW + transform.x,
      y: ((mercNorth - mercN) / mercRange) * effectiveMapH * transform.scale + transform.y,
    });

    let cancelled = false;

    const drawTiles = (tiles) => {
      if (cancelled) return;
      ctx.clearRect(0, 0, W, H);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      for (const { img, tx, ty } of tiles) {
        if (!img) continue;
        const tl = geoToScreen(tileMercN(ty),     tileLonRad(tx));
        const br = geoToScreen(tileMercN(ty + 1), tileLonRad(tx + 1));
        const dw = br.x - tl.x, dh = br.y - tl.y;
        if (dw > 0 && dh > 0) {
          try { ctx.drawImage(img, tl.x, tl.y, dw, dh); } catch {}
        }
      }
    };

    // Collect tile URLs
    const tileList = [];
    for (let tx = txMin; tx < txMax; tx++) {
      for (let ty = tyMin; ty < tyMax; ty++) {
        tileList.push({ tx, ty, url: TILE_URL.replace('{z}', zoom).replace('{x}', tx).replace('{y}', ty) });
      }
    }

    // Immediate draw from cache
    const immediate = tileList.map(({ tx, ty, url }) => {
      const hit = tileCache.get(url);
      return { img: hit instanceof HTMLImageElement ? hit : null, tx, ty };
    });
    drawTiles(immediate);

    // Full draw once all tiles resolve
    Promise.all(tileList.map(({ tx, ty, url }) =>
      loadTile(url).then(img => ({ img, tx, ty }))
    )).then(drawTiles);

    return () => { cancelled = true; };
  }, [bbox, mapW, mapH, transform, sizeRef.current.w, sizeRef.current.h]);

  return (
    <div
      ref={containerRef}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0, opacity, transition: 'opacity 0.15s' }}
    >
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
    </div>
  );
}