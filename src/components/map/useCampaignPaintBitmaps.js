import { useCallback, useEffect, useRef } from 'react';

/** Own paint previews, not pixel data: cancelling a redraw never discards edits. */
export default function useCampaignPaintBitmaps(layers, layersRef, setLayers) {
  const state = useRef({ timer: null, pending: {}, epoch: 0, revisions: {}, owned: new Set(), mounted: true });
  const cancel = useCallback(() => {
    const queue = state.current;
    clearTimeout(queue.timer); queue.timer = null; queue.pending = {}; queue.epoch++;
  }, []);
  const flush = useCallback(async () => {
    const queue = state.current, epoch = queue.epoch;
    clearTimeout(queue.timer); queue.timer = null;
    const pending = queue.pending; queue.pending = {};
    await Promise.all(Object.entries(pending).map(async ([id, data]) => {
      const layer = layersRef.current[id];
      if (!layer || layer.data !== data) return;
      const revision = (queue.revisions[id] || 0) + 1;
      queue.revisions[id] = revision;
      const bitmap = await createImageBitmap(new ImageData(new Uint8ClampedArray(data), layer.width, layer.height));
      if (!queue.mounted || queue.epoch !== epoch || queue.revisions[id] !== revision || layersRef.current[id]?.data !== data) {
        bitmap.close(); return;
      }
      queue.owned.add(bitmap);
      setLayers(previous => previous[id]?.data === data ? { ...previous, [id]: { ...previous[id], bitmap } } : previous);
    }));
  }, [layersRef, setLayers]);
  const schedule = useCallback((id, data) => {
    const queue = state.current;
    queue.pending[id] = data;
    clearTimeout(queue.timer); queue.timer = setTimeout(() => { void flush(); }, 120);
  }, [flush]);
  useEffect(() => {
    const live = new Set(Object.values(layers).map(layer => layer?.bitmap));
    for (const bitmap of state.current.owned) if (!live.has(bitmap)) {
      bitmap.close(); state.current.owned.delete(bitmap);
    }
  }, [layers]);
  useEffect(() => {
    const queue = state.current; queue.mounted = true;
    return () => {
      queue.mounted = false; cancel();
      // Current bitmaps belong to the navigation-surviving layer store.
      const live = new Set(Object.values(layersRef.current).map(layer => layer?.bitmap));
      for (const bitmap of queue.owned) if (!live.has(bitmap)) bitmap.close();
      queue.owned.clear();
    };
  }, [cancel, layersRef]);
  return { flush, schedule, cancel };
}