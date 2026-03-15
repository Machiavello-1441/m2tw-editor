import React from 'react';
import { Section } from './UnitStatRow';

export default function UnitDescriptionTab({ dictionary, descr, onDescrChange }) {
  const name    = descr?.name    ?? '';
  const long    = descr?.long    ?? '';
  const short   = descr?.short   ?? '';

  const set = (key, val) => onDescrChange({ ...descr, [key]: val });

  if (!descr && !dictionary) {
    return (
      <div className="flex items-center justify-center h-40 text-muted-foreground text-xs">
        No description data loaded. Load <code className="font-mono bg-accent px-1 rounded mx-1">export_units.txt</code> via the Home page.
      </div>
    );
  }

  return (
    <div className="p-4 space-y-5">
      <Section title="Unit Name & Description">
        <p className="text-[10px] text-muted-foreground mb-1">
          Editing <code className="font-mono bg-accent px-1 rounded">{`{${dictionary}}`}</code> entries in <code className="font-mono bg-accent px-1 rounded">data/text/export_units.txt</code>
        </p>

        <div className="space-y-1">
          <label className="text-[10px] text-muted-foreground font-medium block">
            Display Name <span className="opacity-60">({`{${dictionary}}`})</span>
          </label>
          <input
            value={name}
            onChange={e => set('name', e.target.value)}
            placeholder="Unit display name"
            className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] text-muted-foreground font-medium block">
            Short Description <span className="opacity-60">({`{${dictionary}_descr_short}`})</span>
          </label>
          <textarea
            value={short}
            onChange={e => set('short', e.target.value)}
            rows={3}
            placeholder="Short description shown in recruitment and custom battles..."
            className="w-full px-2 py-1.5 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary text-foreground font-sans resize-y leading-relaxed"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] text-muted-foreground font-medium block">
            Full Description <span className="opacity-60">({`{${dictionary}_descr}`})</span>
          </label>
          <textarea
            value={long}
            onChange={e => set('long', e.target.value)}
            rows={8}
            placeholder="Full description shown in the unit info panel..."
            className="w-full px-2 py-1.5 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary text-foreground font-sans resize-y leading-relaxed"
          />
        </div>
      </Section>
    </div>
  );
}