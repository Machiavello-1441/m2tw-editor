import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Globe } from 'lucide-react';

// Known ground type preset RGB values (in map_ground_types.tga) → display color [R,G,B]
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
  '255,255,255': { color: [230, 215, 150], name: 'Beach' },
  '64,64,64':    { color: [80, 80, 80],    name: 'Impassable Land' },
  '0,0,64':      { color: [20, 30, 100],   name: 'Impassable Sea' },
};

// Feature detection from map_features.tga pixels
function detectFeature(r, g, b) {
  if (r < 10 && g < 10 && b < 10) return null;            // black = background
  if (r > 220 && g > 220 && b > 220) return 'source';      // white = river source
  if (g > 180 && b > 180 && r < 80) return 'bridge';       // cyan = bridge
  if (b > 150 && r < 80 && g < 80) return 'river';         // blue = river
  if (r > 180 && g > 130 && b < 60) return 'cliff';        // yellow = cliff
  if (r > 180 && g < 60 && b < 60) return 'volcano';       // red = volcano
  return null;
}

const FEATURE_RGBA = {
  river:   [50, 100, 220, 210],
  source:  [150, 210, 255, 230],
  bridge:  [0, 220, 220, 240],
  cliff:   [220, 180, 30, 220],
  volcano: [210, 50, 10, 240],
};

// Sea pixel: high blue, low red+green in map_heights.tga
function isSeaPixel(r, g, b) {
  return b > 150 && r < 80 && g < 80;
}

// Build a canvas with ground type colors + optional features baked on top
function buildTerrainTexture(groundData, featuresData, w, h, showFeatures) {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(w, h);
  const d = imgData.data;

  for (let i = 0; i < w * h; i++) {
    const base = i * 4;
    if (groundData) {
      const r = groundData[base], g = groundData[base + 1], b = groundData[base + 2];
      const key = `${r},${g},${b}`;
      const preset = GROUND_PRESETS[key];
      if (preset) {
        d[base] = preset.color[0]; d[base + 1] = preset.color[1]; d[base + 2] = preset.color[2];
      } else {
        d[base] = r; d[base + 1] = g; d[base + 2] = b;
      }
    } else {
      d[base] = 60; d[base + 1] = 110; d[base + 2] = 55;
    }
    d[base + 3] = 255;
  }
  ctx.putImageData(imgData, 0, 0);

  if (featuresData && showFeatures) {
    const featImgData = ctx.createImageData(w, h);
    const fd = featImgData.data;
    for (let i = 0; i < w * h; i++) {
      const base = i * 4;
      const r = featuresData[base], g = featuresData[base + 1], b = featuresData[base + 2];
      const feat = detectFeature(r, g, b);
      if (feat) {
        const c = FEATURE_RGBA[feat];
        fd[base] = c[0]; fd[base + 1] = c[1]; fd[base + 2] = c[2]; fd[base + 3] = c[3];
      }
    }
    const featCanvas = document.createElement('canvas');
    featCanvas.width = w; featCanvas.height = h;
    featCanvas.getContext('2d').putImageData(featImgData, 0, 0);
    ctx.drawImage(featCanvas, 0, 0);
  }

  return canvas;
}

function buildRegionsTexture(regionsData, w, h) {
  if (!regionsData) return null;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(w, h);
  const d = imgData.data;
  for (let i = 0; i < w * h; i++) {
    const base = i * 4;
    const r = regionsData[base], g = regionsData[base + 1], b = regionsData[base + 2];
    const isBlack = r < 15 && g < 15 && b < 15;
    const isWhite = r > 240 && g > 240 && b > 240;
    if (isBlack) {
      // City → golden dot
      d[base] = 255; d[base + 1] = 220; d[base + 2] = 0; d[base + 3] = 240;
    } else if (isWhite) {
      // Port → cyan dot
      d[base] = 0; d[base + 1] = 220; d[base + 2] = 255; d[base + 3] = 240;
    } else {
      // Region fill — semi-transparent
      d[base] = r; d[base + 1] = g; d[base + 2] = b; d[base + 3] = 110;
    }
  }
  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

const LEGEND_ITEMS = [
  { label: 'River', color: '#3264dc' },
  { label: 'River Source', color: '#96c8ff' },
  { label: 'Bridge', color: '#00dcdc' },
  { label: 'Cliff', color: '#dcb41e' },
  { label: 'Volcano', color: '#d23200' },
  { label: 'City (region)', color: '#ffdc00' },
  { label: 'Port (region)', color: '#00dcff' },
];

export default function Map3DPreview({ layers }) {
  const mountRef = useRef(null);
  const cleanupRef = useRef(null);
  const regionsMeshRef = useRef(null);
  const [heightScale, setHeightScale] = useState(30);
  const [showFeatures, setShowFeatures] = useState(true);
  const [showRegions, setShowRegions] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const [status, setStatus] = useState('idle');

  // Toggle regions visibility without rebuilding the whole scene
  useEffect(() => {
    if (regionsMeshRef.current) {
      regionsMeshRef.current.visible = showRegions;
    }
  }, [showRegions]);

  // Main scene build — only depends on layers, heightScale, showFeatures
  useEffect(() => {
    if (cleanupRef.current) { cleanupRef.current(); cleanupRef.current = null; }
    regionsMeshRef.current = null;

    const heightsLayer = layers.heights;
    if (!heightsLayer?.data || !heightsLayer?.width || !heightsLayer?.height) {
      setStatus('no_data');
      return;
    }

    setStatus('building');

    const { data: heightsData, width: mapW, height: mapH } = heightsLayer;
    const groundData = layers.ground?.data;
    const featuresData = layers.features?.data;
    const regionsData = layers.regions?.data;

    // Defer to next tick so the loading state renders
    const buildTimeout = setTimeout(() => {
      if (!mountRef.current) return;

      // ── Scene ──────────────────────────────────────────────────────────────
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
      controls.minDistance = 10;
      controls.maxDistance = mapW * 4;
      controls.maxPolarAngle = Math.PI / 2.05;

      // ── Terrain geometry ───────────────────────────────────────────────────
      // Cap segments for performance (512x512 = 262K verts max)
      const stepsX = Math.min(mapW - 1, 512);
      const stepsY = Math.min(mapH - 1, 512);
      const vertW = stepsX + 1;
      const vertH = stepsY + 1;

      const geom = new THREE.PlaneGeometry(mapW, mapH, stepsX, stepsY);
      geom.rotateX(-Math.PI / 2);

      const positions = geom.attributes.position;
      for (let j = 0; j < vertH; j++) {
        for (let i = 0; i < vertW; i++) {
          const px = Math.min(Math.round((i / stepsX) * (mapW - 1)), mapW - 1);
          const py = Math.min(Math.round((j / stepsY) * (mapH - 1)), mapH - 1);
          const pidx = (py * mapW + px) * 4;
          const r = heightsData[pidx], g = heightsData[pidx + 1], b = heightsData[pidx + 2];
          const sea = isSeaPixel(r, g, b);
          const gray = sea ? 0 : (r + g + b) / 3;
          const ht = sea ? -heightScale * 0.04 : (gray / 255) * heightScale;
          positions.setY(j * vertW + i, ht);
        }
      }
      positions.needsUpdate = true;
      geom.computeVertexNormals();

      // ── Terrain texture ────────────────────────────────────────────────────
      const terrainCanvas = buildTerrainTexture(groundData, featuresData, mapW, mapH, showFeatures);
      const terrainTex = new THREE.CanvasTexture(terrainCanvas);
      terrainTex.flipY = false;
      const terrainMat = new THREE.MeshLambertMaterial({ map: terrainTex });
      const terrain = new THREE.Mesh(geom, terrainMat);
      scene.add(terrain);

      // ── Sea plane ──────────────────────────────────────────────────────────
      const seaGeom = new THREE.PlaneGeometry(mapW * 1.1, mapH * 1.1);
      seaGeom.rotateX(-Math.PI / 2);
      const seaMat = new THREE.MeshLambertMaterial({ color: 0x1a3d6e, transparent: true, opacity: 0.9 });
      const seaMesh = new THREE.Mesh(seaGeom, seaMat);
      seaMesh.position.y = -heightScale * 0.01;
      scene.add(seaMesh);

      // ── Regions overlay (always built, visibility toggled) ─────────────────
      if (regionsData) {
        const regCanvas = buildRegionsTexture(regionsData, mapW, mapH);
        if (regCanvas) {
          const regTex = new THREE.CanvasTexture(regCanvas);
          regTex.flipY = false;
          const regGeom = new THREE.PlaneGeometry(mapW, mapH);
          regGeom.rotateX(-Math.PI / 2);
          const regMat = new THREE.MeshBasicMaterial({ map: regTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
          const regMesh = new THREE.Mesh(regGeom, regMat);
          regMesh.position.y = heightScale + 2;
          regMesh.visible = showRegions;
          scene.add(regMesh);
          regionsMeshRef.current = regMesh;
        }
      }

      // ── Lighting ───────────────────────────────────────────────────────────
      scene.add(new THREE.AmbientLight(0xffffff, 0.55));
      const sun = new THREE.DirectionalLight(0xfff5e0, 1.3);
      sun.position.set(mapW * 0.6, heightScale * 4, mapH * 0.4);
      scene.add(sun);
      const fill = new THREE.DirectionalLight(0xa0b8d0, 0.4);
      fill.position.set(-mapW * 0.4, heightScale * 1.5, -mapH * 0.3);
      scene.add(fill);

      setStatus('ready');

      // ── Render loop ────────────────────────────────────────────────────────
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

      // ── Cleanup ────────────────────────────────────────────────────────────
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
      clearTimeout(buildTimeout);
      if (cleanupRef.current) { cleanupRef.current(); cleanupRef.current = null; }
    };
  }, [layers, heightScale, showFeatures]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasData = !!(layers.heights?.data);

  return (
    <div className="relative w-full h-full bg-slate-950">
      {/* No data state */}
      {status === 'no_data' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-slate-500">
          <Globe className="w-14 h-14 opacity-20" />
          <p className="text-sm font-medium">No map data loaded</p>
          <p className="text-xs opacity-60">Load map_heights.tga to generate the 3D terrain</p>
        </div>
      )}

      {/* Building state */}
      {status === 'building' && (
        <div className="absolute inset-0 flex items-center justify-center z-20 bg-slate-950/80">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-slate-700 border-t-primary rounded-full animate-spin" />
            <p className="text-xs text-slate-400">Building 3D terrain…</p>
            <p className="text-[10px] text-slate-600">This may take a moment for large maps</p>
          </div>
        </div>
      )}

      {/* Three.js canvas mount */}
      <div ref={mountRef} className="w-full h-full" />

      {/* Controls panel */}
      {hasData && (
        <div className="absolute bottom-4 left-4 bg-slate-900/92 border border-slate-700 rounded-lg p-3 space-y-2.5 text-[11px] min-w-[200px]">
          {/* Height scale */}
          <div className="flex items-center gap-2">
            <span className="text-slate-400 w-24 shrink-0">Height scale</span>
            <input
              type="range" min={5} max={120} value={heightScale}
              onChange={e => setHeightScale(Number(e.target.value))}
              className="flex-1 h-1 accent-primary"
            />
            <span className="text-slate-400 w-7 text-right">{heightScale}</span>
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

          {/* Legend toggle */}
          <button
            onClick={() => setShowLegend(v => !v)}
            className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
          >
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

      {/* Loaded layers badge */}
      {status === 'ready' && (
        <div className="absolute top-3 right-3 flex flex-wrap gap-1 max-w-xs justify-end">
          {layers.heights?.data && <span className="px-1.5 py-0.5 rounded text-[9px] bg-slate-800 border border-slate-600 text-slate-400">heights</span>}
          {layers.ground?.data  && <span className="px-1.5 py-0.5 rounded text-[9px] bg-green-900/40 border border-green-700/40 text-green-400">ground types</span>}
          {layers.features?.data && showFeatures && <span className="px-1.5 py-0.5 rounded text-[9px] bg-blue-900/40 border border-blue-700/40 text-blue-400">features</span>}
          {layers.regions?.data && showRegions && <span className="px-1.5 py-0.5 rounded text-[9px] bg-purple-900/40 border border-purple-700/40 text-purple-400">regions</span>}
        </div>
      )}
    </div>
  );
}