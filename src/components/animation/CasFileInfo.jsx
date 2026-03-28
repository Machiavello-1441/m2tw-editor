import React from 'react';
import { Info, AlertTriangle } from 'lucide-react';

export default function CasFileInfo({ parsed }) {
  if (!parsed) return null;
  const { header, nBones, nFrames, bones = [] } = parsed;
  const activeBones = bones.filter(b => b.nQuat > 0);
  return (
    <div className="bg-slate-900 rounded-xl border border-slate-700 p-4 space-y-3">
      <p className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold flex items-center gap-1.5">
        <Info className="w-3 h-3" /> Animation Info
      </p>
      {parsed.errors?.length > 0 && (
        <div className="bg-amber-950/40 border border-amber-700 rounded-lg p-2 space-y-1">
          {parsed.errors.map((e, i) => (
            <p key={i} className="text-[10px] text-amber-300 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 shrink-0" />{e}
            </p>
          ))}
        </div>
      )}
      <div className="space-y-1 text-[11px]">
        {[
          ['Version', header.version.toFixed(2)],
          ['Anim Time', header.animTime.toFixed(3) + 's'],
          ['Bones', nBones],
          ['Active Bones', activeBones.length],
          ['Frames', nFrames],
          ['FPS', nFrames > 0 && header.animTime > 0 ? (nFrames / header.animTime).toFixed(1) : 'n/a'],
        ].map(([label, val]) => (
          <div key={label} className="flex justify-between">
            <span className="text-slate-500">{label}</span>
            <span className="text-slate-200 font-mono">{val}</span>
          </div>
        ))}
      </div>

      <div className="border-t border-slate-700 pt-2">
        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Bones</p>
        <div className="space-y-0.5 max-h-40 overflow-y-auto pr-1">
          {bones.map((b, i) => (
            <div key={i} className="flex items-center justify-between text-[10px]">
              <span className={`font-mono ${b.nQuat > 0 ? 'text-slate-200' : 'text-slate-600'}`}>{b.name || `bone_${i}`}</span>
              <span className="text-slate-500 font-mono">{b.nQuat}q {b.nAnim}a</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}