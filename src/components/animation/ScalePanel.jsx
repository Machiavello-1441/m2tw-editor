import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Maximize2 } from 'lucide-react';

export default function ScalePanel({ onScale }) {
  const [sx, setSx] = useState('1.0');
  const [sy, setSy] = useState('0.64');
  const [sz, setSz] = useState('0.64');

  const apply = () => {
    const x = parseFloat(sx), y = parseFloat(sy), z = parseFloat(sz);
    if (!isNaN(x) && !isNaN(y) && !isNaN(z)) onScale(x, y, z);
  };

  const inp = "h-7 w-20 px-2 text-xs bg-slate-800 border border-slate-600 rounded text-slate-200 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500";

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-700 p-4 space-y-3">
      <p className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold flex items-center gap-1.5">
        <Maximize2 className="w-3 h-3" /> Scale Animation
      </p>
      <p className="text-[10px] text-slate-500 leading-relaxed">
        Scale translation data — useful for fitting non-standard skeletons (e.g. dwarves).
        Y-scale controls height (feet-on-ground). Start with leg-length ratio.
      </p>
      <div className="space-y-1.5 text-[11px]">
        {[['X', sx, setSx], ['Y (height)', sy, setSy], ['Z (forward)', sz, setSz]].map(([label, val, set]) => (
          <div key={label} className="flex items-center justify-between gap-2">
            <span className="text-slate-400">{label}</span>
            <input type="number" step="0.01" value={val} onChange={e => set(e.target.value)} className={inp} />
          </div>
        ))}
      </div>
      <Button size="sm" className="w-full bg-blue-700 hover:bg-blue-600 text-white gap-2" onClick={apply}>
        Apply Scaling
      </Button>
    </div>
  );
}