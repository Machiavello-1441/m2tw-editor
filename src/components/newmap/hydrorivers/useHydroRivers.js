import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { mergeHydroDraft } from '@/components/newmap/hydrorivers/mergeDraft';

let session = { key: '', reaches: [], names: [] };
export default function useHydroRivers({ bbox, mapWidth, mapHeight, featuresLayer, onApply, onRiverPreviewChange }) {
  const key = JSON.stringify([bbox?.west, bbox?.south, bbox?.east, bbox?.north]);
  const [reaches, setReaches] = useState(() => session.key === key ? session.reaches : []);
  const [names, setNames] = useState(() => session.key === key ? session.names : []);
  const [minOrder, setMinOrder] = useState(3), [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(''), [error, setError] = useState(''), [message, setMessage] = useState('');
  const worker = useRef(null), pending = useRef(new Map()), sequence = useRef(0), alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    const instance = new Worker(new URL('./hydroWorker.js', import.meta.url), { type: 'module' });
    worker.current = instance;
    instance.onmessage = ({ data }) => {
      const job = pending.current.get(data.id);
      if (!job) return;
      if (data.progress) { if (alive.current) setBusy(data.progress); return; }
      pending.current.delete(data.id);
      if (data.error) job.reject(new Error(data.error)); else job.resolve(data.result);
    };
    instance.onerror = event => {
      pending.current.forEach(job => job.reject(new Error(event.message || 'The river import could not be processed.')));
      pending.current.clear();
    };
    return () => {
      alive.current = false; instance.terminate(); worker.current = null;
      pending.current.forEach(job => job.reject(new Error('Import cancelled.'))); pending.current.clear();
      onRiverPreviewChange?.(null);
    };
  }, [onRiverPreviewChange]);
  const request = useCallback(payload => new Promise((resolve, reject) => {
    const id = ++sequence.current;
    pending.current.set(id, { resolve, reject }); worker.current.postMessage({ ...payload, id });
  }), []);
  useEffect(() => {
    if (session.key !== key) { setReaches([]); setNames([]); setDraft(null); onRiverPreviewChange?.(null); }
  }, [key, onRiverPreviewChange]);
  const maxOrder = useMemo(() => reaches.reduce((max, reach) => Math.max(max, reach.ORD_STRA), 1), [reaches]);
  const threshold = Math.min(minOrder, maxOrder);
  useEffect(() => {
    setDraft(null); onRiverPreviewChange?.(null);
    if (!bbox || !reaches.length) return;
    let cancelled = false;
    setBusy('Building river preview…'); setError(''); setMessage('');
    request({ kind: 'preview', reaches, bbox, width: mapWidth, height: mapHeight, minOrder: threshold }).then(result => {
      if (cancelled) return;
      const imageData = new ImageData(result.pixels, result.width, result.height);
      const canvas = document.createElement('canvas'); canvas.width = result.width; canvas.height = result.height;
      canvas.getContext('2d').putImageData(imageData, 0, 0);
      const next = { imageData, stats: result.stats, url: canvas.toDataURL() };
      setDraft(next); setBusy(''); onRiverPreviewChange?.(next);
    }).catch(reason => { if (!cancelled) { setBusy(''); setError(reason.message); } });
    return () => { cancelled = true; };
  }, [reaches, key, mapWidth, mapHeight, threshold, request, onRiverPreviewChange]);
  const loadFiles = async files => {
    if (!files.length) return;
    setBusy('Opening regional data…'); setError(''); setMessage('');
    try {
      const imported = await request({ kind: 'import', files, bbox });
      if (!alive.current) return;
      if (!imported.length) { setMessage('No reaches in these files overlap the selected area. Choose another region.'); setBusy(''); return; }
      const combined = new Map(reaches.map(reach => [reach.HYRIV_ID, reach]));
      imported.forEach(reach => combined.set(reach.HYRIV_ID, reach));
      const next = [...combined.values()], labels = [...new Set([...names, ...files.map(file => file.name)])];
      session = { key, reaches: next, names: labels }; setNames(labels); setReaches(next);
    } catch (reason) { if (alive.current) { setBusy(''); setError(reason.message); } }
  };
  const apply = () => {
    if (!draft || busy || !draft.stats.selected) return;
    const merged = mergeHydroDraft(featuresLayer, draft.imageData);
    onApply(merged); onRiverPreviewChange?.(null);
    setMessage(`Applied repaired river draft. ${merged.protectedPixels} conflicting pixels preserved from existing features. Run River Validator on the merged layer; review inferred source direction and ford placement.`);
  };
  return { names, minOrder: threshold, maxOrder, setMinOrder, draft, busy, error, message, loadFiles, apply,
    hidePreview: () => onRiverPreviewChange?.(null), showPreview: () => onRiverPreviewChange?.(draft) };
}