import React from 'react';

export function Field({ label, tooltip, children }) {
  return (
    <div className="flex items-start gap-2">
      <label className="w-36 text-[11px] text-muted-foreground pt-1.5 shrink-0" title={tooltip}>{label}</label>
      <div className="flex-1">{children}</div>
    </div>
  );
}

export function TextInput({ value, onChange, mono = false, placeholder = '' }) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full h-7 px-2 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary ${mono ? 'font-mono' : ''}`}
    />
  );
}

export function NumberInput({ value, onChange, min, max, step = 1 }) {
  return (
    <input
      type="number"
      value={value}
      onChange={e => onChange(Number(e.target.value))}
      min={min}
      max={max}
      step={step}
      className="w-full h-7 px-2 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary font-mono"
    />
  );
}

export function SelectInput({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full h-7 px-2 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
    >
      {options.map(o => (
        <option key={o.value || o} value={o.value || o}>{o.label || o}</option>
      ))}
    </select>
  );
}

export function Section({ title, children }) {
  return (
    <div className="space-y-2">
      <h3 className="text-[11px] font-semibold text-foreground uppercase tracking-wider border-b border-border pb-1">{title}</h3>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

export function MultiCheckbox({ label, allOptions, selected, onChange }) {
  const toggle = (opt) => {
    if (selected.includes(opt)) onChange(selected.filter(s => s !== opt));
    else onChange([...selected, opt]);
  };
  return (
    <div className="space-y-1">
      <label className="text-[11px] text-muted-foreground">{label}</label>
      <div className="flex flex-wrap gap-1">
        {allOptions.map(opt => (
          <button
            key={opt}
            onClick={() => toggle(opt)}
            className={`px-1.5 py-0.5 text-[10px] rounded border font-mono transition-colors ${selected.includes(opt) ? 'bg-primary/20 border-primary/40 text-primary' : 'border-border text-muted-foreground hover:border-border hover:text-foreground'}`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}