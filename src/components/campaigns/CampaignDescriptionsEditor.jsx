import React, { useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Globe2 } from 'lucide-react';

// Parse {KEY}Value pairs from campaign_descriptions.txt style
function parseDescriptions(text) {
  const entries = [];
  const lines = (text || '').split('\n');
  for (const line of lines) {
    const m = line.match(/^\{([^}]+)\}(.*)$/);
    if (m) {
      entries.push({ key: m[1], value: m[2] });
    }
  }
  return entries;
}

function serializeDescriptions(entries) {
  return entries.map(e => `{${e.key}}${e.value}`).join('\n');
}

export default function CampaignDescriptionsEditor({ campaign, onChange }) {
  const entries = parseDescriptions(campaign.descriptions || '');
  const [editIdx, setEditIdx] = useState(null);

  const update = (newEntries) => {
    onChange({ descriptions: serializeDescriptions(newEntries) });
  };

  const handleAdd = () => {
    const name = campaign.name.toUpperCase();
    const newEntries = [...entries, { key: `${name}_NEW_KEY`, value: 'New value' }];
    update(newEntries);
    setEditIdx(newEntries.length - 1);
  };

  const handleDelete = (idx) => {
    const newEntries = entries.filter((_, i) => i !== idx);
    update(newEntries);
    if (editIdx === idx) setEditIdx(null);
  };

  const handleChange = (idx, field, val) => {
    const newEntries = entries.map((e, i) => i === idx ? { ...e, [field]: val } : e);
    update(newEntries);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-card/20 shrink-0">
        <Globe2 className="w-3.5 h-3.5 text-primary" />
        <span className="text-[11px] text-muted-foreground flex-1">
          Defines the text shown in the campaign selection screen. Keys must follow the pattern <code className="font-mono bg-accent px-0.5 rounded">CAMPAIGN_NAME_TITLE</code>, etc.
        </span>
        <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1" onClick={handleAdd}>
          <Plus className="w-3 h-3" /> Add Entry
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {entries.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-xs">No description entries yet. Click "Add Entry" to start.</div>
          )}
          {entries.map((entry, idx) => (
            <div key={idx} className="flex gap-2 items-start bg-accent/20 border border-border rounded-lg p-2.5">
              <div className="flex-1 grid grid-cols-2 gap-2 min-w-0">
                <div>
                  <label className="text-[9px] text-muted-foreground uppercase block mb-0.5">Key</label>
                  <input
                    className="w-full bg-input border border-border rounded px-2 py-1 text-[11px] font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    value={entry.key}
                    onChange={e => handleChange(idx, 'key', e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-[9px] text-muted-foreground uppercase block mb-0.5">Value</label>
                  <input
                    className="w-full bg-input border border-border rounded px-2 py-1 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    value={entry.value}
                    onChange={e => handleChange(idx, 'value', e.target.value)}
                  />
                </div>
              </div>
              <button
                onClick={() => handleDelete(idx)}
                className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors mt-3.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}

          {entries.length > 0 && (
            <div className="mt-4 p-3 bg-card rounded-lg border border-border">
              <p className="text-[10px] text-muted-foreground font-semibold mb-1">Preview (campaign_descriptions.txt)</p>
              <pre className="text-[10px] font-mono text-foreground/70 whitespace-pre-wrap">
                {'¬\n'}{serializeDescriptions(entries)}
              </pre>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}