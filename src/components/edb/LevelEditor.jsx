import React from 'react';
import { useEDB } from './EDBContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Settings, Shield, Swords, ArrowUpRight } from 'lucide-react';
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

  // If only building selected (not a specific level), show building overview
  if (!selectedLevel) {
    return <BuildingOverview building={building} />;
  }

  const level = building.levels.find(l => l.name === selectedLevel);
  if (!level) return null;

  const update = (field, value) => {
    updateLevel(selectedBuilding, selectedLevel, { [field]: value });
  };

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
                  onChange={e => {
                    const newName = e.target.value;
                    updateLevel(selectedBuilding, selectedLevel, prev => ({ ...prev, name: newName }));
                  }}
                />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">Settlement Type</Label>
                <Select value={level.settlementType} onValueChange={v => update('settlementType', v)}>
                  <SelectTrigger className="h-7 text-xs mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SETTLEMENT_TYPES.map(t => (
                      <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">Material</Label>
                <Select value={level.material} onValueChange={v => update('material', v)}>
                  <SelectTrigger className="h-7 text-xs mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MATERIALS.map(m => (
                      <SelectItem key={m} value={m} className="text-xs">{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">Settlement Min</Label>
                <Select value={level.settlementMin} onValueChange={v => update('settlementMin', v)}>
                  <SelectTrigger className="h-7 text-xs mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SETTLEMENT_LEVELS.map(s => (
                      <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                    ))}
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
              <div>
                <Label className="text-[10px] text-muted-foreground">Convert To</Label>
                <Input className="h-7 text-xs mt-1" value={level.convertTo ?? ''}
                  placeholder="Index or blank"
                  onChange={e => update('convertTo', e.target.value || null)}
                />
              </div>
            </div>
            
            {/* Upgrades */}
            <div>
              <Label className="text-[10px] text-muted-foreground">Upgrades To</Label>
              <div className="flex gap-1 mt-1 flex-wrap">
                {level.upgrades.map((u, i) => (
                  <Badge key={i} variant="secondary" className="text-[10px]">
                    <ArrowUpRight className="w-2.5 h-2.5 mr-0.5" />{u}
                  </Badge>
                ))}
                {level.upgrades.length === 0 && (
                  <span className="text-[10px] text-muted-foreground italic">Top level (no upgrades)</span>
                )}
              </div>
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
            />
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}

function BuildingOverview({ building }) {
  const { updateBuilding } = useEDB();

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
              <Input className="h-7 text-xs mt-1"
                value={building.convertTo || ''}
                placeholder="e.g. castle_barracks"
                onChange={e => updateBuilding(building.name, { convertTo: e.target.value || null })}
              />
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