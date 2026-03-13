import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { createPortal } from 'react-dom';

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
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef();
  const inputRef = useRef();

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (triggerRef.current && triggerRef.current.contains(e.target)) return;
      // check if clicking inside the portal dropdown
      const portal = document.getElementById('effect-attr-portal');
      if (portal && portal.contains(e.target)) return;
      setOpen(false);
      setSearch('');
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Focus search on open
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  const handleOpen = () => {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropPos({
        top: rect.bottom + window.scrollY + 2,
        left: rect.left + window.scrollX,
        width: Math.max(rect.width, 180),
      });
    }
    setOpen(v => !v);
    setSearch('');
  };

  const filtered = EFFECT_ATTRIBUTES.filter(a =>
    a.toLowerCase().includes(search.toLowerCase())
  );

  const showCustom = value && !EFFECT_ATTRIBUTES.includes(value) &&
    value.toLowerCase().includes(search.toLowerCase());

  const select = (attr) => {
    onChange(attr);
    setOpen(false);
    setSearch('');
  };

  const dropdown = open ? createPortal(
    <div
      id="effect-attr-portal"
      style={{ position: 'absolute', top: dropPos.top, left: dropPos.left, width: dropPos.width, zIndex: 9999 }}
      className="bg-card border border-border rounded shadow-xl overflow-hidden"
    >
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
          <button type="button" onMouseDown={() => select(value)}
            className="w-full text-left px-3 py-1.5 text-xs font-mono text-primary hover:bg-accent">
            {value} <span className="text-muted-foreground">(custom)</span>
          </button>
        )}
        {filtered.map(attr => (
          <button key={attr} type="button" onMouseDown={() => select(attr)}
            className={`w-full text-left px-3 py-1.5 text-xs font-mono hover:bg-accent transition-colors ${
              attr === value ? 'bg-primary/15 text-primary' : 'text-foreground'
            }`}>
            {attr}
          </button>
        ))}
        {filtered.length === 0 && !showCustom && search && (
          <button type="button" onMouseDown={() => select(search)}
            className="w-full text-left px-3 py-1.5 text-xs font-mono text-primary hover:bg-accent">
            Use "{search}"
          </button>
        )}
        {filtered.length === 0 && !showCustom && !search && (
          <div className="px-3 py-2 text-xs text-muted-foreground">No match</div>
        )}
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div ref={triggerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={handleOpen}
        className="w-full h-6 flex items-center justify-between px-2 text-xs font-mono bg-background border border-border rounded text-white hover:border-primary/50 focus:outline-none"
      >
        <span className="truncate">{value || 'Select…'}</span>
        <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0 ml-1" />
      </button>
      {dropdown}
    </div>
  );
}