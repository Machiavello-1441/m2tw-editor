import React, { useRef } from 'react';
import { Upload, X, Film } from 'lucide-react';
import useAnimPlayback from '@/components/assets/useAnimPlayback';
import AnimationTransport from '@/components/assets/AnimationTransport';

export default function AnimPlaybackPanel({ joints, packedBones, rigWarnings, onPoseChange, onReset }) {
  const input = useRef(null);
  const p = useAnimPlayback({ joints, packedBones, onPoseChange, onReset });
  return <div className="flex min-h-0 flex-1 flex-col space-y-2 overflow-y-auto p-2.5 text-[11px]">
    <p className="flex items-center gap-1 font-semibold uppercase text-muted-foreground"><Film className="h-3 w-3" /> Animations</p>
    <p className="text-[10px] text-muted-foreground">Loose .cas files or unpacked animations. Unpacked files need their matching file from animations/skeleton loaded above. Files stay in your browser.</p>
    {!joints?.length ? <p>Load a skeleton before linking an animation.</p> : <>
      <input ref={input} type="file" multiple accept=".cas" className="hidden" onChange={e => { p.add(e.target.files); e.target.value = ''; }} />
      <button disabled={p.loading} onClick={() => input.current?.click()} className="flex items-center gap-2 rounded bg-secondary px-2 py-1 text-secondary-foreground disabled:opacity-50"><Upload className="h-3 w-3" />{p.loading ? 'Reading animation…' : 'Load animations…'}</button>
      {!!p.files.length && <div className="flex min-w-0 items-center gap-1">
        <select aria-label="Loaded animation" disabled={p.loading} value={p.selected} onChange={e => p.choose(Number(e.target.value))} className="min-w-0 flex-1 rounded border border-input bg-background px-1 py-1 text-foreground">{p.files.map((f, i) => <option key={i} value={i}>{f.name}</option>)}</select>
        <button onClick={p.clear} aria-label="Clear animations"><X className="h-3 w-3" /></button>
      </div>}
      {p.error && <p role="alert" className="text-destructive">{p.error}</p>}
      {rigWarnings?.map(w => <p key={w} className="text-muted-foreground">{w}</p>)}
      {p.clip && <AnimationTransport playback={p} />}
    </>}
  </div>;
}