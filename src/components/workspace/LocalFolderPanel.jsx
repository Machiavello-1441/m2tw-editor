import React, { useEffect, useState } from 'react';
import { FolderOpen, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { authorizeWorkspace, connectWorkspace, disconnectWorkspace, getWorkspace, restoreWorkspace, supportsLocalWorkspace, workspaceEvent } from '@/components/workspace/localWorkspace';

export default function LocalFolderPanel() {
  const [source, setSource] = useState(getWorkspace());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const update = () => setSource({ ...getWorkspace() });
    window.addEventListener(workspaceEvent, update);
    restoreWorkspace().then(value => setSource(value)).catch(error => setError(error.message));
    return () => window.removeEventListener(workspaceEvent, update);
  }, []);
  const run = async action => {
    setBusy(true); setError('');
    try { await action(); } catch (error) { if (error.name !== 'AbortError') setError(error.message); }
    finally { setBusy(false); }
  };
  return <div className="space-y-3 rounded-lg border border-border bg-background p-4">
    <h3 className="text-sm font-semibold">Local folder workspace</h3>
    <p className="text-xs text-muted-foreground">Connect your mod or data folder. Editors read needed files from your PC; UI images load when viewed, not in a bulk import.</p>
    {source?.root && <p className="text-xs">Folder: <strong>{source.name}</strong> · {source.authorized ? `${source.files.size} file references, contents not preloaded` : 'Permission needed'}</p>}
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" disabled={busy || !supportsLocalWorkspace()} onClick={() => run(source?.root && !source.authorized ? authorizeWorkspace : connectWorkspace)}>
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderOpen className="w-4 h-4" />}
        {source?.root && !source.authorized ? 'Grant folder access' : source?.root ? 'Change local folder' : 'Connect local folder'}
      </Button>
      {source?.root && <Button variant="ghost" disabled={busy} onClick={() => run(disconnectWorkspace)}>Use manual import instead</Button>}
    </div>
    {!supportsLocalWorkspace() && <p className="text-xs text-muted-foreground">Direct folder access needs desktop Chrome or Edge. Use manual import below in other browsers.</p>}
    <p className="text-xs text-muted-foreground">Source files remain untouched until you explicitly choose overwrite on Export. Separate-copy export is the default.</p>
    <p className="text-xs text-muted-foreground">Local mode covers buildings, traits, ancillaries, units, factions, cultures, minor text files, strings, Lua and campaigns. 3D/sound tools and additional texture previews still use their existing pickers.</p>
    {error && <p role="alert" className="text-xs text-destructive">{error} If the browser blocks the picker in the preview, open the published app in its own tab.</p>}
  </div>;
}