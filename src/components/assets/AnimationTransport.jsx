import React from 'react';
import { Play, Pause } from 'lucide-react';

export default function AnimationTransport({ playback: p }) {
  const { clip, progress, playing, speed } = p;
  const time = progress * clip.duration;
  const next = clip.times.findIndex(t => t > time + clip.times[0]);
  const frame = next < 0 ? clip.times.length : Math.max(1, next);
  return <div className="space-y-2">
    <p className="text-[10px] text-muted-foreground">{clip.format === 'unpacked' ? 'Unpacked animation · 20 fps' : 'Loose CAS animation'}<br />{clip.matched.length} bones linked · {clip.frameCount} frames · {clip.duration.toFixed(2)}s</p>
    {!!clip.unmatched.length && <p className="text-[10px] text-muted-foreground">Unmatched animation bones: {clip.unmatched.join(', ')}</p>}
    <button onClick={p.toggle} className="flex w-full items-center gap-2 rounded bg-secondary px-2 py-1 text-secondary-foreground">{playing ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}{playing ? 'Pause' : 'Play'}</button>
    <div className="flex justify-between text-[10px] text-muted-foreground"><span>Frame {frame}/{clip.frameCount}</span><span>{time.toFixed(2)}s</span></div>
    <input aria-label="Animation position" type="range" min={0} max={1000} value={Math.round(progress * 1000)} onChange={e => p.scrub(Number(e.target.value) / 1000)} className="w-full accent-primary" />
    <div className="flex gap-1">{[0.25, 0.5, 1, 2].map(s => <button key={s} onClick={() => p.setSpeed(s)} className={`flex-1 rounded py-1 ${speed === s ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}>{s}×</button>)}</div>
    <button onClick={p.reset} className="w-full rounded bg-secondary px-2 py-1 text-secondary-foreground">Reset to bind pose</button>
  </div>;
}