import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function Mesh3DPreview({ parsedMesh, className = '' }) {
  const mountRef = useRef(null);

  useEffect(() => {
    if (!parsedMesh || !mountRef.current) return;
    const el = mountRef.current;
    const w = el.clientWidth || 600;
    const h = el.clientHeight || 400;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(window.devicePixelRatio);
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);

    const camera = new THREE.PerspectiveCamera(45, w / h, 0.01, 10000);
    camera.position.set(0, 0, 5);

    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const dir = new THREE.DirectionalLight(0xffffff, 1);
    dir.position.set(5, 10, 7);
    scene.add(dir);

    const meshObjects = [];
    let bbox = new THREE.Box3();

    for (const mesh of parsedMesh.meshes) {
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
      scene.add(obj);
      meshObjects.push(obj);
      if (geo.boundingBox) bbox.union(geo.boundingBox);
    }

    // Center & fit camera
    const center = new THREE.Vector3();
    bbox.getCenter(center);
    const size = bbox.getSize(new THREE.Vector3()).length();
    camera.position.set(center.x, center.y, center.z + size * 1.5);
    camera.lookAt(center);

    // Wireframe overlay
    for (const obj of meshObjects) {
      const wf = new THREE.LineSegments(
        new THREE.WireframeGeometry(obj.geometry),
        new THREE.LineBasicMaterial({ color: 0x334466, opacity: 0.3, transparent: true })
      );
      obj.add(wf);
    }

    // Orbit-like drag rotation
    let isDragging = false;
    let lastX = 0, lastY = 0;
    const group = new THREE.Group();
    scene.add(group);
    for (const obj of meshObjects) { scene.remove(obj); group.add(obj); }

    const onDown = (e) => { isDragging = true; lastX = e.clientX; lastY = e.clientY; };
    const onUp = () => { isDragging = false; };
    const onMove = (e) => {
      if (!isDragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      group.rotation.y += dx * 0.01;
      group.rotation.x += dy * 0.01;
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
      if (!isDragging) group.rotation.y += 0.003;
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      el.removeEventListener('mousedown', onDown);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('mousemove', onMove);
      el.removeEventListener('wheel', onWheel);
      renderer.dispose();
      if (renderer.domElement.parentNode === el) el.removeChild(renderer.domElement);
    };
  }, [parsedMesh]);

  return <div ref={mountRef} className={`w-full h-full ${className}`} />;
}