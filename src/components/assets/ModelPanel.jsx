import React, { useState } from 'react';
import { parseMeshFile, parseCasFile, meshesToMs3d, parseMs3d as parseMs3dSimple, encodeMeshFile, encodeCasFile } from '@/lib/casCodec';
import { parseMs3d as parseMs3dFull } from '@/lib/ms3dCodec';
import Mesh3DPreview from './Mesh3DPreview';
import { Button } from '@/components/ui/button';
import { Upload, Download, Info, ArrowLeftRight, Box, AlertTriangle, X } from 'lucide-react';

function downloadBuffer(buf, filename) {
  const blob = new Blob([buf], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── sub-panel shared across both mesh types ────────────────────────────────────
function ModelSubPanel({ accept, label, hint, onToMs3d, onFromMs3d }) {
  const [files, setFiles] = useState([]);
  const [selected, setSelected] = useState(0);

  const current = files[selected] || null;

  const loadFile = async (file) => {
    const buf = await file.arrayBuffer();
    const ext = file.name.split('.').pop().toLowerCase();
    let result;
    let joints = null;

    if (ext === 'ms3d') {
      // Use full parser for groups/joints/materials, simple parser for mesh geometry
      const full = parseMs3dFull(buf);
      result = parseMs3dSimple(buf);
      result.sourceFormat = 'ms3d';
      // If full parser got groups, split meshes by group with proper names
      if (full && !full.error && full.groups?.length > 0 && result.meshes?.length > 0) {
        const srcMesh = result.meshes[0]; // simple parser returns one combined mesh
        const groupMeshes = [];
        for (const g of full.groups) {
          // Build per-group mesh from triangle indices
          const usedVerts = new Set();
          for (const ti of g.triIndices) {
            const tri = full.triangles[ti];
            if (tri) { usedVerts.add(tri.vi[0]); usedVerts.add(tri.vi[1]); usedVerts.add(tri.vi[2]); }
          }
          const vertMap = {};
          const verts = [];
          for (const vi of usedVerts) { vertMap[vi] = verts.length; verts.push(vi); }
          const nv = verts.length;
          const positions = new Float32Array(nv * 3);
          const normals = new Float32Array(nv * 3);
          const uvs = new Float32Array(nv * 2);
          for (let i = 0; i < nv; i++) {
            const vi = verts[i];
            positions[i*3] = srcMesh.positions[vi*3];
            positions[i*3+1] = srcMesh.positions[vi*3+1];
            positions[i*3+2] = srcMesh.positions[vi*3+2];
            normals[i*3] = srcMesh.normals[vi*3];
            normals[i*3+1] = srcMesh.normals[vi*3+1];
            normals[i*3+2] = srcMesh.normals[vi*3+2];
            uvs[i*2] = srcMesh.uvs[vi*2];
            uvs[i*2+1] = srcMesh.uvs[vi*2+1];
          }
          const faces = [];
          for (const ti of g.triIndices) {
            const tri = full.triangles[ti];
            if (tri) {
              faces.push(vertMap[tri.vi[0]], vertMap[tri.vi[1]], vertMap[tri.vi[2]]);
            }
          }
          const indices = new Uint32Array(faces);
          groupMeshes.push({
            name: g.name || `Group ${groupMeshes.length}`,
            positions, normals, uvs, indices,
            numVertices: nv,
            numFaces: indices.length / 3,
          });
        }
        if (groupMeshes.length > 0) result.meshes = groupMeshes;
      }
      if (full && !full.error && full.joints?.length > 0) {
        joints = full.joints;
      }
    } else if (ext === 'mesh') {
      result = parseMeshFile(buf);
      result.sourceFormat = 'mesh';
    } else if (ext === 'cas') {
      result = parseCasFile(buf);
      result.sourceFormat = 'cas';
    } else {
      return;
    }

    if (!result.meshes || result.meshes.length === 0) {
      const errMsg = result.errors?.join('\n') || result.error || 'Unknown parse error';
      alert(`Could not parse "${file.name}":\n\n${errMsg}`);
      return;
    }

    const totalVerts = result.meshes.reduce((s, m) => s + m.numVertices, 0);
    const totalFaces = result.meshes.reduce((s, m) => s + m.numFaces, 0);

    setFiles(prev => {
      const next = prev.filter(f => f.name !== file.name);
      return [...next, { name: file.name, parsed: result, sourceFormat: result.sourceFormat, totalVerts, totalFaces, rawBuffer: buf, joints }];
    });
    setSelected(0);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    for (const f of e.dataTransfer.files) await loadFile(f);
  };

  const handleInput = async (e) => {
    for (const f of e.target.files) await loadFile(f);
    e.target.value = '';
  };

  const exportMs3d = () => {
    if (!current) return;
    const buf = meshesToMs3d(current.parsed.meshes);
    downloadBuffer(buf, current.name.replace(/\.(cas|mesh)$/i, '.ms3d'));
  };

  const exportNative = () => {
    if (!current) return;
    if (onFromMs3d) {
      const buf = onFromMs3d(current.parsed.meshes);
      const outExt = accept.includes('cas') ? '.cas' : '.mesh';
      downloadBuffer(buf, current.name.replace(/\.ms3d$/i, outExt));
    }
  };

  const removeFile = (i) => {
    setFiles(prev => prev.filter((_, idx) => idx !== i));
    setSelected(prev => Math.max(0, prev - (i <= prev ? 1 : 0)));
  };

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Top bar: drop zone (left) + info & converter (right) */}
      <div className="flex gap-3 items-start">
        {/* Drop zone — compact */}
        <label
          className="shrink-0 cursor-pointer border-2 border-dashed border-slate-600 rounded-lg px-4 py-3 text-center hover:border-blue-500 transition-colors"
          onDragOver={e => e.preventDefault()}
          onDrop={handleDrop}
          style={{ minWidth: 180 }}
        >
          <input type="file" className="hidden" multiple accept={accept} onChange={handleInput} />
          <Box className="w-4 h-4 mx-auto mb-1 text-slate-400" />
          <p className="text-xs text-slate-300">{label}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">{hint}</p>
        </label>

        {/* File chips + info + converter — side by side */}
        {current ? (
          <div className="flex-1 flex gap-3 min-w-0 flex-wrap">
            {/* File chips */}
            {files.length > 1 && (
              <div className="flex gap-1.5 flex-wrap items-start">
                {files.map((f, i) => (
                  <div key={f.name} className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded border transition-colors ${i === selected ? 'bg-blue-700 border-blue-500 text-white' : 'bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700'}`}>
                    <button onClick={() => setSelected(i)} className="truncate max-w-[120px]">{f.name}</button>
                    <button onClick={() => removeFile(i)} className="opacity-50 hover:opacity-100 ml-0.5"><X className="w-3 h-3" /></button>
                  </div>
                ))}
              </div>
            )}

            {/* Model info */}
            <div className="bg-slate-900 rounded-lg border border-slate-700 px-3 py-2 space-y-0.5 text-[10px] shrink-0">
              <p className="text-[9px] text-slate-400 uppercase tracking-wider font-semibold flex items-center gap-1"><Info className="w-3 h-3" /> Info</p>
              <div className="flex gap-3 text-slate-300">
                <span><span className="text-slate-500">Fmt:</span> {current.sourceFormat}</span>
                <span><span className="text-slate-500">Meshes:</span> {current.parsed.meshes.length}</span>
                <span><span className="text-slate-500">Verts:</span> {current.totalVerts.toLocaleString()}</span>
                <span><span className="text-slate-500">Faces:</span> {current.totalFaces.toLocaleString()}</span>
                {current.joints?.length > 0 && <span><span className="text-slate-500">Joints:</span> {current.joints.length}</span>}
              </div>
            </div>

            {/* Convert buttons */}
            <div className="flex gap-2 items-center flex-wrap shrink-0">
              {(current.sourceFormat === 'cas' || current.sourceFormat === 'mesh') && (
                <Button size="sm" className="gap-1.5 bg-blue-600 hover:bg-blue-500 text-white h-7 text-[10px]" onClick={exportMs3d}>
                  <Download className="w-3 h-3" /> .ms3d
                </Button>
              )}
              {current.sourceFormat === 'ms3d' && onFromMs3d && (
                <Button size="sm" className="gap-1.5 bg-blue-600 hover:bg-blue-500 text-white h-7 text-[10px]" onClick={exportNative}>
                  <Download className="w-3 h-3" /> {accept.includes('cas') ? '.cas' : '.mesh'}
                </Button>
              )}
              <Button size="sm" variant="outline" className="gap-1.5 border-slate-600 text-slate-200 hover:bg-slate-700 h-7 text-[10px]"
                onClick={() => downloadBuffer(current.rawBuffer, current.name)}>
                <Download className="w-3 h-3" /> Original
              </Button>
            </div>

            {current.parsed.errors?.length > 0 && (
              <div className="bg-amber-950/40 border border-amber-700 rounded-lg px-3 py-1.5">
                <p className="text-[10px] text-amber-400 font-semibold flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> {current.parsed.errors.length} warning(s)</p>
              </div>
            )}
          </div>
        ) : (
          files.length > 0 && (
            <div className="flex gap-1.5 flex-wrap items-start">
              {files.map((f, i) => (
                <div key={f.name} className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded border transition-colors ${i === selected ? 'bg-blue-700 border-blue-500 text-white' : 'bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700'}`}>
                  <button onClick={() => setSelected(i)} className="truncate max-w-[120px]">{f.name}</button>
                  <button onClick={() => removeFile(i)} className="opacity-50 hover:opacity-100 ml-0.5"><X className="w-3 h-3" /></button>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* 3D Preview — takes remaining space */}
      {current && (
        <div className="flex-1 rounded-xl border border-slate-700 overflow-hidden bg-slate-900 min-h-0">
          <Mesh3DPreview parsedMesh={current.parsed} joints={current.joints} className="w-full h-full" />
        </div>
      )}
    </div>
  );
}

// ── exported panel with two sub-tabs ──────────────────────────────────────────
const MODEL_TABS = [
  {
    id: 'mesh',
    label: '.mesh — Unit Models',
    desc: 'data/unit_models/',
    accept: '.mesh,.ms3d',
    hint: 'Battle unit / character models · Drag to rotate, scroll to zoom',
    fromMs3d: (meshes) => encodeMeshFile(meshes),
  },
  {
    id: 'cas',
    label: '.cas — Strat Models',
    desc: 'data/world/maps/…',
    accept: '.cas,.ms3d',
    hint: 'Strat-map unit, city & resource models · Drag to rotate, scroll to zoom',
    fromMs3d: (meshes) => encodeCasFile(meshes),
  },
];

export default function ModelPanel() {
  const [tab, setTab] = useState('mesh');
  const t = MODEL_TABS.find(x => x.id === tab);

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Sub-tabs */}
      <div className="flex gap-2">
        {MODEL_TABS.map(mt => (
          <button
            key={mt.id}
            onClick={() => setTab(mt.id)}
            className={`flex flex-col px-4 py-2 rounded-lg border text-left transition-all ${tab === mt.id ? 'bg-blue-900/40 border-blue-600 text-blue-300' : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
          >
            <span className="text-xs font-semibold">{mt.label}</span>
            <span className="text-[10px] opacity-60">{mt.desc}</span>
          </button>
        ))}
      </div>

      <ModelSubPanel
        key={tab}
        accept={t.accept}
        label={`Drop ${t.accept.split(',').join(' / ')} files here`}
        hint={t.hint}
        onFromMs3d={t.fromMs3d}
      />
    </div>
  );
}