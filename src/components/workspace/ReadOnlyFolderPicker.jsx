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
      {slow ? <AlertCircle className="w-4 h-4" /> : waiting || busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderOpen className="w-4 h-4" />} {waiting ? 'Browser preparing folder selection' : busy ? 'Processing selected folder' : source?.name ? 'Change mod folder (read-only)' : 'Select mod folder (read-only)'}
    </Button>
    {waiting && <div role="status" aria-live="polite" className="space-y-2 text-sm">
      <p>{slow ? 'The browser still has not supplied the selected files after one minute. The editor cannot start scanning or report file progress until it does. Stop waiting and choose a smaller folder instead.' : 'Choose a folder and approve the browser prompt. The browser lists every file and subfolder before passing the selection to this editor; no file list has arrived yet.'}</p>
      <progress className="h-3 w-full accent-primary" aria-label="Waiting for the browser to supply the selected folder" />
      <Button variant="outline" size="sm" onClick={stop}>Stop waiting</Button>
      <p className="text-xs text-muted-foreground">This discards the pending selection; close any browser folder dialog yourself. A late result from this selection will be ignored.</p>
    </div>}
    <p className="text-xs text-muted-foreground">Select mods → your mod folder, with data inside it. Do not select the whole Steam or game installation. This read-only picker does not request direct filesystem access, which is what triggers the browser’s system-files restriction. The browser may call its confirmation “Upload”; accepting only supplies local file references to this editor, not an online upload.</p>
    <p className="text-xs text-muted-foreground">If this picker also refuses the location, copy only your mod folder to Documents/M2TWMods and select that copy. Keep data inside it. Edits are downloaded as a separate ZIP; reselect the folder after reloading the app.</p>
  </div>;
}