import React, { useRef } from 'react';
import { FolderOpen, RotateCcw, Download, ShieldCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCampaignMap } from './CampaignMapContext';
import { LAYER_DEFS } from './MapLayerDefs';
import { encodeTGA } from './TgaLoader';
import { validateMap } from './MapValidator';

const TGA_FILENAMES = Object.fromEntries(
  Object.entries(LAYER_DEFS).map(([k, v]) => [v.filename, k])
);

export default function CampaignToolbar({ onValidate }) {
  const folderInputRef = useRef(null);
  const { layers, loadLayer, revertLayer, isDirty, activeLayer, setValidationResults } = useCampaignMap();

  const handleFolderSelect = (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      const fname = file.name.toLowerCase();
      const key = TGA_FILENAMES[fname];
      if (!key) return;
      const reader = new FileReader();
      reader.onload = (ev) => loadLayer(key, ev.target.result);
      reader.readAsArrayBuffer(file);
    });
    e.target.value = '';
  };

  const handleExport = () => {
    if (!activeLayer || !layers[activeLayer]) return;
    const layer = layers[activeLayer];
    const buf = encodeTGA(layer.width, layer.height, layer.edited);
    const blob = new Blob([buf], { type: 'image/x-tga' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = LAYER_DEFS[activeLayer].filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleValidate = () => {
    const results = validateMap(layers);
    setValidationResults(results);
    if (onValidate) onValidate();
  };

  const dirty = activeLayer && isDirty[activeLayer];

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-card shrink-0">
      <span className="text-xs font-bold text-primary mr-2">Campaign Map</span>

      <Button size="sm" variant="outline" onClick={() => folderInputRef.current?.click()} className="h-7 text-xs gap-1.5 text-foreground">
        <FolderOpen className="w-3.5 h-3.5" />
        Load Folder
      </Button>
      <input
        ref={folderInputRef}
        type="file"
        className="hidden"
        webkitdirectory=""
        multiple
        onChange={handleFolderSelect}
      />

      <div className="h-4 w-px bg-border mx-1" />

      <Button size="sm" variant="outline" onClick={() => activeLayer && revertLayer(activeLayer)}
        disabled={!dirty} className="h-7 text-xs gap-1.5 text-foreground">
        <RotateCcw className="w-3.5 h-3.5" />
        Revert
      </Button>

      <Button size="sm" variant="outline" onClick={handleExport}
        disabled={!activeLayer || !layers[activeLayer]}
        className="h-7 text-xs gap-1.5 text-foreground">
        <Download className="w-3.5 h-3.5" />
        Export .tga
      </Button>

      <div className="h-4 w-px bg-border mx-1" />

      <Button size="sm" variant="outline" onClick={handleValidate}
        disabled={Object.keys(layers).length === 0}
        className="h-7 text-xs gap-1.5 border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10">
        <ShieldCheck className="w-3.5 h-3.5" />
        Validate
      </Button>

      <div className="flex-1" />

      {/* Loaded file indicators */}
      <div className="flex gap-1">
        {Object.entries(LAYER_DEFS).map(([key, def]) => (
          <div key={key}
            className={`px-1.5 py-0.5 rounded text-[9px] font-mono ${
              layers[key] ? 'bg-green-500/20 text-green-400' : 'bg-secondary text-muted-foreground'
            }`}
          >
            {def.filename.replace('map_', '').replace('.tga', '')}
          </div>
        ))}
      </div>
    </div>
  );
}