import { useEffect, useRef, useState } from 'react';
import { captureCampaignStorage } from '@/components/map/campaignSession';
import { campaignStorageChanged, writeCampaignRecovery } from '@/components/map/campaignRecovery';

export default function useCampaignRecovery(snapshot, enabled, modName, active) {
  const [status, setStatus] = useState({ phase: 'idle' });
  const current = useRef();
  current.current = { snapshot, enabled, modName, active };
  const pending = useRef(false), writing = useRef(false), stored = useRef(null), mounted = useRef(true);
  const flush = async () => {
    const value = current.current;
    if (!value.enabled) return;
    if (!(value.snapshot.stratData || value.snapshot.regionsData || Object.values(value.snapshot.layers).some(layer => layer.data))) { pending.current = false; return; }
    if (writing.current) { pending.current = true; return; }
    writing.current = true; pending.current = false;
    const storage = captureCampaignStorage();
    if (mounted.current) setStatus({ phase: 'saving' });
    try {
      const savedAt = await writeCampaignRecovery(value.snapshot, storage, value.modName, value.active);
      stored.current = storage;
      if (mounted.current) setStatus({ phase: 'saved', savedAt });
    } catch (error) {
      if (mounted.current) setStatus({ phase: 'error', error: error.message });
    } finally { writing.current = false; if (pending.current) flush(); }
  };
  const save = useRef(flush); save.current = flush;
  useEffect(() => {
    if (!enabled || !(snapshot.stratData || snapshot.regionsData || Object.values(snapshot.layers).some(layer => layer.data))) return;
    pending.current = true;
    const timer = setTimeout(() => save.current(), 500);
    return () => clearTimeout(timer);
  }, [enabled, snapshot.layers, snapshot.stratData, snapshot.regionsData, snapshot.settlementNames, snapshot.overlayItems, snapshot.editedSettlements, snapshot.dirtyLayers, snapshot.overlayDirty, snapshot.osmBbox, snapshot.factionColors, snapshot.descrNames, snapshot.edbData, snapshot.savedSnapshot]);
  useEffect(() => {
    mounted.current = true;
    const interval = setInterval(() => {
      if (current.current.enabled && (pending.current || campaignStorageChanged(captureCampaignStorage(), stored.current))) save.current();
    }, 2000);
    const hidden = () => { if (document.hidden) save.current(); };
    const warn = event => { if (pending.current || writing.current) { event.preventDefault(); event.returnValue = ''; } };
    document.addEventListener('visibilitychange', hidden); window.addEventListener('beforeunload', warn);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', hidden); window.removeEventListener('beforeunload', warn); mounted.current = false; save.current(); };
  }, []);
  return status;
}