import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import CampaignRecoveryController from '@/components/map/CampaignRecoveryController';
import { campaignLibrary } from '@/components/map/campaignLibrary';
import { isUndoStorageEvent } from '@/components/map/campaignUndoStorage';
import { FILES_CHANGED_EVENT } from '@/lib/modFileRegistry';
import { captureRecoveryInputs, sameRecoveryInputs } from '@/components/map/campaignRecoveryInputs';

export default function useCampaignRecovery(snapshot, active, enabled, protect) {
  const [status, setStatus] = useState({ pending: false, savedAt: null, error: '' });
  const current = useRef(null), controller = useRef(null), observed = useRef(null);
  current.current = { snapshot, enabled, protect, library: campaignLibrary(),
    id: active || snapshot.stratData?.campaignName || 'campaign',
    ready: Boolean(snapshot.stratData || snapshot.regionsData || Object.values(snapshot.layers).some(layer => layer.data)) };
  if (!controller.current) controller.current = new CampaignRecoveryController(() => current.current, setStatus);
  // Check actual draft changes, not a variable-length positional dependency list.
  // Store the observation before notifying React so status updates cannot retrigger it.
  useLayoutEffect(() => {
    const next = captureRecoveryInputs(snapshot, active, enabled);
    if (sameRecoveryInputs(observed.current, next)) return;
    observed.current = next;
    controller.current.changed();
  });
  useEffect(() => {
    const writer = controller.current;
    writer.notify = setStatus;
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