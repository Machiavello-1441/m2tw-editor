import { useCallback, useEffect, useState } from 'react';
import useOsmPackWorker from '@/components/newmap/osmpacks/useOsmPackWorker';

const empty = { packs: [], classes: [], preferences: {}, warning: '' };
export default function useOsmRegionalPacks(bbox) {
  const worker = useOsmPackWorker(bbox);
  const [summary, setSummary] = useState(empty), [preferences, setPreferences] = useState({});
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const initialized = worker.ready?.key === worker.key && !worker.ready.error;
  useEffect(() => {
    if (!worker.ready || worker.ready.key !== worker.key) return;
    if (worker.ready.error) { setError(worker.ready.error); return; }
    setSummary(worker.ready.result); setPreferences(worker.ready.result.preferences || {}); setBusy(false);
    setMessage(worker.ready.result.packs.length ? 'Restored regional polygons from this browser. Apply classes when ready.' : '');
  }, [worker.ready, worker.key]);
  useEffect(() => {
    if (!initialized || busy || !summary.packs.length) return;
    let active = true;
    const timer = setTimeout(() => {
      worker.request({ kind: 'preferences', preferences }).then(result => {
        if (active && result.warning) setSummary(current => ({ ...current, warning: result.warning }));
      }).catch(reason => { if (active && reason.name !== 'AbortError') setError(reason.message); });
    }, 700);
    return () => { active = false; clearTimeout(timer); };
  }, [initialized, busy, preferences, summary.packs.length, worker.request]);
  const perform = useCallback(async (payload, transfer = []) => {
    setBusy(true); setError(''); setMessage('');
    try { return await worker.request(payload, transfer); }
    catch (reason) { if (reason.name !== 'AbortError') setError(reason.message); return null; }
    finally { setBusy(false); }
  }, [worker.request]);
  const loadFiles = async files => {
    if (!files.length) return;
    const result = await perform({ kind: 'import', files });
    if (result) { setSummary(result); setMessage(`Imported ${result.packs.length} regional pack(s); ${result.classes.filter(item => item.count).length} area classes overlap this map.`); }
  };
  const clear = async () => {
    const result = await perform({ kind: 'clear' });
    if (result) { setSummary(result); setPreferences({}); setMessage('Loaded data and local cache cleared. Existing painted ground is unchanged.'); }
    return !!result;
  };
  return { ...worker, initialized, summary, preferences, setPreferences, busy, error, setError, message, setMessage, perform, loadFiles, clear };
}