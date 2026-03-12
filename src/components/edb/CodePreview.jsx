import React, { useMemo } from 'react';
import { useEDB } from './EDBContext';
import { serializeBuilding } from './EDBParser.js';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Code2 } from 'lucide-react';

export default function CodePreview() {
  const { edbData, selectedBuilding, selectedLevel } = useEDB();

  const { code, highlightStart } = useMemo(() => {
    if (!edbData || !selectedBuilding) return { code: '', highlightStart: -1 };
    const building = edbData.buildings.find(b => b.name === selectedBuilding);
    if (!building) return { code: '', highlightStart: -1 };
    const serialized = serializeBuilding(building);
    const lines = serialized.split('\n');
    const hs = selectedLevel
      ? lines.findIndex(l => l.trim().startsWith(selectedLevel + ' ') || l.trim() === selectedLevel)
      : -1;
    return { code: serialized, highlightStart: hs };
  }, [edbData, selectedBuilding, selectedLevel]);

  if (!selectedBuilding) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <p className="text-[10px] text-muted-foreground text-center">Select a building to preview its serialized code</p>
      </div>
    );
  }

  const lines = code.split('\n');

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border shrink-0">
        <Code2 className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Code Preview</span>
        <span className="text-[10px] text-primary font-mono truncate flex-1">{selectedBuilding}</span>
      </div>
      <ScrollArea className="flex-1">
        <pre className="p-3 text-[9px] font-mono leading-[1.6] whitespace-pre">
          {lines.map((line, i) => {
            const inHighlight = highlightStart !== -1 && i >= highlightStart && i < highlightStart + 40;
            return (
              <span key={i} className={`block ${inHighlight ? 'bg-primary/10 text-foreground' : 'text-muted-foreground'}`}>
                <span className="select-none opacity-30 w-8 inline-block text-right mr-2">{i + 1}</span>
                {line}
              </span>
            );
          })}
        </pre>
      </ScrollArea>
    </div>
  );
}