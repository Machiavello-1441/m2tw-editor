import React, { useRef, useState } from 'react';
import { Section } from './UnitStatRow';
import { Upload, X, Download } from 'lucide-react';
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

// Encode canvas → TGA bytes (BGRA, uncompressed)
function encodeTGA(canvas, tw, th) {
  const off = document.createElement('canvas');
  off.width = tw; off.height = th;
  off.getContext('2d').drawImage(canvas, 0, 0, tw, th);
  const imgData = off.getContext('2d').getImageData(0, 0, tw, th);
  const px = imgData.data;
  const header = new Uint8Array(18);
  header[2] = 2;
  header[12] = tw & 0xff; header[13] = (tw >> 8) & 0xff;
  header[14] = th & 0xff; header[15] = (th >> 8) & 0xff;
  header[16] = 32; header[17] = 0x28;
  const body = new Uint8Array(tw * th * 4);
  for (let i = 0; i < tw * th; i++) {
    body[i*4] = px[i*4+2]; body[i*4+1] = px[i*4+1];
    body[i*4+2] = px[i*4]; body[i*4+3] = px[i*4+3];
  }
  const out = new Uint8Array(18 + body.length);
  out.set(header); out.set(body, 18);
  return out;
}

function downloadTGA(dataUrl, filename, tw, th) {
  const img = new window.Image();
  img.onload = () => {
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    c.getContext('2d').drawImage(img, 0, 0);
    const bytes = encodeTGA(c, tw, th);
    const blob = new Blob([bytes], { type: 'image/x-tga' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = filename; a.click(); URL.revokeObjectURL(a.href);
  };
  img.src = dataUrl;
}

// CARD: 48×56 px   INFO: 260×350 px  (approximate M2TW sizes)
const SLOT_SIZES = { card: [48, 56], info: [260, 350] };

function UnitImageSlot({ label, imageKey, img, onUpload, onDelete, targetSize, style }) {
  const fileRef = useRef();
  const [preview, setPreview] = useState(null);
  const [tw, th] = targetSize;

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    let dataUrl;
    if (file.name.toLowerCase().endsWith('.tga')) {
      const buf = await file.arrayBuffer();
      dataUrl = decodeTgaToDataUrl(buf);
    } else {
      dataUrl = await new Promise(res => { const r = new FileReader(); r.onload = ev => res(ev.target.result); r.readAsDataURL(file); });
    }
    if (!dataUrl) return;
    setPreview({ dataUrl, fileName: file.name });
  };

  const handleSave = () => {
    if (!preview) return;
    const baseName = imageKey.replace(/^#/, '');
    downloadTGA(preview.dataUrl, `${baseName}.tga`, tw, th);
    onUpload(imageKey, preview.dataUrl);
    setPreview(null);
  };

  return (
    <div className="flex flex-col items-center gap-1 group shrink-0" style={style}>
      <span className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wide">{label}</span>
      {preview ? (
        <div className="flex flex-col items-center gap-1">
          <img src={preview.dataUrl} alt={label}
            className="border border-border rounded bg-black object-contain"
            style={{ maxWidth: tw * 2, maxHeight: th * 1.5, imageRendering: 'pixelated' }} />
          <p className="text-[9px] text-muted-foreground">→ {tw}×{th}px</p>
          <div className="flex gap-1">
            <button onClick={handleSave}
              className="flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] rounded bg-primary text-primary-foreground hover:bg-primary/90">
              <Download className="w-2 h-2" /> Save .tga
            </button>
            <button onClick={() => setPreview(null)} className="text-[9px] text-muted-foreground hover:text-destructive px-1">✕</button>
          </div>
        </div>
      ) : img ? (
        <div className="relative">
          <img src={img} alt={label} className="border border-border rounded bg-black object-contain"
            style={{ imageRendering: 'pixelated', maxWidth: tw * 2, maxHeight: th * 1.5 }} />
          <button
            className="absolute -top-1 -right-1 bg-destructive/80 hover:bg-destructive rounded-full w-3.5 h-3.5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => onDelete(imageKey)} title="Remove">
            <X className="w-2 h-2 text-white" />
          </button>
          <button
            className="absolute bottom-0 right-0 bg-black/60 rounded-tl text-[8px] text-white px-1 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => fileRef.current?.click()} title="Replace">↑</button>
          {/* Download current */}
          <button
            className="absolute bottom-0 left-0 bg-black/60 rounded-tr text-[8px] text-white px-1 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => downloadTGA(img, `${imageKey.replace(/^#/, '')}.tga`, tw, th)} title="Export .tga">↓</button>
        </div>
      ) : (
        <button onClick={() => fileRef.current?.click()}
          className="border border-dashed border-border rounded flex flex-col items-center justify-center gap-0.5 hover:border-primary/40 hover:bg-primary/5 transition-colors text-muted-foreground"
          style={{ width: Math.min(tw, 80), height: Math.min(th, 96) }}>
          <Upload className="w-3 h-3" />
          <span className="text-[7px] text-center leading-tight">Upload</span>
          <span className="text-[7px] opacity-60">{tw}×{th}</span>
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
  const cardKey = `#${dictLower}`;
  const infoKey = `${dictLower}_info`;
  const cardImg = findImage(unitImages, cardKey);
  const infoImg = findImage(unitImages, infoKey);

  return (
    <div className="p-4 space-y-4">

      {/* ── Images row (centered, before names) ── */}
      <div className="flex items-end justify-center gap-8 py-3 border border-border rounded-lg bg-card/40">
        <UnitImageSlot
          label="Unit Card"
          imageKey={cardKey}
          img={cardImg}
          onUpload={onImageUpload}
          onDelete={onImageDelete}
          targetSize={SLOT_SIZES.card}
        />
        <UnitImageSlot
          label="Unit Info"
          imageKey={infoKey}
          img={infoImg}
          onUpload={onImageUpload}
          onDelete={onImageDelete}
          targetSize={SLOT_SIZES.info}
        />
      </div>

      <Section title="Name & Descriptions">
        <p className="text-[10px] text-muted-foreground mb-2">
          Editing <code className="font-mono bg-accent px-1 rounded">{`{${dictionary}}`}</code> entries in{' '}
          <code className="font-mono bg-accent px-1 rounded">data/text/export_units.txt</code>
        </p>

        <div className="space-y-1">
          <label className="text-[10px] text-muted-foreground font-medium block">Display Name</label>
          <input
            value={name}
            onChange={e => set('name', e.target.value)}
            placeholder="Unit display name"
            className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
          />
        </div>

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
    </div>
  );
}