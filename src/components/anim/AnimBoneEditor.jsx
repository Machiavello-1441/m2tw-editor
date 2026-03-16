import React, { useState, useMemo } from 'react';
import { applyEulersToQuats, encodeCasAnim } from '@/lib/casAnimCodec';
import { Button } from '@/components/ui/button';
import { Download, ChevronDown, ChevronRight, RotateCcw } from 'lucide-react';

function downloadBuffer(buf, filename) {
  const blob = new Blob([buf], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function AnimBoneEditor({ parsed }) {
  const [eulersDeg, setEulersDeg] = useState(() =>
    parsed ? parsed.eulersDeg.map(b => b.map(f => [...f])) : []
  );
  const [expandedBone, setExpandedBone] = useState(null);
  const [frameFilter, setFrameFilter] = useState('');

  // Reset when parsed changes
  React.useEffect(() => {
    if (parsed) setEulersDeg(parsed.eulersDeg.map(b => b.map(f => [...f])));
    setExpandedBone(null);
  }, [parsed]);

  if (!parsed) return null;

  const bonesWithData = parsed.bones.filter(b => b.quatFrames > 0);
  const globalBoneIdx = (localIdx) => {
    let count = 0;
    for (let i = 0; i < parsed.bones.length; i++) {
      if (parsed.bones[i].quatFrames > 0) {
        if (count === localIdx) return i;
        count++;
      }
    }
    return -1;
  };

  const updateEuler = (boneIdx, frameIdx, axis, value) => {
    setEulersDeg(prev => {
      const copy = prev.map(b => b.map(f => [...f]));
      copy[boneIdx][frameIdx][axis] = parseFloat(value) || 0;
      return copy;
    });
  };

  const handleExport = () => {
    const updated = applyEulersToQuats(parsed, eulersDeg);
    const buf = encodeCasAnim(updated);
    const name = (parsed._filename || 'animation').replace(/\.cas$/i, '') + '_modified.cas';
    downloadBuffer(buf, name);
  };

  const handleReset = () => {
    setEulersDeg(parsed.eulersDeg.map(b => b.map(f => [...f])));
  };

  const frameN = parseInt(frameFilter) || null;

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex items-center gap-2">
        <p className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold flex-1">
          Euler Angle Editor (degrees)
        </p>
        <input
          type="number" min="0" placeholder="frame #"
          value={frameFilter}
          onChange={e => setFrameFilter(e.target.value)}
          className="w-20 h-6 px-2 text-[10px] font-mono bg-slate-800 border border-slate-600 rounded text-slate-200 focus:outline-none"
        />
      </div>

      <div className="flex-1 overflow-y-auto space-y-1 pr-1">
        {bonesWithData.map((_, localIdx) => {
          const bi = globalBoneIdx(localIdx);
          if (bi === -1) return null;
          const bone = parsed.bones[bi];
          const frames = eulersDeg[bi];
          const isOpen = expandedBone === bi;
          const displayFrames = frameN !== null
            ? frames.filter((_, fi) => fi === frameN)
            : frames;
          const frameOffset = frameN !== null ? frameN : 0;

          return (
            <div key={bi} className="bg-slate-900 rounded-lg border border-slate-700">
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-left"
                onClick={() => setExpandedBone(isOpen ? null : bi)}
              >
                {isOpen ? <ChevronDown className="w-3 h-3 text-slate-500" /> : <ChevronRight className="w-3 h-3 text-slate-500" />}
                <span className="text-[11px] font-mono text-amber-300 flex-1 truncate">{bone.name}</span>
                <span className="text-[10px] text-slate-600">{bone.quatFrames} frames</span>
              </button>

              {isOpen && (
                <div className="px-3 pb-3 space-y-1 max-h-64 overflow-y-auto">
                  {/* Header */}
                  <div className="grid grid-cols-4 gap-1 text-[9px] text-slate-600 px-1 mb-1">
                    <span>Frame</span>
                    <span>X (roll)</span>
                    <span>Y (pitch)</span>
                    <span>Z (yaw)</span>
                  </div>
                  {displayFrames.map((frame, di) => {
                    const fi = frameN !== null ? frameN : di;
                    if (fi >= frames.length) return null;
                    return (
                      <div key={fi} className="grid grid-cols-4 gap-1 items-center">
                        <span className="text-[9px] text-slate-600 font-mono text-center">{fi}</span>
                        {[0, 1, 2].map(axis => (
                          <input
                            key={axis}
                            type="number" step="0.1"
                            value={frames[fi][axis].toFixed(4)}
                            onChange={e => updateEuler(bi, fi, axis, e.target.value)}
                            className="h-5 px-1 text-[9px] font-mono bg-slate-800 border border-slate-700 rounded text-slate-200 focus:outline-none focus:border-amber-500 w-full"
                          />
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex gap-2 pt-1">
        <Button size="sm" variant="outline" className="gap-1.5 border-slate-600 text-slate-300 hover:bg-slate-700 text-[11px]" onClick={handleReset}>
          <RotateCcw className="w-3 h-3" /> Reset
        </Button>
        <Button size="sm" className="flex-1 gap-2 bg-amber-700 hover:bg-amber-600 text-white" onClick={handleExport}>
          <Download className="w-3.5 h-3.5" /> Export _modified.cas
        </Button>
      </div>
    </div>
  );
}