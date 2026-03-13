import React from 'react';
import { useAncillaries } from './AncillariesContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';

const ANCILLARY_TYPES = [
  'Academic', 'Court', 'Diplomacy', 'Entertain', 'Family',
  'Health', 'Item', 'Magic', 'Military', 'Money', 'Naval',
  'Pet', 'Politics', 'Relic', 'Religion', 'Security', 'Sex',
];

const CULTURES = ['northern_european', 'eastern_european', 'southern_european', 'greek', 'middle_eastern', 'mesoamerican'];

export default function AncillaryEditor() {
  const { ancData, selectedAnc, updateAncillary, getText } = useAncillaries();

  if (selectedAnc === null || !ancData) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-muted-foreground">Select an ancillary from the list to edit it</p>
      </div>
    );
  }

  const anc = ancData.ancillaries[selectedAnc];
  if (!anc) return null;

  const update = (field, value) => updateAncillary(selectedAnc, { ...anc, [field]: value });

  const toggleCulture = (culture) => {
    const cultures = anc.excludeCultures.includes(culture)
      ? anc.excludeCultures.filter(c => c !== culture)
      : [...anc.excludeCultures, culture];
    update('excludeCultures', cultures);
  };

  const addEffect = () => {
    update('effects', [...anc.effects, { attribute: 'Command', value: 1 }]);
  };

  const updateEffect = (i, field, value) => {
    const effects = anc.effects.map((e, j) => j === i ? { ...e, [field]: value } : e);
    update('effects', effects);
  };

  const deleteEffect = (i) => {
    update('effects', anc.effects.filter((_, j) => j !== i));
  };

  const descText = getText(anc.description);
  const effectsText = getText(anc.effectsDescription);
  const displayName = getText(anc.name) || getText(anc.description?.replace('_desc', ''));

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4 space-y-5">
        {/* Display name preview */}
        {displayName && (
          <div className="bg-primary/10 border border-primary/20 rounded px-3 py-2">
            <p className="text-sm font-medium text-primary">{displayName}</p>
            {descText && <p className="text-xs text-muted-foreground mt-0.5 italic">{descText}</p>}
            {effectsText && <p className="text-[10px] text-muted-foreground mt-1">{effectsText}</p>}
          </div>
        )}

        {/* Core fields */}
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label className="text-[10px] text-muted-foreground">Ancillary Name (ID)</Label>
            <Input value={anc.name} onChange={e => update('name', e.target.value)}
              className="h-8 text-xs font-mono mt-1" />
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">Type</Label>
            <select
              value={anc.type}
              onChange={e => update('type', e.target.value)}
              className="w-full h-8 mt-1 text-xs bg-card border border-border rounded px-2 text-foreground"
            >
              {ANCILLARY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              <option value={anc.type}>{anc.type}</option>
            </select>
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">Image filename</Label>
            <Input value={anc.image} onChange={e => update('image', e.target.value)}
              className="h-8 text-xs font-mono mt-1" placeholder="e.g. court_noble.tga" />
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">Description key</Label>
            <Input value={anc.description} onChange={e => update('description', e.target.value)}
              className="h-8 text-xs font-mono mt-1" />
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">Effects Desc key</Label>
            <Input value={anc.effectsDescription} onChange={e => update('effectsDescription', e.target.value)}
              className="h-8 text-xs font-mono mt-1" />
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">Excluded Ancillaries</Label>
            <Input
              value={anc.excludedAncillaries.join(', ')}
              onChange={e => update('excludedAncillaries', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
              className="h-8 text-xs font-mono mt-1"
              placeholder="comma separated"
            />
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">Transferable</Label>
            <select
              value={anc.transferable}
              onChange={e => update('transferable', parseInt(e.target.value))}
              className="w-full h-8 mt-1 text-xs bg-card border border-border rounded px-2 text-foreground"
            >
              <option value={0}>No (0)</option>
              <option value={1}>Yes (1)</option>
            </select>
          </div>
        </div>

        {/* Toggles */}
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={anc.unique}
              onChange={e => update('unique', e.target.checked)} className="rounded" />
            <span className="text-xs text-muted-foreground">Unique</span>
          </label>
        </div>

        {/* Exclude Cultures */}
        <div>
          <Label className="text-[10px] text-muted-foreground">Exclude Cultures</Label>
          <div className="flex flex-wrap gap-1 mt-1">
            {CULTURES.map(culture => (
              <button key={culture} onClick={() => toggleCulture(culture)}
                className={`px-2 py-0.5 rounded text-[10px] border transition-colors ${
                  anc.excludeCultures.includes(culture)
                    ? 'bg-destructive/20 border-destructive text-destructive'
                    : 'bg-card border-border text-muted-foreground hover:border-foreground'
                }`}>
                {culture}
              </button>
            ))}
          </div>
        </div>

        {/* Effects */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Effects</Label>
            <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" onClick={addEffect}>
              <Plus className="w-3 h-3 mr-1" /> Add Effect
            </Button>
          </div>
          <div className="space-y-1.5">
            {anc.effects.map((effect, i) => (
              <div key={i} className="flex items-center gap-2 bg-card/50 rounded border border-border px-2 py-1.5">
                <Input
                  value={effect.attribute}
                  onChange={e => updateEffect(i, 'attribute', e.target.value)}
                  className="h-6 text-xs font-mono flex-1"
                  placeholder="Attribute name"
                />
                <Input
                  type="number"
                  value={effect.value}
                  onChange={e => updateEffect(i, 'value', parseInt(e.target.value) || 0)}
                  className="h-6 text-xs w-20"
                />
                <button onClick={() => deleteEffect(i)}
                  className="p-0.5 hover:bg-destructive/20 rounded shrink-0">
                  <Trash2 className="w-3 h-3 text-destructive" />
                </button>
              </div>
            ))}
            {anc.effects.length === 0 && (
              <p className="text-xs text-muted-foreground italic">No effects defined</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}