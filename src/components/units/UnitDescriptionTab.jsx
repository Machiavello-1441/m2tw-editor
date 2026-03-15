import React, { useRef } from 'react';
import { Section } from './UnitStatRow';
import { Upload, X } from 'lucide-react';
import { decodeTgaToDataUrl } from '../shared/tgaDecoder';

function findImage(unitImages, key) {
  if (!unitImages) return null;
  if (unitImages[key]) return unitImages[key];
  const lower = key.toLowerCase();
  for (const k of Object.keys(unitImages)) {
    if (k.toLowerCase() === lower) return unitImages[k];
  }
  return null;
}

function UnitImageSlot({ label, imageKey, img, onUpload, onDelete }) {
  const fileRef = useRef();

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const name = file.name.toLowerCase();
    let dataUrl = null;
    if (name.endsWith('.tga')) {
      const buf = await file.arrayBuffer();
      dataUrl = decodeTgaToDataUrl(buf);
    } else {
      dataUrl = await new Promise(res => {
        const r = new FileReader();
        r.onload = ev => res(ev.target.result);
        r.readAsDataURL(file);
      });
    }
    if (dataUrl) onUpload(imageKey, dataUrl);
  };

  return (
    <div className="flex flex-col items-center gap-1 group shrink-0">
      <span className="text-[9px] text-muted-foreground">{label}</span>
      {img ? (
        <div className="relative">
          <img
            src={img}
            alt={label}
            className="border border-border rounded bg-black"
            style={{ imageRendering: 'pixelated', width: 48 }}
          />
          <button
            className="absolute -top-1 -right-1 bg-destructive/80 hover:bg-destructive rounded-full w-3.5 h-3.5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => onDelete(imageKey)}
            title="Remove image"
          >
            <X className="w-2 h-2 text-white" />
          </button>
          <button
            className="absolute inset-0 bg-black/0 hover:bg-black/40 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => fileRef.current?.click()}
            title="Replace image"
          />
        </div>
      ) : (
        <button
          onClick={() => fileRef.current?.click()}
          className="border border-dashed border-border rounded flex flex-col items-center justify-center gap-0.5 hover:border-primary/40 hover:bg-primary/5 transition-colors text-muted-foreground"
          style={{ width: 48, height: 52 }}
          title={`Upload ${imageKey}.tga`}
        >
          <Upload className="w-3 h-3" />
          <span className="text-[7px] text-center leading-tight">Upload</span>
        </button>
      )}
      <input ref={fileRef} type="file" accept="image/*,.tga,.dds" className="hidden" onChange={handleFile} />
    </div>
  );
}

export default function UnitDescriptionTab({ dictionary, descr, onDescrChange, unitImages, onImageUpload, onImageDelete }) {
  const name  = descr?.name  ?? '';
  const long  = descr?.long  ?? '';
  const short = descr?.short ?? '';

  const set = (key, val) => onDescrChange({ ...(descr || {}), [key]: val });

  const dictLower = (dictionary || '').toLowerCase();
  // Card: #dict (stored without .tga extension, without #)
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
              Display Name
            </label>
            <input
              value={name}
              onChange={e => set('name', e.target.value)}
              placeholder="Unit display name"
              className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
            />
          </div>
          <UnitImageSlot
            label="Card"
            imageKey={cardKey}
            img={cardImg}
            onUpload={onImageUpload}
            onDelete={onImageDelete}
          />
        </div>

        {/* Full description */}
        <div className="space-y-1">
          <label className="text-[10px] text-muted-foreground font-medium block">
            Full Description <span className="opacity-60 font-mono text-[9px]">{`{${dictionary}_descr}`}</span>
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
            Short Description <span className="opacity-60 font-mono text-[9px]">{`{${dictionary}_descr_short}`}</span>
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

      {/* Unit info image */}
      <Section title="Unit Info Image">
        <p className="text-[10px] text-muted-foreground font-mono mb-2">
          data\ui\unit_info\[faction]\{dictLower}_info.tga
        </p>
        <div className="flex items-start gap-3">
          {infoImg ? (
            <div className="relative group">
              <img src={infoImg} alt="unit info" className="max-w-xs border border-border rounded bg-black" style={{ maxHeight: 320 }} />
              <button
                className="absolute top-1 right-1 bg-destructive/80 hover:bg-destructive rounded-full w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => onImageDelete(infoKey)}
                title="Remove image"
              >
                <X className="w-2.5 h-2.5 text-white" />
              </button>
            </div>
          ) : (
            <UnitImageSlot
              label="Info Panel"
              imageKey={infoKey}
              img={null}
              onUpload={onImageUpload}
              onDelete={onImageDelete}
            />
          )}
        </div>
      </Section>
    </div>
  );
}