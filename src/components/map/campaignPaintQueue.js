/** Coalesce strokes without starving the preview or overlapping GPU uploads. */
export default function campaignPaintQueue(layersRef, setLayers) {
  let pending = {}, timer = null, running = null, epoch = 0, active = true;
  const hasPending = () => Object.keys(pending).length > 0;
  const clearTimer = () => { clearTimeout(timer); timer = null; };
  const tick = () => {
    if (active && hasPending() && timer === null && !running) {
      timer = setTimeout(() => { timer = null; void run(); }, 50);
    }
  };
  const run = () => {
    if (running) return running;
    if (!active || !hasPending()) return Promise.resolve();
    const batch = pending, version = epoch;
    pending = {};
    running = (async () => {
      for (const [id, data] of Object.entries(batch)) {
        const layer = layersRef.current[id];
        if (!active || version !== epoch || layer?.data !== data) continue;
        const { width, height } = layer;
        const bitmap = await createImageBitmap(new ImageData(new Uint8ClampedArray(data), width, height));
        const latest = layersRef.current[id];
        if (!active || version !== epoch || latest?.data !== data || latest.width !== width || latest.height !== height) {
          bitmap.close(); continue; // This bitmap was never shared with a renderer.
        }
        // Published bitmaps can also belong to cached campaigns. Let their actual
        // references control lifetime, never close them from a stale React effect.
        setLayers(previous => previous[id]?.data === data && previous[id].width === width && previous[id].height === height
          ? { ...previous, [id]: { ...previous[id], bitmap } } : previous);
      }
    })().finally(() => { running = null; tick(); });
    return running;
  };
  const cancel = () => { clearTimer(); pending = {}; epoch++; };
  return {
    schedule(id, data) { if (active) { pending[id] = data; tick(); } },
    async flush() {
      clearTimer();
      while (active && (running || hasPending())) { await run(); clearTimer(); }
    },
    cancel,
    resume() { active = true; tick(); },
    dispose() { active = false; cancel(); },
  };
}