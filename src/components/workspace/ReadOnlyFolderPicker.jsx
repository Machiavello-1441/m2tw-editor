import React, { useRef } from 'react';
import { FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ReadOnlyFolderPicker({ busy, source, onSelect }) {
  const input = useRef(null);
  const select = event => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (files.length) onSelect(files);
  };
  return <div className="space-y-2">
    <input ref={input} type="file" webkitdirectory="" multiple className="hidden" onChange={select} aria-label="Select installed mod folder for read-only access" />
    <Button variant="outline" className="text-foreground bg-card hover:text-foreground border-border" disabled={busy} onClick={() => input.current.click()}>
      <FolderOpen className="w-4 h-4" /> {source?.name ? 'Change M2TW folder' : 'Connect M2TW folder'}
    </Button>
    <p className="text-xs text-muted-foreground">In the folder window, navigate into your C: drive’s Steam folder, then steamapps → common → your M2TW game → your mod or data folder. Select that subfolder, not the C: drive or Steam root. This uses read-only file selection rather than the browser-restricted folder-handle picker; files stay on your PC and load on demand.</p>
  </div>;
}