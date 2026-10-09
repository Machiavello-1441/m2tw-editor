import React, { useEffect, useState } from 'react';
import FolderConnectionFlow from '@/components/workspace/FolderConnectionFlow';
import WorkspaceReadyPanel from '@/components/workspace/WorkspaceReadyPanel';
import { Button } from '@/components/ui/button';
import { disconnectWorkspace, getWorkspace, restoreWorkspace, workspaceEvent } from '@/components/workspace/localWorkspace';

export default function LocalFolderPanel() {
  const [source, setSource] = useState(getWorkspace());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const update = () => {
      const current = getWorkspace();
      setSource({ ...current });
      if (current?.authorized) setError('');
    };
    window.addEventListener(workspaceEvent, update);
    restoreWorkspace().then(value => setSource(value)).catch(() => setError('Remembered direct folder access could not be restored. Select your mod with the read-only picker below instead.'));
    return () => window.removeEventListener(workspaceEvent, update);
  }, []);
  const run = async action => {
    setBusy(true); setError('');
    try { await action(); } catch (error) {
      if (error.name !== 'AbortError') setError(error.name === 'SecurityError' || error.name === 'NotAllowedError'
        ? 'Remembered direct access was blocked. Use Select mod folder (read-only) above instead; it uses a different browser picker and does not request direct filesystem permission.'
        : error.message);
    }
    finally { setBusy(false); }
  };
  return <div className="space-y-3 rounded-lg border border-border bg-background p-4 text-foreground">
    <h3 className="text-sm font-semibold text-foreground">Open a mod folder</h3>
    <p className="text-xs text-muted-foreground">Select one mod folder containing data → Open → Ready to edit. Read-only selection avoids the restricted direct-access picker. File contents stay local and load only when needed.</p>
    <WorkspaceReadyPanel source={source} />
    <FolderConnectionFlow busy={busy} source={source} />
    {source?.name && <Button variant="ghost" className="text-foreground" disabled={busy} onClick={() => run(disconnectWorkspace)}>Use manual import instead</Button>}
    <p className="text-xs text-muted-foreground">Selecting and opening a folder never modifies the installed mod. Edited files are exported as a separate ZIP by default.</p>
    <p className="text-xs text-muted-foreground">Local mode covers buildings, traits, ancillaries, units, factions, cultures, minor text files, strings, Lua and campaigns. 3D/sound tools and additional texture previews still use their existing pickers.</p>
    {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
  </div>;
}