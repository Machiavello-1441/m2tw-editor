import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

function FrameRow({ frame, type }) {
  if (type === 'quat') {
    return (
      <tr className="border-b border-slate-800 hover:bg-slate-800/40 text-[10px] font-mono">
        <td className="px-2 py-0.5 text-slate-300">{frame.q1.toFixed(7)}</td>
        <td className="px-2 py-0.5 text-slate-300">{frame.q2.toFixed(7)}</td>
        <td className="px-2 py-0.5 text-slate-300">{frame.q3.toFixed(7)}</td>
        <td className="px-2 py-0.5 text-slate-300">{frame.q4.toFixed(7)}</td>
        <td className="px-2 py-0.5 text-blue-400">{(frame.roll * 180 / Math.PI).toFixed(2)}°</td>
        <td className="px-2 py-0.5 text-green-400">{(frame.pitch * 180 / Math.PI).toFixed(2)}°</td>
        <td className="px-2 py-0.5 text-yellow-400">{(frame.yaw * 180 / Math.PI).toFixed(2)}°</td>
      </tr>
    );
  }
  return (
    <tr className="border-b border-slate-800 hover:bg-slate-800/40 text-[10px] font-mono">
      <td className="px-2 py-0.5 text-red-300">{frame.x.toFixed(7)}</td>
      <td className="px-2 py-0.5 text-green-300">{frame.y.toFixed(7)}</td>
      <td className="px-2 py-0.5 text-blue-300">{frame.z.toFixed(7)}</td>
    </tr>
  );
}

function BoneRow({ bone }) {
  const [open, setOpen] = useState(false);
  if (bone.nQuat === 0 && bone.nAnim === 0) return null;

  return (
    <div className="border-b border-slate-800">
      <button
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-800/60 text-left transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        {open ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
        <span className="text-[11px] font-mono text-slate-200 flex-1">{bone.name}</span>
        <span className="text-[10px] text-slate-500">{bone.nQuat}q · {bone.nAnim}a</span>
      </button>

      {open && (
        <div className="px-4 pb-3 space-y-3">
          {bone.quatFrames?.length > 0 && (
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Quaternion data (roll/pitch/yaw in °)</p>
              <div className="overflow-x-auto rounded-lg border border-slate-700">
                <table className="w-full text-left min-w-[480px]">
                  <thead className="bg-slate-900 text-[9px] text-slate-500 uppercase">
                    <tr>
                      <th className="px-2 py-1">q1</th><th className="px-2 py-1">q2</th>
                      <th className="px-2 py-1">q3</th><th className="px-2 py-1">q4</th>
                      <th className="px-2 py-1 text-blue-400">Roll</th>
                      <th className="px-2 py-1 text-green-400">Pitch</th>
                      <th className="px-2 py-1 text-yellow-400">Yaw</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bone.quatFrames.map((f, i) => <FrameRow key={i} frame={f} type="quat" />)}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {bone.animFrames?.length > 0 && (
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Translation data (x / y / z)</p>
              <div className="overflow-x-auto rounded-lg border border-slate-700">
                <table className="w-full text-left">
                  <thead className="bg-slate-900 text-[9px] text-slate-500 uppercase">
                    <tr>
                      <th className="px-2 py-1 text-red-400">X</th>
                      <th className="px-2 py-1 text-green-400">Y</th>
                      <th className="px-2 py-1 text-blue-400">Z</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bone.animFrames.map((f, i) => <FrameRow key={i} frame={f} type="anim" />)}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function BoneDataTable({ parsed }) {
  if (!parsed) return null;
  return (
    <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
      <p className="px-4 py-2 text-[11px] text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-700">
        Bone Data
      </p>
      <div className="max-h-[600px] overflow-y-auto">
        {parsed.bones.map((b, i) => <BoneRow key={i} bone={b} />)}
      </div>
    </div>
  );
}