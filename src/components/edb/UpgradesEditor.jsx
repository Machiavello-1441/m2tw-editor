import React, { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, ChevronDown, ChevronRight, Shield } from 'lucide-react';
import SearchableSelect from './SearchableSelect.jsx';
import RequirementBuilder from './RequirementBuilder';

/**
 * Each upgrade entry is either:
 *   - a plain string (legacy): the level name
 *   - an object: { name: string, requirements: [] }
 *
 * We normalise everything to objects internally and serialise back to strings
 * when there are no requirements, to keep the EDB output clean.
 */
function normalise(upgrades) {
  return (upgrades || []).map(u =>
    typeof u === 'string' ? { name: u, requirements: [] } : { requirements: [], ...u }
  );
}

export default function UpgradesEditor({ upgrades, onChange, allLevels, currentLevelName, edbData }) {
  const [expandedIdx, setExpandedIdx] = useState(null);

  const entries = normalise(upgrades);

  // Levels available to add (not already in list, not self)
  const usedNames = new Set(entries.map(e => e.name));
  const available = allLevels
    .filter(l => l.name !== currentLevelName && !usedNames.has(l.name))
    .map(l => ({ value: l.name, label: l.name }));

  const commit = (newEntries) => {
    // Serialise: plain string if no requirements, object otherwise
    onChange(newEntries.map(e =>
      (!e.requirements || e.requirements.length === 0) ? e.name : e
    ));
  };

  const addUpgrade = (levelName) => {
    if (!levelName) return;
    commit([...entries, { name: levelName, requirements: [] }]);
  };

  const removeUpgrade = (idx) => {
    const next = entries.filter((_, i) => i !== idx);
    if (expandedIdx === idx) setExpandedIdx(null);
    else if (expandedIdx > idx) setExpandedIdx(expandedIdx - 1);
    commit(next);
  };

  const updateReqs = (idx, reqs) => {
    const next = entries.map((e, i) => i === idx ? { ...e, requirements: reqs } : e);
    commit(next);
  };

  return (
    <div>
      <Label className="text-[10px] text-muted-foreground">Upgrades To</Label>

      {entries.length === 0 && (
        <p className="text-[10px] text-muted-foreground italic mt-1">No upgrades — this is a top-level or terminal level</p>
      )}

      <div className="mt-1 space-y-1">
        {entries.map((entry, idx) => {
          const isExpanded = expandedIdx === idx;
          const hasReqs = entry.requirements && entry.requirements.length > 0;
          return (
            <div key={idx} className="rounded border border-border bg-card overflow-hidden">
              <div className="flex items-center gap-2 px-2 py-1.5">
                <button
                  onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                  className="p-0.5 hover:bg-accent rounded shrink-0"
                >
                  {isExpanded
                    ? <ChevronDown className="w-3 h-3 text-muted-foreground" />
                    : <ChevronRight className="w-3 h-3 text-muted-foreground" />
                  }
                </button>
                <span className="text-xs font-mono flex-1 text-foreground">{entry.name}</span>
                {hasReqs && (
                  <Shield className="w-3 h-3 text-primary shrink-0" title="Has requirements" />
                )}
                <Button
                  variant="ghost" size="sm"
                  className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                  onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                >
                  Req ({entry.requirements?.length || 0})
                </Button>
                <button onClick={() => removeUpgrade(idx)} className="p-1 hover:bg-destructive/20 rounded shrink-0">
                  <Trash2 className="w-3 h-3 text-destructive" />
                </button>
              </div>

              {isExpanded && (
                <div className="px-3 pb-3 pt-1 border-t border-border/50 bg-accent/10">
                  <p className="text-[10px] text-muted-foreground mb-2">
                    Optional requirements for this upgrade path:
                  </p>
                  <RequirementBuilder
                    requirements={entry.requirements || []}
                    onChange={reqs => updateReqs(idx, reqs)}
                    edbData={edbData}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {available.length > 0 && (
        <div className="flex items-center gap-2 mt-2">
          <SearchableSelect
            value=""
            onValueChange={addUpgrade}
            options={available}
            placeholder="Add upgrade path..."
            className="flex-1"
          />
        </div>
      )}
      {available.length === 0 && allLevels.filter(l => l.name !== currentLevelName).length > 0 && (
        <p className="text-[10px] text-muted-foreground italic mt-1">All other levels already added</p>
      )}
    </div>
  );
}