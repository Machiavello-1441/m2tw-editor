import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Play, Pause, Upload, X, Film } from 'lucide-react';
import { parseCasAnim } from '@/lib/casAnimCodec';
import { buildAnimClip, sampleAnimClip } from '@/lib/casAnimPlayer';

const SPEEDS = [0.25, 0.5, 1, 2];

/**
 * Loads a .cas animation, links its bones to the model's skeleton joints and
 * drives the viewer's pose rotations frame by frame.
 */
export default function AnimPlaybackPanel({ joints, onPoseChange, onReset }) {
  const inputRef = useRef(null);
  const rafRef = useRef(null);
  const startRef = useRef(0);

  const [fileName, setFileName] = useState('');
  const [clip, setClip] = useState(null);
  const [error, setError] = useState('');
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [progress, setProgress] = useState(0);

  const hasSkeleton = joints?.length > 0;

  const handleFile = useCallback(async (file) => {
    setError(''); setClip(null); setPlaying(false); setProgress(0);
    setFileName(file.name);
    const parsed = parseCasAnim(await file.arrayBuffer());
    if (parsed.errors?.length) { setError(parsed.errors[0]); return; }
    const built = buildAnimClip(parsed, joints);
    if (!built || !built.tracks.length) {
      setError('No animation bone matched this model’s skeleton.');
      return;
    }
    setClip(built);
  }, [joints]);

  // Apply the sampled pose whenever progress changes
  useEffect(() => {
    if (clip) onPoseChange(sampleAnimClip(clip, progress));
  }, [clip, progress, onPoseChange]);

  // Playback loop
  useEffect(() => {
    if (!playing || !clip) return;
    startRef.current = performance.now() - progress * clip.duration * 1000 / speed;
    const tick = () => {
      const elapsed = (performance.now() - startRef.current) * speed / 1000;
      setProgress((elapsed % clip.duration) / clip.duration);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, clip, speed]);

  const clear = () => {
    setPlaying(false); setClip(null); setFileName(''); setError(''); setProgress(0);
    onReset();
  };

  const frame = clip ? Math.round(progress * (clip.frameCount - 1)) : 0;

  return (
    <div className="flex flex-col flex-1 min-h-0 text-[11px] p-2.5 space-y-2 overflow-y-auto">
      <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold flex items-center gap-1">
        <Film className="w-3 h-3" /> Animation (.cas)
      </p>

      {!hasSkeleton ? (
        <p className="text-[10px] text-amber-400 leading-snug">
          This model has no skeleton loaded — load a rigged mesh (or its skeleton) before linking an animation.
        </p>
      ) : (
        <>
          <input ref={inputRef} type="file" accept=".cas" className="hidden"
            onChange={(e) => { if (e.target.files[0]) handleFile(e.target.files[0]); e.target.value = ''; }} />
          <button onClick={() => inputRef.current?.click()}
            className="w-full flex items-center gap-2 px-2 py-1 rounded bg-slate-800 text-slate-200 hover:bg-slate-700">
            <Upload className="w-3 h-3" /> Load .cas animation
          </button>

          {fileName && (
            <div className="flex items-center gap-1 bg-slate-800 rounded px-1.5 py-1">
              <span className="text-[10px] text-slate-200 truncate flex-1" title={fileName}>{fileName}</span>
              <button onClick={clear} className="text-slate-500 hover:text-red-400"><X className="w-3 h-3" /></button>
            </div>
          )}

          {error && <p className="text-[10px] text-red-400 leading-snug">{error}</p>}

          {clip && (
            <>
              <p className="text-[9px] text-slate-500 leading-snug">
                {clip.tracks.length} bone{clip.tracks.length === 1 ? '' : 's'} linked · {clip.frameCount} frames · {clip.duration.toFixed(2)}s
                {clip.unmatched.length > 0 && ` · ${clip.unmatched.length} unmatched`}
              </p>

              <button onClick={() => setPlaying(p => !p)}
                className={`w-full flex items-center gap-2 px-2 py-1 rounded ${
                  playing ? 'bg-green-600/30 text-green-300' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                }`}>
                {playing ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                {playing ? 'Pause' : 'Play'}
              </button>

              <div className="space-y-1">
                <div className="flex justify-between text-[9px] text-slate-500">
                  <span>Frame {frame + 1}/{clip.frameCount}</span>
                  <span>{(progress * clip.duration).toFixed(2)}s</span>
                </div>
                <input type="range" min={0} max={1000} value={Math.round(progress * 1000)}
                  onChange={(e) => { setPlaying(false); setProgress(Number(e.target.value) / 1000); }}
                  className="w-full accent-green-500" />
              </div>

              <div className="flex gap-1">
                {SPEEDS.map(s => (
                  <button key={s} onClick={() => setSpeed(s)}
                    className={`flex-1 py-0.5 rounded text-[9px] ${
                      speed === s ? 'bg-green-600/30 text-green-300' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}>{s}×</button>
                ))}
              </div>

              <button onClick={() => { setPlaying(false); setProgress(0); onReset(); }}
                className="w-full px-2 py-1 rounded bg-slate-800 text-slate-300 hover:bg-slate-700">
                Reset to bind pose
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}