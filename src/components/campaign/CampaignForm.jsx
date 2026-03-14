import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const CAMPAIGN_TEMPLATES = [
  { id: 'imperial', label: 'Imperial Campaign (copy)', desc: 'Full world map, all factions' },
  { id: 'crusades', label: 'Crusades', desc: 'Focus on Holy Land and Mediterranean' },
  { id: 'british_isles', label: 'British Isles', desc: 'England, Scotland, Wales, Ireland' },
  { id: 'iberia', label: 'Iberian Peninsula', desc: 'Reconquista setting' },
  { id: 'blank', label: 'Blank (from scratch)', desc: 'Empty campaign — you provide all map files' },
];

const DEFAULT_WIN_CONDITIONS = `; Short Campaign
{SHORT_CAMPAIGN_CONDITIONS}
HoldRegions 15
TreasuryAmount 30000

; Long Campaign
{LONG_CAMPAIGN_CONDITIONS}
HoldRegions 45
`;

export default function CampaignForm({ initial, onSubmit, onCancel, isDuplicate }) {
  const [name, setName] = useState(initial?.name || '');
  const [title, setTitle] = useState(initial?.title || '');
  const [template, setTemplate] = useState(initial?.template || 'blank');
  const [description, setDescription] = useState(initial?.description || '');
  const [winConditions, setWinConditions] = useState(initial?.winConditions || DEFAULT_WIN_CONDITIONS);
  const [factions, setFactions] = useState(initial?.factions || 'england,france,hre,spain,venice,milan,sicily,papal_states,byzantium,egypt,moors,turks,russia,poland,hungary,denmark,norway,portugal,scotland,milan');
  const [errors, setErrors] = useState({});

  const validate = () => {
    const e = {};
    if (!name.trim()) e.name = 'Campaign folder name is required';
    else if (!/^[a-z0-9_]+$/.test(name.trim())) e.name = 'Use only lowercase letters, numbers, underscores';
    if (!title.trim()) e.title = 'Display title is required';
    return e;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    onSubmit({ name: name.trim(), title: title.trim(), template, description, winConditions, factions });
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 space-y-4">
      {/* Template selector */}
      {!initial && (
        <div className="space-y-2">
          <Label className="text-xs">Base Template</Label>
          <div className="space-y-1.5">
            {CAMPAIGN_TEMPLATES.map(t => (
              <label key={t.id} className={`flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${template === t.id ? 'border-primary bg-primary/10' : 'border-border hover:bg-accent/30'}`}>
                <input type="radio" name="template" value={t.id} checked={template === t.id} onChange={() => setTemplate(t.id)} className="mt-0.5 accent-primary" />
                <div>
                  <p className="text-xs font-medium text-foreground">{t.label}</p>
                  <p className="text-[10px] text-muted-foreground">{t.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Name */}
      <div className="space-y-1.5">
        <Label htmlFor="camp-name" className="text-xs">
          Campaign Folder Name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="camp-name"
          value={name}
          onChange={e => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
          placeholder="my_campaign"
          className="h-8 text-xs font-mono"
        />
        {errors.name && <p className="text-[10px] text-destructive">{errors.name}</p>}
        <p className="text-[10px] text-muted-foreground">
          Used in <code className="font-mono bg-accent px-1 rounded">data/world/maps/campaign/custom/<strong>{name || 'folder'}</strong>/</code>
        </p>
      </div>

      {/* Title */}
      <div className="space-y-1.5">
        <Label htmlFor="camp-title" className="text-xs">
          Display Title <span className="text-destructive">*</span>
        </Label>
        <Input
          id="camp-title"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="The Crusades"
          className="h-8 text-xs"
        />
        {errors.title && <p className="text-[10px] text-destructive">{errors.title}</p>}
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <Label className="text-xs">Campaign Description (optional)</Label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Describe your campaign…"
          rows={3}
          className="w-full text-xs bg-background border border-border rounded-md px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* Factions */}
      <div className="space-y-1.5">
        <Label className="text-xs">Playable Factions (comma-separated)</Label>
        <textarea
          value={factions}
          onChange={e => setFactions(e.target.value)}
          rows={3}
          className="w-full text-xs bg-background border border-border rounded-md px-3 py-2 resize-none font-mono focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <p className="text-[10px] text-muted-foreground">These go into <code className="font-mono bg-accent px-1 rounded">descr_strat.txt</code> playable factions list</p>
      </div>

      {/* Win conditions */}
      <div className="space-y-1.5">
        <Label className="text-xs">Win Conditions (descr_win_conditions.txt)</Label>
        <textarea
          value={winConditions}
          onChange={e => setWinConditions(e.target.value)}
          rows={5}
          className="w-full text-xs bg-background border border-border rounded-md px-3 py-2 resize-none font-mono focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="button" variant="outline" className="flex-1 h-8 text-xs" onClick={onCancel}>Cancel</Button>
        <Button type="submit" className="flex-1 h-8 text-xs">
          {initial && !isDuplicate ? 'Update Campaign' : isDuplicate ? 'Duplicate Campaign' : 'Create Campaign'}
        </Button>
      </div>
    </form>
  );
}