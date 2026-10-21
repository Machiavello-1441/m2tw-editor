import React from 'react';

export default function ArmoryPartTransform({ part, onChange }) {
  if (!part) return null;
  const field = 'w-full rounded border border-input bg-background p-1 text-xs text-foreground';
  const updateAxis = (key, axis, value) => { const values = [...part[key]]; values[axis] = Number(value); onChange({ ...part, [key]: values }); };
  return <section className="space-y-2 border-t border-border pt-3">
    <h3 className="text-xs font-semibold">Edit selected part</h3>
    <label className="block text-xs">Part name<input className={field} value={part.name} onChange={event => onChange({ ...part, name: event.target.value })} /></label>
    {['position', 'rotation'].map(key => <fieldset key={key} className="space-y-1"><legend className="text-xs text-muted-foreground">{key === 'position' ? 'Position (game units)' : 'Rotation (degrees)'}</legend>
      <div className="grid grid-cols-3 gap-1">{['X', 'Y', 'Z'].map((axis, i) => <label key={axis} className="text-[10px]">{axis}<input type="number" step={key === 'position' ? '0.01' : '1'} className={field} value={part[key][i]} onChange={event => updateAxis(key, i, event.target.value)} /></label>)}</div>
    </fieldset>)}
    <label className="block text-xs">Scale<input type="number" min="0.01" step="0.01" className={field} value={part.scale} onChange={event => onChange({ ...part, scale: Math.max(0.01, Number(event.target.value) || 0.01) })} /></label>
    <button type="button" className="rounded border border-border px-2 py-1 text-xs hover:bg-accent" onClick={() => onChange({ ...part, position: [0, 0, 0], rotation: [0, 0, 0], scale: 1 })}>Reset transform</button>
  </section>;
}