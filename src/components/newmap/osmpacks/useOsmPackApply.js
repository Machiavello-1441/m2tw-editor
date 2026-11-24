import { useEffect, useRef, useState } from 'react';
import resizePixelMap from '@/lib/resizePixelMap';
import { GT } from '@/lib/autoGroundTypes';
import { getLayerDimensions } from '@/lib/mapLayerStore';
import { defaultGround } from '@/components/newmap/osmpacks/osmPackDefaults';

const BAND_PIXELS = 16000000; // Each band stays well inside the worker's 32 Mpx single-pass limit.

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
  // Large maps paint one horizontal band at a time, so the ground layer never
  // has to fit inside the worker's single-pass pixel limit.
  const apply = async (remove = false) => {
    if (!ground.current?.imageData) return;
    const { width, height } = getLayerDimensions({ id: 'ground' }, mapWidth, mapHeight);
    const source = base.current || ground.current.imageData;
    const fixed = resizePixelMap(source, width, height);
    const reference = ground.current.imageData;
    const rows = width * height > BAND_PIXELS ? Math.max(1, Math.floor(BAND_PIXELS / width)) : height;
    const bands = Math.ceil(height / rows);
    const target = new Uint8ClampedArray(width * height * 4);
    let painted = 0;
    for (let band = 0; band < bands; band++) {
      const y0 = band * rows, bandRows = Math.min(rows, height - y0);
      const pixels = fixed.data.slice(y0 * width * 4, (y0 + bandRows) * width * 4);
      const result = await state.perform({
        kind: 'paint', choices: remove ? [] : choices, pixels,
        width, height: bandRows, fullHeight: height, y0,
        progressStart: band / bands, progressEnd: (band + 1) / bands, bandIndex: band, bandCount: bands,
      }, [pixels.buffer]);
      if (!result) return;
      if (ground.current.imageData !== reference) { state.setError('Ground changed during processing. Apply again to use the latest layer.'); return; }
      target.set(result.pixels, y0 * width * 4);
      painted += result.painted;
    }
    const imageData = new ImageData(target, width, height);
    base.current = source; last.current = imageData;
    onLayerUpdate('ground', { imageData, visible: true, opacity: 1, dirty: true });
    setApplied(!remove && choices.length > 0);
    state.setMessage(remove
      ? `Removed pack overlays from the current baseline${bands > 1 ? ` in ${bands} horizontal bands` : ''}.`
      : `Applied ${choices.length} local classes (${painted.toLocaleString()} pixel writes)${bands > 1 ? ` across ${bands} horizontal bands` : ''}. No live requests were made.`);
  };
  return { apply, reset, applied, selected: choices.length };
}