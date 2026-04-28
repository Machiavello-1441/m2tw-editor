import React, { useState } from 'react';
import { MapPin } from 'lucide-react';

/**
 * A small "📍" button next to position fields.
 * When onPickFromMap is provided, clicking it sets a pending pick mode in the parent
 * and the parent calls back with {x, y} when the user clicks the map.
 *
 * If no map pick is available, it just fills in the X/Y fields directly.
 */
export default function PositionPickerButton({ onAdd, onPickFromMap }) {
  const [x, setX] = useState('');
  const [y, setY] = useState('');

  const commit = () => {
    if (x !== '' && y !== '') {
      onAdd(`${x}, ${y}`);
      setX('');
      setY('');
    }
  };

  return (
    <div className="flex gap-1 items-center">
      <input
        type="number" value={x} onChange={e => setX(e.target.value)} placeholder="X"
        className="flex-1 h-5 px-1 text-[9px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 font-mono"
      />
      <input
        type="number" value={y} onChange={e => setY(e.target.value)} placeholder="Y"
        className="flex-1 h-5 px-1 text-[9px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 font-mono"
      />
      {onPickFromMap && (
        <button
          onClick={() => onPickFromMap((px, py) => { onAdd(`${px}, ${py}`); })}
          title="Pick from map"
          className="h-5 px-1.5 rounded bg-cyan-700/30 border border-cyan-500/40 text-cyan-400 hover:bg-cyan-700/60 text-[9px] flex items-center gap-0.5 transition-colors shrink-0"
        >
          <MapPin className="w-2.5 h-2.5" />
        </button>
      )}
      <button
        onClick={commit}
        className="h-5 px-1.5 rounded bg-slate-700/60 border border-slate-600/40 text-slate-300 hover:text-slate-100 text-[9px] shrink-0"
      >+</button>
    </div>
  );
}