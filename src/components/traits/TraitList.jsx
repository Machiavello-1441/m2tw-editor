import React, { useState } from 'react';
import { useTraits } from './TraitsContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, Trash2, Shield } from 'lucide-react';

const CHARACTER_FILTERS = ['family', 'merchant', 'priest', 'princess', 'spy', 'assassin', 'diplomat', 'admiral', 'all'];

const characterColors = {
  family: 'text-amber-400',
  spy: 'text-blue-400',
  assassin: 'text-red-400',
  diplomat: 'text-green-400',
  admiral: 'text-cyan-400',
  all: 'text-purple-400',
  merchant: 'text-yellow-400',
  priest: 'text-orange-400',
  princess: 'text-pink-400',
};

export default function TraitList() {
  const { traitsData, selectedTrait, setSelectedTrait, addTrait, deleteTrait } = useTraits();
  const [search, setSearch] = useState('');
  const [charFilter, setCharFilter] = useState('');

  if (!traitsData) return null;

  const filtered = traitsData.traits
    .map((t, i) => ({ ...t, _idx: i }))
    .filter(t => {
      const matchSearch = t.name.toLowerCase().includes(search.toLowerCase());
      const matchChar = !charFilter || t.characters.includes(charFilter);
      return matchSearch && matchChar;
    });

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border space-y-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search traits..."
            className="pl-7 h-8 text-xs"
          />
        </div>

        {/* Character type filter */}
        <select
          value={charFilter}
          onChange={e => setCharFilter(e.target.value)}
          className="w-full h-7 text-xs bg-card border border-border rounded px-2 text-foreground"
        >
          <option value="">All Characters</option>
          {CHARACTER_FILTERS.map(c => (
            <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
          ))}
        </select>

        <Button size="sm" className="w-full h-7 text-xs" onClick={() => {
          const idx = addTrait();
          setSelectedTrait(idx);
        }}>
          <Plus className="w-3 h-3 mr-1" />
          Add Trait
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-1 space-y-0.5">
          {filtered.map(trait => {
            const isSelected = selectedTrait === trait._idx;
            const charColor = characterColors[trait.characters[0]] || 'text-muted-foreground';
            return (
              <div
                key={trait._idx}
                className={`group flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-xs transition-colors
                  ${isSelected ? 'bg-primary/15 text-primary' : 'hover:bg-accent text-foreground'}`}
                onClick={() => setSelectedTrait(trait._idx)}
              >
                <Shield className={`w-3 h-3 shrink-0 ${isSelected ? 'text-primary' : charColor}`} />
                <div className="flex-1 min-w-0">
                  <div className="font-mono truncate">{trait.name}</div>
                  <div className={`text-[10px] truncate ${isSelected ? 'text-primary/70' : 'text-muted-foreground'}`}>
                    {trait.characters.join(', ')} · {trait.levels.length} level{trait.levels.length !== 1 ? 's' : ''}
                  </div>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); deleteTrait(trait._idx); }}
                  className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-destructive/20 rounded shrink-0"
                >
                  <Trash2 className="w-3 h-3 text-destructive" />
                </button>
              </div>
            );
          })}
        </div>
        <div className="px-2 py-1 text-[10px] text-muted-foreground text-center">
          {filtered.length} / {traitsData.traits.length} traits
        </div>
      </div>
    </div>
  );
}