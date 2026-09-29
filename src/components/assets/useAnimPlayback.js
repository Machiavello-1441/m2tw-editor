import { useCallback, useEffect, useRef, useState } from 'react';
import { readViewerAnimation } from '@/lib/unpackedAnimationReader';
import { buildAnimClip, sampleAnimClip } from '@/lib/casAnimPlayer';

export default function useAnimPlayback({ joints, packedBones, onPoseChange, onReset }) {
  const [files, setFiles] = useState([]), [selected, setSelected] = useState(0);
  const [clip, setClip] = useState(null), [error, setError] = useState(''), [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false), [active, setActive] = useState(false);
  const [progress, setProgress] = useState(0), [speed, setSpeed] = useState(1);
  const request = useRef(0), progressRef = useRef(0);
  progressRef.current = progress;
  useEffect(() => {
    request.current++; setClip(null); setPlaying(false); setActive(false); setProgress(0); setFiles([]); setError(''); setLoading(false); onReset();
    return () => { request.current++; };
  }, [joints, onReset]);
  const load = useCallback(async file => {
    const token = ++request.current;
    setLoading(true); setError(''); setClip(null); setPlaying(false); setActive(false); setProgress(0); onReset();
    try {
      const parsed = readViewerAnimation(await file.arrayBuffer(), packedBones);
      if (parsed.isPose) throw new Error('This file is a base-pose skeleton. Use “Load matching skeleton” above, then choose an animation.');
      const next = buildAnimClip(parsed, joints);
      if (!next?.tracks.length) throw new Error('No animation bones match this model’s skeleton.');
      if (token === request.current) { setClip(next); setActive(true); }
    } catch (e) { if (token === request.current) setError(e.message); }
    finally { if (token === request.current) setLoading(false); }
  }, [joints, packedBones, onReset]);
  useEffect(() => { if (clip && active) onPoseChange(sampleAnimClip(clip, progress)); }, [clip, active, progress, onPoseChange]);
  useEffect(() => {
    if (!playing || !clip) return;
    const start = performance.now() - progressRef.current * clip.duration * 1000 / speed;
    let id;
    const tick = now => { setProgress(((now - start) * speed / 1000 % clip.duration) / clip.duration); id = requestAnimationFrame(tick); };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [playing, clip, speed]);
  const reset = () => { setPlaying(false); setActive(false); setProgress(0); onReset(); };
  return { files, selected, clip, error, loading, playing, progress, speed, setSpeed, reset,
    choose: index => { setSelected(index); load(files[index]); },
    add: list => { const next = Array.from(list); if (next.length) { setFiles(next); setSelected(0); load(next[0]); } },
    toggle: () => { setActive(true); setPlaying(p => !p); },
    scrub: value => { setPlaying(false); setActive(true); setProgress(value); },
    clear: () => { request.current++; setLoading(false); setClip(null); setFiles([]); setError(''); reset(); },
  };
}