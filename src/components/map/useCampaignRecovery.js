import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import CampaignRecoveryController from '@/components/map/CampaignRecoveryController';
import { campaignLibrary } from '@/components/map/campaignLibrary';
import { isUndoStorageEvent } from '@/components/map/campaignUndoStorage';
import { FILES_CHANGED_EVENT } from '@/lib/modFileRegistry';

export default function useCampaignRecovery(snapshot, active, enabled, protect) {
  const [status, setStatus] = useState({ pending: false, savedAt: null, error: '' });
  const current = useRef(null), controller = useRef(null);
  current.current = { snapshot, enabled, protect, library: campaignLibrary(),
    id: active || snapshot.stratData?.campaignName || 'campaign',
    ready: Boolean(snapshot.stratData || snapshot.regionsData || Object.values(snapshot.layers).some(layer => layer.data)) };
  if (!controller.current) controller.current = new CampaignRecoveryController(() => current.current, setStatus);
  const { layers, ...model } = snapshot;
  // Ignore bitmap rebuilds and viewport chrome; watch editable state and pixel identities.
  const dependencies = [enabled, active, ...Object.values(model), ...Object.values(layers).flatMap(layer => [layer.data, layer.width, layer.height])];
  useLayoutEffect(() => { controller.current.changed(); }, dependencies);
  useEffect(() => {
    const writer = controller.current;
    const changed = event => { if (isUndoStorageEvent(event)) writer.changed(); };
    const flush = () => { if (current.current.enabled) void writer.flush(); };
    const hidden = () => { if (document.visibilityState === 'hidden') flush(); };
    const beforeUnload = event => {
      if (current.current.ready && (current.current.protect || writer.revision > writer.durable)) {
        event.preventDefault(); event.returnValue = '';
      }
    };
    window.addEventListener(FILES_CHANGED_EVENT, changed);
    window.addEventListener('beforeunload', beforeUnload);
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      writer.pause(); writer.notify = () => {};
      if (current.current.enabled) void writer.flush();
      window.removeEventListener(FILES_CHANGED_EVENT, changed);
      window.removeEventListener('beforeunload', beforeUnload);
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', hidden);
    };
  }, []);
  return { status, flush: () => controller.current.flush(), committed: () => controller.current.committed() };
}