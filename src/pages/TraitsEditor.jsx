import React from 'react';
import { TraitsProvider, useTraits } from '../components/traits/TraitsContext';
import TraitsFileLoader from '../components/traits/TraitsFileLoader';
import TraitList from '../components/traits/TraitList';
import TraitEditor from '../components/traits/TraitEditor';
import { Shield, FileText } from 'lucide-react';

function TraitsEditorInner() {
  const { traitsData } = useTraits();

  if (!traitsData) {
    return (
      <div className="flex flex-col h-full">
        <TraitsFileLoader />
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Traits Editor</h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Load <code className="text-xs bg-muted px-1 rounded">export_descr_character_traits.txt</code> to start editing character traits.
              Optionally also load <code className="text-xs bg-muted px-1 rounded">export_VnVs.txt</code> to see trait display names and descriptions.
            </p>
          </div>
          <div className="text-xs text-muted-foreground bg-muted/50 rounded p-3 text-left max-w-sm">
            <p className="font-medium mb-1">Files needed:</p>
            <p>📄 <code>data/export_descr_character_traits.txt</code></p>
            <p>📄 <code>data/text/export_VnVs.txt</code> (optional)</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <TraitsFileLoader />
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - trait list */}
        <div className="w-60 shrink-0 border-r border-border overflow-hidden flex flex-col">
          <div className="px-3 py-2 border-b border-border flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-semibold text-foreground">Traits</span>
            <span className="ml-auto text-[10px] text-muted-foreground">{traitsData.traits.length}</span>
          </div>
          <TraitList />
        </div>

        {/* Main editor */}
        <div className="flex-1 overflow-hidden">
          <TraitEditor />
        </div>
      </div>
    </div>
  );
}

export default function TraitsEditor() {
  return (
    <TraitsProvider>
      <TraitsEditorInner />
    </TraitsProvider>
  );
}