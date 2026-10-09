import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import ReadOnlyFolderPicker from '@/components/workspace/ReadOnlyFolderPicker';
import WorkspaceFolderReview from '@/components/workspace/WorkspaceFolderReview';
import { discoverWorkspaceFolders } from '@/components/workspace/workspaceFolderCatalog';
import { connectReadOnlyWorkspace } from '@/components/workspace/localWorkspace';

export default function FolderConnectionFlow({ busy, source }) {
  const [folders, setFolders] = useState([]);
  const [selected, setSelected] = useState(0);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState('');
  const scan = async files => {
    setError(''); setFolders([]); setSelected(0);
    setProgress({ phase: 'Checking selected folder', current: 0, total: files.length });
    try {
      const detected = await discoverWorkspaceFolders(files, setProgress);
      if (!detected.length) throw new Error('No supported unpacked M2TW files found. Select your mod or its data folder. If it contains only game packs, unpack the game data first.');
      setFolders(detected);
    } catch (error) { setError(error.message); }
    finally { setProgress(null); }
  };
  const open = async () => {
    const folder = folders[selected];
    setError(''); setProgress({ phase: 'Connecting selected mod', current: 0, total: folder.files.length });
    try { await connectReadOnlyWorkspace(folder.files, { folder, onProgress: setProgress }); setFolders([]); }
    catch (error) { setError(`Could not open this folder: ${error.message}`); }
    finally { setProgress(null); }
  };
  return <div className="space-y-3" aria-busy={!!progress}>
    <ReadOnlyFolderPicker busy={busy || !!progress} source={source} onSelect={scan} />
    {progress && <div role="status" aria-live="polite" className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
      <p className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" />{progress.phase}…</p>
      <progress className="w-full accent-primary" value={progress.current} max={progress.total || 1} />
      <p className="text-xs text-muted-foreground">{progress.current.toLocaleString()} / {progress.total.toLocaleString()} file references · Please wait before opening an editor.</p>
    </div>}
    {!progress && !!folders.length && <WorkspaceFolderReview folders={folders} selected={selected} onSelect={setSelected} onOpen={open} onCancel={() => setFolders([])} />}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </div>;
}