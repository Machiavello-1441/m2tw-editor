import React from 'react';
import { RotateCcw } from 'lucide-react';

export default function CampaignRevertButton({ onRevert, hasSavedSnapshot }) {
  return (
    <button type="button" onClick={onRevert} disabled={!hasSavedSnapshot}
      title={hasSavedSnapshot ? 'Discard all changes since the last save' : 'Save the campaign first to create a restore point'}
      className="flex items-center gap-1 rounded border border-border bg-secondary px-2 py-1 text-[10px] text-secondary-foreground hover:bg-accent disabled:cursor-not-allowed disabled:text-muted-foreground">
      <RotateCcw className="h-3 w-3" /> Revert
    </button>
  );
}