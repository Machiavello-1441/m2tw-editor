import React, { useState, useRef, useEffect } from 'react';
import { extractDdsFromTexture, wrapDdsAsTexture, parseDdsInfo, ddsToImageData } from '@/lib/textureCodec';
import { Button } from '@/components/ui/button';
import { Upload, Download, Info, ArrowLeftRight, X } from 'lucide-react';

function downloadBuffer(buf, filename) {
  const blob = new Blob([buf], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function TexturePanel() {
  const [files, setFiles] = useState([]);
  const [selected, setSelected] = useState(0);
  const canvasRef = useRef(null);

  const current = files[selected] || null;

  useEffect(() => {
    if (!canvasRef.current || !current?.imageData) return;
    const ctx = canvasRef.current.getContext('2d');
    canvasRef.current.width = current.imageData.width;
    canvasRef.current.height = current.imageData.height;
    ctx.putImageData(current.imageData.imageData, 0, 0);
  }, [current]);

  const loadFile = async (file) => {
    const buf = await file.arrayBuffer();
    const ext = file.name.split('.').pop().toLowerCase();

    if (ext === 'texture') {
      const result = extractDdsFromTexture(buf);
      if (!result) {
        alert(`Could not find DDS magic in "${file.name}". File may use an unsupported format.`);
        return;
      }
      const { ddsBuffer, headerBytes } = result;
      const info = parseDdsInfo(ddsBuffer);
      const imageData = ddsToImageData(ddsBuffer);
      setFiles(prev => {
        const next = prev.filter(f => f.name !== file.name);
        return [...next, { name: file.name, mode: 'texture', ddsBuffer, info, originalHeaderBytes: headerBytes, imageData }];
      });
    } else if (ext === 'dds') {
      const info = parseDdsInfo(buf);
      const imageData = ddsToImageData(buf);
      setFiles(prev => {
        const next = prev.filter(f => f.name !== file.name);
        return [...next, { name: file.name, mode: 'dds', ddsBuffer: buf, info, originalHeaderBytes: null, imageData }];
      });
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    const newFiles = Array.from(e.dataTransfer.files);
    for (const f of newFiles) await loadFile(f);
    setSelected(0);
  };

  const handleInput = async (e) => {
    for (const f of e.target.files) await loadFile(f);
    setSelected(prev => files.length); // select last loaded
    e.target.value = '';
  };

  // .texture → .dds: just strip the M2TW header, download the inner DDS
  const exportAsDds = () => {
    if (!current) return;
    const outName = current.name.replace(/\.texture$/i, '') + '.dds';
    downloadBuffer(current.ddsBuffer, outName);
  };

  // .dds → .texture: wrap the loaded DDS buffer with M2TW 4-byte header
  const exportAsTexture = () => {
    if (!current || current.mode !== 'dds') return;
    const wrapped = wrapDdsAsTexture(current.ddsBuffer, null);
    const outName = current.name.replace(/\.dds$/i, '') + '.texture';
    downloadBuffer(wrapped, outName);
  };

  const removeFile = (i) => {
    setFiles(prev => prev.filter((_, idx) => idx !== i));
    setSelected(prev => Math.max(0, prev - (i <= prev ? 1 : 0)));
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      <label
        className="block cursor-pointer border-2 border-dashed border-slate-600 rounded-xl p-6 text-center hover:border-blue-500 transition-colors"
        onDragOver={e => e.preventDefault()}
        onDrop={handleDrop}
      >
        <input type="file" className="hidden" multiple accept=".texture,.dds" onChange={handleInput} />
        <Upload className="w-6 h-6 mx-auto mb-2 text-slate-400" />
        <p className="text-sm text-slate-300">
          Drop <code className="bg-slate-700 px-1 rounded">.texture</code> or <code className="bg-slate-700 px-1 rounded">.dds</code> files here
        </p>
        <p className="text-[11px] text-slate-500 mt-1">Supports DXT1 / DXT3 / DXT5 / BGRA8 uncompressed</p>
      </label>

      {files.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {files.map((f, i) => (
            <div key={f.name} className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded border transition-colors ${i === selected ? 'bg-blue-700 border-blue-500 text-white' : 'bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700'}`}>
              <button onClick={() => setSelected(i)} className="truncate max-w-[140px]">{f.name}</button>
              <button onClick={() => removeFile(i)} className="opacity-50 hover:opacity-100 ml-0.5">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {current && (
        <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0">
          {/* Preview */}
          <div
            className="flex-1 bg-slate-900 rounded-xl border border-slate-700 flex items-center justify-center overflow-hidden"
            style={{ minHeight: 200, background: 'repeating-conic-gradient(#1e293b 0% 25%, #0f172a 0% 50%) 0 0 / 16px 16px' }}
          >
            {current.imageData ? (
              <canvas
                ref={canvasRef}
                className="max-w-full max-h-full"
                style={{ imageRendering: 'pixelated' }}
              />
            ) : (
              <p className="text-slate-500 text-sm">Preview unavailable for this format</p>
            )}
          </div>

          {/* Sidebar */}
          <div className="w-full lg:w-64 flex flex-col gap-3 shrink-0">
            {current.info && (
              <div className="bg-slate-900 rounded-xl border border-slate-700 p-4 space-y-2">
                <p className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold flex items-center gap-1.5">
                  <Info className="w-3 h-3" /> File Info
                </p>
                <div className="space-y-1 text-[11px]">
                  <div className="flex justify-between"><span className="text-slate-500">Source</span><span className="text-slate-200 font-mono">{current.mode}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Size</span><span className="text-slate-200 font-mono">{current.info.width} × {current.info.height}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Format</span><span className="text-slate-200 font-mono">{current.info.format}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Mipmaps</span><span className="text-slate-200 font-mono">{current.info.mipMapCount}</span></div>
                </div>
              </div>
            )}

            <div className="bg-slate-900 rounded-xl border border-slate-700 p-4 space-y-2">
              <p className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold flex items-center gap-1.5">
                <ArrowLeftRight className="w-3 h-3" /> Convert & Download
              </p>

              {current.mode === 'texture' && (
                <>
                  <Button size="sm" className="w-full gap-2 bg-blue-600 hover:bg-blue-500 text-white" onClick={exportAsDds}>
                    <Download className="w-3.5 h-3.5" /> Save as .dds
                  </Button>
                  <p className="text-[10px] text-slate-500">Strips the M2TW header — result is standard DDS.</p>
                </>
              )}

              {current.mode === 'dds' && (
                <>
                  <Button size="sm" className="w-full gap-2 bg-blue-600 hover:bg-blue-500 text-white" onClick={exportAsDds}>
                    <Download className="w-3.5 h-3.5" /> Download .dds
                  </Button>
                  <Button size="sm" variant="outline" className="w-full gap-2 border-slate-600 text-slate-200 hover:bg-slate-700" onClick={exportAsTexture}>
                    <Download className="w-3.5 h-3.5" /> Convert → .texture
                  </Button>
                  <p className="text-[10px] text-slate-500">Prepends the standard M2TW 4-byte prefix to the DDS.</p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}