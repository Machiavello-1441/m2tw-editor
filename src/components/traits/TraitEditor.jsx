import React, { useState } from 'react';
import { useTraits } from './TraitsContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import EffectAttributeSelect from '../shared/EffectAttributeSelect';
import TriggerEditor from '../shared/TriggerEditor';

const CHARACTER_TYPES = ['family', 'spy', 'assassin', 'diplomat', 'admiral', 'merchant', 'priest', 'all'];
const CULTURES = ['northern_european', 'eastern_european', 'southern_european', 'greek', 'middle_eastern', 'mesoamerican'];

const inputCls = 'h-8 text-xs font-mono mt-1 text-white bg-background';
const inputSmCls = 'h-7 text-xs mt-0.5 text-white bg-background';
const textareaCls = 'w-full mt-1 text-xs bg-background border border-border rounded px-2 py-1.5 text-white resize-y focus:outline-none focus:ring-1 focus:ring-primary';

// \n\n is the M2TW strings.bin line break — render as actual <br>
function PreviewText({ text }) {
  if (!text) return null;
  const parts = text.split('\\n\\n');
  return (
    <span>
      {parts.map((p, i) => (
        <React.Fragment key={i}>{p}{i < parts.length - 1 && <br />}</React.Fragment>
      ))}
    </span>
  );
}

export default function TraitEditor() {
  const { traitsData, selectedTrait, updateTrait, getText, updateTextEntry, updateTrigger, addTrigger, deleteTrigger } = useTraits();
  const [expandedLevel, setExpandedLevel] = useState(0);

  if (selectedTrait === null || !traitsData) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-muted-foreground">Select a trait from the list to edit it</p>
      </div>
    );
  }

  const trait = traitsData.traits[selectedTrait];
  if (!trait) return null;

  const update = (field, value) => updateTrait(selectedTrait, { ...trait, [field]: value });

  const toggleCharacter = (char) => {
    const chars = trait.characters.includes(char)
      ? trait.characters.filter(c => c !== char)
      : [...trait.characters, char];
    update('characters', chars);
  };

  const toggleCulture = (culture) => {
    const cultures = trait.excludeCultures.includes(culture)
      ? trait.excludeCultures.filter(c => c !== culture)
      : [...trait.excludeCultures, culture];
    update('excludeCultures', cultures);
  };

  const addLevel = () => {
    const newLevel = {
      name: `${trait.name}_Level${trait.levels.length + 1}`,
      description: `${trait.name}_Level${trait.levels.length + 1}_desc`,
      effectsDescription: `${trait.name}_Level${trait.levels.length + 1}_effects_desc`,
      gainMessage: '', loseMessage: '', epithet: '',
      threshold: (trait.levels[trait.levels.length - 1]?.threshold || 0) * 2 || 1,
      effects: [],
    };
    const levels = [...trait.levels, newLevel];
    update('levels', levels);
    setExpandedLevel(levels.length - 1);
  };

  const updateLevel = (li, field, value) => {
    const levels = trait.levels.map((l, i) => i === li ? { ...l, [field]: value } : l);
    update('levels', levels);
  };

  const deleteLevel = (li) => update('levels', trait.levels.filter((_, i) => i !== li));

  const addEffect = (li) => {
    const levels = trait.levels.map((l, i) =>
      i === li ? { ...l, effects: [...l.effects, { attribute: 'Command', value: 1 }] } : l
    );
    update('levels', levels);
  };

  const updateEffect = (li, ei, field, value) => {
    const levels = trait.levels.map((l, i) => {
      if (i !== li) return l;
      const effects = l.effects.map((e, j) => j === ei ? { ...e, [field]: value } : e);
      return { ...l, effects };
    });
    update('levels', levels);
  };

  const deleteEffect = (li, ei) => {
    const levels = trait.levels.map((l, i) => {
      if (i !== li) return l;
      return { ...l, effects: l.effects.filter((_, j) => j !== ei) };
    });
    update('levels', levels);
  };

  // All triggers that affect this trait
  const allTriggers = traitsData.triggers || [];
  const relatedTriggerIndices = allTriggers
    .map((t, i) => ({ t, i }))
    .filter(({ t }) => t.affects?.some(a => a.trait === trait.name));

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4 space-y-5">

        {/* Header fields */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-[10px] text-muted-foreground">Trait Name (ID)</Label>
            <Input value={trait.name} onChange={e => update('name', e.target.value)} className={inputCls} />
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">Anti-Traits (comma separated)</Label>
            <Input
              value={trait.antiTraits.join(', ')}
              onChange={e => update('antiTraits', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
              className={inputCls} placeholder="e.g. BadCommander"
            />
          </div>
        </div>

        {/* Characters */}
        <div>
          <Label className="text-[10px] text-muted-foreground">Characters</Label>
          <div className="flex flex-wrap gap-1 mt-1">
            {CHARACTER_TYPES.map(char => (
              <button key={char} onClick={() => toggleCharacter(char)}
                className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-colors ${
                  trait.characters.includes(char)
                    ? 'bg-primary/20 border-primary text-primary'
                    : 'bg-card border-border text-muted-foreground hover:border-foreground'
                }`}>
                {char}
              </button>
            ))}
          </div>
        </div>

        {/* Options */}
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={trait.hidden} onChange={e => update('hidden', e.target.checked)} className="rounded" />
            <span className="text-xs text-white">Hidden</span>
          </label>
          <div className="flex items-center gap-2">
            <Label className="text-[10px] text-muted-foreground">NoGoingBackLevel</Label>
            <Input type="number" value={trait.noGoingBackLevel ?? ''}
              onChange={e => update('noGoingBackLevel', e.target.value ? parseInt(e.target.value) : null)}
              className="h-7 w-20 text-xs text-white bg-background" placeholder="none" />
          </div>
        </div>

        {/* Exclude Cultures */}
        <div>
          <Label className="text-[10px] text-muted-foreground">Exclude Cultures</Label>
          <div className="flex flex-wrap gap-1 mt-1">
            {CULTURES.map(culture => (
              <button key={culture} onClick={() => toggleCulture(culture)}
                className={`px-2 py-0.5 rounded text-[10px] border transition-colors ${
                  trait.excludeCultures.includes(culture)
                    ? 'bg-destructive/20 border-destructive text-destructive'
                    : 'bg-card border-border text-muted-foreground hover:border-foreground'
                }`}>
                {culture}
              </button>
            ))}
          </div>
        </div>

        {/* Levels */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Levels ({trait.levels.length})</Label>
            <Button size="sm" variant="outline" className="h-6 px-2 text-[10px] text-white" onClick={addLevel}>
              <Plus className="w-3 h-3 mr-1" /> Add Level
            </Button>
          </div>

          <div className="space-y-2">
            {trait.levels.map((level, li) => {
              const isExpanded = expandedLevel === li;
              const descText = getText(level.description);
              const effectsDescText = getText(level.effectsDescription);
              const epithText = getText(level.epithet);
              return (
                <div key={li} className="rounded border border-border bg-card/50 overflow-visible">
                  <div className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-accent/50"
                    onClick={() => setExpandedLevel(isExpanded ? null : li)}>
                    {isExpanded ? <ChevronDown className="w-3 h-3 shrink-0" /> : <ChevronRight className="w-3 h-3 shrink-0" />}
                    <span className="text-xs font-mono font-medium flex-1 truncate text-white">{level.name}</span>
                    <Badge variant="outline" className="text-[10px] h-4 px-1.5">T:{level.threshold}</Badge>
                    <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{level.effects.length} fx</Badge>
                    <button onClick={e => { e.stopPropagation(); deleteLevel(li); }}
                      className="p-0.5 hover:bg-destructive/20 rounded shrink-0">
                      <Trash2 className="w-3 h-3 text-destructive" />
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="px-3 pb-3 pt-2 border-t border-border/50 space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-[10px] text-muted-foreground">Level Name (ID)</Label>
                          <Input value={level.name} onChange={e => updateLevel(li, 'name', e.target.value)} className={inputSmCls + ' font-mono'} />
                        </div>
                        <div>
                          <Label className="text-[10px] text-muted-foreground">Threshold</Label>
                          <Input type="number" value={level.threshold}
                            onChange={e => updateLevel(li, 'threshold', parseInt(e.target.value) || 0)}
                            className={inputSmCls} />
                        </div>
                        <div>
                          <Label className="text-[10px] text-muted-foreground">Gain Message key</Label>
                          <Input value={level.gainMessage} onChange={e => updateLevel(li, 'gainMessage', e.target.value)} className={inputSmCls + ' font-mono'} placeholder="optional" />
                        </div>
                        <div>
                          <Label className="text-[10px] text-muted-foreground">Lose Message key</Label>
                          <Input value={level.loseMessage} onChange={e => updateLevel(li, 'loseMessage', e.target.value)} className={inputSmCls + ' font-mono'} placeholder="optional" />
                        </div>
                      </div>

                      {/* Text fields */}
                      <div className="space-y-2">
                        <div>
                          <div className="flex items-center justify-between">
                            <Label className="text-[10px] text-muted-foreground">Description</Label>
                            <span className="text-[9px] text-muted-foreground/50 font-mono">{level.description}</span>
                          </div>
                          <textarea rows={4} className={textareaCls}
                            value={descText}
                            onChange={e => level.description && updateTextEntry(level.description, e.target.value)}
                            placeholder={level.description ? 'Enter description text… (use \\n\\n for line break)' : 'No description key'}
                            disabled={!level.description}
                          />
                          {descText && (
                            <p className="text-[10px] text-muted-foreground mt-1 bg-muted/20 rounded px-2 py-1 italic leading-relaxed">
                              <PreviewText text={descText} />
                            </p>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center justify-between">
                            <Label className="text-[10px] text-muted-foreground">Effects Description</Label>
                            <span className="text-[9px] text-muted-foreground/50 font-mono">{level.effectsDescription}</span>
                          </div>
                          <textarea rows={3} className={textareaCls}
                            value={effectsDescText}
                            onChange={e => level.effectsDescription && updateTextEntry(level.effectsDescription, e.target.value)}
                            placeholder={level.effectsDescription ? 'Enter effects description text…' : 'No effects description key'}
                            disabled={!level.effectsDescription}
                          />
                        </div>
                        <div>
                          <div className="flex items-center justify-between">
                            <Label className="text-[10px] text-muted-foreground">Epithet</Label>
                            <span className="text-[9px] text-muted-foreground/50 font-mono">{level.epithet}</span>
                          </div>
                          <Input
                            value={epithText}
                            onChange={e => level.epithet && updateTextEntry(level.epithet, e.target.value)}
                            className={inputSmCls}
                            placeholder={level.epithet ? 'Enter epithet text…' : 'No epithet key set'}
                            disabled={!level.epithet}
                          />
                        </div>
                      </div>

                      {/* Effects */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <Label className="text-[10px] text-muted-foreground">Effects</Label>
                          <Button size="sm" variant="ghost" className="h-5 px-1.5 text-[10px] text-white" onClick={() => addEffect(li)}>
                            <Plus className="w-2.5 h-2.5 mr-0.5" /> Add
                          </Button>
                        </div>
                        <div className="space-y-1">
                          {level.effects.map((effect, ei) => (
                            <div key={ei} className="flex items-center gap-1.5">
                              <EffectAttributeSelect
                                value={effect.attribute}
                                onChange={v => updateEffect(li, ei, 'attribute', v)}
                                className="flex-1"
                              />
                              <Input type="number" value={effect.value}
                                onChange={e => updateEffect(li, ei, 'value', parseInt(e.target.value) || 0)}
                                className="h-6 text-xs w-20 text-white bg-background" />
                              <button onClick={() => deleteEffect(li, ei)}
                                className="p-0.5 hover:bg-destructive/20 rounded shrink-0">
                                <Trash2 className="w-3 h-3 text-destructive" />
                              </button>
                            </div>
                          ))}
                          {level.effects.length === 0 && (
                            <p className="text-[10px] text-muted-foreground italic">No effects</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Triggers */}
        <TriggerEditor
          triggers={relatedTriggerIndices.map(({ t }) => t)}
          onUpdate={(localIdx, updated) => updateTrigger(relatedTriggerIndices[localIdx].i, updated)}
          onAdd={addTrigger}
          onDelete={(localIdx) => deleteTrigger(relatedTriggerIndices[localIdx].i)}
          entityName={trait.name}
          mode="trait"
        />
      </div>
    </div>
  );
}