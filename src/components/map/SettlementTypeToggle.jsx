import React from 'react';

export default function SettlementTypeToggle({ value, onChange, allowKeep = false }) {
  const options = [...(allowKeep ? [{ value: '', label: 'Keep each' }] : []), { value: 'city', label: 'City' }, { value: 'castle', label: 'Castle' }];
  return <div role="group" aria-label="Settlement type" className="flex rounded border border-input bg-background p-0.5">
    {options.map(option => <button key={option.value} type="button" aria-pressed={value === option.value} onClick={() => onChange(option.value)}
      className={`h-7 flex-1 rounded px-2 text-[11px] ${value === option.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}>
      {option.label}
    </button>)}
  </div>;
}