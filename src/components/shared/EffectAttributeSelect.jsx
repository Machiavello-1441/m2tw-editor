import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search } from 'lucide-react';

// Full M2TW attribute list
export const EFFECT_ATTRIBUTES = [
  // Command / Leadership
  'Command', 'Morale', 'MovementPoints',
  // Personal stats
  'Authority', 'Dread', 'Influence', 'Subterfuge', 'Loyalty',
  'Piety', 'Chivalry', 'Purity', 'Corruption',
  'Vigor', 'Sanity', 'TroopMorale',
  // Finance
  'Finance', 'TradeIncome', 'TradePenalty',
  // Construction / Management
  'Construction', 'Farming', 'Mining', 'Traders',
  // Combat
  'Attack', 'Defence', 'HitPoints', 'Siege',
  // Population
  'PopulationGrowthBonus', 'PublicOrder',
  // Espionage / Assassination
  'Espionage', 'Assassination',
  // Religion
  'Religion',
  // Misc
  'LineOfSight', 'NightBonus', 'Ambush',
  'Fertility', 'Health', 'LawBonus',
  'GuildAffinity',
];

export default function EffectAttributeSelect({ value, onChange, className = '' }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef();
  const inputRef = useRef();

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  const filtered = EFFECT_ATTRIBUTES.filter(a =>
    a.toLowerCase().includes(search.toLowerCase())
  );

  // Also include the current value if it's not in the list (custom value)
  const showCustom = value && !EFFECT_ATTRIBUTES.includes(value) &&
    value.toLowerCase().includes(search.toLowerCase());

  const select = (attr) => {
    onChange(attr);
    setOpen(false);
    setSearch('');
  };

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full h-6 flex items-center justify-between px-2 text-xs font-mono bg-background border border-border rounded text-white hover:border-primary/50 focus:outline-none"
      >
        <span className="truncate">{value || 'Select…'}</span>
        <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0 ml-1" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-48 bg-card border border-border rounded shadow-lg overflow-hidden">
          <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border">
            <Search className="w-3 h-3 text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search…"
              className="flex-1 text-xs bg-transparent text-white outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="max-h-44 overflow-y-auto">
            {showCustom && (
              <button
                type="button"
                onClick={() => select(value)}
                className="w-full text-left px-3 py-1.5 text-xs font-mono text-primary hover:bg-accent"
              >
                {value} <span className="text-muted-foreground">(custom)</span>
              </button>
            )}
            {filtered.map(attr => (
              <button
                key={attr}
                type="button"
                onClick={() => select(attr)}
                className={`w-full text-left px-3 py-1.5 text-xs font-mono hover:bg-accent transition-colors ${
                  attr === value ? 'bg-primary/15 text-primary' : 'text-foreground'
                }`}
              >
                {attr}
              </button>
            ))}
            {filtered.length === 0 && !showCustom && (
              <div className="px-3 py-2 text-xs text-muted-foreground">No match — type to use custom</div>
            )}
            {filtered.length === 0 && search && (
              <button
                type="button"
                onClick={() => select(search)}
                className="w-full text-left px-3 py-1.5 text-xs font-mono text-primary hover:bg-accent"
              >
                Use "{search}"
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}