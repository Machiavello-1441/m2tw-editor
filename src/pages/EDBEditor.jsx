import React, { useState, useRef } from 'react';
import { Upload } from 'lucide-react';
import { useEDB } from '../components/edb/EDBContext';
import BuildingTree from '../components/edb/BuildingTree';
import LevelEditor from '../components/edb/LevelEditor';
import ValidationPanel from '../components/edb/ValidationPanel';
import CodePreview from '../components/edb/CodePreview';
import HiddenResourceEditor from '../components/edb/HiddenResourceEditor';
import RefFileLoader from '../components/edb/RefFileLoader';
import { Button } from '@/components/ui/button';
import { Castle, Code2, ShieldAlert, Save } from 'lucide-react';
import AutoSavePanel from '../components/edb/AutoSavePanel';

function decodeTgaToDataUrl(buffer) {
  const data = new Uint8Array(buffer);
  if (data.length < 18) return null;
  const idLength = data[0];
  const colorMapType = data[1];
  const imageType = data[2];
  const width = data[12] | data[13] << 8;
  const height = data[14] | data[15] << 8;
  const bpp = data[16];
  const imageDescriptor = data[17];
  const topOrigin = !!(imageDescriptor & 0x20);
  if (colorMapType !== 0 || imageType !== 2 && imageType !== 10) return null;
  if (bpp !== 24 && bpp !== 32) return null;
  if (width === 0 || height === 0) return null;
  const headerSize = 18 + idLength;
  const bytesPerPixel = bpp / 8;
  const pixels = new Uint8ClampedArray(width * height * 4);
  let srcIdx = headerSize,pixIdx = 0;
  if (imageType === 2) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const b = data[srcIdx++],g = data[srcIdx++],r = data[srcIdx++];
        const a = bpp === 32 ? data[srcIdx++] : 255;
        pixels[pixIdx++] = r;pixels[pixIdx++] = g;pixels[pixIdx++] = b;pixels[pixIdx++] = a;
      }
    }
  } else {
    let pixel = 0;
    while (pixel < width * height) {
      const repCount = data[srcIdx++];
      const count = (repCount & 0x7f) + 1;
      if (repCount & 0x80) {
        const b = data[srcIdx++],g = data[srcIdx++],r = data[srcIdx++];
        const a = bpp === 32 ? data[srcIdx++] : 255;
        for (let i = 0; i < count; i++, pixel++) {
          pixels[pixIdx++] = r;pixels[pixIdx++] = g;pixels[pixIdx++] = b;pixels[pixIdx++] = a;
        }
      } else {
        for (let i = 0; i < count; i++, pixel++) {
          const b = data[srcIdx++],g = data[srcIdx++],r = data[srcIdx++];
          const a = bpp === 32 ? data[srcIdx++] : 255;
          pixels[pixIdx++] = r;pixels[pixIdx++] = g;pixels[pixIdx++] = b;pixels[pixIdx++] = a;
        }
      }
    }
  }
  if (!topOrigin) {
    const rowSize = width * 4;
    for (let y = 0; y < Math.floor(height / 2); y++) {
      const top = y * rowSize,bot = (height - 1 - y) * rowSize;
      for (let i = 0; i < rowSize; i++) {
        const tmp = pixels[top + i];pixels[top + i] = pixels[bot + i];pixels[bot + i] = tmp;
      }
    }
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.putImageData(new ImageData(pixels, width, height), 0, 0);
  return canvas.toDataURL('image/png');
}

export default function EDBEditor() {
  const { edbData, fileName, loadBuildingTgaImages, saveNow, exportEDB, exportTextFile, isDirty } = useEDB();
  const [showCode, setShowCode] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const tgaFolderRef = useRef();

  const handleTgaFolder = async (e) => {
    const files = Array.from(e.target.files || []).filter((f) => f.name.toLowerCase().endsWith('.tga'));
    e.target.value = '';
    const parsed = [];
    for (const file of files) {
      const buf = await file.arrayBuffer();
      const url = decodeTgaToDataUrl(buf);
      if (url) {
        parsed.push({ path: file.webkitRelativePath || file.name, name: file.name, url });
      }
    }
    loadBuildingTgaImages(parsed);
  };

  const edbFileRef = useRef();

  const handleEdbFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const text = await file.text();
    loadEDB(text, file.name);
  };

  if (!edbData) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Castle className="w-10 h-10 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">No EDB loaded.</p>
          <label className="cursor-pointer">
            <input ref={edbFileRef} type="file" className="hidden" accept=".txt" onChange={handleEdbFile} />
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-border bg-card text-sm text-foreground hover:bg-accent cursor-pointer">
              <Castle className="w-4 h-4" /> Open export_descr_buildings.txt
            </span>
          </label>
          <p className="text-xs text-muted-foreground">Or go to Home to load your full mod data folder.</p>
        </div>
      </div>);

  }

  return (
    <div className="h-screen flex flex-col">
      {/* Top bar */}
      <div className="h-10 border-b border-border flex items-center px-3 gap-3 shrink-0 bg-card/50">
        <input ref={tgaFolderRef} type="file" className="hidden"
        webkitdirectory="" directory="" multiple onChange={handleTgaFolder} />
        <input ref={edbFileRef} type="file" className="hidden" accept=".txt" onChange={handleEdbFile} />
        <Castle className="w-4 h-4 text-muted-foreground shrink-0" />
        <button
          onClick={() => edbFileRef.current?.click()}
          className="text-xs font-medium text-foreground truncate max-w-[200px] hover:text-primary transition-colors cursor-pointer"
          title="Click to load a new EDB file">
          {fileName || 'EDB Editor'}</button>
        <span className="text-[10px] text-muted-foreground hidden sm:block">
          {edbData.buildings.length} buildings
        </span>
        <div className="flex-1 min-w-0 overflow-hidden">
          <RefFileLoader />
        </div>
        <HiddenResourceEditor />
        









        <Button
          size="sm"
          variant="ghost"
          className={`px-3 text-xs font-medium rounded-md inline-flex items-center h-7 gap-1 shrink-0 ${isDirty ? 'text-yellow-400 hover:text-yellow-300' : 'text-muted-foreground'}`}
          title="Save EDB to browser cache"
          onClick={() => saveNow()}>
          
          <Save className="w-3 h-3" />
          <span className="hidden lg:block">{isDirty ? 'Save*' : 'Saved'}</span>
        </Button>
        <AutoSavePanel onSaveNow={saveNow} />
        <Button
          size="sm"
          variant={showValidation ? 'default' : 'ghost'} className="bg-slate-600 text-slate-50 px-3 text-xs font-medium rounded-md inline-flex items-center justify-center whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 hover:bg-accent hover:text-accent-foreground h-7 gap-1 shrink-0"

          onClick={() => setShowValidation((v) => !v)}>

          <ShieldAlert className="w-3 h-3" />
          <span className="hidden lg:block">Validate</span>
        </Button>
        <Button
          size="sm"
          variant={showCode ? 'default' : 'ghost'} className="bg-slate-500 text-slate-50 px-3 text-xs font-medium rounded-md inline-flex items-center justify-center whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 hover:bg-accent hover:text-accent-foreground h-7 gap-1 shrink-0"

          onClick={() => setShowCode((v) => !v)}>

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
        <div className="pr-4 pl-2 flex-1 min-w-0 min-h-0 overflow-auto">
          <LevelEditor />
        </div>

        {/* Right: validation panel */}
        {showValidation &&
        <div className="w-80 xl:w-96 border-l border-border bg-card/20 shrink-0 min-h-0 overflow-auto">
            <ValidationPanel />
          </div>
        }

        {/* Right: code preview (collapsible) */}
        {showCode &&
        <div className="w-80 xl:w-96 border-l border-border bg-card/20 shrink-0 min-h-0">
            <CodePreview />
          </div>
        }
      </div>
    </div>);

}