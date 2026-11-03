import { useCallback, useEffect, useRef, useState } from 'react';
import { bboxKey } from '@/components/newmap/osmpacks/osmPackGeometry';

export default function useOsmPackWorker(bbox) {
  const worker = useRef(null), pending = useRef(new Map()), serial = useRef(0);
  const [restart, setRestart] = useState(0), [progress, setProgress] = useState(null), [ready, setReady] = useState(null);
  const key = bboxKey(bbox);
  const request = useCallback((payload, transfer = []) => new Promise((resolve, reject) => {
    if (!worker.current) { reject(new Error('Select a map area first.')); return; }
    const id = ++serial.current; pending.current.set(id, { resolve, reject }); worker.current.postMessage({ ...payload, id }, transfer);
  }), []);
  useEffect(() => {
    setReady(null); setProgress(null);
    if (!bbox) return;
    const instance = new Worker(new URL('./osmPackWorker.js', import.meta.url), { type: 'module' });
    worker.current = instance;
    instance.onmessage = ({ data }) => {
      const job = pending.current.get(data.id); if (!job) return;
      if (data.progress) { setProgress(data.progress); return; }
      pending.current.delete(data.id);
      if (data.error) job.reject(new Error(data.error)); else job.resolve(data.result);
    };
    instance.onerror = event => {
      const message = event.message || 'Regional processing stopped. Try smaller subregions.';
      pending.current.forEach(job => job.reject(new Error(message))); pending.current.clear();
      instance.terminate(); worker.current = null; setReady({ key, error: message });
    };
    let active = true;
    request({ kind: 'restore', bbox }).then(result => { if (active) setReady({ key, result }); }).catch(error => { if (active) setReady({ key, error: error.message }); });
    return () => {
      active = false; instance.terminate(); worker.current = null;
      pending.current.forEach(job => job.reject(new DOMException('Operation cancelled.', 'AbortError'))); pending.current.clear();
    };
  }, [key, restart, request]); // The key captures geographic values, not the parent's changing object identity.
  const cancel = useCallback(() => setRestart(value => value + 1), []);
  return { request, progress, ready, cancel, key };
}