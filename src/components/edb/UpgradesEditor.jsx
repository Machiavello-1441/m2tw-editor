import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import RequirementBuilder from './RequirementBuilder';

export default function UpgradesEditor({ level, otherLevels, onUpdate, edbData }) {
  const [expandedUpgrade, setExpandedUpgrade] = useState(null);

  const upgrades = level.upgrades || [];

  const handleAdd = (levelName) => {
    const newUpgrade = {
      levelName,
      requirements: []
    };
    onUpdate([...upgrades, newUpgrade]);
  };

  const handleRemove = (idx) => {
    onUpdate(upgrades.filter((_, i) => i !== idx));
  };

  const handleUpdateUpgrade = (idx, updated) => {
    const newUpgrades = [...upgrades];
    newUpgrades[idx] = updated;
    onUpdate(newUpgrades);
  };

  const toggleExpanded = (idx) => {
    setExpandedUpgrade(expandedUpgrade === idx ? null : idx);
  };

  // Track which levels are already added
  const addedLevelNames = new Set(upgrades.map(u => u.levelName));
  const availableLevels = otherLevels.filter(l => !addedLevelNames.has(l.name));

  return (
    <div className="space-y-2">
      {upgrades.length > 0 ? (
        <div className="space-y-1">
          {upgrades.map((upgrade, idx) => (
            <div key={idx} className="bg-accent/50 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleExpanded(idx)}
                className="w-full px-3 py-2 flex items-center gap-2 hover:bg-accent/70 transition-colors"
              >
                {expandedUpgrade === idx ? (
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                )}
                <span className="text-xs font-medium text-foreground flex-1 text-left">
                  {upgrade.levelName}
                </span>
                <span className="text-[9px] text-muted-foreground">
                  Req: {upgrade.requirements?.length || 0}
                </span>
                <button
                  onClick={e => {
                    e.stopPropagation();
                    handleRemove(idx);
                  }}
                  className="p-1 hover:bg-destructive/20 rounded shrink-0"
                >
                  <Trash2 className="w-3 h-3 text-destructive" />
                </button>
              </button>

              {expandedUpgrade === idx && (
                <div className="px-3 py-2 border-t border-border/50 bg-accent/30">
                  <RequirementBuilder
                    requirements={upgrade.requirements || []}
                    onChange={reqs => handleUpdateUpgrade(idx, { ...upgrade, requirements: reqs })}
                    edbData={edbData}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[10px] text-muted-foreground italic">No upgrades selected</p>
      )}

      {availableLevels.length > 0 && (
        <div className="flex gap-2 items-center pt-1">
          <Select onValueChange={handleAdd}>
            <SelectTrigger className="h-7 text-xs flex-1">
              <SelectValue placeholder="Add upgrade…" />
            </SelectTrigger>
            <SelectContent>
              {availableLevels.map(l => (
                <SelectItem key={l.name} value={l.name} className="text-xs">
                  {l.index + 1}. {l.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={() => {}} className="h-7 text-xs px-2 gap-1 text-muted-foreground" disabled>
            <Plus className="w-3 h-3" />
          </Button>
        </div>
      )}

      {otherLevels.length === 0 && (
        <p className="text-[10px] text-muted-foreground italic">No other levels in this building tree</p>
      )}
    </div>
  );
}