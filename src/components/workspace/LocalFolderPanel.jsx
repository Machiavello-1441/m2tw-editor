import React, { useEffect, useState } from 'react';
import LocalFolderAccessButton from '@/components/workspace/LocalFolderAccessButton';
import ReadOnlyFolderPicker from '@/components/workspace/ReadOnlyFolderPicker';
import { Button } from '@/components/ui/button';
import { authorizeWorkspace, connectWorkspace, connectReadOnlyWorkspace, disconnectWorkspace, getWorkspace, restoreWorkspace, supportsLocalWorkspace, workspaceEvent } from '@/components/workspace/localWorkspace';

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
  return <div className="space-y-3 rounded-lg border border-border bg-background p-4 text-foreground">
    <h3 className="text-sm font-semibold text-foreground">Local folder workspace</h3>
    <p className="text-xs text-muted-foreground">Connect your mod or data folder. Editors read needed files from your PC; UI images load when viewed, not in a bulk import.</p>
    {source?.name && <p className="text-xs">Folder: <strong>{source.name}</strong> · {source.authorized ? `${source.files.size} file references, contents not preloaded` : 'Permission needed'}</p>}
    <div className="flex flex-wrap gap-2">
      <LocalFolderAccessButton busy={busy} source={source} onConnect={() => run(source?.root && !source.authorized ? authorizeWorkspace : connectWorkspace)} />
      {source?.name && <Button variant="ghost" className="text-foreground" disabled={busy} onClick={() => run(disconnectWorkspace)}>Use manual import instead</Button>}
    </div>
    <ReadOnlyFolderPicker busy={busy} onSelect={files => run(() => connectReadOnlyWorkspace(files))} />
    {source?.readOnly && <p className="text-xs text-foreground">Connected read-only for this tab session. File contents load on demand and are not uploaded. Export your edits as a ZIP before refreshing; select the folder again after a refresh.</p>}
    {!supportsLocalWorkspace() && <p className="text-xs text-muted-foreground">Direct folder access needs desktop Chrome or Edge. Use the read-only option above or manual import below in other browsers.</p>}
    <p className="text-xs text-muted-foreground">Source files remain untouched until you explicitly choose overwrite on Export. Separate-copy export is the default.</p>
    <p className="text-xs text-muted-foreground">Local mode covers buildings, traits, ancillaries, units, factions, cultures, minor text files, strings, Lua and campaigns. 3D/sound tools and additional texture previews still use their existing pickers.</p>
    {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
  </div>;
}