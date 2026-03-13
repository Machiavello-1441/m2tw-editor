import React, { useState, useMemo } from 'react';
import { useVnV } from '../components/vnv/VnVContext';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import TraitLevelEditor from '../components/vnv/TraitLevelEditor';
import { CHARACTER_TYPES, CULTURE_TYPES } from '../components/vnv/VnVParser';
import {
  Plus, Trash2, Search, Shield, ChevronRight, Download, Users
} from 'lucide-react';

// ─── Trait List Sidebar ───────────────────────────────────────────────────────
function TraitListItem({ trait, selected, onClick }) {
  const color = trait.levels.length > 0
    ? (trait.levels[trait.levels.length - 1].effects.some(e => e.value > 0)
        ? 'text-green-400' : 'text-red-400')
    : 'text-muted-foreground';
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2 rounded-lg transition-all text-xs ${
        selected ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
      }`}
    >
      <div className="flex items-center gap-2">
        <Shield className={`w-3 h-3 shrink-0 ${color}`} />
        <span className="font-mono flex-1 truncate">{trait.name}</span>
        <span className="text-[10px] opacity-50">{trait.levels.length}L</span>
      </div>
      {trait.characters && trait.characters.length > 0 && (
        <div className="ml-5 mt-0.5">
          <span className="text-[9px] text-muted-foreground/60">{trait.characters.join(', ')}</span>
        </div>
      )}
    </button>
  );
}

// ─── Trait Header Editor ─────────────────────────────────────────────────────
function TraitHeaderEditor({ trait, onUpdate }) {
  const [antiInput, setAntiInput] = useState('');

  const toggleCharacter = (char) => {
    const chars = trait.characters || [];
    const next = chars.includes(char) ? chars.filter(c => c !== char) : [...chars, char];
    onUpdate({ characters: next });
  };

  const toggleCulture = (cult) => {
    const excl = trait.excludeCultures || [];
    const next = excl.includes(cult) ? excl.filter(c => c !== cult) : [...excl, cult];
    onUpdate({ excludeCultures: next });
  };

  const toggleAntiTrait = (name) => {
    const anti = trait.antiTraits || [];
    const next = anti.includes(name) ? anti.filter(a => a !== name) : [...anti, name];
    onUpdate({ antiTraits: next });
  };

  return (
    <div className="space-y-4">
      {/* Name */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-[10px] text-muted-foreground">Trait Name</Label>
          <Input className="h-7 text-xs mt-1 font-mono"
            value={trait.name} onChange={e => onUpdate({ name: e.target.value })} />
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">NoGoingBackLevel</Label>
          <Input className="h-7 text-xs mt-1 font-mono" type="number" min="0"
            value={trait.noGoingBackLevel ?? ''}
            onChange={e => onUpdate({ noGoingBackLevel: e.target.value ? parseInt(e.target.value) : null })}
            placeholder="none" />
        </div>
      </div>

      {/* Hidden */}
      <div className="flex items-center gap-2">
        <Switch checked={trait.hidden || false} onCheckedChange={v => onUpdate({ hidden: v })} />
        <Label className="text-xs text-foreground">Hidden trait (not shown on character info)</Label>
      </div>

      {/* Characters */}
      <div>
        <Label className="text-[10px] text-muted-foreground mb-1.5 block">Characters</Label>
        <div className="flex flex-wrap gap-1.5">
          {CHARACTER_TYPES.map(c => (
            <button key={c} onClick={() => toggleCharacter(c)}
              className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-all ${
                (trait.characters || []).includes(c)
                  ? 'bg-primary/20 border-primary/40 text-primary'
                  : 'border-border text-muted-foreground hover:border-primary/30'
              }`}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* ExcludeCultures */}
      <div>
        <Label className="text-[10px] text-muted-foreground mb-1.5 block">Exclude Cultures</Label>
        <div className="flex flex-wrap gap-1.5">
          {CULTURE_TYPES.map(c => (
            <button key={c} onClick={() => toggleCulture(c)}
              className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-all ${
                (trait.excludeCultures || []).includes(c)
                  ? 'bg-destructive/20 border-destructive/40 text-destructive'
                  : 'border-border text-muted-foreground hover:border-destructive/30'
              }`}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* AntiTraits */}
      <div>
        <Label className="text-[10px] text-muted-foreground mb-1.5 block">Anti-Traits</Label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {(trait.antiTraits || []).map(a => (
            <Badge key={a} variant="outline" className="text-[10px] font-mono gap-1 cursor-pointer hover:border-destructive/50"
              onClick={() => toggleAntiTrait(a)}>
              {a} ×
            </Badge>
          ))}
          {(trait.antiTraits || []).length === 0 && (
            <span className="text-[10px] text-muted-foreground/50 italic">None</span>
          )}
        </div>
        <div className="flex gap-2">
          <Input className="h-7 text-xs flex-1 font-mono"
            value={antiInput} onChange={e => setAntiInput(e.target.value)}
            placeholder="TraitName" onKeyDown={e => {
              if (e.key === 'Enter' && antiInput.trim()) {
                toggleAntiTrait(antiInput.trim());
                setAntiInput('');
              }
            }} />
          <Button variant="outline" size="sm" className="h-7 text-xs"
            onClick={() => { if (antiInput.trim()) { toggleAntiTrait(antiInput.trim()); setAntiInput(''); } }}>
            Add
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function TraitEditor() {
  const { traitData, traitFileName, updateTrait, addTrait, deleteTrait, exportTraitFile } = useVnV();
  const [search, setSearch] = useState('');
  const [selectedName, setSelectedName] = useState(null);
  const [filterChars, setFilterChars] = useState('all');

  const allTraits = traitData?.traits || [];

  const filtered = useMemo(() => {
    return allTraits.filter(t => {
      const matchSearch = !search || t.name.toLowerCase().includes(search.toLowerCase());
      const matchChar = filterChars === 'all' || (t.characters || []).includes(filterChars);
      return matchSearch && matchChar;
    });
  }, [allTraits, search, filterChars]);

  const selectedTrait = allTraits.find(t => t.name === selectedName) || null;

  const handleAddTrait = () => {
    const name = addTrait();
    setSelectedName(name);
  };

  const handleDelete = () => {
    if (!selectedTrait) return;
    deleteTrait(selectedTrait.name);
    setSelectedName(null);
  };

  const handleUpdate = (changes) => {
    if (!selectedTrait) return;
    const oldName = selectedTrait.name;
    updateTrait(oldName, changes);
    // If name changed, keep selection
    if (changes.name && changes.name !== oldName) {
      setSelectedName(changes.name);
    }
  };

  const handleLevelUpdate = (idx, newLevel) => {
    const levels = [...selectedTrait.levels];
    levels[idx] = newLevel;
    handleUpdate({ levels });
  };

  const handleLevelDelete = (idx) => {
    handleUpdate({ levels: selectedTrait.levels.filter((_, i) => i !== idx) });
  };

  const handleLevelMove = (idx, dir) => {
    const levels = [...selectedTrait.levels];
    const swap = idx + dir;
    [levels[idx], levels[swap]] = [levels[swap], levels[idx]];
    handleUpdate({ levels });
  };

  const handleAddLevel = () => {
    const levels = selectedTrait.levels;
    const newLevel = {
      name: `${selectedTrait.name}_Level${levels.length + 1}`,
      description: `${selectedTrait.name}_Level${levels.length + 1}_desc`,
      effectsDescription: `${selectedTrait.name}_Level${levels.length + 1}_effects_desc`,
      gainMessage: '',
      loseMessage: '',
      epithet: '',
      threshold: (levels[levels.length - 1]?.threshold || 0) * 2 || 1,
      effects: [{ stat: 'Command', value: levels.length + 1 }],
    };
    handleUpdate({ levels: [...levels, newLevel] });
  };

  const handleExport = () => {
    const text = exportTraitFile();
    if (!text) return;
    const blob = new Blob([text], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = traitFileName || 'export_descr_character_traits.txt';
    a.click();
  };

  if (!traitData) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
        <Shield className="w-12 h-12 text-muted-foreground/30" />
        <div>
          <p className="text-sm font-semibold text-foreground mb-1">No Trait File Loaded</p>
          <p className="text-xs text-muted-foreground">Load <code className="text-[10px] font-mono bg-accent px-1 rounded">export_descr_character_traits.txt</code> from the Home page to begin editing traits.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 border-r border-border bg-card flex flex-col shrink-0">
        <div className="p-3 border-b border-border space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">
              Traits <span className="text-muted-foreground font-normal">({allTraits.length})</span>
            </span>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleAddTrait} title="Add Trait">
                <Plus className="w-3.5 h-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-primary" onClick={handleExport} title="Download .txt">
                <Download className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-2 top-1.5 w-3.5 h-3.5 text-muted-foreground" />
            <Input className="h-7 pl-7 text-xs" placeholder="Search traits…"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select value={filterChars} onChange={e => setFilterChars(e.target.value)}
            className="w-full h-7 px-2 text-xs bg-background border border-border rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
            <option value="all">All characters</option>
            {CHARACTER_TYPES.filter(c => c !== 'all').map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-0.5">
            {filtered.map(t => (
              <TraitListItem key={t.name} trait={t}
                selected={selectedName === t.name}
                onClick={() => setSelectedName(t.name)} />
            ))}
            {filtered.length === 0 && (
              <p className="text-[11px] text-muted-foreground/50 text-center py-6">No traits found</p>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Main Editor */}
      {!selectedTrait ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <div className="text-center space-y-2">
            <ChevronRight className="w-8 h-8 mx-auto opacity-30" />
            <p className="text-sm">Select a trait to edit</p>
          </div>
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="p-5 space-y-5 max-w-3xl">
            {/* Title bar */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center">
                <Shield className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1">
                <h2 className="text-sm font-bold text-foreground font-mono">{selectedTrait.name}</h2>
                <p className="text-[10px] text-muted-foreground">
                  {selectedTrait.levels.length} levels · {(selectedTrait.characters || []).join(', ') || 'no characters'}
                </p>
              </div>
              <Button variant="destructive" size="sm" className="h-7 text-xs gap-1" onClick={handleDelete}>
                <Trash2 className="w-3 h-3" /> Delete Trait
              </Button>
            </div>

            {/* Header */}
            <Card>
              <CardHeader className="p-3 pb-2">
                <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-primary" /> Trait Properties
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <TraitHeaderEditor trait={selectedTrait} onUpdate={handleUpdate} />
              </CardContent>
            </Card>

            {/* Levels */}
            <Card>
              <CardHeader className="p-3 pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs font-semibold">
                    Levels ({selectedTrait.levels.length})
                  </CardTitle>
                  <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 text-primary" onClick={handleAddLevel}>
                    <Plus className="w-3 h-3" /> Add Level
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-3 pt-0 space-y-3">
                {selectedTrait.levels.map((level, idx) => (
                  <TraitLevelEditor
                    key={idx} level={level}
                    onChange={l => handleLevelUpdate(idx, l)}
                    onDelete={() => handleLevelDelete(idx)}
                    onMoveUp={() => handleLevelMove(idx, -1)}
                    onMoveDown={() => handleLevelMove(idx, 1)}
                    isFirst={idx === 0}
                    isLast={idx === selectedTrait.levels.length - 1}
                  />
                ))}
                {selectedTrait.levels.length === 0 && (
                  <p className="text-[11px] text-muted-foreground/50 italic text-center py-4">
                    No levels yet — click Add Level
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
      )}
    </div>
  );
}