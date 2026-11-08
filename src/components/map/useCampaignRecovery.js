import { useEffect, useRef, useState } from 'react';
import CampaignRecoveryController from '@/components/map/CampaignRecoveryController';
import { campaignLibrary } from '@/components/map/campaignLibrary';
import campaignAutoSaveLifecycle from '@/components/map/campaignAutoSaveLifecycle';
import { captureRecoveryInputs, sameRecoveryInputs } from '@/components/map/campaignRecoveryInputs';

export default function useCampaignRecovery(snapshot, active, enabled, protect) {
  const [status, setStatus] = useState({ pending: false, savedAt: null, error: '' });
  const current = useRef(null), controller = useRef(null), observed = useRef(null);
  current.current = { snapshot, enabled, protect, library: campaignLibrary(),
    id: active || snapshot.stratData?.campaignName || 'campaign',
    ready: Boolean(snapshot.stratData || snapshot.regionsData || Object.values(snapshot.layers).some(layer => layer.data)) };
  if (!controller.current) controller.current = new CampaignRecoveryController(() => current.current, setStatus);
  // Recovery is background work: never dispatch status updates during layout.
  // Observe before notifying, so the resulting status render is not another edit.
  useEffect(() => {
    const next = captureRecoveryInputs(snapshot, active, enabled);
    if (sameRecoveryInputs(observed.current, next)) return;
    observed.current = next;
    controller.current.changed();
  });
  useEffect(() => {
    const writer = controller.current;
    writer.notify = setStatus;
    const stopAutoSave = campaignAutoSaveLifecycle(writer, current);
    return () => {
      stopAutoSave();
      writer.pause(); writer.notify = () => {};
      if (current.current.enabled) void writer.flush();
    };
  }, []);
  return { status, flush: () => controller.current.flush(), committed: () => controller.current.committed() };
}