/**
 * Three.js skeleton + animation viewer.
 * Accepts either a parsed .cas anim (casAnim) or a parsed .ms3d (ms3d).
 * When both are supplied the ms3d skeleton is shown with cas animation applied.
 */
import React, { useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// ── helpers ─────────────────────────────────────────────────────────────────

function buildEulerQuat(rx, ry, rz) {
  // MS3D uses ZYX Euler (Milkshape convention)
  const e = new THREE.Euler(rx, ry, rz, 'ZYX');
  return new THREE.Quaternion().setFromEuler(e);
}

function lerpFrames(frames, time, fps) {
  if (!frames || frames.length === 0) return null;
  const t = time * fps;
  const idx = Math.floor(t);
  const frac = t - idx;
  const a = frames[Math.min(idx, frames.length - 1)];
  const b = frames[Math.min(idx + 1, frames.length - 1)];
  return { a, b, frac };
}

// Build joint world matrices from ms3d joint array at a given time (in seconds)
function computeMs3dPose(joints, timeS) {
  const localMats = joints.map(j => {
    const bindRot = buildEulerQuat(j.bindRot.rx, j.bindRot.ry, j.bindRot.rz);
    const bindPos = new THREE.Vector3(j.bindPos.x, j.bindPos.y, j.bindPos.z);

    // interpolate rotation keyframes
    let animRot = new THREE.Quaternion();
    if (j.rotFrames.length > 0) {
      const lr = lerpFrames(j.rotFrames, timeS, 1);
      if (lr) {
        const qa = buildEulerQuat(lr.a.rx, lr.a.ry, lr.a.rz);
        const qb = buildEulerQuat(lr.b.rx, lr.b.ry, lr.b.rz);
        animRot.slerpQuaternions(qa, qb, lr.frac);
      }
    }

    // interpolate translation keyframes
    let animTrans = new THREE.Vector3();
    if (j.transFrames.length > 0) {
      const lt = lerpFrames(j.transFrames, timeS, 1);
      if (lt) {
        animTrans.lerpVectors(
          new THREE.Vector3(lt.a.tx, lt.a.ty, lt.a.tz),
          new THREE.Vector3(lt.b.tx, lt.b.ty, lt.b.tz),
          lt.frac
        );
      }
    }

    // local = bind * anim
    const localQ = bindRot.clone().multiply(animRot);
    const localP = bindPos.clone().add(animTrans);
    return new THREE.Matrix4().compose(localP, localQ, new THREE.Vector3(1, 1, 1));
  });

  // Accumulate world mats
  const worldMats = localMats.map((mat, i) => {
    const j = joints[i];
    if (j.parentIdx < 0) return mat.clone();
    return worldMats[j.parentIdx].clone().multiply(mat);
  });

  return worldMats;
}

// ─────────────────────────────────────────────────────────────────────────────

export default function SkeletonViewer({ casAnim, ms3d, frameIdx, totalFrames }) {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const animFrameRef = useRef(null);
  const skeletonGroupRef = useRef(null);
  const meshGroupRef = useRef(null);

  // ── scene init ────────────────────────────────────────────────────────────
  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    const w = el.clientWidth, h = el.clientHeight || 480;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(w, h);
    renderer.setClearColor(0x0d1117, 1);
    el.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(2, 4, 3);
    scene.add(dir);

    // Grid
    const grid = new THREE.GridHelper(4, 20, 0x333333, 0x222222);
    scene.add(grid);

    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, w / h, 0.01, 200);
    camera.position.set(0, 1.5, 3);
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controlsRef.current = controls;

    const skGroup = new THREE.Group();
    scene.add(skGroup);
    skeletonGroupRef.current = skGroup;

    const meshGroup = new THREE.Group();
    scene.add(meshGroup);
    meshGroupRef.current = meshGroup;

    const loop = () => {
      animFrameRef.current = requestAnimationFrame(loop);
      controls.update();
      renderer.render(scene, camera);
    };
    loop();

    const onResize = () => {
      const nw = el.clientWidth, nh = el.clientHeight || 480;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(el);

    return () => {
      ro.disconnect();
      cancelAnimationFrame(animFrameRef.current);
      renderer.dispose();
      el.removeChild(renderer.domElement);
    };
  }, []);

  // ── build skeleton lines ──────────────────────────────────────────────────
  const buildCasSkeleton = useCallback((parsed) => {
    const grp = skeletonGroupRef.current;
    if (!grp) return;
    grp.clear();
    if (!parsed) return;

    const { bones, nFrames } = parsed;
    const frac = nFrames > 0 ? (frameIdx % nFrames) : 0;

    // Accumulate world positions per bone using translation frames
    const worldPos = bones.map((b, i) => {
      const base = new THREE.Vector3(0, 0, 0);
      if (b.animFrames && b.animFrames.length > 0) {
        const f = b.animFrames[frac % b.animFrames.length];
        base.set(f.x, f.y, f.z);
      }
      return base;
    });

    // Simple approach: place spheres at each bone position, draw lines to parent
    const sphereGeo = new THREE.SphereGeometry(0.02, 6, 6);
    const bMat = new THREE.MeshBasicMaterial({ color: 0x4fc3f7 });
    const lMat = new THREE.LineBasicMaterial({ color: 0x81d4fa });

    bones.forEach((b, i) => {
      const pos = worldPos[i];
      const sphere = new THREE.Mesh(sphereGeo, bMat);
      sphere.position.copy(pos);
      grp.add(sphere);

      if (b.parentIdx >= 0) {
        const parent = worldPos[b.parentIdx];
        const pts = [parent.clone(), pos.clone()];
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        grp.add(new THREE.Line(geo, lMat));
      }
    });
  }, [frameIdx]);

  const buildMs3dSkeleton = useCallback((ms3dData, timeS) => {
    const skGrp = skeletonGroupRef.current;
    const mshGrp = meshGroupRef.current;
    if (!skGrp || !mshGrp) return;
    skGrp.clear();
    mshGrp.clear();
    if (!ms3dData || !ms3dData.joints) return;

    const { joints, vertices, triangles, groups, materials } = ms3dData;
    const worldMats = computeMs3dPose(joints, timeS);

    const sphereGeo = new THREE.SphereGeometry(0.025, 6, 6);
    const jointMat = new THREE.MeshBasicMaterial({ color: 0xffa726 });
    const boneMat  = new THREE.LineBasicMaterial({ color: 0xffcc80 });

    joints.forEach((j, i) => {
      const pos = new THREE.Vector3();
      const rot = new THREE.Quaternion();
      const scl = new THREE.Vector3();
      worldMats[i].decompose(pos, rot, scl);

      const sp = new THREE.Mesh(sphereGeo, jointMat);
      sp.position.copy(pos);
      skGrp.add(sp);

      if (j.parentIdx >= 0) {
        const pPos = new THREE.Vector3();
        worldMats[j.parentIdx].decompose(pPos, rot, scl);
        const geo = new THREE.BufferGeometry().setFromPoints([pPos, pos]);
        skGrp.add(new THREE.Line(geo, boneMat));
      }
    });

    // Mesh with per-vertex skinning (only if vertices/triangles exist)
    if (vertices && vertices.length > 0 && triangles && triangles.length > 0) {
      const positions = new Float32Array(triangles.length * 3 * 3);
      triangles.forEach((tri, ti) => {
        tri.vi.forEach((vi, vi2) => {
          const v = vertices[vi];
          let wp = new THREE.Vector3(v.x, v.y, v.z);
          if (v.boneId >= 0 && v.boneId < joints.length) {
            wp.applyMatrix4(worldMats[v.boneId]);
            // Undo bind pose
            const bindMat = new THREE.Matrix4().compose(
              new THREE.Vector3(joints[v.boneId].bindPos.x, joints[v.boneId].bindPos.y, joints[v.boneId].bindPos.z),
              buildEulerQuat(joints[v.boneId].bindRot.rx, joints[v.boneId].bindRot.ry, joints[v.boneId].bindRot.rz),
              new THREE.Vector3(1, 1, 1)
            );
            // For simplicity just show deformed positions
          }
          const base = (ti * 3 + vi2) * 3;
          positions[base]     = wp.x;
          positions[base + 1] = wp.y;
          positions[base + 2] = wp.z;
        });
      });

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geo.computeVertexNormals();
      const mat = new THREE.MeshStandardMaterial({ color: 0x607d8b, wireframe: true, opacity: 0.4, transparent: true });
      mshGrp.add(new THREE.Mesh(geo, mat));
    }
  }, []);

  // ── re-draw on frame change ───────────────────────────────────────────────
  useEffect(() => {
    if (ms3d && ms3d.joints) {
      const timeS = ms3d.totalFrames > 0 ? (frameIdx / ms3d.totalFrames) * (ms3d.totalFrames / ms3d.animFPS) : 0;
      buildMs3dSkeleton(ms3d, timeS);
    } else if (casAnim) {
      buildCasSkeleton(casAnim);
    }
  }, [casAnim, ms3d, frameIdx, buildCasSkeleton, buildMs3dSkeleton]);

  return <div ref={mountRef} className="w-full rounded-xl overflow-hidden" style={{ height: 420 }} />;
}