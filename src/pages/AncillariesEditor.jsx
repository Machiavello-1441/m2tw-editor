import React from 'react';
import { useAncillaries } from '../components/ancillaries/AncillariesContext';
import AncillariesFileLoader from '../components/ancillaries/AncillariesFileLoader';
import AncillaryList from '../components/ancillaries/AncillaryList';
import AncillaryEditor from '../components/ancillaries/AncillaryEditor';
import { Package } from 'lucide-react';

function AncillariesEditorInner() {
  const { ancData } = useAncillaries();

  if (!ancData) {
    return (
      <div className="flex flex-col h-full">
        <AncillariesFileLoader />
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Package className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Ancillaries Editor</h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Load <code className="text-xs bg-muted px-1 rounded">export_descr_ancillaries.txt</code> to start editing ancillaries.
              Optionally also load <code className="text-xs bg-muted px-1 rounded">export_ancillaries.txt</code> to see display names and descriptions.
            </p>
          </div>
          <div className="text-xs text-muted-foreground bg-muted/50 rounded p-3 text-left max-w-sm">
            <p className="font-medium mb-1">Files needed:</p>
            <p>📄 <code>data/export_descr_ancillaries.txt</code></p>
            <p>📄 <code>data/text/export_ancillaries.txt</code> (optional)</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col" style={{ height: '100vh' }}>
      <AncillariesFileLoader />
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Sidebar */}
        <div className="w-64 shrink-0 border-r border-border overflow-hidden flex flex-col">
          <div className="px-3 py-2 border-b border-border flex items-center gap-2">
            <Package className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-semibold text-foreground">Ancillaries</span>
            <span className="ml-auto text-[10px] text-muted-foreground">{ancData.ancillaries.length}</span>
          </div>
          <AncillaryList />
        </div>

        {/* Main editor */}
        <div className="flex-1 overflow-hidden">
          <AncillaryEditor />
        </div>
      </div>
    </div>
  );
}

export default function AncillariesEditor() {
  return (
    <AncillariesProvider>
      <AncillariesEditorInner />
    </AncillariesProvider>
  );
}