import React, { useMemo } from 'react';
import { X } from 'lucide-react';

// Slider-based religion editor where moving one religion rescales the others
// proportionally so the sum stays exactly 100.
//   showAll=false → render only religions present in `religions`, with add/remove
//   showAll=true  → render every entry in `availableReligions`, no add/remove
export default function ReligionsEditor({ religions, availableReligions = [], onChange, showAll = false }) {
  const allKeys = useMemo(() => {
    if (showAll) return (availableReligions || []).slice();
    return Object.keys(religions || {});
  }, [showAll, availableReligions, religions]);

  const total = allKeys.reduce((s, k) => s + (parseInt(religions?.[k]) || 0), 0);

  // Rescale the other religions so the sum stays exactly 100.
  const rescale = (r, key, newVal) => {
    const others = allKeys.filter(k => k !== key);
    if (others.length === 0) {
      r[key] = 100;
      return r;
    }
    const othersTotal = others.reduce((s, k) => s + (parseInt(r[k]) || 0), 0);
    const targetOthers = 100 - newVal;
    r[key] = newVal;
    const rawShares = othersTotal > 0
      ? others.map(k => ((parseInt(r[k]) || 0) / othersTotal) * targetOthers)
      : others.map(() => targetOthers / others.length);
    const rounded = rawShares.map(s => Math.round(s));
    const sumRounded = rounded.reduce((a, b) => a + b, 0);
    const drift = targetOthers - sumRounded;
    if (drift !== 0) {
      let maxIdx = 0;
      for (let i = 1; i < rawShares.length; i++) {
        if (rawShares[i] > rawShares[maxIdx]) maxIdx = i;
      }
      rounded[maxIdx] = Math.max(0, rounded[maxIdx] + drift);
    }
    others.forEach((k, i) => { r[k] = Math.max(0, rounded[i]); });
    return r;
  };

  const setReligion = (key, valRaw) => {
    const newVal = Math.max(0, Math.min(100, Math.round(parseInt(valRaw) || 0)));
    onChange(rescale({ ...(religions || {}) }, key, newVal));
  };

  const add = (key) => {
    if (!key || key in (religions || {})) return;
    onChange({ ...(religions || {}), [key]: 0 });
  };
  const remove = (key) => {
    const next = { ...(religions || {}) };
    const removedVal = parseInt(next[key]) || 0;
    delete next[key];
    const remaining = Object.keys(next);
    if (remaining.length > 0 && removedVal > 0) {
      const remTotal = remaining.reduce((s, k) => s + (parseInt(next[k]) || 0), 0);
      const raw = remTotal > 0
        ? remaining.map(k => ((parseInt(next[k]) || 0) / remTotal) * removedVal)
        : remaining.map(() => removedVal / remaining.length);
      const rounded = raw.map(s => Math.round(s));
      const drift = removedVal - rounded.reduce((a, b) => a + b, 0);
      if (drift !== 0) {
        let m = 0;
        for (let i = 1; i < raw.length; i++) if (raw[i] > raw[m]) m = i;
        rounded[m] = Math.max(0, rounded[m] + drift);
      }
      remaining.forEach((k, i) => { next[k] = Math.max(0, (parseInt(next[k]) || 0) + rounded[i]); });
    }
    onChange(next);
  };

  return (
    <div className="space-y-1.5">
      {allKeys.map(rel => {
        const val = parseInt(religions?.[rel]) || 0;
        return (
          <div key={rel} className="space-y-0.5">
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-mono text-slate-300 w-20 truncate shrink-0">{rel}</span>
              <input
                type="range" min={0} max={100} step={1} value={val}
                onChange={e => setReligion(rel, e.target.value)}
                className="flex-1 accent-amber-500 h-1 cursor-pointer"
              />
              <input
                type="number" min={0} max={100}
                value={val}
                onChange={e => setReligion(rel, e.target.value)}
                className="w-11 h-5 px-1 text-[10px] bg-slate-800 border border-slate-600/40 rounded text-slate-200 font-mono text-right"
              />
              {!showAll && (
                <button onClick={() => remove(rel)} className="text-slate-600 hover:text-red-400 shrink-0"><X className="w-2.5 h-2.5" /></button>
              )}
            </div>
          </div>
        );
      })}
      <div className={`text-[10px] font-mono font-semibold ${total === 100 ? 'text-green-400' : 'text-red-400'}`}>
        Total: {total} / 100 {total !== 100 && '⚠ Must equal 100'}
      </div>
      {!showAll && availableReligions?.filter(r => !(r in (religions || {}))).length > 0 && (
        <select
          defaultValue=""
          onChange={e => { add(e.target.value); e.target.value = ''; }}
          className="w-full h-5 text-[10px] bg-slate-800 border border-slate-600/40 rounded text-slate-400"
        >
          <option value="">+ Add religion…</option>
          {availableReligions.filter(r => !(r in (religions || {}))).map(r => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      )}
    </div>
  );
}