import React, { useState } from 'react';
import { useAncillaries } from './AncillariesContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, Trash2, Package } from 'lucide-react';

const TYPE_COLORS = {
  Security: 'text-blue-400',
  Academic: 'text-purple-400',
  Military: 'text-red-400',
  Health: 'text-green-400',
  Money: 'text-yellow-400',
  Religion: 'text-orange-400',
  Court: 'text-cyan-400',
  Entertain: 'text-pink-400',
  Magic: 'text-violet-400',
  Item: 'text-gray-400',
  Pet: 'text-amber-400',
  Relic: 'text-yellow-600',
  Naval: 'text-sky-400',
  Family: 'text-rose-400',
  Diplomacy: 'text-teal-400',
  Sex: 'text-red-300',
  Politics: 'text-indigo-400',
};

export default function AncillaryList() {
  const { ancData, selectedAnc, setSelectedAnc, addAncillary, deleteAncillary, getText } = useAncillaries();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  if (!ancData) return null;

  const allTypes = [...new Set(ancData.ancillaries.map(a => a.type))].sort();

  const filtered = ancData.ancillaries
    .map((a, i) => ({ ...a, _idx: i }))
    .filter(a => {
      const matchSearch = a.name.toLowerCase().includes(search.toLowerCase());
      const matchType = !typeFilter || a.type === typeFilter;
      return matchSearch && matchType;
    });

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border space-y-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search ancillaries..."
            className="pl-7 h-8 text-xs"
          />
        </div>
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="w-full h-7 text-xs bg-card border border-border rounded px-2 text-foreground"
        >
          <option value="">All Types</option>
          {allTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <Button size="sm" className="w-full h-7 text-xs" onClick={() => {
          addAncillary();
          setSelectedAnc((ancData?.ancillaries?.length || 0));
        }}>
          <Plus className="w-3 h-3 mr-1" />
          Add Ancillary
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-1 space-y-0.5">
          {filtered.map(anc => {
            const isSelected = selectedAnc === anc._idx;
            const typeColor = TYPE_COLORS[anc.type] || 'text-muted-foreground';
            return (
              <div
                key={anc._idx}
                className={`group flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-xs transition-colors
                  ${isSelected ? 'bg-primary/15 text-primary' : 'hover:bg-accent text-foreground'}`}
                onClick={() => setSelectedAnc(anc._idx)}
              >
                <Package className={`w-3 h-3 shrink-0 ${isSelected ? 'text-primary' : typeColor}`} />
                <div className="flex-1 min-w-0">
                  <div className="font-mono truncate">{anc.name}</div>
                  {getText(anc.name) && (
                    <div className="text-[10px] truncate text-amber-400/80 italic">{getText(anc.name)}</div>
                  )}
                  <div className={`text-[10px] truncate ${isSelected ? 'text-primary/70' : 'text-muted-foreground'}`}>
                    {anc.type}{anc.unique ? ' · Unique' : ''}{anc.transferable ? ' · Transferable' : ''}
                  </div>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); deleteAncillary(anc._idx); }}
                  className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-destructive/20 rounded shrink-0"
                >
                  <Trash2 className="w-3 h-3 text-destructive" />
                </button>
              </div>
            );
          })}
        </div>
        <div className="px-2 py-1 text-[10px] text-muted-foreground text-center">
          {filtered.length} / {ancData.ancillaries.length} ancillaries
        </div>
      </div>
    </div>
  );
}