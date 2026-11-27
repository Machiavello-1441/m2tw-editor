import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import SceneryFolders from '@/components/scenery/SceneryFolders';
import SceneryWorkspace from '@/components/scenery/SceneryWorkspace';
import { createScenerySession, fileListMount } from '@/components/scenery/sceneryFiles';
import { getFolderIndex } from '@/lib/modFolderStore';

export default function SceneryStudio() {
  const [mounts, setMounts] = useState(() => window.__SCENERY_STUDIO_SESSION__?.mounts || {});
  const [session, setSession] = useState(() => window.__SCENERY_STUDIO_SESSION__ || null);
  const [error, setError] = useState(''), [opening, setOpening] = useState(false);
  const pick = (kind, mount) => { setMounts(value => ({ ...value, [kind]: mount })); setError(''); };
  const open = async () => {
    if (session && session.pendingVersion !== session.downloadedVersion && !window.confirm('Download any pending ZIP changes before choosing a new session. Continue?')) return;
    setOpening(true); setError('');
    try {
      const next = createScenerySession(mounts);
      if (!await next.stat('/mod/data/world/maps')) throw Error('Choose the whole mod folder containing data/world/maps.');
      window.__SCENERY_STUDIO_SESSION__ = next; setSession(null); setTimeout(() => setSession(next), 0);
    } catch (e) { setError(e.message); } finally { setOpening(false); }
  };
  const reuse = () => {
    const index = getFolderIndex();
    if (!index) { setError('No folder has been loaded in the 3D Model Viewer. Choose the whole mod folder here.'); return; }
    pick('mod', fileListMount([...index.byName.values()].flat().map(entry => entry.file)));
  };
  return <div className="p-4 space-y-4 text-foreground">
    <header><h1 className="text-2xl font-bold text-foreground">Scenery Studio</h1><p className="text-sm text-muted-foreground">Place unique cities, ports, forts, resources and watchtowers on the campaign terrain. Edit bridge designs and align placements with geographic overlays.</p></header>
    <SceneryFolders mounts={mounts} onPick={pick} onError={setError} />
    <div className="flex flex-wrap items-center gap-3"><Button onClick={open} disabled={!mounts.mod || opening}>{opening ? 'Opening…' : 'Open selected mod'}</Button><Button variant="ghost" onClick={reuse}>Use folder loaded in Model Viewer</Button><span className="text-xs text-muted-foreground">Files stay on your PC. Chrome/Edge can save directly; folder import also supports ZIP export.</span></div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {session ? <SceneryWorkspace session={session} /> : <div className="rounded-lg border border-border p-8 text-muted-foreground">Select your mod folder to begin. If it uses shared game assets, select the Medieval II installation as well. The editor loads bbox_coords.txt automatically when present.</div>}
  </div>;
}
