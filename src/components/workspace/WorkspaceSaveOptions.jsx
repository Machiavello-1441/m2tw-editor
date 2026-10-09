import React, { useEffect } from 'react';
import { getWorkspace } from '@/components/workspace/localWorkspace';

export default function WorkspaceSaveOptions({ mode, onChange, disabled }) {
  const source = getWorkspace();
  useEffect(() => {
    if (source?.readOnly && mode !== 'copy') onChange('copy');
  }, [source?.readOnly, mode, onChange]);
  if (!source?.authorized) return null;
  return <fieldset disabled={disabled} className="rounded-lg border border-border p-4 space-y-2">
    <legend className="px-1 text-sm font-semibold">Save destination</legend>
    <label className="flex gap-2 items-center text-xs"><input type="radio" name="workspace-save" checked={mode === 'copy'} onChange={() => onChange('copy')} />Create a separate edited copy (ZIP, recommended)</label>
    <label className="flex gap-2 items-center text-xs"><input type="radio" name="workspace-save" disabled={source.readOnly} checked={mode === 'source'} onChange={() => onChange('source')} />Overwrite exported files in the source folder</label>
    <p className="text-xs text-muted-foreground">{source.readOnly ? 'This installed folder is connected read-only. Download the ZIP, then copy its exported files into your mod using your file manager. The ZIP contains editor files, not every unedited asset.' : 'The copy contains exported editor files, not a duplicate of every unedited asset. Overwrite asks for confirmation and write permission.'}</p>
  </fieldset>;
}