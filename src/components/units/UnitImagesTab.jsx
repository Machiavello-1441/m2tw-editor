import React from 'react';
import { Image, AlertCircle } from 'lucide-react';

export default function UnitImagesTab({ dictionary, unitImages }) {
  if (!unitImages) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-3 text-muted-foreground text-xs text-center px-6">
        <Image className="w-8 h-8 opacity-20" />
        <p>No unit images loaded.<br />Load the <code className="font-mono bg-accent px-1 rounded">data\ui\</code> folder via the Home page.</p>
      </div>
    );
  }

  const dictLower = (dictionary || '').toLowerCase();
  // Unit card: data/ui/units/[faction]/#dictionary.tga
  // Unit info: data/ui/unit_info/[faction]/dictionary_info.tga
  const cardKey = `#${dictLower}`;
  const infoKey = `${dictLower}_info`;

  // Search all loaded image keys for matches
  const cardImg  = unitImages[cardKey]  ?? findByKey(unitImages, cardKey);
  const infoImg  = unitImages[infoKey]  ?? findByKey(unitImages, infoKey);

  return (
    <div className="p-4 space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Unit Card (small ~48x64) */}
        <div className="space-y-2">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Unit Card
          </p>
          <p className="text-[10px] text-muted-foreground font-mono">
            data\ui\units\[faction]\#{dictLower}.tga
          </p>
          {cardImg ? (
            <div className="flex items-start gap-3">
              <img
                src={cardImg}
                alt="unit card"
                style={{ imageRendering: 'pixelated' }}
                className="border border-border rounded bg-black"
              />
              <p className="text-[10px] text-green-400 flex items-center gap-1 mt-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                Loaded
              </p>
            </div>
          ) : (
            <MissingImage label={`#${dictLower}.tga`} />
          )}
        </div>

        {/* Unit Info (large ~260x350) */}
        <div className="space-y-2">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Unit Info Image
          </p>
          <p className="text-[10px] text-muted-foreground font-mono">
            data\ui\unit_info\[faction]\{dictLower}_info.tga
          </p>
          {infoImg ? (
            <div className="flex items-start gap-3">
              <img
                src={infoImg}
                alt="unit info"
                className="max-w-full border border-border rounded bg-black"
                style={{ maxHeight: 320 }}
              />
              <p className="text-[10px] text-green-400 flex items-center gap-1 mt-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                Loaded
              </p>
            </div>
          ) : (
            <MissingImage label={`${dictLower}_info.tga`} />
          )}
        </div>
      </div>
    </div>
  );
}

function findByKey(images, key) {
  // Try case-insensitive match
  const lower = key.toLowerCase();
  for (const k of Object.keys(images)) {
    if (k.toLowerCase() === lower) return images[k];
  }
  return null;
}

function MissingImage({ label }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 border border-dashed border-border rounded p-6 text-muted-foreground">
      <AlertCircle className="w-5 h-5 opacity-40" />
      <p className="text-[10px] font-mono text-center opacity-60">{label}</p>
      <p className="text-[10px] opacity-40">Not found in loaded images</p>
    </div>
  );
}