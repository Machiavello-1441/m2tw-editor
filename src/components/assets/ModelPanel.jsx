import React, { useState } from 'react';
import { parseMeshFile, parseCasFile, meshesToMs3d, parseMs3d, encodeMeshFile, encodeCasFile } from '@/lib/casCodec';
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

    if (ext === 'ms3d') {
      result = parseMs3d(buf);
      result.sourceFormat = 'ms3d';
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
      const errMsg = result.errors?.join('\n') || 'Unknown parse error';
      alert(`Could not parse "${file.name}":\n\n${errMsg}`);
      return;
    }

    const totalVerts = result.meshes.reduce((s, m) => s + m.numVertices, 0);
    const totalFaces = result.meshes.reduce((s, m) => s + m.numFaces, 0);

    setFiles(prev => {
      const next = prev.filter(f => f.name !== file.name);
      return [...next, { name: file.name, parsed: result, sourceFormat: result.sourceFormat, totalVerts, totalFaces, rawBuffer: buf }];
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
    <div className="flex flex-col gap-4 h-full">
      <label
        className="block cursor-pointer border-2 border-dashed border-slate-600 rounded-xl p-5 text-center hover:border-blue-500 transition-colors"
        onDragOver={e => e.preventDefault()}
        onDrop={handleDrop}
      >
        <input type="file" className="hidden" multiple accept={accept} onChange={handleInput} />
        <Box className="w-5 h-5 mx-auto mb-1.5 text-slate-400" />
        <p className="text-sm text-slate-300">{label}</p>
        <p className="text-[11px] text-slate-500 mt-0.5">{hint}</p>
      </label>

      {files.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {files.map((f, i) => (
            <div key={f.name} className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded border transition-colors ${i === selected ? 'bg-blue-700 border-blue-500 text-white' : 'bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700'}`}>
              <button onClick={() => setSelected(i)} className="truncate max-w-[140px]">{f.name}</button>
              <button onClick={() => removeFile(i)} className="opacity-50 hover:opacity-100 ml-0.5"><X className="w-3 h-3" /></button>
            </div>
          ))}
        </div>
      )}

      {current && (
        <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0">
          {/* 3D Preview */}
          <div className="flex-1 rounded-xl border border-slate-700 overflow-hidden bg-slate-900" style={{ minHeight: 300 }}>
            <Mesh3DPreview parsedMesh={current.parsed} className="w-full h-full" />
          </div>

          {/* Info + actions */}
          <div className="w-full lg:w-64 flex flex-col gap-3 shrink-0">
            {current.parsed.errors?.length > 0 && (
              <div className="bg-amber-950/40 border border-amber-700 rounded-xl p-3 space-y-1">
                <p className="text-[11px] text-amber-400 font-semibold flex items-center gap-1.5"><AlertTriangle className="w-3 h-3" /> Warnings</p>
                {current.parsed.errors.map((e, i) => <p key={i} className="text-[10px] text-amber-300 leading-snug">{e}</p>)}
              </div>
            )}

            <div className="bg-slate-900 rounded-xl border border-slate-700 p-4 space-y-2">
              <p className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold flex items-center gap-1.5"><Info className="w-3 h-3" /> Model Info</p>
              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between"><span className="text-slate-500">Format</span><span className="text-slate-200 font-mono">{current.sourceFormat}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Sub-meshes</span><span className="text-slate-200 font-mono">{current.parsed.meshes.length}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Vertices</span><span className="text-slate-200 font-mono">{current.totalVerts.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Faces</span><span className="text-slate-200 font-mono">{current.totalFaces.toLocaleString()}</span></div>
              </div>
            </div>

            <div className="bg-slate-900 rounded-xl border border-slate-700 p-4 space-y-2">
              <p className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold flex items-center gap-1.5"><ArrowLeftRight className="w-3 h-3" /> Convert</p>

              {/* native → ms3d */}
              {(current.sourceFormat === 'cas' || current.sourceFormat === 'mesh') && (
                <Button size="sm" className="w-full gap-2 bg-blue-600 hover:bg-blue-500 text-white" onClick={exportMs3d}>
                  <Download className="w-3.5 h-3.5" /> Export as .ms3d
                </Button>
              )}

              {/* ms3d → native */}
              {current.sourceFormat === 'ms3d' && onFromMs3d && (
                <Button size="sm" className="w-full gap-2 bg-blue-600 hover:bg-blue-500 text-white" onClick={exportNative}>
                  <Download className="w-3.5 h-3.5" /> Export as {accept.includes('cas') ? '.cas' : '.mesh'}
                </Button>
              )}

              {/* download original */}
              <Button size="sm" variant="outline" className="w-full gap-2 border-slate-600 text-slate-200 hover:bg-slate-700"
                onClick={() => downloadBuffer(current.rawBuffer, current.name)}>
                <Download className="w-3.5 h-3.5" /> Download original
              </Button>
            </div>
          </div>
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
        label={`Drop ${t.accept.split(',').map(e => <code key={e}>{e}</code>)} files here`}
        hint={t.hint}
        onFromMs3d={t.fromMs3d}
      />
    </div>
  );
}