import React, { useRef, useState } from 'react';
import { useEDB } from './EDBContext';
import { useRefData } from './RefDataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Upload, Download, Copy, ImageIcon } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// ─── Text helpers ────────────────────────────────────────────────────────────

function TextRow({ label, textKey }) {
  const { textData, setTextData } = useEDB();
  const value = textData[textKey] ?? '';
  const base = 'w-full bg-background border border-border rounded text-[11px] text-foreground font-mono px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary resize-none';
  const isDesc = label === 'Desc' || label === 'Short';
  return (
    <div className="flex items-start gap-1.5 min-w-0">
      <span className="text-[10px] text-muted-foreground w-9 shrink-0 pt-1.5 text-right">{label}</span>
      {isDesc ? (
        <textarea
          className={`${base} min-h-[42px]`}
          rows={2}
          value={value}
          onChange={e => setTextData(prev => ({ ...prev, [textKey]: e.target.value }))}
        />
      ) : (
        <input
          className={`${base} h-7`}
          value={value}
          onChange={e => setTextData(prev => ({ ...prev, [textKey]: e.target.value }))}
        />
      )}
    </div>
  );
}

// ─── Image helpers ───────────────────────────────────────────────────────────

const IMAGE_SLOTS = [
  { type: 'icon',         label: 'Icon',   w: 64,  h: 51  },
  { type: 'panel',        label: 'Panel',  w: 78,  h: 62  },
  { type: 'construction', label: 'Built',  w: 300, h: 245 },
];

function encodeTGA(canvas, tw, th) {
  const off = document.createElement('canvas');
  off.width = tw; off.height = th;
  off.getContext('2d').drawImage(canvas, 0, 0, tw, th);
  const d = off.getContext('2d').getImageData(0, 0, tw, th).data;
  const hdr = new Uint8Array(18);
  hdr[2] = 2; hdr[12] = tw & 0xff; hdr[13] = tw >> 8;
  hdr[14] = th & 0xff; hdr[15] = th >> 8; hdr[16] = 32; hdr[17] = 0x28;
  const body = new Uint8Array(tw * th * 4);
  for (let i = 0; i < tw * th; i++) {
    body[i*4]=d[i*4+2]; body[i*4+1]=d[i*4+1]; body[i*4+2]=d[i*4]; body[i*4+3]=d[i*4+3];
  }
  const out = new Uint8Array(18 + body.length);
  out.set(hdr); out.set(body, 18); return out;
}

function ImageSlot({ culture, levelName, slot }) {
  const { imageData, loadBuildingTgaImages } = useEDB();
  const key = `${levelName}_${culture}_${slot.type}`;
  const img = imageData[key];
  const fileRef = useRef();
  const [preview, setPreview] = useState(null);

  const handleFile = (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      const image = new window.Image();
      image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = image.width; canvas.height = image.height;
        canvas.getContext('2d').drawImage(image, 0, 0);
        setPreview({ dataUrl, canvas });
      };
      image.src = dataUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSave = () => {
    if (!preview) return;
    const { w, h } = slot;
    const filename = `#${culture}_${levelName}${slot.type === 'construction' ? '_constructed' : ''}.tga`;
    const tga = encodeTGA(preview.canvas, w, h);
    const blob = new Blob([tga], { type: 'image/x-tga' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click(); URL.revokeObjectURL(a.href);
    const off = document.createElement('canvas'); off.width = w; off.height = h;
    off.getContext('2d').drawImage(preview.canvas, 0, 0, w, h);
    loadBuildingTgaImages([{
      path: `data/ui/${culture}/buildings/${slot.type === 'icon' ? 'constructed/' : ''}${filename}`,
      name: filename, url: off.toDataURL('image/png'),
    }]);
    setPreview(null);
  };

  const displayImg = preview ? preview.dataUrl : img?.url;

  return (
    <div className="flex flex-col items-center gap-0.5 group" style={{ width: 60 }}>
      <span className="text-[9px] text-muted-foreground">{slot.label}</span>
      {displayImg ? (
        <div className="relative">
          <img src={displayImg} alt={slot.label}
            className="rounded border border-border bg-black/30 object-contain"
            style={{ width: 60, aspectRatio: `${slot.w}/${slot.h}` }} />
          {preview ? (
            <div className="absolute -bottom-4 left-0 right-0 flex justify-center gap-1">
              <button className="text-[8px] text-green-400 hover:text-green-300" onClick={handleSave} title="Save as TGA">↓tga</button>
              <button className="text-[8px] text-destructive hover:text-red-300" onClick={() => setPreview(null)}>✕</button>
            </div>
          ) : (
            <button
              className="absolute inset-0 bg-black/0 hover:bg-black/40 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[8px] text-white"
              onClick={() => fileRef.current?.click()} title="Replace">↑</button>
          )}
        </div>
      ) : (
        <button
          className="border border-dashed border-border rounded flex flex-col items-center justify-center gap-0.5 hover:border-primary/40 hover:bg-primary/5 transition-colors text-muted-foreground"
          style={{ width: 60, aspectRatio: `${slot.w}/${slot.h}` }}
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="w-3 h-3" />
          <span className="text-[7px]">{slot.w}×{slot.h}</span>
        </button>
      )}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
}

// ─── One culture row ─────────────────────────────────────────────────────────

function CultureRow({ culture, levelName, allCultures, isBase }) {
  const { textData, setTextData, imageData, loadBuildingTgaImages } = useEDB();
  const [copyFrom, setCopyFrom] = useState('');

  const textKeys = isBase
    ? { name: levelName, desc: `${levelName}_desc`, short: `${levelName}_desc_short` }
    : { name: `${levelName}_${culture}`, desc: `${levelName}_${culture}_desc`, short: `${levelName}_${culture}_desc_short` };

  const handleCopy = (srcCulture) => {
    if (!srcCulture) return;
    const isBaseSrc = srcCulture === '_base';
    const srcKeys = isBaseSrc
      ? { name: levelName, desc: `${levelName}_desc`, short: `${levelName}_desc_short` }
      : { name: `${levelName}_${srcCulture}`, desc: `${levelName}_${srcCulture}_desc`, short: `${levelName}_${srcCulture}_desc_short` };

    // Copy text
    setTextData(prev => ({
      ...prev,
      [textKeys.name]: prev[srcKeys.name] ?? '',
      [textKeys.desc]: prev[srcKeys.desc] ?? '',
      [textKeys.short]: prev[srcKeys.short] ?? '',
    }));

    // Copy images
    const newImages = [];
    for (const slot of IMAGE_SLOTS) {
      const srcKey = `${levelName}_${isBaseSrc ? culture : srcCulture}_${slot.type}`;
      const srcImg = imageData[srcKey];
      if (srcImg) {
        newImages.push({
          path: `data/ui/${culture}/buildings/${slot.type === 'icon' ? 'constructed/' : ''}#${culture}_${levelName}${slot.type === 'construction' ? '_constructed' : ''}.tga`,
          name: `#${culture}_${levelName}.tga`,
          url: srcImg.url,
        });
      }
    }
    if (newImages.length > 0) loadBuildingTgaImages(newImages);
    setCopyFrom('');
  };

  const otherCultures = allCultures.filter(c => c !== culture);

  return (
    <div className="rounded-lg border border-border bg-accent/10 overflow-hidden">
      {/* Culture header */}
      <div className="flex items-center gap-2 px-2.5 py-1.5 bg-accent/20 border-b border-border">
        <span className="text-[10px] font-mono font-semibold text-primary/80 flex-1">{isBase ? '(base)' : culture}</span>
        {otherCultures.length > 0 && (
          <div className="flex items-center gap-1">
            <Copy className="w-3 h-3 text-muted-foreground" />
            <Select value={copyFrom} onValueChange={(v) => { setCopyFrom(v); handleCopy(v); }}>
              <SelectTrigger className="h-5 text-[9px] w-32 px-1.5 border-border">
                <SelectValue placeholder="Copy from…" />
              </SelectTrigger>
              <SelectContent>
                {!isBase && <SelectItem value="_base" className="text-[10px]">(base)</SelectItem>}
                {otherCultures.filter(c => c !== '_base').map(c => (
                  <SelectItem key={c} value={c} className="text-[10px]">{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Content: text left, images right */}
      <div className="flex gap-2 p-2">
        {/* Text fields */}
        <div className="flex-1 space-y-1 min-w-0">
          <TextRow label="Name" textKey={textKeys.name} />
          <TextRow label="Desc" textKey={textKeys.desc} />
          <TextRow label="Short" textKey={textKeys.short} />
        </div>

        {/* Images */}
        {!isBase && (
          <div className="flex gap-1.5 shrink-0 items-start pt-5">
            {IMAGE_SLOTS.map(slot => (
              <ImageSlot key={slot.type} culture={culture} levelName={levelName} slot={slot} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────

export default function LevelCultureEditor({ levelName }) {
  const { cultures } = useRefData();

  return (
    <Card>
      <CardHeader className="p-3 pb-2">
        <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5 text-primary" />
          Names, Descriptions &amp; Images
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 pt-0 space-y-2">
        {/* Base (non-culture) entries */}
        <CultureRow culture="base" levelName={levelName} allCultures={['_base', ...cultures]} isBase />

        {cultures.length === 0 && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-accent/30 border border-dashed border-border text-[10px] text-muted-foreground">
            <ImageIcon className="w-3.5 h-3.5 shrink-0" />
            Load descr_sm_factions.txt to see per-culture entries
          </div>
        )}

        {cultures.map(culture => (
          <CultureRow
            key={culture}
            culture={culture}
            levelName={levelName}
            allCultures={['_base', ...cultures]}
            isBase={false}
          />
        ))}
      </CardContent>
    </Card>
  );
}