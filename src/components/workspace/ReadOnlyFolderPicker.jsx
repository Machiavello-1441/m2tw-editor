import React, { useEffect, useRef, useState } from 'react';
import { FolderOpen, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ReadOnlyFolderPicker({ busy, source, onSelect }) {
  const input = useRef(null);
  const [waiting, setWaiting] = useState(false);
  useEffect(() => {
    const element = input.current;
    const cancel = () => setWaiting(false);
    element.addEventListener('cancel', cancel);
    return () => element.removeEventListener('cancel', cancel);
  }, []);
  const select = event => {
    setWaiting(false);
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (files.length) onSelect(files);
  };
  return <div className="space-y-2">
    <input ref={input} type="file" webkitdirectory="" multiple className="hidden" onChange={select} aria-label="Select installed mod folder for read-only access" />
    <Button variant="outline" className="text-foreground bg-card hover:text-foreground border-border" disabled={busy || waiting} onClick={() => { setWaiting(true); input.current.click(); }}>
      {waiting || busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderOpen className="w-4 h-4" />} {source?.name ? 'Change M2TW folder' : 'Connect M2TW folder'}
    </Button>
    {waiting && <p role="status" aria-live="polite" className="text-sm">Waiting for the browser to finish folder selection. Approve its file-selection warning, then wait for the detected-mod list; a large installation can take a while.</p>}
    <p className="text-xs text-muted-foreground">Choose your M2TW installation to discover its mods, or choose one mod/data folder directly. The browser calls its permission prompt “upload”, but this connection does not send game files online. After selection, choose a detected folder and click Open.</p>
  </div>;
}