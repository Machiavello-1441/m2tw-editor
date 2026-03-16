import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Globe } from 'lucide-react';

// Hardcoded fallback color map: rgb_key from map_ground_types.tga → display color
const GROUND_PRESETS = {
  '0,128,128':   { color: [106, 168, 122], name: 'Fertile Low' },
  '96,160,64':   { color: [85, 170, 55],   name: 'Fertile Medium' },
  '101,124,0':   { color: [100, 130, 20],  name: 'Fertile High' },
  '0,64,0':      { color: [22, 65, 22],    name: 'Forest Dense' },
  '0,128,0':     { color: [30, 110, 30],   name: 'Forest Sparse' },
  '128,128,64':  { color: [160, 150, 90],  name: 'Hills' },
  '196,128,128': { color: [175, 135, 110], name: 'Mountains High' },
  '98,65,65':    { color: [125, 85, 75],   name: 'Mountains Low' },
  '0,255,128':   { color: [55, 195, 125],  name: 'Swamp' },
  '255,255,255': { color: [230, 215, 150], name: 'Beach/Sand' },
  '64,64,64':    { color: [80, 80, 80],    name: 'Impassable Land' },
  '0,0,64':      { color: [20, 30, 100],   name: 'Impassable Sea' },
};

// Build color lookup: merges hardcoded presets with dynamically loaded aerial_ground_types
function buildColorLookup() {
  const lookup = { ...GROUND_PRESETS };
  const aerial = window._m2tw_aerial_ground_types;
  if (aerial) {
    for (const preset of Object.values(aerial)) {
      const key = `${preset.r},${preset.g},${preset.b}`;
      if (!lookup[key]) {
        lookup[key] = { color: [preset.r, preset.g, preset.b], name: preset.name };
      }
    }
  }
  return lookup;
}

function detectFeature(r, g, b) {
  if (r < 10 && g < 10 && b < 10) return null;
  if (r > 220 && g > 220 && b > 220) return 'source';
  if (g > 180 && b > 180 && r < 80)  return 'bridge';
  if (b > 150 && r < 80 && g < 80)   return 'river';
  if (r > 180 && g > 130 && b < 60)  return 'cliff';
  if (r > 180 && g < 60 && b < 60)   return 'volcano';
  return null;
}

const FEATURE_RGBA = {
  river:   [50,  100, 220, 210],
  source:  [150, 210, 255, 230],
  bridge:  [0,   220, 220, 240],
  cliff:   [220, 180, 30,  220],
  volcano: [210, 50,  10,  240],
};

function isSeaPixel(r, g, b) {
  return b > 150 && r < 80 && g < 80;
}

function loadImageData(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      c.getContext('2d').drawImage(img, 0, 0);
      const id = c.getContext('2d').getImageData(0, 0, img.width, img.height);
      resolve({ data: id.data, w: img.width, h: img.height });
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

// Pre-load TGA tile images for texture mode
async function preloadGroundTiles(groundData, gW, gH, groundTextures, aerialGroundTypes, season) {
  if (!groundTextures || !aerialGroundTypes || !groundData) return {};

  const rgbToPreset = {};
  for (const preset of Object.values(aerialGroundTypes)) {
    rgbToPreset[`${preset.r},${preset.g},${preset.b}`] = preset;
  }

  const uniqueKeys = new Set();
  for (let i = 0; i < gW * gH; i++) {
    const b = i * 4;
    uniqueKeys.add(`${groundData[b]},${groundData[b + 1]},${groundData[b + 2]}`);
  }

  const tileCache = {};
  for (const key of uniqueKeys) {
    const preset = rgbToPreset[key];
    if (!preset) continue;
    const texName = (season === 'winter' && preset.winter) ? preset.winter : preset.summer;
    if (!texName) continue;
    const stripped = texName.replace(/\.tga$/i, '').toLowerCase();
    const dataUrl = groundTextures[stripped];
    if (!dataUrl) continue;
    const tileData = await loadImageData(dataUrl);
    if (tileData) tileCache[key] = tileData;
  }
  return tileCache;
}

// Build the final terrain canvas with ground colors/textures + baked features + baked regions.
// Heights and ground maps are (2N+1)×(2M+1); features and regions are N×M.
// The Y-axis of ground/features/regions is inverted relative to heights.
async function buildTerrainCanvas(
  groundData, gW, gH,
  featData, fW, fH,
  regData, rW, rH,
  showFeatures, showRegions,
  useTextures, tileCache, colorLookup
) {
  const canvas = document.createElement('canvas');
  canvas.width = gW; canvas.height = gH;
  const ctx = canvas.getContext('2d');
  const out = ctx.createImageData(gW, gH);
  const d = out.data;

  // ── Ground layer ──────────────────────────────────────────────────────────
  for (let j = 0; j < gH; j++) {
    for (let i = 0; i < gW; i++) {
      const dBase = (j * gW + i) * 4;
      let cr = 60, cg = 110, cb = 55;

      if (groundData) {
        const gy = gH - 1 - j;   // Y-flip: ground TGA is inverted vs heights
        const gSrc = (gy * gW + i) * 4;
        const gr = groundData[gSrc], gg = groundData[gSrc + 1], gb = groundData[gSrc + 2];
        const key = `${gr},${gg},${gb}`;

        if (useTextures && tileCache[key]) {
          const tile = tileCache[key];
          const tx = i % tile.w;
          const ty = j % tile.h;
          const tSrc = (ty * tile.w + tx) * 4;
          cr = tile.data[tSrc]; cg = tile.data[tSrc + 1]; cb = tile.data[tSrc + 2];
        } else {
          const p = colorLookup[key];
          if (p) { cr = p.color[0]; cg = p.color[1]; cb = p.color[2]; }
          else   { cr = gr; cg = gg; cb = gb; }
        }
      }

      d[dBase] = cr; d[dBase + 1] = cg; d[dBase + 2] = cb; d[dBase + 3] = 255;
    }
  }

  // ── Features overlay ──────────────────────────────────────────────────────
  // features map is ~half the size: fW ≈ (gW-1)/2, fH ≈ (gH-1)/2
  // Mapping: fx = floor(i/2), fy_flipped = fH-1-floor(j/2)
  if (featData && showFeatures && fW && fH) {
    for (let j = 0; j < gH; j++) {
      for (let i = 0; i < gW; i++) {
        const fx = Math.min(Math.floor(i / 2), fW - 1);
        const fy = Math.min(fH - 1 - Math.floor(j / 2), fH - 1);
        const fSrc = (fy * fW + fx) * 4;
        const feat = detectFeature(featData[fSrc], featData[fSrc + 1], featData[fSrc + 2]);
        if (feat) {
          const dBase = (j * gW + i) * 4;
          const c = FEATURE_RGBA[feat];
          const a = c[3] / 255;
          d[dBase]     = Math.round(d[dBase]     * (1 - a) + c[0] * a);
          d[dBase + 1] = Math.round(d[dBase + 1] * (1 - a) + c[1] * a);
          d[dBase + 2] = Math.round(d[dBase + 2] * (1 - a) + c[2] * a);
        }
      }
    }
  }

  // ── Regions overlay ───────────────────────────────────────────────────────
  if (regData && showRegions && rW && rH) {
    for (let j = 0; j < gH; j++) {
      for (let i = 0; i < gW; i++) {
        const rx = Math.min(Math.floor(i / 2), rW - 1);
        const ry = Math.min(rH - 1 - Math.floor(j / 2), rH - 1);
        const rSrc = (ry * rW + rx) * 4;
        const rr = regData[rSrc], rg = regData[rSrc + 1], rb = regData[rSrc + 2];
        const isBlack = rr < 15 && rg < 15 && rb < 15;
        const isWhite = rr > 240 && rg > 240 && rb > 240;
        const dBase = (j * gW + i) * 4;
        if (isBlack || isWhite) {
          // City = gold, Port = cyan — fully opaque marker
          const c = isBlack ? [255, 220, 0] : [0, 220, 255];
          d[dBase] = c[0]; d[dBase + 1] = c[1]; d[dBase + 2] = c[2];
        } else {
          // Region fill — semi-transparent tint
          const a = 0.25;
          d[dBase]     = Math.round(d[dBase]     * (1 - a) + rr * a);
          d[dBase + 1] = Math.round(d[dBase + 1] * (1 - a) + rg * a);
          d[dBase + 2] = Math.round(d[dBase + 2] * (1 - a) + rb * a);
        }
      }
    }
  }

  ctx.putImageData(out, 0, 0);
  return canvas;
}

const LEGEND_ITEMS = [
  { label: 'River',       color: '#3264dc' },
  { label: 'River Source',color: '#96c8ff' },
  { label: 'Bridge',      color: '#00dcdc' },
  { label: 'Cliff',       color: '#dcb41e' },
  { label: 'Volcano',     color: '#d23200' },
  { label: 'City (region)',  color: '#ffdc00' },
  { label: 'Port (region)',  color: '#00dcff' },
];

export default function Map3DPreview({ layers }) {
  const mountRef    = useRef(null);
  const cleanupRef  = useRef(null);

  const [heightScale,  setHeightScale]  = useState(30);
  const [showFeatures, setShowFeatures] = useState(true);
  const [showRegions,  setShowRegions]  = useState(false);
  const [useTextures,  setUseTextures]  = useState(false);
  const [season,       setSeason]       = useState('summer');
  const [showLegend,   setShowLegend]   = useState(false);
  const [status,       setStatus]       = useState('idle');

  const hasGroundTextures = !!(window._m2tw_ground_textures && Object.keys(window._m2tw_ground_textures).length > 0);
  const hasAerialDef      = !!(window._m2tw_aerial_ground_types);

  useEffect(() => {
    if (cleanupRef.current) { cleanupRef.current(); cleanupRef.current = null; }

    const heightsLayer = layers.heights;
    if (!heightsLayer?.data || !heightsLayer?.width || !heightsLayer?.height) {
      setStatus('no_data');
      return;
    }

    setStatus('building');

    const { data: heightsData, width: mapW, height: mapH } = heightsLayer;
    const groundData   = layers.ground?.data;
    const featuresData = layers.features?.data;
    const featW        = layers.features?.width  ?? 0;
    const featH        = layers.features?.height ?? 0;
    const regionsData  = layers.regions?.data;
    const regW         = layers.regions?.width   ?? 0;
    const regH         = layers.regions?.height  ?? 0;

    let cancelled = false;

    const buildTimeout = setTimeout(async () => {
      if (!mountRef.current || cancelled) return;

      // ── Pre-load tile textures (async) ──────────────────────────────────
      let tileCache = {};
      if (useTextures && hasGroundTextures && hasAerialDef && groundData) {
        tileCache = await preloadGroundTiles(
          groundData, mapW, mapH,
          window._m2tw_ground_textures,
          window._m2tw_aerial_ground_types,
          season
        );
      }
      if (cancelled || !mountRef.current) return;

      const colorLookup = buildColorLookup();

      // ── Build terrain canvas ─────────────────────────────────────────────
      const terrainCanvas = await buildTerrainCanvas(
        groundData, mapW, mapH,
        featuresData, featW, featH,
        regionsData,  regW,  regH,
        showFeatures, showRegions,
        useTextures, tileCache, colorLookup
      );
      if (cancelled || !mountRef.current) return;

      // ── Three.js scene ──────────────────────────────────────────────────
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x1a2535);
      scene.fog = new THREE.FogExp2(0x1a2535, 0.0005);

      const cw = mountRef.current.clientWidth;
      const ch = mountRef.current.clientHeight;
      const camera = new THREE.PerspectiveCamera(55, cw / ch, 0.1, 100000);
      camera.position.set(0, mapH * 0.7, mapH * 0.75);
      camera.lookAt(0, 0, 0);

      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(cw, ch);
      mountRef.current.appendChild(renderer.domElement);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.07;
      controls.minDistance   = 10;
      controls.maxDistance   = mapW * 4;
      controls.maxPolarAngle = Math.PI / 2.05;

      // ── Terrain geometry ─────────────────────────────────────────────────
      const stepsX = Math.min(mapW - 1, 512);
      const stepsY = Math.min(mapH - 1, 512);
      const vertW  = stepsX + 1;
      const vertH  = stepsY + 1;

      const geom = new THREE.PlaneGeometry(mapW, mapH, stepsX, stepsY);
      geom.rotateX(-Math.PI / 2);

      const positions = geom.attributes.position;
      for (let j = 0; j < vertH; j++) {
        for (let i = 0; i < vertW; i++) {
          const px = Math.min(Math.round((i / stepsX) * (mapW - 1)), mapW - 1);
          const py = Math.min(Math.round((j / stepsY) * (mapH - 1)), mapH - 1);
          const pidx = (py * mapW + px) * 4;
          const r = heightsData[pidx], g = heightsData[pidx + 1], b = heightsData[pidx + 2];
          const sea  = isSeaPixel(r, g, b);
          const gray = sea ? 0 : (r + g + b) / 3;
          const ht   = sea ? -heightScale * 0.04 : (gray / 255) * heightScale;
          positions.setY(j * vertW + i, ht);
        }
      }
      positions.needsUpdate = true;
      geom.computeVertexNormals();

      // ── Terrain texture (pixel-perfect) ──────────────────────────────────
      const terrainTex = new THREE.CanvasTexture(terrainCanvas);
      terrainTex.minFilter = THREE.NearestFilter;
      terrainTex.magFilter = THREE.NearestFilter;
      terrainTex.flipY = false;
      const terrainMat  = new THREE.MeshLambertMaterial({ map: terrainTex });
      const terrainMesh = new THREE.Mesh(geom, terrainMat);
      scene.add(terrainMesh);

      // ── Sea plane ─────────────────────────────────────────────────────────
      const seaGeom = new THREE.PlaneGeometry(mapW * 1.1, mapH * 1.1);
      seaGeom.rotateX(-Math.PI / 2);
      const seaMat  = new THREE.MeshLambertMaterial({ color: 0x1a3d6e, transparent: true, opacity: 0.9 });
      const seaMesh = new THREE.Mesh(seaGeom, seaMat);
      seaMesh.position.y = -heightScale * 0.01;
      scene.add(seaMesh);

      // ── Lighting ──────────────────────────────────────────────────────────
      scene.add(new THREE.AmbientLight(0xffffff, 0.55));
      const sun = new THREE.DirectionalLight(0xfff5e0, 1.3);
      sun.position.set(mapW * 0.6, heightScale * 4, mapH * 0.4);
      scene.add(sun);
      const fill = new THREE.DirectionalLight(0xa0b8d0, 0.4);
      fill.position.set(-mapW * 0.4, heightScale * 1.5, -mapH * 0.3);
      scene.add(fill);

      setStatus('ready');

      // ── Render loop ───────────────────────────────────────────────────────
      let animId;
      const animate = () => {
        animId = requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
      };
      animate();

      // ── Resize ────────────────────────────────────────────────────────────
      const onResize = () => {
        if (!mountRef.current) return;
        const nw = mountRef.current.clientWidth;
        const nh = mountRef.current.clientHeight;
        camera.aspect = nw / nh;
        camera.updateProjectionMatrix();
        renderer.setSize(nw, nh);
      };
      window.addEventListener('resize', onResize);

      cleanupRef.current = () => {
        cancelAnimationFrame(animId);
        window.removeEventListener('resize', onResize);
        controls.dispose();
        renderer.dispose();
        geom.dispose(); seaGeom.dispose();
        terrainTex.dispose(); terrainMat.dispose(); seaMat.dispose();
        if (mountRef.current && renderer.domElement.parentNode === mountRef.current) {
          mountRef.current.removeChild(renderer.domElement);
        }
      };
    }, 60);

    return () => {
      cancelled = true;
      clearTimeout(buildTimeout);
      if (cleanupRef.current) { cleanupRef.current(); cleanupRef.current = null; }
    };
  }, [layers, heightScale, showFeatures, showRegions, useTextures, season]); // eslint-disable-line

  const hasData = !!(layers.heights?.data);

  return (
    <div className="relative w-full h-full bg-slate-950">
      {status === 'no_data' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-slate-500">
          <Globe className="w-14 h-14 opacity-20" />
          <p className="text-sm font-medium">No map data loaded</p>
          <p className="text-xs opacity-60">Load map_heights.tga to generate the 3D terrain</p>
        </div>
      )}

      {status === 'building' && (
        <div className="absolute inset-0 flex items-center justify-center z-20 bg-slate-950/80">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-slate-700 border-t-primary rounded-full animate-spin" />
            <p className="text-xs text-slate-400">Building 3D terrain…</p>
            <p className="text-[10px] text-slate-600">This may take a moment for large maps</p>
          </div>
        </div>
      )}

      <div ref={mountRef} className="w-full h-full" />

      {hasData && (
        <div className="absolute bottom-4 left-4 bg-slate-900/92 border border-slate-700 rounded-lg p-3 space-y-2.5 text-[11px] min-w-[210px]">
          {/* Height scale */}
          <div className="flex items-center gap-2">
            <span className="text-slate-400 w-24 shrink-0">Height scale</span>
            <input type="range" min={5} max={120} value={heightScale}
              onChange={e => setHeightScale(Number(e.target.value))}
              className="flex-1 h-1 accent-primary" />
            <span className="text-slate-400 w-7 text-right">{heightScale}</span>
          </div>

          <div className="border-t border-slate-700" />

          {/* Ground texture mode */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={useTextures}
                onChange={e => setUseTextures(e.target.checked)}
                disabled={!hasGroundTextures || !hasAerialDef}
                className="w-3 h-3 accent-primary" />
              <span className={useTextures ? 'text-slate-300' : 'text-slate-500'}>
                Ground tile textures
                {(!hasGroundTextures || !hasAerialDef) && <span className="text-slate-600"> (not loaded)</span>}
              </span>
            </label>
            {useTextures && hasGroundTextures && (
              <div className="flex items-center gap-2 ml-5">
                <span className="text-slate-500">Season:</span>
                <select value={season} onChange={e => setSeason(e.target.value)}
                  className="bg-slate-800 border border-slate-600 rounded px-1.5 py-0.5 text-[10px] text-slate-300">
                  <option value="summer">Summer</option>
                  <option value="winter">Winter</option>
                </select>
              </div>
            )}
          </div>

          <div className="border-t border-slate-700" />

          {/* Features toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={showFeatures}
              onChange={e => setShowFeatures(e.target.checked)}
              className="w-3 h-3 accent-primary" />
            <span className="text-slate-300">Rivers, cliffs &amp; volcanoes</span>
          </label>

          {/* Regions toggle */}
          {layers.regions?.data && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={showRegions}
                onChange={e => setShowRegions(e.target.checked)}
                className="w-3 h-3 accent-primary" />
              <span className="text-slate-300">Regions &amp; cities/ports</span>
            </label>
          )}

          {/* Legend */}
          <button onClick={() => setShowLegend(v => !v)}
            className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors">
            {showLegend ? '▾ Hide legend' : '▸ Show legend'}
          </button>
          {showLegend && (
            <div className="space-y-1 pt-1 border-t border-slate-700">
              {LEGEND_ITEMS.map(({ label, color }) => (
                <div key={label} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm shrink-0" style={{ background: color }} />
                  <span className="text-slate-400">{label}</span>
                </div>
              ))}
            </div>
          )}

          <div className="pt-1 border-t border-slate-700 text-[10px] text-slate-600 space-y-0.5">
            <div>🖱 Left drag — orbit</div>
            <div>🖱 Right drag — pan</div>
            <div>⚙ Scroll — zoom</div>
          </div>
        </div>
      )}

      {status === 'ready' && (
        <div className="absolute top-3 right-3 flex flex-wrap gap-1 max-w-xs justify-end">
          {layers.heights?.data  && <span className="px-1.5 py-0.5 rounded text-[9px] bg-slate-800 border border-slate-600 text-slate-400">heights</span>}
          {layers.ground?.data   && <span className="px-1.5 py-0.5 rounded text-[9px] bg-green-900/40 border border-green-700/40 text-green-400">{useTextures ? `textures (${season})` : 'ground types'}</span>}
          {layers.features?.data && showFeatures && <span className="px-1.5 py-0.5 rounded text-[9px] bg-blue-900/40 border border-blue-700/40 text-blue-400">features</span>}
          {layers.regions?.data  && showRegions  && <span className="px-1.5 py-0.5 rounded text-[9px] bg-purple-900/40 border border-purple-700/40 text-purple-400">regions</span>}
        </div>
      )}
    </div>
  );
}