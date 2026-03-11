import React from 'react';
import { useEDB } from './EDBContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Settings, Shield, Swords, X } from 'lucide-react';
import { SETTLEMENT_TYPES, SETTLEMENT_LEVELS, MATERIALS } from './EDBParser';
import CapabilityEditor from './CapabilityEditor';
import RequirementBuilder from './RequirementBuilder';

export default function LevelEditor() {
  const { edbData, selectedBuilding, selectedLevel, updateLevel, updateBuilding } = useEDB();

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

  const level = building.levels.find(l => l.name === selectedLevel);
  if (!level) return null;

  const update = (field, value) => updateLevel(selectedBuilding, selectedLevel, { [field]: value });

  // Other levels in same building (for upgrades)
  const otherLevels = building.levels.filter(l => l.name !== selectedLevel).map(l => l.name);

  const toggleUpgrade = (levelName) => {
    const current = level.upgrades || [];
    if (current.includes(levelName)) {
      update('upgrades', current.filter(u => u !== levelName));
    } else {
      update('upgrades', [...current, levelName]);
    }
  };

  // All building names for convert_to dropdown
  const allBuildingNames = edbData.buildings.map(b => b.name);

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center">
            <Settings className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground">{level.name}</h2>
            <p className="text-[10px] text-muted-foreground">
              {building.name} → {level.settlementType}
            </p>
          </div>
          <Badge variant="outline" className="ml-auto text-[10px]">
            {level.settlementMin}
          </Badge>
        </div>

        {/* Core Attributes */}
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
              <div className="col-span-2">
                <Label className="text-[10px] text-muted-foreground">Convert To</Label>
                <Select value={level.convertTo || '__none__'} onValueChange={v => update('convertTo', v === '__none__' ? null : v)}>
                  <SelectTrigger className="h-7 text-xs mt-1"><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__" className="text-xs text-muted-foreground">— None —</SelectItem>
                    {allBuildingNames.filter(n => n !== selectedBuilding).map(n => (
                      <SelectItem key={n} value={n} className="text-xs">{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Upgrades — multi-select from same tree */}
            <div>
              <Label className="text-[10px] text-muted-foreground">Upgrades To</Label>
              {otherLevels.length > 0 ? (
                <div className="flex flex-wrap gap-1 mt-1">
                  {otherLevels.map(ln => {
                    const selected = (level.upgrades || []).includes(ln);
                    return (
                      <button
                        key={ln}
                        onClick={() => toggleUpgrade(ln)}
                        className={`px-2 py-0.5 text-[10px] rounded border transition-colors flex items-center gap-1
                          ${selected
                            ? 'bg-primary/20 border-primary/40 text-primary'
                            : 'bg-accent/50 border-border text-muted-foreground hover:border-primary/30'
                          }`}
                      >
                        {ln}
                        {selected && <X className="w-2 h-2" />}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[10px] text-muted-foreground mt-1 italic">No other levels in this building tree</p>
              )}
              {(level.upgrades || []).length === 0 && otherLevels.length > 0 && (
                <p className="text-[10px] text-muted-foreground italic mt-1">Top level (no upgrades selected)</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Requirements */}
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

        {/* Capabilities */}
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
      </div>
    </ScrollArea>
  );
}

function BuildingOverview({ building, edbData }) {
  const { updateBuilding } = useEDB();
  const allBuildingNames = edbData.buildings.map(b => b.name);

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
              <Select value={building.convertTo || '__none__'} onValueChange={v => updateBuilding(building.name, { convertTo: v === '__none__' ? null : v })}>
                <SelectTrigger className="h-7 text-xs mt-1"><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__" className="text-xs text-muted-foreground">— None —</SelectItem>
                  {allBuildingNames.filter(n => n !== building.name).map(n => (
                    <SelectItem key={n} value={n} className="text-xs">{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

        <p className="text-xs text-muted-foreground text-center pt-4">
          Select a level from the tree to edit its details
        </p>
      </div>
    </ScrollArea>
  );
}