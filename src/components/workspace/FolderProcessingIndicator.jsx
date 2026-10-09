import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

export default function FolderProcessingIndicator({ progress }) {
  const [seconds, setSeconds] = useState(0);
  const running = !!progress;
  useEffect(() => {
    if (!running) return;
    setSeconds(0);
    const timer = setInterval(() => setSeconds(value => value + 1), 1000);
    return () => clearInterval(timer);
  }, [running]);
  if (!progress) return null;
  return <div className="dark fixed top-4 left-1/2 z-[100] w-[92%] max-w-xl -translate-x-1/2 pointer-events-none">
    <div role="status" aria-live="polite" aria-atomic="true" className="rounded-lg border border-primary/40 bg-card p-4 text-card-foreground shadow-xl">
      <div className="flex items-center gap-3">
        <Loader2 aria-hidden="true" className="h-6 w-6 shrink-0 animate-spin text-primary" />
        <div className="min-w-0 flex-1"><p className="text-sm font-semibold">Processing M2TW folder…</p><p className="truncate text-xs text-muted-foreground">{progress.folder}</p></div>
        <span aria-hidden="true" className="text-xs tabular-nums text-muted-foreground">{seconds}s</span>
      </div>
      <progress aria-label="Processing M2TW folder; total file count is not yet known" className="mt-3 h-3 w-full accent-primary" />
      <p className="mt-2 text-xs">{(progress.current || 0).toLocaleString()} editor file locations found</p>
      <p className="mt-1 truncate text-xs text-muted-foreground" title={progress.name}>{progress.name || progress.phase}</p>
      <p className="mt-2 text-xs text-muted-foreground">Checking local files. Please wait; nothing is being uploaded or changed.</p>
    </div>
  </div>;
}