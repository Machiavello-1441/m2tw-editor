import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import LocalFolderAccessButton from '@/components/workspace/LocalFolderAccessButton';
import ModFolderReview from '@/components/workspace/ModFolderReview';
import { selectWorkspaceFolder, connectWorkspace, authorizeWorkspace } from '@/components/workspace/localWorkspace';
import useFolderOperation from '@/components/workspace/useFolderOperation';
import { Button } from '@/components/ui/button';

export default function FolderConnectionFlow({ busy, source }) {
  const [selected, setSelected] = useState(null);
  const { progress, error, run, cancel } = useFolderOperation();
  const choose = () => {
    setSelected(null);
    return run({ phase: 'Selecting a mod folder', current: 0, total: 0 }, async signal => {
      const root = await selectWorkspaceFolder();
      signal.throwIfAborted();
      setSelected(root);
    });
  };
  const reconnect = () => run({ phase: 'Reconnecting mod folder', current: 0, total: 0 }, (signal, update) => authorizeWorkspace({ signal, onProgress: update }));
  const open = async () => {
    const connected = await run({ phase: 'Connecting mod folder', current: 0, total: 0 }, (signal, update) => connectWorkspace(selected, { signal, onProgress: update }));
    if (connected) setSelected(null);
  };
  return <div className="space-y-3" aria-busy={!!progress}>
    <LocalFolderAccessButton busy={busy || !!progress} source={source} onConnect={choose} />
    {window.self === window.top && source?.root && !source.authorized && <Button variant="outline" disabled={busy || !!progress} onClick={reconnect}>Reconnect remembered mod</Button>}
    {progress && <div role="status" aria-live="polite" className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
      <p className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" />{progress.phase}…</p>
      <progress className="w-full accent-primary" value={progress.total ? progress.current : undefined} max={progress.total || 1} />
      <p className="text-xs text-muted-foreground">{progress.current.toLocaleString()} editor file locations found · No file contents are being uploaded or preloaded.</p>
      <Button variant="outline" size="sm" onClick={cancel}>Cancel processing</Button>
    </div>}
    {!progress && selected && <ModFolderReview root={selected} onOpen={open} onCancel={() => setSelected(null)} />}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </div>;
}