import React from 'react';
import { Button } from '@/components/ui/button';

export default function ModFolderReview({ root, onOpen, onCancel }) {
  return <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
    <h4 className="text-sm font-semibold">Selected mod: {root.name}</h4>
    <p className="text-xs"><strong>{root.name}/data</strong> was found. No files have been uploaded or read.</p>
    <p className="text-xs text-muted-foreground">Open this mod to connect its editor file locations. File contents and images are read locally only when needed; other mods and unrelated installation folders are not scanned.</p>
    <p className="text-xs text-muted-foreground">Opening replaces current editor data. Export unsaved edits first. Installed mod files stay untouched.</p>
    <div className="flex flex-wrap gap-2"><Button onClick={onOpen}>Open {root.name}</Button><Button variant="outline" onClick={onCancel}>Cancel</Button></div>
  </div>;
}