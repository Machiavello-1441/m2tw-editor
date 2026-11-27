import React, { useEffect, useState } from 'react';
import JSZip from 'jszip';
import { Button } from '@/components/ui/button';

export default function SceneryWorkspace({ session }) {
  const [pending, setPending] = useState(session.pending.size), [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => {
    const timer = setInterval(() => setPending(session.pending.size), 800);
    const protect = event => { if (session.pendingVersion !== session.downloadedVersion) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', protect);
    return () => { clearInterval(timer); window.removeEventListener('beforeunload', protect); };
  }, [session]);
  const download = async () => {
    setBusy(true); setError('');
    try {
      const zip = new JSZip(), revision = session.pendingVersion;
      for (const [path, bytes] of session.pending) zip.file(path, bytes);
      const url = URL.createObjectURL(await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' }));
      const link = document.createElement('a'); link.href = url; link.download = 'Scenery-Studio-changes.zip'; link.click();
      session.downloadedVersion = revision; setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  return <div className="space-y-2">
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
      <span>{session.config.webDownloadOnly ? 'ZIP export mode: download changes and extract them into your mod to apply them.' : 'Connected to local folders. Saving writes to your mod with backups; game and library folders are read-only.'}</span>
      {session.config.webDownloadOnly && <Button size="sm" onClick={download} disabled={!pending || busy}>{busy ? 'Preparing ZIP…' : `Download ${pending} changed files`}</Button>}
    </div>
    <iframe title="Scenery Studio terrain and model editor" src="/scenery-studio/index.html" className="w-full h-[calc(100vh-230px)] min-h-[680px] rounded-lg border border-border bg-background" allow="clipboard-write" />
  </div>;
}
