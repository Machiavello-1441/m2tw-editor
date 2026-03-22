import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import ModelViewerSidebar from './ModelViewerSidebar';
import { loadTextureBuffer } from '@/lib/textureLoader';

/**
 * Build skeleton helper lines from ms3d joints data.
 * Returns a THREE.Group containing line segments.
 */
function buildSkeletonHelper(joints) {
  if (!joints || joints.length === 0) return null;
  const group = new THREE.Group();
  group.name = '__skeleton__';

  // Compute world positions for each joint
  const worldPos = [];
  for (const j of joints) {
    const pos = new THREE.Vector3(j.bindPos.x, j.bindPos.y, j.bindPos.z);
    // For simplicity we use the bind position directly
    // (proper approach would chain parent transforms, but bind positions are usually world-space in ms3d)
    worldPos.push(pos);
  }

  // Draw bones as lines from parent to child
  const material = new THREE.LineBasicMaterial({ color: 0x00ff88, linewidth: 2, depthTest: false });
  const pointMat = new THREE.PointsMaterial({ color: 0xffff00, size: 3, sizeAttenuation: false, depthTest: false });

  const bonePoints = [];
  for (let i = 0; i < joints.length; i++) {
    bonePoints.push(worldPos[i].x, worldPos[i].y, worldPos[i].z);
    if (joints[i].parentIdx >= 0 && joints[i].parentIdx < joints.length) {
      const lineGeo = new THREE.BufferGeometry().setFromPoints([worldPos[joints[i].parentIdx], worldPos[i]]);
      group.add(new THREE.Line(lineGeo, material));
    }
  }

  // Joint points
  const ptGeo = new THREE.BufferGeometry();
  ptGeo.setAttribute('position', new THREE.Float32BufferAttribute(bonePoints, 3));
  group.add(new THREE.Points(ptGeo, pointMat));

  return group;
}

/**
 * Convert an ImageData into a Three.js texture
 */
function imageDataToTexture(imgData) {
  const canvas = document.createElement('canvas');
  canvas.width = imgData.width;
  canvas.height = imgData.height;
  const ctx = canvas.getContext('2d');
  ctx.putImageData(imgData, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.flipY = false;
  tex.needsUpdate = true;
  return tex;
}

export default function ModelViewer({ parsedMesh, joints, className = '' }) {
  const mountRef = useRef(null);
  const sceneRef = useRef(null); // { group, meshObjs, skeletonGroup, camera, renderer, size }
  const [isRotating, setIsRotating] = useState(true);
  const isRotatingRef = useRef(true);
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [visibleMeshes, setVisibleMeshes] = useState({});
  const [groupTextures, setGroupTextures] = useState({}); // meshName → filename

  // Keep ref in sync for animation loop
  useEffect(() => { isRotatingRef.current = isRotating; }, [isRotating]);

  const meshNames = parsedMesh?.meshes?.map((m, i) => m.name || `Mesh ${i}`) || [];

  // ── Three.js scene setup ──────────────────────────────────────────────
  useEffect(() => {
    if (!parsedMesh?.meshes?.length || !mountRef.current) return;
    const el = mountRef.current;
    // Clear any previous renderer
    while (el.firstChild) el.removeChild(el.firstChild);

    const w = el.clientWidth || 600;
    const h = el.clientHeight || 600;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0x000000, 0); // transparent
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(45, w / h, 0.01, 10000);
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const dir = new THREE.DirectionalLight(0xffffff, 1);
    dir.position.set(5, 10, 7);
    scene.add(dir);

    const group = new THREE.Group();
    scene.add(group);

    let bbox = new THREE.Box3();
    const meshObjs = [];
    const initVis = {};

    parsedMesh.meshes.forEach((mesh, idx) => {
      const name = mesh.name || `Mesh ${idx}`;
      initVis[name] = true;

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(mesh.normals, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(mesh.uvs, 2));
      geo.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
      geo.computeBoundingBox();

      const mat = new THREE.MeshPhongMaterial({ color: 0x8899bb, side: THREE.DoubleSide });
      const obj = new THREE.Mesh(geo, mat);
      obj.name = name;
      group.add(obj);
      meshObjs.push(obj);
      if (geo.boundingBox) bbox.union(geo.boundingBox);

      // Wireframe overlay
      const wf = new THREE.LineSegments(
        new THREE.WireframeGeometry(geo),
        new THREE.LineBasicMaterial({ color: 0x334466, opacity: 0.25, transparent: true })
      );
      wf.name = '__wireframe__';
      obj.add(wf);
    });

    setVisibleMeshes(initVis);
    setGroupTextures({});

    const center = new THREE.Vector3();
    bbox.getCenter(center);
    const size = bbox.getSize(new THREE.Vector3()).length() || 1;
    camera.position.set(center.x, center.y, center.z + size * 1.5);
    camera.lookAt(center);

    // Skeleton
    let skeletonGroup = null;
    if (joints?.length) {
      skeletonGroup = buildSkeletonHelper(joints);
      if (skeletonGroup) {
        skeletonGroup.visible = false;
        group.add(skeletonGroup);
      }
    }

    // Store refs
    sceneRef.current = { group, meshObjs, skeletonGroup, camera, renderer, scene, size, center };

    // ── Interaction ──
    let isDragging = false;
    let lastX = 0, lastY = 0;
    const onDown = (e) => { isDragging = true; lastX = e.clientX; lastY = e.clientY; };
    const onUp = () => { isDragging = false; };
    const onMove = (e) => {
      if (!isDragging) return;
      group.rotation.y += (e.clientX - lastX) * 0.01;
      group.rotation.x += (e.clientY - lastY) * 0.01;
      lastX = e.clientX; lastY = e.clientY;
    };
    const onWheel = (e) => {
      camera.position.z = Math.max(size * 0.2, camera.position.z + e.deltaY * size * 0.001);
    };

    el.addEventListener('mousedown', onDown);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('mousemove', onMove);
    el.addEventListener('wheel', onWheel, { passive: true });

    let animId;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      if (isRotatingRef.current && !isDragging) group.rotation.y += 0.003;
      renderer.render(scene, camera);
    };
    animate();

    // Resize observer
    const ro = new ResizeObserver(() => {
      const nw = el.clientWidth;
      const nh = el.clientHeight;
      if (nw > 0 && nh > 0) {
        renderer.setSize(nw, nh);
        camera.aspect = nw / nh;
        camera.updateProjectionMatrix();
      }
    });
    ro.observe(el);

    return () => {
      cancelAnimationFrame(animId);
      ro.disconnect();
      el.removeEventListener('mousedown', onDown);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('mousemove', onMove);
      el.removeEventListener('wheel', onWheel);
      renderer.dispose();
      if (renderer.domElement.parentNode === el) el.removeChild(renderer.domElement);
      sceneRef.current = null;
    };
  }, [parsedMesh, joints]);

  // ── Sync visibility ──
  useEffect(() => {
    const s = sceneRef.current;
    if (!s) return;
    s.meshObjs.forEach(obj => {
      obj.visible = visibleMeshes[obj.name] !== false;
    });
  }, [visibleMeshes]);

  // ── Sync skeleton visibility ──
  useEffect(() => {
    const s = sceneRef.current;
    if (!s?.skeletonGroup) return;
    s.skeletonGroup.visible = showSkeleton;
  }, [showSkeleton]);

  // ── Toggle mesh ──
  const handleToggleMesh = useCallback((name) => {
    setVisibleMeshes(prev => ({ ...prev, [name]: !prev[name] }));
  }, []);

  // ── Load texture for a group ──
  const handleLoadTexture = useCallback(async (meshName, file) => {
    const ext = file.name.split('.').pop().toLowerCase();
    const buffer = await file.arrayBuffer();
    const result = loadTextureBuffer(buffer, ext);
    if (!result?.imageData) {
      alert(`Could not decode texture "${file.name}"`);
      return;
    }

    const tex = imageDataToTexture(result.imageData);
    const s = sceneRef.current;
    if (!s) return;

    const obj = s.meshObjs.find(o => o.name === meshName);
    if (obj) {
      obj.material.map = tex;
      obj.material.color.set(0xffffff);
      obj.material.needsUpdate = true;
      // Hide wireframe when texture is applied
      const wf = obj.children.find(c => c.name === '__wireframe__');
      if (wf) wf.visible = false;
    }
    setGroupTextures(prev => ({ ...prev, [meshName]: file.name }));
  }, []);

  // ── Screenshot ──
  const handleScreenshot = useCallback(() => {
    const s = sceneRef.current;
    if (!s) return;
    // Force one render then grab
    s.renderer.render(s.scene, s.camera);
    const dataURL = s.renderer.domElement.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataURL;
    a.download = 'model-screenshot.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, []);

  return (
    <div className={`flex h-full ${className}`}>
      {/* 3D Canvas — square-ish, fills available space */}
      <div
        ref={mountRef}
        className="flex-1 min-h-0 min-w-0"
        style={{ background: 'repeating-conic-gradient(#1e293b 0% 25%, #0f172a 0% 50%) 0 0 / 16px 16px' }}
      />

      {/* Sidebar */}
      <ModelViewerSidebar
        meshNames={meshNames}
        visibleMeshes={visibleMeshes}
        onToggleMesh={handleToggleMesh}
        isRotating={isRotating}
        onToggleRotation={setIsRotating}
        showSkeleton={showSkeleton}
        onToggleSkeleton={setShowSkeleton}
        hasJoints={!!joints?.length}
        onScreenshot={handleScreenshot}
        groupTextures={groupTextures}
        onLoadTexture={handleLoadTexture}
      />
    </div>
  );
}