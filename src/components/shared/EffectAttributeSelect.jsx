import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  const [dropdownStyle, setDropdownStyle] = useState({});
  const buttonRef = useRef();
  const inputRef = useRef();

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (buttonRef.current && !buttonRef.current.closest('[data-effect-select]')?.contains(e.target) &&
          !document.getElementById('effect-select-portal')?.contains(e.target)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const openDropdown = () => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const dropdownH = 220;
    const top = spaceBelow >= dropdownH ? rect.bottom + 2 : rect.top - dropdownH - 2;
    setDropdownStyle({
      position: 'fixed',
      top,
      left: rect.left,
      width: Math.max(rect.width, 180),
      zIndex: 9999,
    });
    setOpen(v => !v);
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

  const portal = open ? createPortal(
    <div id="effect-select-portal"
      style={dropdownStyle}
      className="bg-card border border-border rounded shadow-xl overflow-hidden">
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
          <button type="button" onClick={() => select(value)}
            className="w-full text-left px-3 py-1.5 text-xs font-mono text-primary hover:bg-accent">
            {value} <span className="text-muted-foreground">(custom)</span>
          </button>
        )}
        {filtered.map(attr => (
          <button key={attr} type="button" onClick={() => select(attr)}
            className={`w-full text-left px-3 py-1.5 text-xs font-mono hover:bg-accent transition-colors ${
              attr === value ? 'bg-primary/15 text-primary' : 'text-foreground'
            }`}>
            {attr}
          </button>
        ))}
        {filtered.length === 0 && !showCustom && (
          <div className="px-3 py-2 text-xs text-muted-foreground">No match</div>
        )}
        {filtered.length === 0 && search && (
          <button type="button" onClick={() => select(search)}
            className="w-full text-left px-3 py-1.5 text-xs font-mono text-primary hover:bg-accent">
            Use "{search}"
          </button>
        )}
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div data-effect-select className={`relative ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={openDropdown}
        className="w-full h-6 flex items-center justify-between px-2 text-xs font-mono bg-background border border-border rounded text-white hover:border-primary/50 focus:outline-none"
      >
        <span className="truncate">{value || 'Select…'}</span>
        <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0 ml-1" />
      </button>
      {portal}
    </div>
  );
}