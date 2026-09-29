import React, { useRef, useState } from 'react';
import { Bone } from 'lucide-react';
import { readSkeleton } from '@/lib/unpackedAnimationReader';

export default function ModelSkeletonImport({ onApply, name }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const load = async file => {
    if (!file) return;
    setBusy(true); setError('');
    try { const skeleton = readSkeleton(await file.arrayBuffer()); await onApply(skeleton, file.name); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };
  return <div className="flex flex-wrap items-center gap-2">
    <input ref={input} type="file" className="hidden" onChange={e => { load(e.target.files[0]); e.target.value = ''; }} />
    <button type="button" disabled={busy} onClick={() => input.current?.click()} title="Choose a loose skeleton .cas or the matching unpacked file from animations/skeleton (often no extension). Files stay in this browser."
      className="flex items-center gap-1 rounded border border-border bg-secondary px-2 py-1 text-[11px] text-secondary-foreground disabled:opacity-50">
      <Bone className="h-3 w-3" />{busy ? 'Reading skeleton…' : 'Load matching skeleton…'}
    </button>
    {name && <span className="max-w-40 truncate text-[10px] text-muted-foreground" title={name}>{name}</span>}
    {error && <p role="alert" className="w-full text-[11px] text-destructive">{error}</p>}
  </div>;
}