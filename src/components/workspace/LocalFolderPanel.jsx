import React, { useEffect, useState } from 'react';
import LocalFolderAccessButton from '@/components/workspace/LocalFolderAccessButton';
import FolderConnectionFlow from '@/components/workspace/FolderConnectionFlow';
import WorkspaceReadyPanel from '@/components/workspace/WorkspaceReadyPanel';
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
    try { await action(); } catch (error) {
      if (error.name !== 'AbortError') setError(error.name === 'SecurityError' || error.name === 'NotAllowedError'
        ? 'The browser blocked remembered folder access. Use the main M2TW folder button above and select the game, mod or data subfolder inside Steam. Windows read permissions still apply.'
        : error.message);
    }
    finally { setBusy(false); }
  };
  return <div className="space-y-3 rounded-lg border border-border bg-background p-4 text-foreground">
    <h3 className="text-sm font-semibold text-foreground">Open a mod folder</h3>
    <p className="text-xs text-muted-foreground">Select folder → choose detected mod → Open → Ready to edit. No bulk image import is needed.</p>
    <WorkspaceReadyPanel source={source} />
    <FolderConnectionFlow busy={busy} source={source} />
    <details><summary className="cursor-pointer text-xs text-muted-foreground">Other connection options</summary><div className="mt-2 flex flex-wrap gap-2">
      <LocalFolderAccessButton busy={busy} source={source} onConnect={() => run(source?.root && !source.authorized ? authorizeWorkspace : connectWorkspace)} />
      {source?.name && <Button variant="ghost" className="text-foreground" disabled={busy} onClick={() => run(disconnectWorkspace)}>Use manual import instead</Button>}
    </div></details>
    {!supportsLocalWorkspace() && <p className="text-xs text-muted-foreground">Direct folder access needs desktop Chrome or Edge. Use the read-only option above or manual import below in other browsers.</p>}
    <p className="text-xs text-muted-foreground">Selecting and opening a folder never modifies the installed mod. Edited files are exported as a separate ZIP by default.</p>
    <p className="text-xs text-muted-foreground">Local mode covers buildings, traits, ancillaries, units, factions, cultures, minor text files, strings, Lua and campaigns. 3D/sound tools and additional texture previews still use their existing pickers.</p>
    {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
  </div>;
}