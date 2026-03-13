import React from 'react';
import { useEDB } from './EDBContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Settings, Shield, Swords, ImageIcon } from 'lucide-react';
import { SETTLEMENT_TYPES, SETTLEMENT_LEVELS, MATERIALS } from './EDBParser';
import CapabilityEditor from './CapabilityEditor.jsx';
import RequirementBuilder from './RequirementBuilder';
import SearchableSelect from './SearchableSelect.jsx';
import { useRefData } from './RefDataContext';
import { BuildingTreeTextEditor, LevelTextEditor } from './BuildingTextEditor';
import UpgradesEditor from './UpgradesEditor';

function LevelImages({ levelName }) {
  const { imageData } = useEDB();
  const { cultures } = useRefData();
  const IMAGE_TYPES = ['icon', 'constructed', 'construction'];
  const IMAGE_LABELS = { icon: 'Icon', constructed: 'Info Pic', construction: 'Construction' };

  const images = [];
  for (const culture of cultures) {
    for (const type of IMAGE_TYPES) {
      const key = `${levelName}_${culture}_${type}`;
      if (imageData[key]) images.push({ ...imageData[key], type, culture, key, label: IMAGE_LABELS[type] });
    }
  }

  if (images.length === 0) return (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-accent/30 border border-dashed border-border">
      <ImageIcon className="w-3.5 h-3.5 text-muted-foreground" />
      <span className="text-[10px] text-muted-foreground">No images uploaded yet — use the Images tab</span>
    </div>
  );

  return (
    <div className="flex flex-wrap gap-2">
      {images.map(img => (
        <div key={img.key} className="flex flex-col items-center gap-1">
          <img src={img.url} alt={img.label} className="w-16 h-16 object-contain rounded border border-border bg-black/20" />
          <span className="text-[9px] text-muted-foreground">{img.label}</span>
          <span className="text-[9px] text-muted-foreground/60">{img.culture}</span>
        </div>
      ))}
    </div>
  );
}

export default function LevelEditor() {
  const { edbData, selectedBuilding, selectedLevel, updateLevel } = useEDB();

  if (!edbData || !selectedBuilding) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Select a building or level to edit
      </div>
    );
  }

  const building = edbData.buildings.find(b => b.name === selectedBuilding);
  if (!building) return null;

  if (!selectedLevel) {
    return <BuildingOverview building={building} edbData={edbData} />;
  }

  const levelIndex = building.levels.findIndex(l => l.name === selectedLevel);
  const level = building.levels[levelIndex];
  if (!level) return null;

  const update = (field, value) => updateLevel(selectedBuilding, selectedLevel, { [field]: value });

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center">
            <Settings className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground">{level.name}</h2>
            <p className="text-[10px] text-muted-foreground">
              {building.name} → Level {levelIndex + 1} · {level.settlementType}
            </p>
          </div>
          <Badge variant="outline" className="ml-auto text-[10px]">
            #{levelIndex + 1}
          </Badge>
        </div>

        <Card>
          <CardHeader className="p-3 pb-2">
            <CardTitle className="text-xs font-semibold">Core Attributes</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[10px] text-muted-foreground">Level Name</Label>
                <Input className="h-7 text-xs mt-1" value={level.name}
                  onChange={e => updateLevel(selectedBuilding, selectedLevel, prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">Settlement Type</Label>
                <Select value={level.settlementType} onValueChange={v => update('settlementType', v)}>
                  <SelectTrigger className="h-7 text-xs mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SETTLEMENT_TYPES.map(t => <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">Material</Label>
                <Select value={level.material} onValueChange={v => update('material', v)}>
                  <SelectTrigger className="h-7 text-xs mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MATERIALS.map(m => <SelectItem key={m} value={m} className="text-xs">{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">Settlement Min</Label>
                <Select value={level.settlementMin} onValueChange={v => update('settlementMin', v)}>
                  <SelectTrigger className="h-7 text-xs mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SETTLEMENT_LEVELS.map(s => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">Construction Time</Label>
                <Input className="h-7 text-xs mt-1" type="number" value={level.construction}
                  onChange={e => update('construction', parseInt(e.target.value) || 0)}
                />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">Cost</Label>
                <Input className="h-7 text-xs mt-1" type="number" step="100" value={level.cost}
                  onChange={e => update('cost', parseInt(e.target.value) || 0)}
                />
              </div>
              {building.convertTo && (
                <div className="col-span-2">
                  <Label className="text-[10px] text-muted-foreground">
                    Convert To Index
                    <span className="ml-1 text-muted-foreground/60">(auto-set from level position, editable)</span>
                  </Label>
                  <Input
                    className="h-7 text-xs mt-1"
                    type="number"
                    min="0"
                    value={level.convertTo !== null && level.convertTo !== undefined ? level.convertTo : levelIndex}
                    onChange={e => update('convertTo', e.target.value)}
                  />
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Building converts to <span className="text-primary font-mono">{building.convertTo}</span>. Auto-index: {levelIndex}
                  </p>
                </div>
              )}
            </div>

            <UpgradesEditor
              upgrades={level.upgrades || []}
              onChange={v => update('upgrades', v)}
              allLevels={building.levels}
              currentLevelName={selectedLevel}
              edbData={edbData}
            />

            <div>
              <Label className="text-[10px] text-muted-foreground mb-1 block">Images</Label>
              <LevelImages levelName={level.name} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-3 pb-2">
            <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-primary" />
              Level Requirements
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <RequirementBuilder
              requirements={level.requirements || []}
              onChange={reqs => update('requirements', reqs)}
              edbData={edbData}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-3 pb-2">
            <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
              <Swords className="w-3.5 h-3.5 text-primary" />
              Capabilities ({level.capabilities.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <CapabilityEditor
              capabilities={level.capabilities}
              onChange={caps => update('capabilities', caps)}
              edbData={edbData}
            />
          </CardContent>
        </Card>

        <LevelTextEditor levelName={level.name} />
      </div>
    </ScrollArea>
  );
}

function BuildingOverview({ building, edbData }) {
  const { updateBuilding } = useEDB();
  const buildingOptions = edbData.buildings
    .filter(b => b.name !== building.name)
    .map(b => ({ value: b.name, label: b.name }));

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center">
            <Settings className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground">{building.name}</h2>
            <p className="text-[10px] text-muted-foreground">
              {building.levels.length} levels · {building.convertTo ? `converts to ${building.convertTo}` : 'no conversion'}
            </p>
          </div>
        </div>

        <Card>
          <CardHeader className="p-3 pb-2">
            <CardTitle className="text-xs font-semibold">Building Properties</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 space-y-3">
            <div>
              <Label className="text-[10px] text-muted-foreground">Convert To (castle/city equivalent)</Label>
              <div className="mt-1">
                <SearchableSelect
                  value={building.convertTo || '__none__'}
                  onValueChange={v => updateBuilding(building.name, { convertTo: v === '__none__' ? null : v })}
                  options={buildingOptions}
                  placeholder="None"
                  noneOption
                />
              </div>
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Levels</Label>
              <div className="flex gap-1 mt-1 flex-wrap">
                {building.levels.map((l, i) => (
                  <Badge key={l.name} variant="outline" className="text-[10px]">
                    {i + 1}. {l.name} ({l.settlementType})
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <BuildingTreeTextEditor buildingName={building.name} />

        <p className="text-xs text-muted-foreground text-center pt-4">
          Select a level from the tree to edit its details
        </p>
      </div>
    </ScrollArea>
  );
}