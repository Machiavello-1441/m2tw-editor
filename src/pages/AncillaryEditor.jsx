import React, { useState, useMemo } from 'react';
import { useVnV } from '../components/vnv/VnVContext';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CHARACTER_STATS, ANCILLARY_TYPES, CULTURE_TYPES } from '../components/vnv/VnVParser';
import {
  Plus, Trash2, Search, Package, ChevronRight, Download
} from 'lucide-react';

const TYPE_COLORS = {
  Military: 'text-red-400', Security: 'text-orange-400', Academic: 'text-blue-400',
  Court: 'text-purple-400', Religion: 'text-yellow-400', Relic: 'text-yellow-500',
  Money: 'text-green-400', Pet: 'text-pink-400', Item: 'text-cyan-400',
  Health: 'text-emerald-400', Magic: 'text-violet-400', Entertain: 'text-fuchsia-400',
  Sex: 'text-rose-400', Naval: 'text-sky-400', Family: 'text-amber-400',
  Diplomacy: 'text-indigo-400', Politics: 'text-teal-400',
};

function EffectRow({ effect, onChange, onDelete }) {
  return (
    <div className="flex items-center gap-1.5 group">
      <input
        list="stat-list-anc"
        className="flex-1 h-7 px-2 text-xs bg-background border border-border rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono"
        value={effect.stat}
        onChange={e => onChange({ ...effect, stat: e.target.value })}
        placeholder="Stat name"
      />
      <datalist id="stat-list-anc">
        {CHARACTER_STATS.map(s => <option key={s} value={s} />)}
      </datalist>
      <Input
        className="w-20 h-7 text-xs text-center font-mono"
        type="number"
        value={effect.value}
        onChange={e => onChange({ ...effect, value: parseInt(e.target.value) || 0 })}
      />
      <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
        onClick={onDelete}>
        <Trash2 className="w-3 h-3" />
      </Button>
    </div>
  );
}

function AncListItem({ anc, selected, onClick }) {
  const color = TYPE_COLORS[anc.type] || 'text-muted-foreground';
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2 rounded-lg transition-all text-xs ${
        selected ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
      }`}
    >
      <div className="flex items-center gap-2">
        <Package className={`w-3 h-3 shrink-0 ${color}`} />
        <span className="font-mono flex-1 truncate">{anc.name}</span>
        {anc.unique && <Badge variant="outline" className="text-[9px] px-1 py-0 border-yellow-500/30 text-yellow-500">Unique</Badge>}
      </div>
      <div className="ml-5 mt-0.5">
        <span className={`text-[9px] ${color}`}>{anc.type}</span>
        {anc.effects.length > 0 && (
          <span className="text-[9px] text-muted-foreground/60 ml-2">
            {anc.effects.slice(0, 2).map(e => `${e.value > 0 ? '+' : ''}${e.value} ${e.stat}`).join(', ')}
            {anc.effects.length > 2 && ` +${anc.effects.length - 2} more`}
          </span>
        )}
      </div>
    </button>
  );
}

export default function AncillaryEditor() {
  const { ancData, ancFileName, updateAncillary, addAncillary, deleteAncillary, exportAncFile } = useVnV();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [selectedName, setSelectedName] = useState(null);
  const [exclInput, setExclInput] = useState('');

  const allAncs = ancData?.ancillaries || [];

  const filtered = useMemo(() => {
    return allAncs.filter(a => {
      const matchSearch = !search || a.name.toLowerCase().includes(search.toLowerCase());
      const matchType = filterType === 'all' || a.type === filterType;
      return matchSearch && matchType;
    });
  }, [allAncs, search, filterType]);

  const selectedAnc = allAncs.find(a => a.name === selectedName) || null;

  const handleAddAnc = () => {
    const name = addAncillary();
    setSelectedName(name);
  };

  const handleDelete = () => {
    if (!selectedAnc) return;
    deleteAncillary(selectedAnc.name);
    setSelectedName(null);
  };

  const update = (changes) => {
    if (!selectedAnc) return;
    const oldName = selectedAnc.name;
    updateAncillary(oldName, changes);
    if (changes.name && changes.name !== oldName) setSelectedName(changes.name);
  };

  const updateEffect = (idx, eff) => {
    const effects = [...selectedAnc.effects];
    effects[idx] = eff;
    update({ effects });
  };

  const deleteEffect = (idx) => {
    update({ effects: selectedAnc.effects.filter((_, i) => i !== idx) });
  };

  const addEffect = () => {
    update({ effects: [...selectedAnc.effects, { stat: 'Command', value: 1 }] });
  };

  const toggleCulture = (cult) => {
    const excl = selectedAnc.excludeCultures || [];
    update({ excludeCultures: excl.includes(cult) ? excl.filter(c => c !== cult) : [...excl, cult] });
  };

  const toggleExclAnc = (name) => {
    const excl = selectedAnc.excludedAncillaries || [];
    update({ excludedAncillaries: excl.includes(name) ? excl.filter(a => a !== name) : [...excl, name] });
  };

  const handleExport = () => {
    const text = exportAncFile();
    if (!text) return;
    const blob = new Blob([text], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = ancFileName || 'export_descr_ancillaries.txt';
    a.click();
  };

  if (!ancData) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
        <Package className="w-12 h-12 text-muted-foreground/30" />
        <div>
          <p className="text-sm font-semibold text-foreground mb-1">No Ancillary File Loaded</p>
          <p className="text-xs text-muted-foreground">Load <code className="text-[10px] font-mono bg-accent px-1 rounded">export_descr_ancillaries.txt</code> from the Home page to begin editing.</p>
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
              Ancillaries <span className="text-muted-foreground font-normal">({allAncs.length})</span>
            </span>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleAddAnc} title="Add Ancillary">
                <Plus className="w-3.5 h-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-primary" onClick={handleExport} title="Download .txt">
                <Download className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-2 top-1.5 w-3.5 h-3.5 text-muted-foreground" />
            <Input className="h-7 pl-7 text-xs" placeholder="Search ancillaries…"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select value={filterType} onChange={e => setFilterType(e.target.value)}
            className="w-full h-7 px-2 text-xs bg-background border border-border rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
            <option value="all">All types</option>
            {ANCILLARY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-0.5">
            {filtered.map(a => (
              <AncListItem key={a.name} anc={a}
                selected={selectedName === a.name}
                onClick={() => setSelectedName(a.name)} />
            ))}
            {filtered.length === 0 && (
              <p className="text-[11px] text-muted-foreground/50 text-center py-6">No ancillaries found</p>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Editor */}
      {!selectedAnc ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <div className="text-center space-y-2">
            <ChevronRight className="w-8 h-8 mx-auto opacity-30" />
            <p className="text-sm">Select an ancillary to edit</p>
          </div>
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="p-5 space-y-5 max-w-2xl">
            {/* Title bar */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center">
                <Package className={`w-4 h-4 ${TYPE_COLORS[selectedAnc.type] || 'text-primary'}`} />
              </div>
              <div className="flex-1">
                <h2 className="text-sm font-bold text-foreground font-mono">{selectedAnc.name}</h2>
                <p className="text-[10px] text-muted-foreground">
                  {selectedAnc.type} · {selectedAnc.effects.length} effects
                  {selectedAnc.unique && <span className="ml-1 text-yellow-500">· Unique</span>}
                </p>
              </div>
              <Button variant="destructive" size="sm" className="h-7 text-xs gap-1" onClick={handleDelete}>
                <Trash2 className="w-3 h-3" /> Delete
              </Button>
            </div>

            {/* Core Properties */}
            <Card>
              <CardHeader className="p-3 pb-2">
                <CardTitle className="text-xs font-semibold">Core Properties</CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Ancillary Name</Label>
                    <Input className="h-7 text-xs mt-1 font-mono"
                      value={selectedAnc.name} onChange={e => update({ name: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Type</Label>
                    <Select value={selectedAnc.type} onValueChange={v => update({ type: v })}>
                      <SelectTrigger className="h-7 text-xs mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ANCILLARY_TYPES.map(t => <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Image filename</Label>
                    <Input className="h-7 text-xs mt-1 font-mono"
                      value={selectedAnc.image || ''} onChange={e => update({ image: e.target.value })}
                      placeholder="academic_scholar.tga" />
                  </div>
                  <div className="flex items-end gap-4 pb-1">
                    <div className="flex items-center gap-2">
                      <Switch checked={selectedAnc.unique || false} onCheckedChange={v => update({ unique: v })} />
                      <Label className="text-xs">Unique</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={(selectedAnc.transferable || 0) === 1} onCheckedChange={v => update({ transferable: v ? 1 : 0 })} />
                      <Label className="text-xs">Transferable</Label>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Description key</Label>
                    <Input className="h-7 text-xs mt-1 font-mono"
                      value={selectedAnc.description || ''} onChange={e => update({ description: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Effects desc key</Label>
                    <Input className="h-7 text-xs mt-1 font-mono"
                      value={selectedAnc.effectsDescription || ''} onChange={e => update({ effectsDescription: e.target.value })} />
                  </div>
                </div>

                {/* Exclude Cultures */}
                <div>
                  <Label className="text-[10px] text-muted-foreground mb-1.5 block">Exclude Cultures</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {CULTURE_TYPES.map(c => (
                      <button key={c} onClick={() => toggleCulture(c)}
                        className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-all ${
                          (selectedAnc.excludeCultures || []).includes(c)
                            ? 'bg-destructive/20 border-destructive/40 text-destructive'
                            : 'border-border text-muted-foreground hover:border-destructive/30'
                        }`}>
                        {c}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Excluded Ancillaries */}
                <div>
                  <Label className="text-[10px] text-muted-foreground mb-1.5 block">Excluded Ancillaries (mutually exclusive)</Label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {(selectedAnc.excludedAncillaries || []).map(a => (
                      <Badge key={a} variant="outline" className="text-[10px] font-mono gap-1 cursor-pointer hover:border-destructive/50"
                        onClick={() => toggleExclAnc(a)}>
                        {a} ×
                      </Badge>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input className="h-7 text-xs flex-1 font-mono"
                      value={exclInput} onChange={e => setExclInput(e.target.value)}
                      placeholder="ancillary_name" onKeyDown={e => {
                        if (e.key === 'Enter' && exclInput.trim()) {
                          toggleExclAnc(exclInput.trim()); setExclInput('');
                        }
                      }} />
                    <Button variant="outline" size="sm" className="h-7 text-xs"
                      onClick={() => { if (exclInput.trim()) { toggleExclAnc(exclInput.trim()); setExclInput(''); }}}>
                      Add
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Effects */}
            <Card>
              <CardHeader className="p-3 pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs font-semibold">Effects ({selectedAnc.effects.length})</CardTitle>
                  <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 text-primary" onClick={addEffect}>
                    <Plus className="w-3 h-3" /> Add Effect
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-3 pt-0 space-y-1">
                {selectedAnc.effects.length > 0 && (
                  <div className="flex items-center gap-1 mb-1">
                    <span className="flex-1 text-[9px] text-muted-foreground/60 pl-1">Stat</span>
                    <span className="w-20 text-[9px] text-muted-foreground/60 text-center">Value</span>
                    <span className="w-6" />
                  </div>
                )}
                {selectedAnc.effects.map((eff, idx) => (
                  <EffectRow key={idx} effect={eff}
                    onChange={e => updateEffect(idx, e)}
                    onDelete={() => deleteEffect(idx)} />
                ))}
                {selectedAnc.effects.length === 0 && (
                  <p className="text-[10px] text-muted-foreground/50 italic text-center py-3">No effects</p>
                )}
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
      )}
    </div>
  );
}