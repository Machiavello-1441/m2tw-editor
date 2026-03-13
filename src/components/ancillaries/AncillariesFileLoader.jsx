import React, { useRef } from 'react';
import { useAncillaries } from './AncillariesContext';
import { Button } from '@/components/ui/button';
import { Upload, Download } from 'lucide-react';

export default function AncillariesFileLoader() {
  const { ancData, textData, ancFilename, textFilename, loadAncFile, loadTextFile, exportAncFile, exportTextFile, isDirty } = useAncillaries();
  const ancRef = useRef();
  const textRef = useRef();

  const handleAncFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => loadAncFile(ev.target.result, file.name);
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleTextFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => loadTextFile(ev.target.result, file.name);
    reader.readAsText(file);
    e.target.value = '';
  };

  const downloadFile = (content, filename) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 p-3 border-b border-border bg-card">
      <input ref={ancRef} type="file" accept=".txt" className="hidden" onChange={handleAncFile} />
      <input ref={textRef} type="file" accept=".txt" className="hidden" onChange={handleTextFile} />

      <div className="flex items-center gap-1.5">
        <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1.5" onClick={() => ancRef.current?.click()}>
          <Upload className="w-3 h-3" />
          Load Ancillaries
        </Button>
        {ancData && (
          <span className="text-[10px] text-muted-foreground font-mono truncate max-w-40">{ancFilename}</span>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1.5" onClick={() => textRef.current?.click()}>
          <Upload className="w-3 h-3" />
          Load Text File
        </Button>
        {textData && (
          <span className="text-[10px] text-muted-foreground font-mono truncate max-w-40">{textFilename}</span>
        )}
      </div>

      {ancData && (
        <Button
          size="sm"
          className="h-7 px-2 text-xs gap-1.5 ml-auto"
          onClick={() => downloadFile(exportAncFile(), ancFilename)}
        >
          <Download className="w-3 h-3" />
          Export Ancillaries {isDirty && '*'}
        </Button>
      )}

      {textData && (
        <Button
          size="sm"
          variant="secondary"
          className="h-7 px-2 text-xs gap-1.5"
          onClick={() => downloadFile(exportTextFile(), textFilename)}
        >
          <Download className="w-3 h-3" />
          Export Text
        </Button>
      )}
    </div>
  );
}