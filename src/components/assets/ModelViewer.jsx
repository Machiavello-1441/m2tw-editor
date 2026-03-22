import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { loadTextureBuffer } from '@/lib/textureLoader';
import ModelViewerSidebar from './ModelViewerSidebar';

/**
 * Enhanced 3D model viewer with:
 * - Large square preview with transparent background
 * - Rotation toggle
 * - Per-group visibility
 * - Per-group texture assignment (.texture / .tga / .dds)
 * - Skeleton visualization
 * - Transparent PNG screenshot
 *
 * Props:
 *   parsedMesh  — from casCodec  { meshes: [{ name, positions, normals, uvs, indices, numVertices, numFaces }] }
 *   skeletonData — optional, from ms3dCodec { vertices, groups, joints }
 */
/**
 * Build super-group hierarchy from MS3D group comments or by name prefix.
 * Group comment format: lines like "SuperGroupName\nMeshName\n0or1"
 * where 0 = random (optional in-game), 1 = always visible.
 * Returns: [{ superGroup, meshIndices: [idx], collapsed: false }]
 */
function buildSuperGroups(meshNames, groupComments) {
  const superGroupMap = new Map(); // superGroupName -> [{ meshIndex, flag }]

  if (groupComments?.length) {
    for (const gc of groupComments) {
      const lines = gc.text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      // Typically: line 0 = super-group name, line 1 = mesh name, line 2 = 0 or 1
      const superName = lines[0] || 'Ungrouped';
      const flag = lines.length >= 3 ? parseInt(lines[lines.length - 1]) : -1;
      if (!superGroupMap.has(superName)) superGroupMap.set(superName, []);
      superGroupMap.get(superName).push({ meshIndex: gc.groupIndex, flag: isNaN(flag) ? -1 : flag });
    }
  } else {
    // Fallback: derive super-group from mesh name prefix (before last _ + digits)
    meshNames.forEach((name, idx) => {
      const match = name.match(/^(.+?)(?:_\d+)?$/);
      const superName = match ? match[1] : name;
      if (!superGroupMap.has(superName)) superGroupMap.set(superName, []);
      superGroupMap.get(superName).push({ meshIndex: idx, flag: -1 });
    });
  }

  // Build ordered array
  const result = [];
  for (const [superName, entries] of superGroupMap) {
    result.push({ superGroup: superName, entries });
  }
  return result;
}

export default function ModelViewer({ parsedMesh, skeletonData, groupComments, className = '' }) {
  const mountRef = useRef(null);
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const groupRef = useRef(null);       // main rotation group
  const meshObjsRef = useRef([]);      // THREE.Mesh objects
  const skeletonObjRef = useRef(null); // skeleton line group
  const animIdRef = useRef(null);
  const isRotatingRef = useRef(true);
  const isDraggingRef = useRef(false);

  const [isRotating, setIsRotating] = useState(true);
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [showWireframe, setShowWireframe] = useState(true);
  const [meshInfos, setMeshInfos] = useState([]); // [{ name, visible, textureFile }]
  const [hasSkeleton, setHasSkeleton] = useState(false);
  const [superGroups, setSuperGroups] = useState([]);

  // Keep ref in sync with state for animation loop
  useEffect(() => { isRotatingRef.current = isRotating; }, [isRotating]);

  // ── Build scene ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!parsedMesh?.meshes?.length || !mountRef.current) return;
    const el = mountRef.current;

    // Clean up previous
    if (rendererRef.current) {
      cancelAnimationFrame(animIdRef.current);
      rendererRef.current.dispose();
      while (el.firstChild) el.removeChild(el.firstChild);
    }

    const w = el.clientWidth || 600;
    const h = el.clientHeight || 600;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0x000000, 0);
    el.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, w / h, 0.01, 10000);
    cameraRef.current = camera;

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(5, 10, 7);
    scene.add(dir);

    const mainGroup = new THREE.Group();
    scene.add(mainGroup);
    groupRef.current = mainGroup;

    const meshObjects = [];
    let bbox = new THREE.Box3();
    const infos = [];

    parsedMesh.meshes.forEach((mesh, index) => {
      const meshName = mesh.name || `Mesh_${index}`;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(mesh.normals, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(mesh.uvs, 2));
      geo.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
      geo.computeBoundingBox();

      const mat = new THREE.MeshPhongMaterial({
        color: 0x8899bb,
        wireframe: false,
        side: THREE.DoubleSide,
      });
      const obj = new THREE.Mesh(geo, mat);
      obj.name = meshName;
      mainGroup.add(obj);
      meshObjects.push(obj);
      if (geo.boundingBox) bbox.union(geo.boundingBox);

      // wireframe overlay
      const wf = new THREE.LineSegments(
        new THREE.WireframeGeometry(geo),
        new THREE.LineBasicMaterial({ color: 0x334466, opacity: 0.3, transparent: true })
      );
      wf.name = meshName + '_wire';
      obj.add(wf);

      infos.push({ name: meshName, visible: true, textureFile: null });
    });

    meshObjsRef.current = meshObjects;
    setMeshInfos(infos);

    // Build super-groups from comments or name prefix
    const meshNames = parsedMesh.meshes.map((m, i) => m.name || `Mesh_${i}`);
    setSuperGroups(buildSuperGroups(meshNames, groupComments));

    // Center & fit camera
    const center = new THREE.Vector3();
    bbox.getCenter(center);
    const bboxSize = bbox.getSize(new THREE.Vector3()).length();
    camera.position.set(center.x, center.y, center.z + bboxSize * 1.5);
    camera.lookAt(center);

    // ── Skeleton visualisation ────────────────────────────────────────────
    const hasJoints = skeletonData?.joints?.length > 0;
    setHasSkeleton(hasJoints);

    if (hasJoints) {
      const skelGroup = new THREE.Group();
      skelGroup.name = '__skeleton__';
      skelGroup.visible = false;

      // Build joint world positions from bind pose
      const joints = skeletonData.joints;
      const worldPositions = [];

      for (let i = 0; i < joints.length; i++) {
        const j = joints[i];
        const local = new THREE.Vector3(j.bindPos.x, j.bindPos.y, j.bindPos.z);
        if (j.parentIdx >= 0 && worldPositions[j.parentIdx]) {
          local.add(worldPositions[j.parentIdx]);
        }
        worldPositions.push(local);
      }

      // Draw bones as lines
      for (let i = 0; i < joints.length; i++) {
        if (joints[i].parentIdx >= 0) {
          const pts = [worldPositions[joints[i].parentIdx], worldPositions[i]];
          const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
          const lineMat = new THREE.LineBasicMaterial({ color: 0x00ff88, linewidth: 2 });
          skelGroup.add(new THREE.Line(lineGeo, lineMat));
        }
        // Joint dot
        const dotGeo = new THREE.SphereGeometry(bboxSize * 0.008, 6, 6);
        const dotMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
        const dot = new THREE.Mesh(dotGeo, dotMat);
        dot.position.copy(worldPositions[i]);
        skelGroup.add(dot);
      }

      mainGroup.add(skelGroup);
      skeletonObjRef.current = skelGroup;
    }

    // ── Orbit controls ────────────────────────────────────────────────────
    let lastX = 0, lastY = 0;
    const onDown = (e) => { isDraggingRef.current = true; lastX = e.clientX; lastY = e.clientY; };
    const onUp = () => { isDraggingRef.current = false; };
    const onMove = (e) => {
      if (!isDraggingRef.current) return;
      mainGroup.rotation.y += (e.clientX - lastX) * 0.01;
      mainGroup.rotation.x += (e.clientY - lastY) * 0.01;
      lastX = e.clientX; lastY = e.clientY;
    };
    const onWheel = (e) => {
      camera.position.z = Math.max(bboxSize * 0.2, camera.position.z + e.deltaY * bboxSize * 0.001);
    };

    el.addEventListener('mousedown', onDown);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('mousemove', onMove);
    el.addEventListener('wheel', onWheel, { passive: true });

    const animate = () => {
      animIdRef.current = requestAnimationFrame(animate);
      if (isRotatingRef.current && !isDraggingRef.current) mainGroup.rotation.y += 0.003;
      renderer.render(scene, camera);
    };
    animate();

    // Handle resize
    const ro = new ResizeObserver(() => {
      const rw = el.clientWidth || 600;
      const rh = el.clientHeight || 600;
      renderer.setSize(rw, rh);
      camera.aspect = rw / rh;
      camera.updateProjectionMatrix();
    });
    ro.observe(el);

    return () => {
      cancelAnimationFrame(animIdRef.current);
      el.removeEventListener('mousedown', onDown);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('mousemove', onMove);
      el.removeEventListener('wheel', onWheel);
      ro.disconnect();
      renderer.dispose();
      while (el.firstChild) el.removeChild(el.firstChild);
    };
  }, [parsedMesh, skeletonData, groupComments]);

  // ── Skeleton visibility ─────────────────────────────────────────────────
  useEffect(() => {
    if (skeletonObjRef.current) skeletonObjRef.current.visible = showSkeleton;
  }, [showSkeleton]);

  // ── Wireframe visibility ────────────────────────────────────────────────
  useEffect(() => {
    meshObjsRef.current.forEach((obj, idx) => {
      // Only toggle wireframe overlay on meshes without a texture applied
      obj.children.forEach(c => {
        if (c.isLineSegments) {
          c.visible = showWireframe && !meshInfos[idx]?.textureFile;
        }
      });
    });
  }, [showWireframe, meshInfos]);

  // ── Mesh visibility ─────────────────────────────────────────────────────
  const handleToggleVisibility = useCallback((index) => {
    setMeshInfos(prev => {
      const next = [...prev];
      next[index] = { ...next[index], visible: !next[index].visible };
      if (meshObjsRef.current[index]) meshObjsRef.current[index].visible = next[index].visible;
      return next;
    });
  }, []);

  // ── Super-group visibility toggle ─────────────────────────────────────
  const handleToggleSuperGroup = useCallback((sgIndex) => {
    const sg = superGroups[sgIndex];
    if (!sg) return;
    // Determine target: if any mesh in group is visible, hide all; otherwise show all
    const anyVisible = sg.entries.some(e => meshInfos[e.meshIndex]?.visible);
    const newVisible = !anyVisible;
    setMeshInfos(prev => {
      const next = [...prev];
      for (const entry of sg.entries) {
        next[entry.meshIndex] = { ...next[entry.meshIndex], visible: newVisible };
        if (meshObjsRef.current[entry.meshIndex]) meshObjsRef.current[entry.meshIndex].visible = newVisible;
      }
      return next;
    });
  }, [superGroups, meshInfos]);

  // ── Texture assignment ──────────────────────────────────────────────────
  const handleTextureFile = useCallback(async (index, file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    const buf = await file.arrayBuffer();
    const result = loadTextureBuffer(buf, ext);
    if (!result?.imageData) return;

    // Create Three.js texture from ImageData
    const canvas = document.createElement('canvas');
    canvas.width = result.width;
    canvas.height = result.height;
    canvas.getContext('2d').putImageData(result.imageData, 0, 0);
    const tex = new THREE.CanvasTexture(canvas);
    tex.flipY = false;
    tex.needsUpdate = true;

    const obj = meshObjsRef.current[index];
    if (obj) {
      obj.material.map = tex;
      obj.material.color.set(0xffffff);
      obj.material.needsUpdate = true;
      // hide wireframe when textured
      obj.children.forEach(c => { if (c.isLineSegments) c.visible = false; });
    }

    setMeshInfos(prev => {
      const next = [...prev];
      next[index] = { ...next[index], textureFile: file.name };
      return next;
    });
  }, []);

  // ── Remove texture ──────────────────────────────────────────────────────
  const handleRemoveTexture = useCallback((index) => {
    const obj = meshObjsRef.current[index];
    if (obj) {
      if (obj.material.map) { obj.material.map.dispose(); obj.material.map = null; }
      obj.material.color.set(0x8899bb);
      obj.material.needsUpdate = true;
      obj.children.forEach(c => { if (c.isLineSegments) c.visible = true; });
    }
    setMeshInfos(prev => {
      const next = [...prev];
      next[index] = { ...next[index], textureFile: null };
      return next;
    });
  }, []);

  // ── Screenshot ──────────────────────────────────────────────────────────
  const handleScreenshot = useCallback(() => {
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    if (!renderer || !scene || !camera) return;

    // Force a render then grab canvas
    renderer.render(scene, camera);
    const dataURL = renderer.domElement.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataURL;
    a.download = 'model-screenshot.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, []);

  return (
    <div className={`flex ${className}`}>
      {/* Preview container */}
      <div className="flex-1 min-w-0 min-h-0 relative"
        style={{ background: 'repeating-conic-gradient(#1e293b 0% 25%, #0f172a 0% 50%) 0 0 / 16px 16px' }}>
        <div ref={mountRef} style={{ position: 'absolute', inset: 0 }} />
      </div>

      {/* Sidebar */}
      <ModelViewerSidebar
        isRotating={isRotating}
        onToggleRotation={() => setIsRotating(r => !r)}
        showSkeleton={showSkeleton}
        onToggleSkeleton={() => setShowSkeleton(s => !s)}
        hasSkeleton={hasSkeleton}
        showWireframe={showWireframe}
        onToggleWireframe={() => setShowWireframe(w => !w)}
        meshInfos={meshInfos}
        superGroups={superGroups}
        onToggleVisibility={handleToggleVisibility}
        onToggleSuperGroup={handleToggleSuperGroup}
        onTextureFile={handleTextureFile}
        onRemoveTexture={handleRemoveTexture}
        onScreenshot={handleScreenshot}
      />
    </div>
  );
}