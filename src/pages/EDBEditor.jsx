import React, { useState, useRef } from 'react';
import { useEDB } from '../components/edb/EDBContext';
import BuildingTree from '../components/edb/BuildingTree';
import LevelEditor from '../components/edb/LevelEditor';
import ValidationPanel from '../components/edb/ValidationPanel';
import CodePreview from '../components/edb/CodePreview';
import HiddenResourceEditor from '../components/edb/HiddenResourceEditor';
import RefFileLoader from '../components/edb/RefFileLoader';
import { Button } from '@/components/ui/button';
import { Castle, Code2, Image, ShieldAlert } from 'lucide-react';
import AutoSavePanel from '../components/edb/AutoSavePanel';

function decodeTgaToDataUrl(buffer) {
  const data = new Uint8Array(buffer);
  if (data.length < 18) return null;
  const idLength = data[0];
  const colorMapType = data[1];
  const imageType = data[2];
  const width = data[12] | (data[13] << 8);
  const height = data[14] | (data[15] << 8);
  const bpp = data[16];
  const imageDescriptor = data[17];
  const topOrigin = !!(imageDescriptor & 0x20);
  if (colorMapType !== 0 || (imageType !== 2 && imageType !== 10)) return null;
  if (bpp !== 24 && bpp !== 32) return null;
  if (width === 0 || height === 0) return null;
  const headerSize = 18 + idLength;
  const bytesPerPixel = bpp / 8;
  const pixels = new Uint8ClampedArray(width * height * 4);
  let srcIdx = headerSize, pixIdx = 0;
  if (imageType === 2) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const b = data[srcIdx++], g = data[srcIdx++], r = data[srcIdx++];
        const a = bpp === 32 ? data[srcIdx++] : 255;
        pixels[pixIdx++] = r; pixels[pixIdx++] = g; pixels[pixIdx++] = b; pixels[pixIdx++] = a;
      }
    }
  } else {
    let pixel = 0;
    while (pixel < width * height) {
      const repCount = data[srcIdx++];
      const count = (repCount & 0x7f) + 1;
      if (repCount & 0x80) {
        const b = data[srcIdx++], g = data[srcIdx++], r = data[srcIdx++];
        const a = bpp === 32 ? data[srcIdx++] : 255;
        for (let i = 0; i < count; i++, pixel++) {
          pixels[pixIdx++] = r; pixels[pixIdx++] = g; pixels[pixIdx++] = b; pixels[pixIdx++] = a;
        }
      } else {
        for (let i = 0; i < count; i++, pixel++) {
          const b = data[srcIdx++], g = data[srcIdx++], r = data[srcIdx++];
          const a = bpp === 32 ? data[srcIdx++] : 255;
          pixels[pixIdx++] = r; pixels[pixIdx++] = g; pixels[pixIdx++] = b; pixels[pixIdx++] = a;
        }
      }
    }
  }
  if (!topOrigin) {
    const rowSize = width * 4;
    for (let y = 0; y < Math.floor(height / 2); y++) {
      const top = y * rowSize, bot = (height - 1 - y) * rowSize;
      for (let i = 0; i < rowSize; i++) {
        const tmp = pixels[top + i]; pixels[top + i] = pixels[bot + i]; pixels[bot + i] = tmp;
      }
    }
  }
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.putImageData(new ImageData(pixels, width, height), 0, 0);
  return canvas.toDataURL('image/png');
}

export default function EDBEditor() {
  const { edbData, fileName, loadTgaImages, saveNow } = useEDB();
  const [showCode, setShowCode] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const tgaFolderRef = useRef();

  const handleTgaFolder = async (e) => {
    const files = Array.from(e.target.files || []).filter(f => f.name.toLowerCase().endsWith('.tga'));
    e.target.value = '';
    const images = {};
    for (const file of files) {
      const buf = await file.arrayBuffer();
      const dataUrl = decodeTgaToDataUrl(buf);
      if (dataUrl) {
        const key = file.name.replace(/\.tga$/i, '').toLowerCase();
        images[key] = dataUrl;
      }
    }
    loadTgaImages(images);
  };

  if (!edbData) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <Castle className="w-10 h-10 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">No EDB loaded. Go to Home to load your mod files.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Top bar */}
      <div className="h-10 border-b border-border flex items-center px-3 gap-3 shrink-0 bg-card/50">
        <input ref={tgaFolderRef} type="file" className="hidden"
          webkitdirectory="" directory="" multiple onChange={handleTgaFolder} />
        <Castle className="w-4 h-4 text-muted-foreground shrink-0" />
        <span className="text-xs font-medium text-foreground truncate max-w-[200px]">{fileName || 'EDB Editor'}</span>
        <span className="text-[10px] text-muted-foreground hidden sm:block">
          {edbData.buildings.length} buildings
        </span>
        <div className="flex-1 min-w-0 overflow-hidden">
          <RefFileLoader />
        </div>
        <HiddenResourceEditor />
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1 shrink-0 text-white"
          title="Browse to data\ui\buildings\ folder"
          onClick={() => tgaFolderRef.current?.click()}
        >
          <Image className="w-3 h-3" />
          <span className="hidden lg:block">Load Images (.tga)</span>
        </Button>
        <AutoSavePanel onSaveNow={saveNow} />
        <Button
          size="sm"
          variant={showValidation ? 'default' : 'ghost'}
          className="h-7 text-xs gap-1 shrink-0"
          onClick={() => setShowValidation(v => !v)}
        >
          <ShieldAlert className="w-3 h-3" />
          <span className="hidden lg:block">Validate</span>
        </Button>
        <Button
          size="sm"
          variant={showCode ? 'default' : 'ghost'}
          className="h-7 text-xs gap-1 shrink-0"
          onClick={() => setShowCode(v => !v)}
        >
          <Code2 className="w-3 h-3" />
          <span className="hidden lg:block">Code</span>
        </Button>
      </div>

      {/* Main layout */}
      <div className="flex-1 flex min-h-0">
        {/* Left sidebar: building tree */}
        <div className="w-56 xl:w-64 border-r border-border bg-card/30 flex flex-col shrink-0 min-h-0">
          <div className="flex-1 min-h-0 overflow-hidden">
            <BuildingTree />
          </div>
        </div>

        {/* Center: level editor */}
        <div className="flex-1 min-w-0 min-h-0 overflow-hidden">
          <LevelEditor />
        </div>

        {/* Right: code preview (collapsible) */}
        {showCode && (
          <div className="w-80 xl:w-96 border-l border-border bg-card/20 shrink-0 min-h-0">
            <CodePreview />
          </div>
        )}
      </div>
    </div>
  );
}