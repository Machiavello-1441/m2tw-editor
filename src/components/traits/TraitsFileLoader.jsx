import React, { useRef } from 'react';
import { useTraits } from './TraitsContext';
import { Button } from '@/components/ui/button';
import { Upload, FileText, Download } from 'lucide-react';

export default function TraitsFileLoader() {
  const { traitsData, textData, traitsFilename, textFilename, loadTraitsFile, loadTextFile, exportTraitsFile, exportTextFile, isDirty } = useTraits();
  const traitsRef = useRef();
  const textRef = useRef();

  const handleTraitsFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => loadTraitsFile(ev.target.result, file.name);
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
      <input ref={traitsRef} type="file" accept=".txt" className="hidden" onChange={handleTraitsFile} />
      <input ref={textRef} type="file" accept=".txt" className="hidden" onChange={handleTextFile} />

      <div className="flex items-center gap-1.5">
        <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1.5" onClick={() => traitsRef.current?.click()}>
          <Upload className="w-3 h-3" />
          Load Traits
        </Button>
        {traitsData && (
          <span className="text-[10px] text-muted-foreground font-mono truncate max-w-32">{traitsFilename}</span>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1.5" onClick={() => textRef.current?.click()}>
          <Upload className="w-3 h-3" />
          Load VnVs Text
        </Button>
        {textData && (
          <span className="text-[10px] text-muted-foreground font-mono truncate max-w-32">{textFilename}</span>
        )}
      </div>

      {traitsData && (
        <Button
          size="sm"
          className="h-7 px-2 text-xs gap-1.5 ml-auto"
          onClick={() => downloadFile(exportTraitsFile(), traitsFilename)}
        >
          <Download className="w-3 h-3" />
          Export Traits {isDirty && '*'}
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