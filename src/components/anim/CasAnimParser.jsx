import React, { useState } from 'react';
import { parseCasAnim } from '@/lib/casAnimCodec';
import { Upload, Film, X } from 'lucide-react';

function downloadBuffer(buf, filename) {
  const blob = new Blob([buf], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function CasAnimParser({ onParsed }) {
  const [files, setFiles] = useState([]);
  const [error, setError] = useState('');

  const loadFile = async (file) => {
    setError('');
    try {
      const buf = await file.arrayBuffer();
      const parsed = parseCasAnim(buf);
      parsed._filename = file.name;
      parsed._rawBuffer = buf;
      setFiles(prev => {
        const next = prev.filter(f => f._filename !== file.name);
        return [...next, parsed];
      });
      onParsed(parsed);
    } catch (e) {
      setError(`Failed to parse "${file.name}": ${e.message}`);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    for (const f of e.dataTransfer.files) if (f.name.toLowerCase().endsWith('.cas')) await loadFile(f);
  };

  const handleInput = async (e) => {
    for (const f of e.target.files) await loadFile(f);
    e.target.value = '';
  };

  return (
    <div className="flex flex-col gap-3">
      <label
        className="block cursor-pointer border-2 border-dashed border-slate-600 rounded-xl p-5 text-center hover:border-amber-500 transition-colors"
        onDragOver={e => e.preventDefault()}
        onDrop={handleDrop}
      >
        <input type="file" className="hidden" multiple accept=".cas" onChange={handleInput} />
        <Film className="w-5 h-5 mx-auto mb-1.5 text-slate-400" />
        <p className="text-sm text-slate-300">Drop animation <code>.cas</code> files here</p>
        <p className="text-[11px] text-slate-500 mt-0.5">data/animations/…/MTW2_…_walk.cas etc.</p>
      </label>

      {error && <p className="text-[11px] text-red-400 px-1">{error}</p>}

      {files.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {files.map((f, i) => (
            <button
              key={f._filename}
              onClick={() => onParsed(f)}
              className="flex items-center gap-1 text-[11px] px-2 py-1 rounded border bg-amber-900/30 border-amber-700 text-amber-300 hover:bg-amber-900/50 transition-colors"
            >
              <Film className="w-3 h-3" />{f._filename}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}