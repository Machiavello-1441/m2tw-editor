import React, { useState } from 'react';
import { casAnimToText, scaleCasAnim, encodeCasAnim } from '@/lib/casAnimCodec';
import { Button } from '@/components/ui/button';
import { Download, FileText, Scale, ChevronDown, ChevronRight } from 'lucide-react';

function downloadBuffer(buf, filename) {
  const blob = new Blob([buf], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between text-[11px]">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-200 font-mono">{value}</span>
    </div>
  );
}

export default function AnimInspector({ parsed }) {
  const [scaleX, setScaleX] = useState('1.0');
  const [scaleY, setScaleY] = useState('1.0');
  const [scaleZ, setScaleZ] = useState('1.0');
  const [expanded, setExpanded] = useState(false);

  if (!parsed) return null;

  const handleExportTxt = () => {
    const txt = casAnimToText(parsed);
    const blob = new Blob([txt], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (parsed._filename || 'animation').replace(/\.cas$/i, '') + '.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleScaleExport = () => {
    const sx = parseFloat(scaleX) || 1;
    const sy = parseFloat(scaleY) || 1;
    const sz = parseFloat(scaleZ) || 1;
    const scaled = scaleCasAnim(parsed, sx, sy, sz);
    const buf = encodeCasAnim(scaled);
    const name = (parsed._filename || 'animation').replace(/\.cas$/i, '') + '_scaled.cas';
    downloadBuffer(buf, name);
  };

  const handleRoundTrip = () => {
    const buf = encodeCasAnim(parsed);
    const name = (parsed._filename || 'animation').replace(/\.cas$/i, '') + '_copy.cas';
    downloadBuffer(buf, name);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Summary card */}
      <div className="bg-slate-900 rounded-xl border border-slate-700 p-4 space-y-2">
        <p className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">File Info</p>
        <InfoRow label="File" value={parsed._filename || '—'} />
        <InfoRow label="Version" value={parsed.version.toFixed(3)} />
        <InfoRow label="Anim time" value={`${parsed.animTime.toFixed(3)}s`} />
        <InfoRow label="Frames" value={parsed.nframes} />
        <InfoRow label="Bones" value={parsed.nbones} />
        <InfoRow label="FPS" value={parsed.nframes > 1 ? (parsed.nframes / parsed.animTime).toFixed(1) : '—'} />
      </div>

      {/* Bone list toggle */}
      <div className="bg-slate-900 rounded-xl border border-slate-700 p-4">
        <button
          className="flex items-center gap-2 text-[11px] text-slate-300 font-semibold w-full text-left"
          onClick={() => setExpanded(e => !e)}
        >
          {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          Bones ({parsed.nbones})
        </button>
        {expanded && (
          <div className="mt-2 space-y-1 max-h-60 overflow-y-auto">
            {parsed.bones.map((b, i) => (
              <div key={i} className="flex items-center gap-2 text-[10px] font-mono text-slate-300 px-1">
                <span className="text-slate-600 w-4">{i}</span>
                <span className="flex-1 truncate">{b.name || '(Scene Root)'}</span>
                <span className="text-slate-600">{b.quatFrames}q/{b.animFrames}a</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Scale export */}
      <div className="bg-slate-900 rounded-xl border border-slate-700 p-4 space-y-3">
        <p className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold flex items-center gap-1.5">
          <Scale className="w-3 h-3" /> Scale Animation (ExportSkeleton)
        </p>
        <p className="text-[10px] text-slate-500 leading-snug">
          Scales all animation delta data — useful for non-standard skeleton sizes (e.g. dwarves ≈ 0.64).
        </p>
        <div className="grid grid-cols-3 gap-2">
          {[['X', scaleX, setScaleX], ['Y', scaleY, setScaleY], ['Z', scaleZ, setScaleZ]].map(([label, val, set]) => (
            <div key={label} className="flex flex-col gap-0.5">
              <label className="text-[10px] text-slate-500">{label} scale</label>
              <input
                type="number" step="0.01" min="0.01" max="10"
                value={val}
                onChange={e => set(e.target.value)}
                className="h-7 px-2 text-xs font-mono bg-slate-800 border border-slate-600 rounded text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
          ))}
        </div>
        <Button size="sm" className="w-full gap-2 bg-amber-700 hover:bg-amber-600 text-white" onClick={handleScaleExport}>
          <Download className="w-3.5 h-3.5" /> Export scaled .cas
        </Button>
      </div>

      {/* Other exports */}
      <div className="bg-slate-900 rounded-xl border border-slate-700 p-4 space-y-2">
        <p className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Export</p>
        <Button size="sm" variant="outline" className="w-full gap-2 border-slate-600 text-slate-200 hover:bg-slate-700" onClick={handleExportTxt}>
          <FileText className="w-3.5 h-3.5" /> Convert .cas → .txt (inspect)
        </Button>
        <Button size="sm" variant="outline" className="w-full gap-2 border-slate-600 text-slate-200 hover:bg-slate-700" onClick={handleRoundTrip}>
          <Download className="w-3.5 h-3.5" /> Round-trip copy (validate)
        </Button>
        <Button size="sm" variant="outline" className="w-full gap-2 border-slate-600 text-slate-200 hover:bg-slate-700"
          onClick={() => downloadBuffer(parsed._rawBuffer, parsed._filename || 'animation.cas')}>
          <Download className="w-3.5 h-3.5" /> Download original
        </Button>
      </div>
    </div>
  );
}