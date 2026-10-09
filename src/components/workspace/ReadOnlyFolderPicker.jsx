import React, { useEffect, useRef, useState } from 'react';
import { FolderOpen, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ReadOnlyFolderPicker({ busy, source, onSelect }) {
  const input = useRef(null);
  const [waiting, setWaiting] = useState(false);
  const [slow, setSlow] = useState(false);
  const [selection, setSelection] = useState(0);
  const stop = () => { setWaiting(false); setSlow(false); setSelection(value => value + 1); };
  useEffect(() => {
    if (!waiting) return;
    const timer = setTimeout(() => setSlow(true), 60000);
    return () => clearTimeout(timer);
  }, [waiting]);
  useEffect(() => {
    const element = input.current;
    const cancel = () => { setWaiting(false); setSlow(false); };
    element.addEventListener('cancel', cancel);
    return () => element.removeEventListener('cancel', cancel);
  }, [selection]);
  const select = event => {
    if (event.target !== input.current) return;
    setWaiting(false); setSlow(false);
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (files.length) onSelect(files);
  };
  return <div className="space-y-2">
    <input key={selection} ref={input} type="file" webkitdirectory="" multiple className="hidden" onChange={select} aria-label="Select installed mod folder for read-only access" />
    <Button variant="outline" className="text-foreground bg-card hover:text-foreground border-border" disabled={busy || waiting} onClick={() => { setSlow(false); setWaiting(true); input.current.click(); }}>
      {slow ? <AlertCircle className="w-4 h-4" /> : waiting || busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderOpen className="w-4 h-4" />} {waiting ? 'Browser preparing folder selection' : busy ? 'Processing selected folder' : source?.name ? 'Change M2TW folder' : 'Connect M2TW folder'}
    </Button>
    {waiting && <div role="status" aria-live="polite" className="space-y-2 text-sm">
      <p>{slow ? 'The browser still has not supplied the selected files after one minute. The editor cannot start scanning or report file progress until it does. Stop waiting and choose a smaller folder instead.' : 'Choose a folder and approve the browser prompt. The browser lists every file and subfolder before passing the selection to this editor; no file list has arrived yet.'}</p>
      <Button variant="outline" size="sm" onClick={stop}>Stop waiting</Button>
      <p className="text-xs text-muted-foreground">This discards the pending selection; close any browser folder dialog yourself. A late result from this selection will be ignored.</p>
    </div>}
    <p className="text-xs text-muted-foreground">For the base game, select Medieval II Total War → data. For a mod, select mods → your mod → data (or the single mod folder to include its Lua scripts). Avoid selecting the whole Steam/game installation: it includes unrelated files and every installed mod. The browser calls its permission prompt “upload”, but this connection does not send game files online.</p>
  </div>;
}