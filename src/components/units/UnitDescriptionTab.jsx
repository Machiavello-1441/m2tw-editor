import React from 'react';
import { Section } from './UnitStatRow';

function findImage(unitImages, key) {
  if (!unitImages) return null;
  if (unitImages[key]) return unitImages[key];
  const lower = key.toLowerCase();
  for (const k of Object.keys(unitImages)) {
    if (k.toLowerCase() === lower) return unitImages[k];
  }
  return null;
}

function MissingImageSlot({ label }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 border border-dashed border-border rounded p-2 text-muted-foreground w-16" style={{ minHeight: 52 }}>
      <span className="text-[8px] opacity-50 text-center">{label}</span>
    </div>
  );
}

export default function UnitDescriptionTab({ dictionary, descr, onDescrChange, unitImages }) {
  const name  = descr?.name  ?? '';
  const long  = descr?.long  ?? '';
  const short = descr?.short ?? '';

  const set = (key, val) => onDescrChange({ ...descr, [key]: val });

  const dictLower = (dictionary || '').toLowerCase();
  const cardKey = `#${dictLower}`;
  const infoKey = `${dictLower}_info`;
  const cardImg = findImage(unitImages, cardKey);
  const infoImg = findImage(unitImages, infoKey);

  return (
    <div className="p-4 space-y-4">
      <Section title="Name & Descriptions">
        <p className="text-[10px] text-muted-foreground mb-2">
          Editing <code className="font-mono bg-accent px-1 rounded">{`{${dictionary}}`}</code> entries in{' '}
          <code className="font-mono bg-accent px-1 rounded">data/text/export_units.txt</code>
        </p>

        {/* Name row + unit card image side by side */}
        <div className="flex gap-3 items-start">
          <div className="flex-1 space-y-1">
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
          {/* Unit card image shown next to name */}
          <div className="flex flex-col items-center gap-1 shrink-0">
            <span className="text-[9px] text-muted-foreground">Card</span>
            {cardImg ? (
              <img src={cardImg} alt="unit card" className="border border-border rounded bg-black" style={{ imageRendering: 'pixelated', width: 48 }} />
            ) : (
              <MissingImageSlot label={`#${dictLower}.tga`} />
            )}
          </div>
        </div>

        {/* Full description */}
        <div className="space-y-1">
          <label className="text-[10px] text-muted-foreground font-medium block">
            Full Description <span className="opacity-60">({`{${dictionary}_descr}`})</span>
          </label>
          <textarea
            value={long}
            onChange={e => set('long', e.target.value)}
            rows={6}
            placeholder="Full description shown in the unit info panel..."
            className="w-full px-2 py-1.5 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary text-foreground font-sans resize-y leading-relaxed"
          />
        </div>

        {/* Short description */}
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
      </Section>

      {/* Unit info image below descriptions */}
      <Section title="Unit Info Image">
        <p className="text-[10px] text-muted-foreground font-mono mb-2">
          data\ui\unit_info\[faction]\{dictLower}_info.tga
        </p>
        {infoImg ? (
          <img src={infoImg} alt="unit info" className="max-w-xs border border-border rounded bg-black" style={{ maxHeight: 320 }} />
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 border border-dashed border-border rounded p-6 text-muted-foreground max-w-xs">
            <span className="text-[10px] font-mono opacity-60">{dictLower}_info.tga</span>
            <span className="text-[10px] opacity-40">Not found in loaded images</span>
          </div>
        )}
      </Section>
    </div>
  );
}