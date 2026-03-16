import React, { useState } from 'react';
import { parseCas, meshesToMs3d, parseMs3d, encodeCas } from '@/lib/casCodec';
import Mesh3DPreview from './Mesh3DPreview';
import { Button } from '@/components/ui/button';
import { Upload, Download, Info, ArrowLeftRight, Box } from 'lucide-react';

function downloadBuffer(buf, filename) {
  const blob = new Blob([buf], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function ModelPanel() {
  const [files, setFiles] = useState([]);
  const [selected, setSelected] = useState(0);

  const current = files[selected] || null;

  const loadFile = async (file) => {
    const buf = await file.arrayBuffer();
    const ext = file.name.split('.').pop().toLowerCase();
    let parsed = null;
    let sourceFormat = ext;

    if (ext === 'cas' || ext === 'mesh') {
      parsed = parseCas(buf);
    } else if (ext === 'ms3d') {
      parsed = parseMs3d(buf);
      sourceFormat = 'ms3d';
    }

    if (!parsed) {
      alert(`Could not parse "${file.name}". The file may use an unsupported variant or is corrupted.`);
      return;
    }

    const totalVerts = parsed.meshes.reduce((s, m) => s + m.numVertices, 0);
    const totalFaces = parsed.meshes.reduce((s, m) => s + m.numFaces, 0);

    setFiles((prev) => {
      const next = prev.filter((f) => f.name !== file.name);
      return [...next, { name: file.name, parsed, sourceFormat, totalVerts, totalFaces, rawBuffer: buf }];
    });
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    for (const file of e.dataTransfer.files) await loadFile(file);
    setSelected(0);
  };

  const handleInput = async (e) => {
    for (const file of e.target.files) await loadFile(file);
    setSelected(0);
    e.target.value = '';
  };

  const exportMs3d = () => {
    if (!current) return;
    const buf = meshesToMs3d(current.parsed.meshes);
    downloadBuffer(buf, current.name.replace(/\.(cas|mesh)$/i, '.ms3d'));
  };

  const exportCas = () => {
    if (!current) return;
    const buf = encodeCas(current.parsed);
    downloadBuffer(buf, current.name.replace(/\.ms3d$/i, '.cas'));
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      <label
        className="block cursor-pointer border-2 border-dashed border-slate-600 rounded-xl p-6 text-center hover:border-blue-500 transition-colors"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        <input type="file" className="hidden" multiple accept=".cas,.mesh,.ms3d" onChange={handleInput} />
        <Box className="w-6 h-6 mx-auto mb-2 text-slate-400" />
        <p className="text-sm text-slate-300">Drop <code className="bg-slate-700 px-1 rounded">.cas</code>, <code className="bg-slate-700 px-1 rounded">.mesh</code>, or <code className="bg-slate-700 px-1 rounded">.ms3d</code> files here</p>
        <p className="text-[11px] text-slate-500 mt-1">Drag to rotate · Scroll to zoom</p>
      </label>

      {files.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {files.map((f, i) => (
            <button
              key={f.name}
              onClick={() => setSelected(i)}
              className={`text-[11px] px-2 py-1 rounded border transition-colors truncate max-w-[160px] ${i === selected ? 'bg-blue-700 border-blue-500 text-white' : 'bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700'}`}
            >
              {f.name}
            </button>
          ))}
        </div>
      )}

      {current && (
        <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0">
          {/* 3D Preview */}
          <div className="flex-1 rounded-xl border border-slate-700 overflow-hidden" style={{ minHeight: 320 }}>
            <Mesh3DPreview parsedMesh={current.parsed} className="w-full h-full" />
          </div>

          {/* Info + actions */}
          <div className="w-full lg:w-64 flex flex-col gap-3">
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
              {(current.sourceFormat === 'cas' || current.sourceFormat === 'mesh') && (
                <Button size="sm" className="w-full gap-2 bg-blue-600 hover:bg-blue-500 text-white" onClick={exportMs3d}>
                  <Download className="w-3.5 h-3.5" /> Export as .ms3d
                </Button>
              )}
              {current.sourceFormat === 'ms3d' && (
                <Button size="sm" className="w-full gap-2 bg-blue-600 hover:bg-blue-500 text-white" onClick={exportCas}>
                  <Download className="w-3.5 h-3.5" /> Export as .cas
                </Button>
              )}
              {current.sourceFormat !== 'ms3d' && (
                <Button size="sm" variant="outline" className="w-full gap-2 border-slate-600 text-slate-200 hover:bg-slate-700" onClick={() => downloadBuffer(current.rawBuffer, current.name)}>
                  <Download className="w-3.5 h-3.5" /> Download original
                </Button>
              )}
            </div>

            <div className="bg-slate-800/60 rounded-lg p-3 text-[10px] text-slate-500 leading-relaxed">
              <strong className="text-slate-400">Note:</strong> M2TW model formats are partially reverse-engineered.
              Some files may use variant layouts. Open an issue if a file fails to parse.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}