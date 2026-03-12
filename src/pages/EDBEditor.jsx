import React, { useCallback, useState } from 'react';
import { useEDB } from '../components/edb/EDBContext';
import BuildingTree from '../components/edb/BuildingTree';
import LevelEditor from '../components/edb/LevelEditor.jsx';
import RefFileLoader from '../components/edb/RefFileLoader.jsx';
import ValidationPanel from '../components/edb/ValidationPanel.jsx';
import HiddenResourceEditor from '../components/edb/HiddenResourceEditor.jsx';
import CodePreview from '../components/edb/CodePreview.jsx';
import { Button } from '@/components/ui/button';
import { Upload, FileText, AlertCircle, Code2 } from 'lucide-react';

export default function EDBEditor() {
  const { edbData, loadEDB, isDirty, fileName } = useEDB();
  const [showCodePreview, setShowCodePreview] = useState(false);

  const handleFileUpload = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => loadEDB(ev.target.result, file.name);
    reader.readAsText(file);
    e.target.value = '';
  }, [loadEDB]);

  if (!edbData) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-accent flex items-center justify-center mx-auto">
            <FileText className="w-7 h-7 text-muted-foreground" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">No EDB File Loaded</h2>
            <p className="text-sm text-muted-foreground mt-1">Upload an export_descr_buildings.txt file to start editing</p>
          </div>
          <label className="cursor-pointer inline-block">
            <input type="file" accept=".txt" onChange={handleFileUpload} className="hidden" />
            <Button className="pointer-events-none"><Upload className="w-4 h-4 mr-2" /> Load EDB File</Button>
          </label>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Toolbar */}
      <div className="h-10 border-b border-border flex items-center px-3 gap-3 shrink-0 bg-card/50 overflow-x-auto">
        <span className="text-xs text-muted-foreground font-mono truncate max-w-[180px] shrink-0">{fileName}</span>
        {isDirty && (
          <span className="flex items-center gap-1 text-[10px] text-primary shrink-0">
            <AlertCircle className="w-3 h-3" /> Unsaved
          </span>
        )}
        <div className="ml-auto flex items-center gap-2 shrink-0">
          <RefFileLoader />
          <HiddenResourceEditor />
          <Button
            variant={showCodePreview ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => setShowCodePreview(!showCodePreview)}
          >
            <Code2 className="w-3 h-3" />
            <span className="hidden lg:inline">Code</span>
          </Button>
          <label className="cursor-pointer">
            <input type="file" accept=".txt" onChange={handleFileUpload} className="hidden" />
            <Button variant="ghost" size="sm" className="h-7 text-xs pointer-events-none">
              <Upload className="w-3 h-3 mr-1" /> Reload
            </Button>
          </label>
        </div>
      </div>

      {/* Main split view */}
      <div className="flex-1 flex min-h-0">
        {/* Left: Tree + Validation */}
        <div className="w-64 lg:w-72 border-r border-border bg-card/30 shrink-0 flex flex-col min-h-0">
          <div className="flex-1 min-h-0">
            <BuildingTree />
          </div>
          <ValidationPanel />
        </div>
        {/* Center: Editor */}
        <div className="flex-1 min-w-0 min-h-0">
          <LevelEditor />
        </div>
        {/* Right: Code Preview */}
        {showCodePreview && (
          <div className="w-80 border-l border-border bg-card/20 shrink-0 min-h-0">
            <CodePreview />
          </div>
        )}
      </div>
    </div>
  );
}