import React from 'react';
import { Button } from '@/components/ui/button';

export default function ModFolderReview({ root, onOpen, onCancel }) {
  return <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
    <h4 className="text-sm font-semibold">Selected mod: {root.name}</h4>
    <p className="text-xs"><strong>{root.name}/data</strong> was found. No files have been uploaded or read.</p>
    <p className="text-xs text-muted-foreground">Open this mod to connect its local file references read-only. File contents and images are read only when needed. Edited files are downloaded as a ZIP; the installed mod is never overwritten.</p>
    <p className="text-xs text-muted-foreground">Opening replaces current editor data. Export unsaved edits first. Installed mod files stay untouched.</p>
    <div className="flex flex-wrap gap-2"><Button onClick={onOpen}>Open {root.name}</Button><Button variant="outline" onClick={onCancel}>Cancel</Button></div>
  </div>;
}