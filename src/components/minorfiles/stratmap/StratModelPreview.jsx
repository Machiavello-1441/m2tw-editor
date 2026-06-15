/**
 * StratModelPreview — drop-zone modal to load an .ms3d for a strat model entry.
 * Uses the same Asset Converter pipeline (casCodec.parseMs3d + ms3dCodec.parseMs3d).
 * Textures from TextureStore are passed in via ModelViewer's onTextureFile callback.
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Upload, X, Box, AlertTriangle, Image } from 'lucide-react';
import { parseMs3d } from '@/lib/casCodec';
import { parseMs3d as parseMs3dFull } from '@/lib/ms3dCodec';
import ModelViewer from '@/components/assets/ModelViewer';
import { decodeTgaToDataUrl } from '@/components/shared/tgaDecoder';
import { extractDdsFromTexture, decodeDds } from '@/lib/textureCodec';

/** Decode an uploaded texture file (tga/dds/texture/png) → data URL */
async function decodeTextureFile(file) {
  const buf = await file.arrayBuffer();
  const name = file.name.toLowerCase();
  if (name.endsWith('.tga')) {
    return decodeTgaToDataUrl(buf);
  }
  if (name.endsWith('.dds') || name.endsWith('.texture')) {
    const dds = name.endsWith('.texture') ? extractDdsFromTexture(buf) : buf;
    const meta = decodeDds(dds);
    if (!meta) return null;
    const canvas = document.createElement('canvas');
    canvas.width = meta.width; canvas.height = meta.height;
    canvas.getContext('2d').putImageData(meta.imageData, 0, 0);
    return canvas.toDataURL('image/png');
  }
  // PNG/JPG — just make an object URL
  return URL.createObjectURL(file);
}

// ── Main modal ─────────────────────────────────────────────────────────────────
export default function StratModelPreview({ modelEntry, onClose }) {
  const [loaded, setLoaded] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [texDataUrl, setTexDataUrl] = useState(null);
  const [texName, setTexName] = useState('');
  const [viewerKey, setViewerKey] = useState(0);
  const meshFileRef = useRef();
  const texFileRef = useRef();

  const loadMeshFile = useCallback(async (file) => {
    if (!file || !file.name.toLowerCase().endsWith('.ms3d')) return;
    const buf = await file.arrayBuffer();
    const parsed = parseMs3d(buf);
    const ms3dFull = parseMs3dFull(buf);
    setLoaded({
      name: file.name,
      parsed,
      ms3dFull: (ms3dFull && !ms3dFull.error) ? ms3dFull : null,
      errors: parsed.errors || [],
    });
    setViewerKey(k => k + 1);
  }, []);

  const loadTexFile = useCallback(async (file) => {
    if (!file) return;
    const url = await decodeTextureFile(file);
    if (url) { setTexDataUrl(url); setTexName(file.name); setViewerKey(k => k + 1); }
  }, []);

  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    setIsDragging(false);
    await loadMeshFile(e.dataTransfer.files[0]);
  }, [loadMeshFile]);

  const expectedFileName = modelEntry?.models?.[0]?.path
    ? modelEntry.models[0].path.replace(/\\/g, '/').split('/').pop().replace(/\.cas$/i, '.ms3d')
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={onClose}>
      <div
        className="bg-slate-900 border border-slate-600 rounded-xl shadow-2xl flex flex-col overflow-hidden"
        style={{ width: '92vw', height: '88vh', maxWidth: 1400 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-700 shrink-0">
          <Box className="w-4 h-4 text-teal-400 shrink-0" />
          <span className="text-sm font-mono text-teal-300 flex-1 truncate">
            {modelEntry?.name || 'Strat Model Preview'}
          </span>
          {expectedFileName && (
            <span className="text-[10px] text-slate-500 font-mono hidden md:block truncate max-w-[240px]">
              {expectedFileName}
            </span>
          )}

          {/* Single texture upload */}
          <label className={`flex items-center gap-1.5 cursor-pointer px-2.5 py-1 rounded border text-[10px] transition-colors
            ${texDataUrl ? 'border-violet-600 bg-violet-900/30 text-violet-300 hover:border-violet-400' : 'border-slate-600 text-slate-400 hover:border-slate-400 hover:text-slate-200'}`}>
            <input ref={texFileRef} type="file" accept=".tga,.dds,.texture,.png,.jpg" className="hidden"
              onChange={e => { loadTexFile(e.target.files[0]); e.target.value = ''; }} />
            <Image className="w-3 h-3" />
            {texDataUrl ? texName : 'Load texture…'}
            {texDataUrl && (
              <span onClick={e => { e.preventDefault(); setTexDataUrl(null); setTexName(''); setViewerKey(k => k + 1); }}
                className="ml-1 text-slate-400 hover:text-red-400">×</span>
            )}
          </label>

          <button onClick={onClose} className="text-slate-400 hover:text-white ml-2 shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 relative">
          {!loaded ? (
            <label
              className={`absolute inset-0 flex flex-col items-center justify-center gap-4 cursor-pointer transition-colors
                ${isDragging ? 'bg-teal-900/30' : 'hover:bg-slate-800/30'}`}
              onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              <input ref={meshFileRef} type="file" accept=".ms3d" className="hidden"
                onChange={e => { loadMeshFile(e.target.files[0]); e.target.value = ''; }} />
              {isDragging
                ? <div className="border-2 border-dashed border-teal-500 rounded-2xl p-10 text-center">
                    <Box className="w-10 h-10 text-teal-400 mx-auto mb-2" />
                    <p className="text-teal-300 font-mono text-sm">Drop to load</p>
                  </div>
                : <>
                    <Box className="w-12 h-12 text-slate-700" />
                    <div className="text-center space-y-1">
                      <p className="text-sm text-slate-300">Drop an <span className="font-mono text-teal-400">.ms3d</span> file to preview</p>
                      {expectedFileName && (
                        <p className="text-[11px] text-slate-500">
                          Expected: <span className="font-mono text-slate-400">{expectedFileName}</span>
                        </p>
                      )}
                      <p className="text-[10px] text-slate-600">Use "Load texture…" in the header to apply a texture · Drag to rotate · Scroll to zoom</p>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-600 text-xs text-slate-400 hover:border-slate-400 hover:text-slate-200 transition-colors">
                      <Upload className="w-3.5 h-3.5" /> Browse .ms3d file
                    </div>
                  </>
              }
            </label>
          ) : (
            <div className="absolute inset-0 flex flex-col">
              {/* Compact top bar */}
              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-950/80 border-b border-slate-800 text-[10px] shrink-0">
                <span className="font-mono text-slate-400 truncate flex-1">{loaded.name}</span>
                <span className="text-slate-500">{loaded.parsed.meshes?.length ?? 0} groups</span>
                <span className="text-slate-500">
                  {(loaded.parsed.meshes?.reduce((s, m) => s + m.numVertices, 0) ?? 0).toLocaleString()} verts
                </span>
                {loaded.ms3dFull?.joints?.length > 0 && (
                  <span className="text-green-400">{loaded.ms3dFull.joints.length} joints</span>
                )}
                {loaded.errors.length > 0 && (
                  <span className="text-amber-400 flex items-center gap-1" title={loaded.errors.join('\n')}>
                    <AlertTriangle className="w-3 h-3" /> {loaded.errors.length}
                  </span>
                )}
                <label className="cursor-pointer text-teal-400 hover:text-teal-300 border border-teal-800 rounded px-1.5 py-0.5 hover:border-teal-600 transition-colors ml-1">
                  <input type="file" accept=".ms3d" className="hidden"
                    onChange={e => { loadMeshFile(e.target.files[0]); e.target.value = ''; }} />
                  ↻ Load model
                </label>
              </div>
              <div className="flex-1 min-h-0">
                <ModelViewer
                  key={viewerKey}
                  parsedMesh={loaded.parsed}
                  skeletonData={loaded.ms3dFull || null}
                  groupComments={loaded.ms3dFull?.groupComments || null}
                  initialTextureDataUrl={texDataUrl}
                  className="w-full h-full"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}