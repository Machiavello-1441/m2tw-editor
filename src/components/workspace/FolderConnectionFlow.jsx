import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import ReadOnlyFolderPicker from '@/components/workspace/ReadOnlyFolderPicker';
import FolderProcessingIndicator from '@/components/workspace/FolderProcessingIndicator';
import selectedModFolder from '@/components/workspace/selectedModFolder';
import ModFolderReview from '@/components/workspace/ModFolderReview';
import { connectReadOnlyWorkspace } from '@/components/workspace/localWorkspace';
import useFolderOperation from '@/components/workspace/useFolderOperation';
import { Button } from '@/components/ui/button';

export default function FolderConnectionFlow({ busy, source }) {
  const [selected, setSelected] = useState(null);
  const { progress, error, run, cancel } = useFolderOperation();
  const choose = files => {
    setSelected(null);
    return run({ phase: 'Checking selected mod', folder: files[0]?.webkitRelativePath.split('/')[0], current: 0, total: files.length }, async (signal, update) => {
      const folder = await selectedModFolder(files, update, signal);
      signal.throwIfAborted();
      setSelected(folder);
    });
  };
  const open = async () => {
    const connected = await run({ phase: 'Connecting local file references', folder: selected.name, current: 0, total: selected.files.length }, (signal, update) => connectReadOnlyWorkspace(selected.files, { folder: selected, signal, onProgress: value => update({ ...value, folder: selected.name }) }));
    if (connected) setSelected(null);
  };
  return <div className="space-y-3" aria-busy={!!progress}>
    <ReadOnlyFolderPicker busy={busy || !!progress} source={source} onSelect={choose} />
    <FolderProcessingIndicator progress={progress} />
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