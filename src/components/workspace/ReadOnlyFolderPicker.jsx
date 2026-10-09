import React, { useRef } from 'react';
import { FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ReadOnlyFolderPicker({ busy, onSelect }) {
  const input = useRef(null);
  const select = event => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (files.length) onSelect(files);
  };
  return <div className="space-y-2">
    <input ref={input} type="file" webkitdirectory="" multiple className="hidden" onChange={select} aria-label="Select installed mod folder for read-only access" />
    <Button variant="outline" className="text-foreground bg-card hover:text-foreground border-border" disabled={busy} onClick={() => input.current.click()}>
      <FolderOpen className="w-4 h-4" /> Select installed folder (read-only)
    </Button>
    <p className="text-xs text-muted-foreground">Use this option when Steam’s installation folder is blocked by direct folder access. Select your mod or data folder in its current location; no copy or move is needed.</p>
  </div>;
}