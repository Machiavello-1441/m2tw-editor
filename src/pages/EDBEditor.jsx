import React, { useState } from 'react';
import { useEDB } from '../components/edb/EDBContext';
import BuildingTree from '../components/edb/BuildingTree';
import LevelEditor from '../components/edb/LevelEditor';
import ValidationPanel from '../components/edb/ValidationPanel';
import CodePreview from '../components/edb/CodePreview';
import HiddenResourceEditor from '../components/edb/HiddenResourceEditor';
import { Button } from '@/components/ui/button';
import { Castle, Code2, Save, RotateCcw, Download } from 'lucide-react';

export default function EDBEditor() {
  const { edbData, fileName } = useEDB();
  const [showCode, setShowCode] = useState(false);

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
        {/* Left sidebar: building tree + validation */}
        <div className="w-56 xl:w-64 border-r border-border bg-card/30 flex flex-col shrink-0 min-h-0">
          <div className="flex-1 min-h-0 overflow-hidden">
            <BuildingTree />
          </div>
          <ValidationPanel />
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