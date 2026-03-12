import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2 } from 'lucide-react';
import { HIDDEN_RESOURCES_DEFAULT } from './EDBParser';
import { useRefData } from './RefDataContext';

const REQ_TYPES = [
  { value: 'factions', label: 'Factions / Cultures' },
  { value: 'event_counter', label: 'Event Counter' },
  { value: 'hidden_resource', label: 'Hidden Resource' },
  { value: 'building_present_min_level', label: 'Building Present' },
  { value: 'resource', label: 'Map Resource' },
  { value: 'region_religion', label: 'Region Religion' },
];

const CONNECTORS = ['and', 'or', 'and not'];

function FactionSelector({ values, onChange, factions, cultures }) {
  const allOptions = ['all', ...cultures, ...factions];
  const toggleFaction = (f) => {
    if (f === 'all') {
      // Toggle: if 'all' is already selected, clear; otherwise set only 'all'
      if (values.includes('all')) onChange([]);
      else onChange(['all']);
    } else {
      // Selecting a specific faction removes 'all'
      const withoutAll = values.filter(v => v !== 'all');
      if (withoutAll.includes(f)) onChange(withoutAll.filter(v => v !== f));
      else onChange([...withoutAll, f]);
    }
  };

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {allOptions.map(f => (
        <button
          key={f}
          onClick={() => toggleFaction(f)}
          className={`px-1.5 py-0.5 text-[10px] rounded border transition-colors
            ${values.includes(f)
              ? 'bg-primary/20 border-primary/40 text-primary'
              : 'bg-accent/50 border-border text-muted-foreground hover:border-primary/30'
            }`}
        >
          {f}
        </button>
      ))}
    </div>
  );
}

function RequirementRow({ req, index, isLast, onChange, onRemove, edbData }) {
  const { factions, cultures, mapResources, eventCounters } = useRefData();
  const updateReq = (updates) => onChange(index, { ...req, ...updates });

  const buildingNames = edbData ? edbData.buildings.map(b => b.name) : [];
  // Merge EDB hidden resources with defaults, deduplicated
  const hiddenResources = edbData?.hiddenResources?.length
    ? [...new Set([...edbData.hiddenResources, ...HIDDEN_RESOURCES_DEFAULT])]
    : HIDDEN_RESOURCES_DEFAULT;

  return (
    <div className="space-y-1.5 p-2 bg-card rounded-lg border border-border">
      <div className="flex items-center gap-2">
        {/* Connector BEFORE the condition (shown between rows, editable here) */}
        {index > 0 && (
          <Select value={req.prevConnector || 'and'} onValueChange={c => updateReq({ prevConnector: c })}>
            <SelectTrigger className="h-6 text-[10px] w-20 shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CONNECTORS.map(c => (
                <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select value={req.type || ''} onValueChange={type => {
          const base = { type, prevConnector: req.prevConnector };
          if (type === 'factions') updateReq({ ...base, values: [] });
          else if (type === 'event_counter') updateReq({ ...base, event: eventCounters[0] || '', value: 1 });
          else if (type === 'hidden_resource') updateReq({ ...base, resource: HIDDEN_RESOURCES_DEFAULT[0] });
          else if (type === 'building_present_min_level') updateReq({ ...base, building: '', level: '' });
          else if (type === 'resource') updateReq({ ...base, resource: mapResources[0] || '' });
          else if (type === 'region_religion') updateReq({ ...base, religion: 'catholic', percentage: 50 });
        }}>
          <SelectTrigger className="h-7 text-xs flex-1">
            <SelectValue placeholder="Type..." />
          </SelectTrigger>
          <SelectContent>
            {REQ_TYPES.map(t => (
              <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <button onClick={() => onRemove(index)} className="p-1 hover:bg-destructive/20 rounded ml-auto">
          <Trash2 className="w-3 h-3 text-destructive" />
        </button>
      </div>

      {/* Type-specific fields */}
      {req.type === 'factions' && (
        <FactionSelector
          values={req.values || []}
          onChange={v => updateReq({ values: v })}
          factions={factions}
          cultures={cultures}
        />
      )}

      {req.type === 'event_counter' && (
        <div className="flex gap-2">
          {eventCounters.length > 0 ? (
            <Select value={req.event || ''} onValueChange={e => updateReq({ event: e })}>
              <SelectTrigger className="h-7 text-xs flex-1">
                <SelectValue placeholder="Select event..." />
              </SelectTrigger>
              <SelectContent>
                {eventCounters.map(e => (
                  <SelectItem key={e} value={e} className="text-xs">{e}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input className="h-7 text-xs flex-1" placeholder="Event name (load descr_events.txt)" value={req.event || ''} onChange={e => updateReq({ event: e.target.value })} />
          )}
          <Input className="h-7 text-xs w-16" type="number" value={req.value ?? 1} onChange={e => updateReq({ value: parseInt(e.target.value) || 0 })} />
        </div>
      )}

      {req.type === 'hidden_resource' && (
        <Select value={req.resource || ''} onValueChange={r => updateReq({ resource: r })}>
          <SelectTrigger className="h-7 text-xs">
            <SelectValue placeholder="Select resource..." />
          </SelectTrigger>
          <SelectContent>
            {HIDDEN_RESOURCES_DEFAULT.map(r => (
              <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {req.type === 'building_present_min_level' && (
        <div className="flex gap-2">
          {buildingNames.length > 0 ? (
            <Select value={req.building || ''} onValueChange={v => updateReq({ building: v })}>
              <SelectTrigger className="h-7 text-xs flex-1">
                <SelectValue placeholder="Building tree..." />
              </SelectTrigger>
              <SelectContent>
                {buildingNames.map(n => (
                  <SelectItem key={n} value={n} className="text-xs">{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input className="h-7 text-xs flex-1" placeholder="Building tree" value={req.building || ''} onChange={e => updateReq({ building: e.target.value })} />
          )}
          <Input className="h-7 text-xs flex-1" placeholder="Min level name" value={req.level || ''} onChange={e => updateReq({ level: e.target.value })} />
        </div>
      )}

      {req.type === 'resource' && (
        mapResources.length > 0 ? (
          <Select value={req.resource || ''} onValueChange={r => updateReq({ resource: r })}>
            <SelectTrigger className="h-7 text-xs">
              <SelectValue placeholder="Select map resource..." />
            </SelectTrigger>
            <SelectContent>
              {mapResources.map(r => (
                <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input className="h-7 text-xs" placeholder="Resource name (load descr_sm_resources.txt)" value={req.resource || ''} onChange={e => updateReq({ resource: e.target.value })} />
        )
      )}

      {req.type === 'region_religion' && (
        <div className="flex gap-2">
          <Input className="h-7 text-xs flex-1" placeholder="Religion" value={req.religion || ''} onChange={e => updateReq({ religion: e.target.value })} />
          <Input className="h-7 text-xs w-20" type="number" placeholder="%" value={req.percentage ?? ''} onChange={e => updateReq({ percentage: parseInt(e.target.value) || 0 })} />
        </div>
      )}
    </div>
  );
}

export default function RequirementBuilder({ requirements, onChange, edbData }) {
  const handleChange = (index, updated) => {
    const newReqs = [...requirements];
    newReqs[index] = updated;
    onChange(newReqs);
  };

  const handleRemove = (index) => {
    onChange(requirements.filter((_, i) => i !== index));
  };

  const addRequirement = () => {
    onChange([...requirements, {
      type: 'factions',
      values: [],
      prevConnector: requirements.length > 0 ? 'and' : undefined
    }]);
  };

  return (
    <div className="space-y-2">
      {requirements.map((req, i) => (
        <RequirementRow
          key={i}
          req={req}
          index={i}
          isLast={i === requirements.length - 1}
          onChange={handleChange}
          onRemove={handleRemove}
          edbData={edbData}
        />
      ))}
      <Button variant="outline" size="sm" className="h-6 text-[10px]" onClick={addRequirement}>
        <Plus className="w-2.5 h-2.5 mr-1" /> Add Condition
      </Button>
    </div>
  );
}