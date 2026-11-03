import { useEffect, useRef, useState } from 'react';
import resizePixelMap from '@/lib/resizePixelMap';
import { GT } from '@/lib/autoGroundTypes';
import { getLayerDimensions } from '@/lib/mapLayerStore';
import { defaultGround } from '@/components/newmap/osmpacks/osmPackDefaults';

export default function useOsmPackApply(state, groundLayer, onLayerUpdate, mapWidth, mapHeight) {
  const base = useRef(null), last = useRef(null), ground = useRef(groundLayer);
  const [applied, setApplied] = useState(false);
  ground.current = groundLayer;
  useEffect(() => {
    if (groundLayer?.imageData !== last.current) { base.current = null; last.current = null; setApplied(false); }
  }, [groundLayer?.imageData]);
  const choices = state.summary.classes.flatMap(item => {
    const p = state.preferences[item.key] || {}, gt = p.gt ?? defaultGround[item.classification] ?? '';
    const color = gt === 'custom' && /^#[0-9a-f]{6}$/i.test(p.color || '') ? [1, 3, 5].map(n => parseInt(p.color.slice(n, n + 2), 16)) : GT[gt];
    return p.enabled && item.count && color ? [{ key: item.key, color }] : [];
  });
  const reset = () => { base.current = null; last.current = null; setApplied(false); };
  const apply = async (remove = false) => {
    if (!ground.current?.imageData) return;
    const { width, height } = getLayerDimensions({ id: 'ground' }, mapWidth, mapHeight);
    const source = base.current || ground.current.imageData;
    const fixed = resizePixelMap(source, width, height), pixels = new Uint8ClampedArray(fixed.data);
    const reference = ground.current.imageData;
    const result = await state.perform({ kind: 'paint', choices: remove ? [] : choices, pixels, width, height }, [pixels.buffer]);
    if (!result) return;
    if (ground.current.imageData !== reference) { state.setError('Ground changed during processing. Apply again to use the latest layer.'); return; }
    const imageData = new ImageData(result.pixels, result.width, result.height);
    base.current = source; last.current = imageData;
    onLayerUpdate('ground', { imageData, visible: true, opacity: 1, dirty: true });
    setApplied(!remove && choices.length > 0);
    state.setMessage(remove ? 'Removed pack overlays from the current baseline.' : `Applied ${choices.length} local classes (${result.painted.toLocaleString()} pixel writes). No live requests were made.`);
  };
  return { apply, reset, applied, selected: choices.length };
}