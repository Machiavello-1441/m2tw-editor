import React from 'react';
import { getWorkspace } from '@/components/workspace/localWorkspace';

export default function WorkspaceSaveOptions({ mode, onChange, disabled }) {
  if (!getWorkspace()?.authorized) return null;
  return <fieldset disabled={disabled} className="rounded-lg border border-border p-4 space-y-2">
    <legend className="px-1 text-sm font-semibold">Save destination</legend>
    <label className="flex gap-2 items-center text-xs"><input type="radio" name="workspace-save" checked={mode === 'copy'} onChange={() => onChange('copy')} />Create a separate edited copy (ZIP, recommended)</label>
    <label className="flex gap-2 items-center text-xs"><input type="radio" name="workspace-save" checked={mode === 'source'} onChange={() => onChange('source')} />Overwrite exported files in the source folder</label>
    <p className="text-xs text-muted-foreground">The copy contains exported editor files, not a duplicate of every unedited asset. Overwrite asks for confirmation and write permission.</p>
  </fieldset>;
}