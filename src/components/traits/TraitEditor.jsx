import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useTraits } from './TraitsContext';
import { useModData } from '../shared/ModDataContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, ChevronDown, ChevronRight, Wand2, ArrowUpDown, Search, X } from 'lucide-react';
import EffectAttributeSelect from '../shared/EffectAttributeSelect';
import TriggerEditor from '../shared/TriggerEditor';
import ValidationPanel from '../shared/ValidationPanel';
import { buildEffectsDescription, validateTraitsData } from '../shared/effectsDescriptionBuilder';

const CHARACTER_TYPES = ['family', 'spy', 'assassin', 'diplomat', 'admiral', 'merchant', 'priest', 'all'];
const CULTURES = ['northern_european', 'eastern_european', 'southern_european', 'greek', 'middle_eastern', 'mesoamerican'];

const inputCls = 'h-8 text-xs font-mono mt-1 text-white bg-background';
const inputSmCls = 'h-7 text-xs mt-0.5 text-white bg-background';
const textareaCls = 'w-full mt-1 text-xs bg-background border border-border rounded px-2 py-1.5 text-white resize-y focus:outline-none focus:ring-1 focus:ring-primary';

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

// ── Searchable multi-select for anti-traits ────────────────────────────────────
function AntiTraitSelect({ selected, allTraitNames, onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const available = useMemo(() => {
    const q = query.toLowerCase();
    return allTraitNames.filter(n => !selected.includes(n) && (!q || n.toLowerCase().includes(q)));
  }, [allTraitNames, selected, query]);

  const add = (name) => { onChange([...selected, name]); setQuery(''); };
  const remove = (name) => onChange(selected.filter(n => n !== name));

  return (
    <div ref={ref} className="relative mt-1">
      <div className="flex flex-wrap gap-1 mb-1 min-h-[28px] rounded border border-border bg-background px-2 py-1">
        {selected.map(n => (
          <span key={n} className="flex items-center gap-0.5 px-1.5 py-0.5 bg-primary/20 border border-primary/40 rounded text-[10px] text-primary font-mono">
            {n}
            <button type="button" onClick={() => remove(n)} className="text-primary/60 hover:text-red-400 ml-0.5">
              <X className="w-2.5 h-2.5" />
            </button>
          </span>
        ))}
        <button
          type="button"
          onClick={() => { setOpen(v => !v); setQuery(''); }}
          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground px-1"
        >
          <Search className="w-3 h-3" /> {selected.length === 0 ? 'Search and add anti-traits…' : 'Add more…'}
        </button>
      </div>
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-0.5 bg-popover border border-border rounded shadow-xl">
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search traits…"
            className="w-full h-7 px-2 text-xs bg-background border-b border-border text-white placeholder-muted-foreground outline-none"
          />
          <div className="max-h-48 overflow-y-auto">
            {available.length === 0 && (
              <div className="px-2 py-2 text-[10px] text-muted-foreground italic">No matching traits</div>
            )}
            {available.map(name => (
              <div
                key={name}
                onMouseDown={() => { add(name); setOpen(false); }}
                className="px-2 py-1 text-[11px] font-mono cursor-pointer hover:bg-accent text-white"
              >
                {name}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function TraitEditor() {
  const { traitsData, selectedTrait, updateTrait, getText, updateTextEntry, renameTextKey, updateTrigger, addTrigger, deleteTrigger } = useTraits();
  const { traitAttributeNames } = useModData();
  const [expandedLevel, setExpandedLevel] = useState(0);

  const trait = (traitsData && selectedTrait !== null) ? traitsData.traits[selectedTrait] : null;

  // All trait names for anti-trait dropdown (hooks must be before any early return)
  const allTraitNames = useMemo(
    () => (traitsData?.traits || []).map(t => t.name).filter(n => n !== trait?.name),
    [traitsData?.traits, trait?.name]
  );

  if (selectedTrait === null || !traitsData) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-muted-foreground">Select a trait from the list to edit it</p>
      </div>
    );
  }

  if (!trait) return null;

  const update = (field, value) => {
    if (field === 'name') {
      const oldName = trait.name;
      const newName = value;
      const renamedLevels = trait.levels.map((l) => {
        const renamedLevel = { ...l };
        if (l.description && l.description.startsWith(oldName)) {
          const newKey = newName + l.description.slice(oldName.length);
          renameTextKey(l.description, newKey);
          renamedLevel.description = newKey;
        }
        if (l.effectsDescription && l.effectsDescription.startsWith(oldName)) {
          const newKey = newName + l.effectsDescription.slice(oldName.length);
          renameTextKey(l.effectsDescription, newKey);
          renamedLevel.effectsDescription = newKey;
        }
        if (l.epithet && l.epithet.startsWith(oldName)) {
          const newKey = newName + l.epithet.slice(oldName.length);
          renameTextKey(l.epithet, newKey);
          renamedLevel.epithet = newKey;
        }
        if (l.name && l.name.startsWith(oldName)) {
          renamedLevel.name = newName + l.name.slice(oldName.length);
        }
        return renamedLevel;
      });
      updateTrait(selectedTrait, { ...trait, name: newName, levels: renamedLevels });
      return;
    }
    updateTrait(selectedTrait, { ...trait, [field]: value });
  };

  // Anti-traits: set this trait's anti-traits AND reciprocally update the other traits
  const handleAntiTraitsChange = (newAntiTraits) => {
    const oldAntiTraits = trait.antiTraits;
    const added = newAntiTraits.filter(n => !oldAntiTraits.includes(n));
    const removed = oldAntiTraits.filter(n => !newAntiTraits.includes(n));

    // Build updated traits array with reciprocal changes
    const updatedTraits = traitsData.traits.map((t, i) => {
      if (i === selectedTrait) return { ...t, antiTraits: newAntiTraits };
      if (added.includes(t.name)) {
        // Add this trait as anti-trait of the newly added one (if not already there)
        if (!t.antiTraits.includes(trait.name)) {
          return { ...t, antiTraits: [...t.antiTraits, trait.name] };
        }
      }
      if (removed.includes(t.name)) {
        // Remove this trait from the anti-traits of the removed one
        return { ...t, antiTraits: t.antiTraits.filter(n => n !== trait.name) };
      }
      return t;
    });

    updateTrait(selectedTrait, { ...trait, antiTraits: newAntiTraits });
    // Apply reciprocal updates to other traits
    updatedTraits.forEach((t, i) => {
      if (i !== selectedTrait) updateTrait(i, t);
    });
  };

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

  // Auto-sort levels by threshold
  const autoSortLevels = () => {
    const sorted = [...trait.levels].sort((a, b) => a.threshold - b.threshold);
    update('levels', sorted);
    setExpandedLevel(null);
  };

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
            <Label className="text-[10px] text-muted-foreground">Display Name <span className="text-amber-400">(VnVs text)</span></Label>
            <Input
              value={getText(trait.name)}
              onChange={e => updateTextEntry(trait.name, e.target.value)}
              className={inputCls + ' text-amber-400'}
              placeholder="Enter in-game display name…"
            />
          </div>
        </div>

        {/* Anti-traits: searchable multi-select with reciprocal update */}
        <div>
          <Label className="text-[10px] text-muted-foreground">Anti-Traits</Label>
          <AntiTraitSelect
            selected={trait.antiTraits}
            allTraitNames={allTraitNames}
            onChange={handleAntiTraitsChange}
          />
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
            <div className="flex gap-1">
              <Button size="sm" variant="outline" className="h-6 px-2 text-[10px] text-white" onClick={autoSortLevels} title="Sort levels by threshold value">
                <ArrowUpDown className="w-3 h-3 mr-1" /> Auto-sort
              </Button>
              <Button size="sm" variant="outline" className="h-6 px-2 text-[10px] text-white" onClick={addLevel}>
                <Plus className="w-3 h-3 mr-1" /> Add Level
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            {trait.levels.map((level, li) => {
              const isExpanded = expandedLevel === li;
              const descText = getText(level.description);
              const effectsDescText = getText(level.effectsDescription);
              const epithText = getText(level.epithet);
              const levelDisplayName = getText(level.name);
              return (
                <div key={li} className="rounded border border-border bg-card/50 overflow-visible">
                  <div className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-accent/50"
                    onClick={() => setExpandedLevel(isExpanded ? null : li)}>
                    {isExpanded ? <ChevronDown className="w-3 h-3 shrink-0" /> : <ChevronRight className="w-3 h-3 shrink-0" />}
                    <span className="text-xs font-mono font-medium flex-1 truncate text-white">
                      {levelDisplayName ? <span className="text-amber-400">{levelDisplayName}</span> : level.name}
                    </span>
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
                          <Label className="text-[10px] text-muted-foreground">Display Level Name <span className="text-amber-400">(VnVs)</span></Label>
                          <Input
                            value={levelDisplayName}
                            onChange={e => updateTextEntry(level.name, e.target.value)}
                            className={inputSmCls + ' text-amber-400'}
                            placeholder="In-game level name…"
                          />
                        </div>
                        <div>
                          <Label className="text-[10px] text-muted-foreground">Threshold</Label>
                          <Input type="number" value={level.threshold}
                            onChange={e => updateLevel(li, 'threshold', parseInt(e.target.value) || 0)}
                            className={inputSmCls} />
                        </div>
                        <div />
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
                            <div className="flex items-center gap-2">
                              <Label className="text-[10px] text-muted-foreground">Effects Description</Label>
                              {level.effectsDescription && level.effects.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => updateTextEntry(level.effectsDescription, buildEffectsDescription(level.effects))}
                                  className="flex items-center gap-0.5 text-[9px] text-primary hover:underline"
                                  title="Auto-generate from effects"
                                >
                                  <Wand2 className="w-2.5 h-2.5" /> Auto
                                </button>
                              )}
                            </div>
                            <span className="text-[9px] text-muted-foreground/50 font-mono">{level.effectsDescription}</span>
                          </div>
                          <textarea rows={3} className={textareaCls}
                            value={effectsDescText}
                            onChange={e => level.effectsDescription && updateTextEntry(level.effectsDescription, e.target.value)}
                            placeholder={level.effectsDescription ? 'Enter effects description text…' : 'No effects description key'}
                            disabled={!level.effectsDescription}
                          />
                        </div>

                        {/* Epithet: key is read-only (shown as label), only display text is editable */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <Label className="text-[10px] text-muted-foreground">Epithet <span className="text-[9px] text-muted-foreground/60">(optional)</span></Label>
                            {!level.epithet ? (
                              <button
                                type="button"
                                onClick={() => {
                                  const key = `${trait.name}_Level${li + 1}_epithet_desc`;
                                  updateLevel(li, 'epithet', key);
                                }}
                                className="text-[9px] text-primary hover:underline"
                              >
                                + Set epithet
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => updateLevel(li, 'epithet', '')}
                                className="text-[9px] text-destructive hover:underline"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                          {level.epithet ? (
                            <>
                              <div className="text-[9px] text-muted-foreground/50 font-mono mb-1 px-1">{level.epithet}</div>
                              <Input
                                value={epithText}
                                onChange={e => updateTextEntry(level.epithet, e.target.value)}
                                className={inputSmCls}
                                placeholder="Enter epithet display text…"
                              />
                            </>
                          ) : (
                            <p className="text-[10px] text-muted-foreground/40 italic">No epithet set</p>
                          )}
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

        {/* Validation */}
        <ValidationPanel onValidate={() => validateTraitsData(traitsData, getText)} watchData={traitsData} />
      </div>
    </div>
  );
}