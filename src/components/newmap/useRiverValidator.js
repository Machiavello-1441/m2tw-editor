import { useEffect, useRef, useState } from 'react';

export default function useRiverValidator(featuresLayer, onLayerUpdate) {
  const [result, setResult] = useState(null), [repairs, setRepairs] = useState(null);
  const [running, setRunning] = useState(false), [error, setError] = useState(''), [undo, setUndo] = useState(null);
  const worker = useRef(null), current = useRef(featuresLayer?.imageData), applying = useRef(false);
  useEffect(() => {
    current.current = featuresLayer?.imageData;
    if (!applying.current) { worker.current?.terminate(); worker.current = null; setRunning(false); setResult(null); setRepairs(null); setUndo(null); }
    applying.current = false;
  }, [featuresLayer?.imageData]);
  useEffect(() => () => worker.current?.terminate(), []);
  const run = kind => {
    const image = featuresLayer?.imageData;
    if (!image || running) return;
    worker.current?.terminate(); setRunning(true); setError('');
    const instance = new Worker(new URL('./riverRepairWorker.js', import.meta.url), { type: 'module' }); worker.current = instance;
    instance.onmessage = ({ data }) => {
      instance.terminate(); worker.current = null; setRunning(false);
      if (current.current !== image) return;
      if (data.error) { setError(data.error); return; }
      setResult(data.result);
      if (kind === 'repair') {
        const fixed = new ImageData(data.data, data.width, data.height);
        const patch = featuresLayer.hydroRiverPatch;
        const updatedPatch = patch ? { ...patch, entries: patch.entries.map(entry => [entry[0], ...entry.slice(1,5), ...fixed.data.subarray(entry[0], entry[0] + 4)]) } : null;
        setUndo({ imageData: image, hydroRiverPatch: patch }); setRepairs(data.repairs); applying.current = true;
        onLayerUpdate('features', { imageData: fixed, hydroRiverPatch: updatedPatch, visible: true, opacity: 0.9, dirty: true });
      }
    };
    instance.onerror = event => { instance.terminate(); worker.current = null; setRunning(false); setError(event.message || 'River repair failed. The layer was not changed.'); };
    instance.postMessage({ kind, image: { data: image.data, width: image.width, height: image.height } });
  };
  return { result, repairs, running, error, undo, check: () => run('check'), repair: () => run('repair'),
    restore: () => { if (!undo) return; onLayerUpdate('features', { ...undo, dirty: true }); setUndo(null); } };
}